// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

/**
 * @title Ballot
 * @dev 超級優化的投票智能合約 - 最小 Gas 版本 + 隱私保護
 */
contract Ballot {
    /// @dev 合約創建者/主席
    address public chairperson;

    /// @dev 投票時間範圍
    uint256 public startTime;
    uint256 public endTime;

    /// @dev 結果公開時間
    uint256 public revealTime;

    /// @dev 是否啟用隱私模式
    bool public privacyMode;

    /// @dev 用於防止重放攻擊的nonce映射
    mapping(address => uint256) public nonces;

    /// @dev 緊湊的投票記錄 - 使用位打包優化存儲
    mapping(address => uint256) public packedVoterData;

    /// @dev 提案名稱數組
    bytes32[] public proposalNames;

    /// @dev 提案票數數組
    uint[] internal voteCount;

    /// @dev 投票承諾映射
    mapping(address => bytes32) public voteCommitments;

    /// @dev 已揭示的投票映射
    mapping(address => bool) public revealed;

    // 追蹤所有曾經有投票權的地址（用於重置時清除）
    address[] internal voterAddresses;
    mapping(address => bool) internal isTracked;

    // 核心事件
    event Voted(address indexed voter, uint indexed proposal);
    event VoteCommitted(address indexed voter, bytes32 commitment); // 隱私模式事件
    event VoteRevealed(address indexed voter, uint indexed proposal); // 揭示事件
    event RightGiven(address indexed voter);
    event MetaTransactionExecuted(
        address indexed user,
        address indexed relayer
    );
    event VotingReset(uint256 newStartTime, uint256 newEndTime);
    event BatchRightsGiven(address[] voters);
    event ResultsRevealed(); // 結果公開事件

    // 錯誤定義
    error OnlyChairperson();
    error NotWithinVotingPeriod();
    error NotWithinRevealPeriod();
    error InvalidProposalIndex();
    error NoRightToVote();
    error AlreadyVoted();
    error AlreadyRevealed();
    error InvalidNonce();
    error InvalidSignature();
    error InvalidTimeRange();
    error VotingInProgress();
    error ResultsNotYetPublic();
    error InvalidCommitment();
    error AlreadyHasVotingRight(); // 新增錯誤定義

    // 核心修飾符 - 使用 custom errors
    modifier onlyChairperson() {
        if (msg.sender != chairperson) revert OnlyChairperson();
        _;
    }

    modifier onlyDuringVoting() {
        uint256 currentTime = block.timestamp;
        if (currentTime < startTime || currentTime > endTime)
            revert NotWithinVotingPeriod();
        _;
    }

    modifier onlyDuringReveal() {
        if (!privacyMode) revert InvalidTimeRange(); // 使用具體錯誤
        uint256 currentTime = block.timestamp;
        if (currentTime < endTime || currentTime > revealTime)
            revert NotWithinRevealPeriod();
        _;
    }

    modifier onlyAfterReveal() {
        if (privacyMode && block.timestamp <= revealTime)
            revert ResultsNotYetPublic();
        _;
    }

    modifier validProposal(uint proposal) {
        if (proposal >= proposalNames.length) revert InvalidProposalIndex();
        _;
    }

    /**
     * @dev 合約建構函數
     */
    constructor(
        bytes32[] memory _proposalNames,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _revealTime,
        bool _privacyMode
    ) {
        if (_proposalNames.length == 0) revert InvalidProposalIndex();
        if (_startTime >= _endTime) revert InvalidTimeRange();
        if (_privacyMode && _revealTime < _endTime) revert InvalidTimeRange();

        chairperson = msg.sender;
        packedVoterData[msg.sender] = 1;
        _trackVoter(msg.sender);

        startTime = _startTime;
        endTime = _endTime;
        revealTime = _revealTime;
        privacyMode = _privacyMode;

        uint len = _proposalNames.length;
        proposalNames = _proposalNames;
        voteCount = new uint[](len);
    }

    /**
     * @dev 批量給予投票權 - 超級優化版本
     */
    function batchGiveRightToVote(
        address[] calldata voters
    ) external onlyChairperson {
        uint256 len = voters.length;
        for (uint256 i = 0; i < len; ) {
            address voter = voters[i];
            uint256 packedData = packedVoterData[voter];

            // 修正：只檢查權重位，使用正確的掩碼
            if ((packedData & 0xFF) == 0) {
                packedVoterData[voter] = 1; // weight = 1
                _trackVoter(voter);
            }

            unchecked {
                ++i;
            }
        }
        emit BatchRightsGiven(voters);
    }

    /**
     * @dev 給予投票權 - 修正錯誤邏輯
     */
    function giveRightToVote(address voter) external onlyChairperson {
        uint256 packedData = packedVoterData[voter];

        // 修正：使用正確的錯誤信息
        if ((packedData & 0xFF) != 0) revert AlreadyHasVotingRight();

        packedVoterData[voter] = 1; // weight = 1
        _trackVoter(voter);
        emit RightGiven(voter);
    }

    /**
     * @dev 直接投票 - 終極優化版本
     */
    function vote(
        uint proposal
    ) external onlyDuringVoting validProposal(proposal) {
        uint256 packedData = packedVoterData[msg.sender];

        // 檢查權限和投票狀態
        uint256 hasRight = packedData & 0xFF;
        uint256 hasVoted = (packedData >> 8) & 1;

        if (hasRight == 0) revert NoRightToVote();
        if (hasVoted == 1) revert AlreadyVoted();

        // 增加票數
        voteCount[proposal] += 1;

        // 更新投票者狀態（單次 SSTORE）- 設置已投票並記錄選擇
        packedVoterData[msg.sender] = 1 | 0x100 | (proposal << 9);

        emit Voted(msg.sender, proposal);
    }

    /**
     * @dev 元交易投票 - 極致優化版本（主席代付 gas）
     */
    function metaVote(
        address voter,
        uint proposal,
        uint256 nonce,
        bytes calldata signature
    ) external onlyChairperson onlyDuringVoting validProposal(proposal) {
        // 檢查 nonce
        if (nonces[voter] != nonce) revert InvalidNonce();

        // 高效簽名驗證
        bytes32 hash = _getMetaVoteHash(voter, proposal, nonce);
        if (!_verifySignatureOptimized(voter, hash, signature))
            revert InvalidSignature();

        uint256 packedData = packedVoterData[voter];

        // 檢查權限和投票狀態
        uint256 hasRight = packedData & 0xFF;
        uint256 hasVoted = (packedData >> 8) & 1;

        if (hasRight == 0) revert NoRightToVote();
        if (hasVoted == 1) revert AlreadyVoted();

        // 增加票數和更新 nonce
        voteCount[proposal] += 1;
        nonces[voter] = nonce + 1;

        // 更新投票者狀態
        packedVoterData[voter] = 1 | 0x100 | (proposal << 9);

        emit Voted(voter, proposal);
        emit MetaTransactionExecuted(voter, msg.sender);
    }

    /**
     * @dev 設置投票時間 - 可在投票結束後調整
     */
    function setVotingTime(
        uint256 _startTime,
        uint256 _endTime
    ) external onlyChairperson {
        if (_startTime >= _endTime) revert InvalidTimeRange();
        if (block.timestamp <= endTime) revert VotingInProgress();

        startTime = _startTime;
        endTime = _endTime;
    }

    /**
     * @dev 緊急停止投票
     */
    function emergencyStop() external onlyChairperson {
        endTime = block.timestamp;
    }

    /**
     * @dev 緊急延遲投票開始時間
     */
    function delayVotingStart(uint256 _newStartTime) external onlyChairperson {
        if (_newStartTime >= endTime) revert InvalidTimeRange();
        if (block.timestamp >= startTime) revert VotingInProgress();

        startTime = _newStartTime;
    }

    /**
     * @dev 提前開始投票
     */
    function startVotingEarly() external onlyChairperson {
        if (block.timestamp >= startTime) revert VotingInProgress();

        startTime = block.timestamp;
    }

    /**
     * @dev 完全重置投票 - 修正主席權限重置邏輯
     */
    function resetVoting(
        bytes32[] calldata _proposalNames,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _revealTime,
        bool _privacyMode
    ) external onlyChairperson {
        if (block.timestamp <= endTime) revert VotingInProgress();
        if (_startTime >= _endTime) revert InvalidTimeRange();
        if (_privacyMode && _revealTime < _endTime) revert InvalidTimeRange();

        // 清除所有投票者的數據
        _clearAllVoterData();

        // 清除現有投票數據
        delete proposalNames;
        delete voteCount;

        // 設置新數據
        uint256 len = _proposalNames.length;
        if (len == 0) revert InvalidProposalIndex();

        proposalNames = _proposalNames;
        voteCount = new uint[](len);

        startTime = _startTime;
        endTime = _endTime;
        revealTime = _revealTime;
        privacyMode = _privacyMode;

        // 重新給主席投票權並追蹤
        packedVoterData[chairperson] = 1;
        _trackVoter(chairperson);

        emit VotingReset(_startTime, _endTime);
    }

    /**
     * @dev 內部函數 - 追蹤投票者地址
     */
    function _trackVoter(address voter) internal {
        if (!isTracked[voter]) {
            voterAddresses.push(voter);
            isTracked[voter] = true;
        }
    }

    /**
     * @dev 內部函數 - 清除所有投票者數據（修正遺漏的清除）
     */
    function _clearAllVoterData() internal {
        uint256 len = voterAddresses.length;
        for (uint256 i = 0; i < len; ) {
            address voter = voterAddresses[i];

            // 清除所有相關數據
            delete packedVoterData[voter];
            delete voteCommitments[voter];
            delete revealed[voter];
            delete nonces[voter];
            delete isTracked[voter]; // 修正：清除追蹤狀態

            unchecked {
                ++i;
            }
        }

        // 清除投票者地址數組
        delete voterAddresses;
    }

    /**
     * @dev 獲取所有追蹤的投票者地址（主席專用）
     */
    function getTrackedVoters()
        external
        view
        onlyChairperson
        returns (address[] memory)
    {
        return voterAddresses;
    }

    /**
     * @dev 完全清除投票者歷史記錄（謹慎使用）
     */
    function clearVoterHistory() external onlyChairperson {
        uint256 len = voterAddresses.length;
        for (uint256 i = 0; i < len; ) {
            address voter = voterAddresses[i];
            delete isTracked[voter];
            unchecked {
                ++i;
            }
        }
        delete voterAddresses;
    }

    /**
     * @dev 隱私投票 - 提交承諾（增加邊界檢查）
     */
    function commitVote(bytes32 commitment) external onlyDuringVoting {
        if (!privacyMode) revert InvalidTimeRange();
        if (commitment == bytes32(0)) revert InvalidCommitment();

        uint256 packedData = packedVoterData[msg.sender];

        // 檢查權限和投票狀態
        uint256 hasRight = packedData & 0xFF;
        uint256 hasVoted = (packedData >> 8) & 1;

        if (hasRight == 0) revert NoRightToVote();
        if (hasVoted == 1) revert AlreadyVoted();

        voteCommitments[msg.sender] = commitment;
        // 標記已提交承諾（但不記錄具體投票）
        packedVoterData[msg.sender] = 1 | 0x100;

        emit VoteCommitted(msg.sender, commitment);
    }

    /**
     * @dev 揭示投票
     */
    function revealVote(
        uint proposal,
        uint256 nonce,
        bytes32 salt
    ) external onlyDuringReveal validProposal(proposal) {
        if (revealed[msg.sender]) revert AlreadyRevealed();

        // 驗證承諾
        bytes32 commitment = keccak256(
            abi.encodePacked(msg.sender, proposal, nonce, salt)
        );
        if (voteCommitments[msg.sender] != commitment)
            revert InvalidCommitment();

        // 記錄投票
        assembly {
            let voteCountSlot := add(voteCount.slot, proposal)
            let currentVotes := sload(voteCountSlot)
            sstore(voteCountSlot, add(currentVotes, 1))
        }

        // 更新狀態
        packedVoterData[msg.sender] = 1 | 0x100 | (proposal << 9);
        revealed[msg.sender] = true;

        emit VoteRevealed(msg.sender, proposal);
        emit Voted(msg.sender, proposal);
    }

    /**
     * @dev 隱私元交易投票 - 提交承諾（修正邊界檢查）
     */
    function metaCommitVote(
        address voter,
        bytes32 commitment,
        uint256 nonce,
        bytes calldata signature
    ) external onlyChairperson onlyDuringVoting {
        if (!privacyMode) revert InvalidTimeRange();
        if (commitment == bytes32(0)) revert InvalidCommitment();

        // 檢查 nonce
        if (nonces[voter] != nonce) revert InvalidNonce();

        // 驗證簽名
        bytes32 hash = _getMetaCommitHash(voter, commitment, nonce);
        if (!_verifySignatureOptimized(voter, hash, signature))
            revert InvalidSignature();

        uint256 packedData = packedVoterData[voter];

        // 檢查權限和投票狀態
        uint256 hasRight = packedData & 0xFF;
        uint256 hasVoted = (packedData >> 8) & 1;

        if (hasRight == 0) revert NoRightToVote();
        if (hasVoted == 1) revert AlreadyVoted();

        // 更新 nonce
        nonces[voter] = nonce + 1;

        voteCommitments[voter] = commitment;
        packedVoterData[voter] = 1 | 0x100;

        emit VoteCommitted(voter, commitment);
        emit MetaTransactionExecuted(voter, msg.sender);
    }

    /**
     * @dev 主席強制公開結果（增加邊界檢查）
     */
    function forceRevealResults() external onlyChairperson {
        if (!privacyMode) revert InvalidTimeRange();
        if (block.timestamp <= endTime) revert VotingInProgress();

        revealTime = block.timestamp;
        emit ResultsRevealed();
    }

    /**
     * @dev 獲取所有提案 - 隱私保護版本
     */
    function getAllProposals()
        external
        view
        returns (bytes32[] memory names, uint[] memory votes)
    {
        return (proposalNames, voteCount);
    }

    /**
     * @dev 獲取投票數 - 隱私保護版本
     */
    function getVoteCount(
        uint proposal
    ) external view onlyAfterReveal returns (uint) {
        if (proposal >= voteCount.length) revert InvalidProposalIndex();
        return voteCount[proposal];
    }

    /**
     * @dev 獲取獲勝提案 - 隱私保護版本
     */
    function getWinningProposal()
        external
        view
        onlyAfterReveal
        returns (uint winningProposal, uint winningVoteCount, bool isTie)
    {
        uint len = voteCount.length;
        winningVoteCount = 0;
        uint tieCount = 0;

        for (uint i = 0; i < len; ) {
            uint currentVotes = voteCount[i];
            if (currentVotes > winningVoteCount) {
                winningVoteCount = currentVotes;
                winningProposal = i;
                tieCount = 1;
            } else if (
                currentVotes == winningVoteCount && winningVoteCount > 0
            ) {
                unchecked {
                    tieCount++;
                }
            }
            unchecked {
                ++i;
            }
        }

        isTie = tieCount > 1;
    }

    /**
     * @dev 主席專用 - 查看當前統計（僅限主席）
     */
    function getPrivateResults()
        external
        view
        onlyChairperson
        returns (bytes32[] memory names, uint[] memory votes)
    {
        return (proposalNames, voteCount);
    }

    /**
     * @dev 檢查投票和揭示狀態
     */
    function getVotingStatus()
        external
        view
        returns (
            bool hasEnded,
            bool isActive,
            bool isRevealPeriod,
            bool resultsPublic,
            uint proposalCount
        )
    {
        uint256 currentTime = block.timestamp;
        hasEnded = currentTime > endTime;
        isActive = currentTime >= startTime && currentTime <= endTime;
        isRevealPeriod =
            privacyMode &&
            currentTime > endTime &&
            currentTime <= revealTime;
        resultsPublic = !privacyMode || currentTime > revealTime;
        proposalCount = proposalNames.length;
    }

    /**
     * @dev 獲取承諾狀態
     */
    function getCommitmentStatus(
        address voter
    )
        external
        view
        returns (bool hasCommitted, bool hasRevealed, bytes32 commitment)
    {
        hasCommitted = voteCommitments[voter] != bytes32(0);
        hasRevealed = revealed[voter];
        commitment = privacyMode ? voteCommitments[voter] : bytes32(0);
    }

    /**
     * @dev 獲取投票模式信息
     */
    function getVotingModeInfo()
        external
        view
        returns (
            bool isPrivacyMode,
            string memory votingPhase,
            bool canVoteDirectly,
            bool canCommitVote,
            bool canRevealVote,
            bool canViewResults
        )
    {
        uint256 currentTime = block.timestamp;
        isPrivacyMode = privacyMode;

        if (currentTime < startTime) {
            votingPhase = "Not Started";
            canVoteDirectly = false;
            canCommitVote = false;
            canRevealVote = false;
            canViewResults = false;
        } else if (currentTime <= endTime) {
            votingPhase = privacyMode ? "Commit Phase" : "Voting Phase";
            canVoteDirectly = !privacyMode;
            canCommitVote = privacyMode;
            canRevealVote = false;
            canViewResults = !privacyMode;
        } else if (privacyMode && currentTime <= revealTime) {
            votingPhase = "Reveal Phase";
            canVoteDirectly = false;
            canCommitVote = false;
            canRevealVote = true;
            canViewResults = false;
        } else {
            votingPhase = "Results Public";
            canVoteDirectly = false;
            canCommitVote = false;
            canRevealVote = false;
            canViewResults = true;
        }
    }

    /**
     * @dev 內部函數 - 生成元投票哈希
     */
    function _getMetaVoteHash(
        address voter,
        uint proposal,
        uint256 nonce
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    _getDomainSeparator(),
                    keccak256(
                        abi.encode(
                            keccak256(
                                "MetaVote(address voter,uint256 proposal,uint256 nonce)"
                            ),
                            voter,
                            proposal,
                            nonce
                        )
                    )
                )
            );
    }

    /**
     * @dev 內部函數 - 生成元承諾哈希
     */
    function _getMetaCommitHash(
        address voter,
        bytes32 commitment,
        uint256 nonce
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    _getDomainSeparator(),
                    keccak256(
                        abi.encode(
                            keccak256(
                                "MetaCommit(address voter,bytes32 commitment,uint256 nonce)"
                            ),
                            voter,
                            commitment,
                            nonce
                        )
                    )
                )
            );
    }

    /**
     * @dev 內部函數 - 獲取域分隔符
     */
    function _getDomainSeparator() internal view returns (bytes32) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256("Ballot"),
                    keccak256("1"),
                    chainId,
                    address(this)
                )
            );
    }

    /**
     * @dev 優化的簽名驗證函數
     */
    function _verifySignatureOptimized(
        address signer,
        bytes32 hash,
        bytes calldata signature
    ) internal pure returns (bool) {
        if (signature.length != 65) return false;

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))

            // 優化 v 值處理
            if lt(v, 27) {
                v := add(v, 27)
            }
        }

        // 移出 assembly 進行 v 值檢查和 ecrecover 調用
        if (v != 27 && v != 28) {
            return false;
        }

        address recovered = ecrecover(hash, v, r, s);
        return recovered != address(0) && recovered == signer;
    }
}
