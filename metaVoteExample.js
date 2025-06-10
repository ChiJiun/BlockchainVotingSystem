const { ethers } = require("ethers");

/**
 * MetaVote 簽署範例
 * 示範如何為投票合約創建 EIP-712 簽名
 */

// EIP-712 Domain 定義
const DOMAIN_TYPE = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

// MetaVote 類型定義
const META_VOTE_TYPE = [
  { name: "voter", type: "address" },
  { name: "proposal", type: "uint256" },
  { name: "nonce", type: "uint256" },
];

/**
 * 創建 MetaVote 簽名
 * @param {Object} signer - ethers.js 簽名者
 * @param {string} contractAddress - 合約地址
 * @param {number} chainId - 鏈 ID
 * @param {string} voterAddress - 投票者地址
 * @param {number} proposalIndex - 提案索引
 * @param {number} nonce - 用戶當前 nonce
 * @returns {Promise<string>} 簽名字符串
 */
async function createMetaVoteSignature(
  signer,
  contractAddress,
  chainId,
  voterAddress,
  proposalIndex,
  nonce
) {
  // 定義域
  const domain = {
    name: "Ballot",
    version: "1",
    chainId: chainId,
    verifyingContract: contractAddress,
  };

  // 定義要簽名的數據
  const value = {
    voter: voterAddress,
    proposal: proposalIndex,
    nonce: nonce,
  };

  // 使用 EIP-712 簽名
  const signature = await signer._signTypedData(
    domain,
    { MetaVote: META_VOTE_TYPE },
    value
  );

  return signature;
}

/**
 * 驗證簽名（可選）
 */
function verifySignature(
  signature,
  voterAddress,
  proposalIndex,
  nonce,
  contractAddress,
  chainId
) {
  const domain = {
    name: "Ballot",
    version: "1",
    chainId: chainId,
    verifyingContract: contractAddress,
  };

  const value = {
    voter: voterAddress,
    proposal: proposalIndex,
    nonce: nonce,
  };

  const recoveredAddress = ethers.utils.verifyTypedData(
    domain,
    { MetaVote: META_VOTE_TYPE },
    value,
    signature
  );

  return recoveredAddress.toLowerCase() === voterAddress.toLowerCase();
}

/**
 * 完整的 MetaVote 流程範例
 */
async function metaVoteExample() {
  // 假設的配置
  const provider = new ethers.providers.JsonRpcProvider(
    "http://localhost:8545"
  );
  const chairpersonWallet = new ethers.Wallet(
    "CHAIRPERSON_PRIVATE_KEY",
    provider
  );
  const voterWallet = new ethers.Wallet("VOTER_PRIVATE_KEY", provider);

  const contractAddress = "0x..."; // 合約地址
  const chainId = 1337; // 本地測試網

  // 創建合約實例
  const ballotContract = new ethers.Contract(
    contractAddress,
    BALLOT_ABI,
    chairpersonWallet
  );

  try {
    // 步驟 1: 獲取投票者的當前 nonce
    const currentNonce = await ballotContract.getUserNonce(voterWallet.address);
    console.log("當前 nonce:", currentNonce.toString());

    // 步驟 2: 投票者創建簽名
    const proposalIndex = 0; // 投票給第一個提案
    const signature = await createMetaVoteSignature(
      voterWallet,
      contractAddress,
      chainId,
      voterWallet.address,
      proposalIndex,
      currentNonce
    );

    console.log("簽名:", signature);

    // 步驟 3: 驗證簽名（可選）
    const isValidSignature = verifySignature(
      signature,
      voterWallet.address,
      proposalIndex,
      currentNonce,
      contractAddress,
      chainId
    );

    console.log("簽名有效性:", isValidSignature);

    // 步驟 4: 主席執行 metaVote（代付 gas）
    const tx = await ballotContract.metaVote(
      voterWallet.address,
      proposalIndex,
      currentNonce,
      signature
    );

    console.log("交易哈希:", tx.hash);

    // 等待交易確認
    const receipt = await tx.wait();
    console.log("交易已確認，區塊:", receipt.blockNumber);

    // 驗證投票結果
    const voterDetails = await ballotContract.getVoterDetails(
      voterWallet.address
    );
    console.log("投票者詳情:", {
      weight: voterDetails.weight.toString(),
      voted: voterDetails.voted,
      proposalVote: voterDetails.proposalVote.toString(),
    });
  } catch (error) {
    console.error("MetaVote 失敗:", error.message);
  }
}

/**
 * 完整的用戶簽署流程
 * @param {Object} ballotContract - 合約實例
 * @param {Object} userSigner - 用戶簽名者
 * @param {number} proposalIndex - 提案索引
 * @returns {Promise<Object>} 簽名數據
 */
async function createUserVoteSignature(
  ballotContract,
  userSigner,
  proposalIndex
) {
  try {
    // 1. 獲取必要信息
    const userAddress = await userSigner.getAddress();
    const network = await userSigner.provider.getNetwork();
    const contractAddress = ballotContract.address;

    // 2. 檢查用戶是否有投票權
    const hasRight = await ballotContract.hasVotingRight(userAddress);
    if (!hasRight) {
      throw new Error("用戶沒有投票權");
    }

    // 3. 檢查是否已投票
    const hasVoted = await ballotContract.hasVoted(userAddress);
    if (hasVoted) {
      throw new Error("用戶已經投票過了");
    }

    // 4. 檢查投票時間
    const votingStatus = await ballotContract.getVotingStatus();
    if (!votingStatus.isActive) {
      throw new Error("不在投票時間內");
    }

    // 5. 獲取當前 nonce
    const nonce = await ballotContract.getUserNonce(userAddress);

    // 6. 創建簽名
    const signature = await createMetaVoteSignature(
      userSigner,
      contractAddress,
      network.chainId,
      userAddress,
      proposalIndex,
      nonce
    );

    // 7. 驗證簽名
    const isValid = verifySignature(
      signature,
      userAddress,
      proposalIndex,
      nonce,
      contractAddress,
      network.chainId
    );

    if (!isValid) {
      throw new Error("簽名驗證失敗");
    }

    console.log("✅ 簽名創建成功");

    return {
      voter: userAddress,
      proposal: proposalIndex,
      nonce: nonce.toString(),
      signature: signature,
      chainId: network.chainId,
      contractAddress: contractAddress,
    };
  } catch (error) {
    console.error("❌ 簽名創建失敗:", error.message);
    throw error;
  }
}

/**
 * 主席執行代付投票
 * @param {Object} ballotContract - 合約實例（主席連接）
 * @param {Object} voteData - 投票簽名數據
 * @returns {Promise<Object>} 交易結果
 */
async function executeMetaVote(ballotContract, voteData) {
  try {
    console.log("🚀 開始執行代付投票...");

    // 執行交易
    const tx = await ballotContract.metaVote(
      voteData.voter,
      voteData.proposal,
      voteData.nonce,
      voteData.signature,
      {
        gasLimit: 200000, // 設置 gas 限制
      }
    );

    console.log("📝 交易已提交:", tx.hash);

    // 等待確認
    const receipt = await tx.wait();

    console.log("✅ 投票成功！區塊:", receipt.blockNumber);
    console.log("💰 Gas 使用量:", receipt.gasUsed.toString());

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch (error) {
    console.error("❌ 代付投票失敗:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 前端使用範例（瀏覽器環境）
 */
async function browserMetaVoteExample() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    // 請求連接錢包
    await provider.send("eth_requestAccounts", []);

    const userAddress = await signer.getAddress();
    const network = await provider.getNetwork();

    // 創建簽名
    const signature = await createMetaVoteSignature(
      signer,
      contractAddress,
      network.chainId,
      userAddress,
      proposalIndex,
      nonce
    );

    // 將簽名發送給主席進行代付交易
    return {
      voter: userAddress,
      proposal: proposalIndex,
      nonce: nonce,
      signature: signature,
    };
  }
}

// 導出函數
module.exports = {
  createMetaVoteSignature,
  verifySignature,
  metaVoteExample,
  browserMetaVoteExample,
};

// 如果直接執行此文件
if (require.main === module) {
  metaVoteExample().catch(console.error);
}
