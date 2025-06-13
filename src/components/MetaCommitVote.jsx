import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractABI } from '../ABI.js';
import './MetaCommitVote.css';

const MetaCommitVote = ({ onCommitSuccess, onCommitError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [commitData, setCommitData] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [isSigningLoading, setIsSigningLoading] = useState(false);
  const [signatureData, setSignatureData] = useState(null);

  // 生成隨機數作為 nonce
  const generateNonce = () => {
    return ethers.randomBytes(32);
  };

  // 修正：生成正確格式的投票 nonce
  const generateVotingNonce = () => {
    // 產生 0 到 2^32-1 的隨機整數，確保是有效的 uint256
    return Math.floor(Math.random() * 4294967295);
  };

  // 生成承諾哈希
  const generateCommitHash = (userAddress, candidateId, nonce, salt) => {
    // 確保參數型別正確
    console.log('🔍 generateCommitHash 參數檢查:', {
      userAddress: typeof userAddress,
      candidateId: typeof candidateId,
      nonce: typeof nonce,
      salt: typeof salt,
      saltLength: salt.length
    });

    // 使用合約中的格式: keccak256(abi.encodePacked(voter, proposal, nonce, salt))
    return ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'bytes32'],
      [userAddress, candidateId, nonce, salt]
    );
  };

  // 創建 Wallet 實例（使用私鑰）
  const createWalletFromPrivateKey = () => {
    try {
      const privateKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY;
      const rpcUrl = import.meta.env.VITE_RPC_URL;

      if (!privateKey) {
        throw new Error('未設定私鑰環境變數 PRIVATE_KEY');
      }

      if (!rpcUrl) {
        throw new Error('未設定 RPC URL 環境變數 VITE_RPC_URL');
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      console.log('🔑 使用私鑰創建錢包，地址:', wallet.address);
      return wallet;

    } catch (error) {
      console.error('❌ 創建錢包失敗:', error);
      throw error;
    }
  };

  // 獲取所有提案/候選人
  const getAllProposals = async () => {
    try {
      setLoadingCandidates(true);
      console.log('📋 開始獲取候選人資料...');

      const rpcUrl = import.meta.env.VITE_RPC_URL;
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;

      if (!rpcUrl || !contractAddress) {
        throw new Error('缺少必要的環境變數配置');
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(contractAddress, contractABI, provider);

      const result = await contract.getAllProposals();
      console.log('📋 原始返回結果:', result);

      // 處理候選人資料
      let candidateNames = [];
      if (result[0]) {
        candidateNames = Array.from(result[0]);
      }

      const proposals = [];
      for (let i = 0; i < candidateNames.length; i++) {
        try {
          const b32 = candidateNames[i];
          
          if (!b32 || typeof b32 !== 'string' || !b32.startsWith('0x')) {
            continue;
          }
          
          if (b32 === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            continue;
          }
          
          let proposalName;
          try {
            proposalName = ethers.decodeBytes32String(b32);
          } catch (decodeError) {
            const hexString = b32.slice(2);
            const bytes = [];
            for (let j = 0; j < hexString.length; j += 2) {
              const byte = parseInt(hexString.substr(j, 2), 16);
              if (byte !== 0) bytes.push(byte);
            }
            proposalName = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
          }
          
          proposalName = proposalName.replace(/\0/g, '').trim();
          
          if (proposalName && proposalName !== '') {
            proposals.push({
              id: i,
              name: proposalName,
              description: ''
            });
          }
          
        } catch (itemError) {
          console.error(`❌ 處理候選人 ${i} 時發生錯誤:`, itemError.message);
        }
      }

      setCandidates(proposals);
      return proposals;
      
    } catch (error) {
      console.error("❌ 獲取候選人資料失敗：", error.message);
      setCandidates([]);
      return [];
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    getAllProposals();
  }, []);

  // 修正：生成 EIP-712 格式的消息哈希
  const generateMessageHash = async (voter, commitment, nonce) => {
    try {
      // 獲取鏈 ID
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      const chainId = network.chainId;
      
      // 域分隔符
      const domainSeparator = ethers.solidityPackedKeccak256(
        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
        [
          ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
          ethers.keccak256(ethers.toUtf8Bytes("Ballot")),
          ethers.keccak256(ethers.toUtf8Bytes("1")),
          chainId,
          commitData.contractAddress
        ]
      );
      
      // 類型哈希
      const typeHash = ethers.keccak256(
        ethers.toUtf8Bytes("MetaCommit(address voter,bytes32 commitment,uint256 nonce)")
      );
      
      // 結構哈希
      const structHash = ethers.solidityPackedKeccak256(
        ['bytes32', 'address', 'bytes32', 'uint256'],
        [typeHash, voter, commitment, nonce]
      );
      
      // 最終哈希（EIP-712 格式）
      const finalHash = ethers.solidityPackedKeccak256(
        ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
        ['0x19', '0x01', domainSeparator, structHash]
      );
      
      return finalHash;
    } catch (error) {
      console.error('❌ 生成 EIP-712 哈希失敗:', error);
      throw error;
    }
  };

  // 修正：使用 EIP-712 結構化簽名
  const handleSignMessage = async () => {
    if (!commitData) {
      alert('⚠️ 請先生成提交資料');
      return;
    }

    try {
      setIsSigningLoading(true);
      console.log('✍️ 開始 EIP-712 簽名流程...');

      // 連接到 MetaMask
      if (!window.ethereum) {
        throw new Error('請安裝 MetaMask 錢包');
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      
      console.log('✍️ MetaMask 簽名者地址:', signerAddress);
      console.log('👤 預期的投票者地址:', commitData.userAddress);
      
      // 確保簽名者就是投票者
      if (signerAddress.toLowerCase() !== commitData.userAddress.toLowerCase()) {
        throw new Error('請使用生成資料時的同一個 MetaMask 錢包進行簽名');
      }

      // 獲取鏈 ID
      const network = await provider.getNetwork();
      const chainId = network.chainId;

      // 🔑 使用 EIP-712 結構化簽名
      const domain = {
        name: "Ballot",
        version: "1",
        chainId: chainId,
        verifyingContract: commitData.contractAddress
      };

      const types = {
        MetaCommit: [
          { name: "voter", type: "address" },
          { name: "commitment", type: "bytes32" },
          { name: "nonce", type: "uint256" }
        ]
      };

      const value = {
        voter: commitData.userAddress,
        commitment: commitData.commitHash,
        nonce: commitData.onChainNonce
      };

      console.log('📝 EIP-712 簽名資料:', { domain, types, value });
      console.log('📱 即將彈出 MetaMask EIP-712 簽名視窗...');

      // 使用 _signTypedData 進行 EIP-712 簽名
      const signature = await signer.signTypedData(domain, types, value);
      
      console.log('✍️ 用戶完成 EIP-712 簽名:', signature);

      // 驗證 EIP-712 簽名
      try {
        const recoveredAddress = ethers.verifyTypedData(domain, types, value, signature);
        console.log('🔍 EIP-712 簽名驗證 - 恢復的地址:', recoveredAddress);
        console.log('🔍 EIP-712 簽名驗證 - 期望的地址:', commitData.userAddress);
        
        if (recoveredAddress.toLowerCase() !== commitData.userAddress.toLowerCase()) {
          throw new Error('EIP-712 簽名驗證失敗：地址不匹配');
        } else {
          console.log('✅ EIP-712 簽名驗證成功');
        }
      } catch (verifyError) {
        console.error('❌ EIP-712 簽名驗證失敗:', verifyError);
        throw new Error('EIP-712 簽名驗證失敗，請重新簽名');
      }

      const signatureDataObj = {
        signature: signature,
        signedAt: new Date().toISOString(),
        signerAddress: commitData.userAddress,
        signatureType: 'EIP-712'
      };

      setSignatureData(signatureDataObj);
      console.log('✅ EIP-712 簽名完成:', signatureDataObj);

      alert('✅ EIP-712 簽名成功！MetaMask 結構化簽名已完成，現在可以執行提交了。');

    } catch (error) {
      console.error('❌ EIP-712 簽名失敗:', error);
      
      let errorMessage = error.message;
      if (error.code === 4001 || error.code === 'ACTION_REJECTED' || error.code === 'USER_REJECTED') {
        errorMessage = '用戶取消了 MetaMask EIP-712 簽名操作';
      } else if (error.message && error.message.includes('rejected')) {
        errorMessage = 'MetaMask EIP-712 簽名被拒絕，請重新嘗試';
      } else if (error.message && error.message.includes('請安裝 MetaMask')) {
        errorMessage = '請安裝並啟用 MetaMask 錢包';
      } else if (error.message.includes('同一個 MetaMask 錢包')) {
        errorMessage = '請使用生成資料時的同一個 MetaMask 錢包進行簽名';
      } else if (error.message.includes('EIP-712 簽名驗證失敗')) {
        errorMessage = 'EIP-712 簽名驗證失敗，請確認錢包連接正確';
      }
      
      alert(`❌ EIP-712 簽名失敗: ${errorMessage}`);
    } finally {
      setIsSigningLoading(false);
    }
  };

  // 生成基礎提交資料（不包括簽名）
  const generateCommitData = async () => {
    try {
      setIsLoading(true);
      console.log('🔐 開始生成基礎提交資料...');

      if (!selectedCandidate) {
        throw new Error('請先選擇候選人');
      }

      // 檢查並連接 MetaMask - 這是投票者的錢包
      if (!window.ethereum) {
        throw new Error('請安裝 MetaMask 錢包');
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const metaMaskSigner = await provider.getSigner();
      const voterAddress = await metaMaskSigner.getAddress(); // 投票者地址

      console.log('👤 投票者地址 (MetaMask):', voterAddress);
      console.log('🗳️ 選擇的候選人:', selectedCandidate);

      // 生成隨機數據
      const votingNonce = generateVotingNonce();
      const salt = ethers.randomBytes(32);
      
      console.log('🎲 生成的投票 nonce:', votingNonce);
      console.log('🧂 生成的 salt:', ethers.hexlify(salt));

      // 生成承諾哈希 - 使用投票者地址
      const commitHash = generateCommitHash(voterAddress, selectedCandidate.id, votingNonce, salt);
      console.log('🔒 生成的承諾哈希:', commitHash);

      // 獲取投票者地址的鏈上 nonce
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      
      // 使用任何可用的 provider 來讀取合約數據
      let readContract;
      const privateKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY;
      if (privateKey) {
        // 使用私鑰錢包讀取（避免 MetaMask 彈窗）
        const adminWallet = createWalletFromPrivateKey();
        readContract = new ethers.Contract(contractAddress, contractABI, adminWallet);
      } else {
        // 使用 MetaMask
        readContract = new ethers.Contract(contractAddress, contractABI, metaMaskSigner);
      }
      
      const onChainNonce = await readContract.nonces(voterAddress);
      console.log('🔢 投票者的鏈上 nonce:', onChainNonce.toString());

      const commitDataObj = {
        candidateId: selectedCandidate.id,
        candidateName: selectedCandidate.name,
        nonce: votingNonce,
        salt: ethers.hexlify(salt),
        commitHash: commitHash,
        userAddress: voterAddress, // 投票者地址（MetaMask）
        contractAddress: contractAddress,
        timestamp: new Date().toISOString(),
        onChainNonce: onChainNonce.toString(),
        // 移除 messageHash，因為 EIP-712 簽名不需要預先生成
        revealData: {
          candidateId: selectedCandidate.id,
          nonce: votingNonce,
          salt: ethers.hexlify(salt)
        }
      };

      setCommitData(commitDataObj);
      console.log('📊 基礎提交資料:', commitDataObj);

      if (onCommitSuccess) {
        onCommitSuccess(commitDataObj);
      }

      return commitDataObj;

    } catch (error) {
      console.error('❌ 生成提交資料失敗:', error);
      if (onCommitError) {
        onCommitError(error);
      }
      setCommitData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 自動下載提交資料
  const autoDownloadCommitData = (commitDataWithTx) => {
    const dataStr = JSON.stringify(commitDataWithTx, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `commit_data_${commitDataWithTx.userAddress}_${commitDataWithTx.txHash || Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  // 修正：執行提交時使用管理員私鑰
  const executeCommit = async () => {
    if (!commitData) {
      alert('⚠️ 請先生成提交資料');
      return;
    }

    if (!signatureData) {
      alert('⚠️ 請先完成 MetaMask 簽名');
      return;
    }

    try {
      setIsLoading(true);
      console.log('📤 執行提交交易...');

      // 使用私鑰錢包提交交易（代付 Gas）
      const privateKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY;
      let signer;

      if (privateKey) {
        // 使用私鑰錢包提交交易
        signer = createWalletFromPrivateKey();
        console.log('🔑 使用管理員私鑰提交交易 (代付 Gas)');
        console.log('💰 交易發送者 (代付者):', signer.address);
      } else {
        // 備用：使用 MetaMask（但這樣用戶需要支付 Gas）
        const provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        console.log('🦊 使用 MetaMask 提交交易 (用戶支付 Gas)');
        console.log('💰 交易發送者:', await signer.getAddress());
      }

      const contract = new ethers.Contract(commitData.contractAddress, contractABI, signer);

      console.log('👤 投票者地址:', commitData.userAddress);

      // 檢查函數是否存在
      if (typeof contract.metaCommitVote !== 'function') {
        throw new Error('函數 metaCommitVote 在合約中不存在');
      }

      // 執行提交交易
      console.log('📋 調用參數:', {
        voter: commitData.userAddress,      // 投票者地址（MetaMask）
        commitment: commitData.commitHash,
        nonce: commitData.onChainNonce,
        signature: signatureData.signature
      });

      const tx = await contract.metaCommitVote(
        commitData.userAddress,     // voter（投票者 MetaMask 地址）
        commitData.commitHash,      // commitment  
        commitData.onChainNonce,    // nonce
        signatureData.signature     // signature
      );

      console.log('🚀 交易已提交:', tx.hash);
      console.log('⏳ 等待交易確認...');

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        console.log('✅ 提交成功！');
        console.log('📊 交易詳情:', {
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        });

        // 準備完整的提交資料
        const completeCommitData = {
          ...commitData,
          signature: signatureData.signature,
          signedAt: signatureData.signedAt,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          status: 'committed',
          submissionTime: new Date().toISOString()
        };

        // 保存和下載
        const storageKey = `commit_${commitData.userAddress}_${tx.hash}`;
        localStorage.setItem(storageKey, JSON.stringify(completeCommitData));
        autoDownloadCommitData(completeCommitData);

        alert('✅ 投票承諾提交成功！資料已自動下載，請妥善保存以便後續揭曉。');
        
        // 清除資料
        setCommitData(null);
        setSignatureData(null);
        
      } else {
        throw new Error('交易失敗');
      }

    } catch (error) {
      console.error('❌ 提交交易失敗:', error);
      
      let errorMessage = error.message;
      
      if (error.code === 'CALL_EXCEPTION') {
        const reason = error.reason || error.message || '';
        const errorData = error.data || '';
        
        if (reason.includes('InvalidSignature') || errorData.includes('InvalidSignature')) {
          errorMessage = '簽名無效，請重新使用 MetaMask 簽名';
        } else if (reason.includes('InvalidNonce') || errorData.includes('InvalidNonce')) {
          errorMessage = 'Nonce 無效，請重新生成提交資料';
        } else {
          errorMessage = '您未獲得投票權或已經投票';
        }
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = '代付錢包餘額不足支付交易費用';
      }
      
      alert(`❌ 提交失敗: ${errorMessage}`);
      
      if (onCommitError) {
        onCommitError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 清除資料
  const clearData = () => {
    setCommitData(null);
    setSignatureData(null);
    setSelectedCandidate(null);
  };

  // 重新載入候選人
  const refreshCandidates = () => {
    getAllProposals();
  };

  return (
    <div className="commit-button-container">
      {/* 候選人選擇區域 */}
      {!commitData && (
        <div className="candidate-selection">
          <div className="selection-header">
            <h3>🗳️ 選擇候選人</h3>
            <button 
              className="refresh-candidates-btn"
              onClick={refreshCandidates}
              disabled={loadingCandidates}
            >
              {loadingCandidates ? '🔄' : '🔄 重新載入'}
            </button>
          </div>

          {loadingCandidates ? (
            <div className="loading-candidates">📋 載入候選人資料中...</div>
          ) : candidates.length === 0 ? (
            <div className="no-candidates">❌ 未找到候選人資料</div>
          ) : (
            <div className="candidates-grid">
              {candidates.map((candidate) => (
                <div 
                  key={candidate.id}
                  className={`candidate-card ${selectedCandidate?.id === candidate.id ? 'selected' : ''}`}
                  onClick={() => setSelectedCandidate(candidate)}
                >
                  <div className="candidate-id">ID: {candidate.id}</div>
                  <div className="candidate-name">{candidate.name}</div>
                  {candidate.description && (
                    <div className="candidate-description">{candidate.description}</div>
                  )}
                  {selectedCandidate?.id === candidate.id && (
                    <div className="selected-indicator">✅ 已選擇</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 提交操作區域 */}
      <div className="commit-actions">
        {!commitData ? (
          <button 
            className="commit-btn generate"
            onClick={generateCommitData}
            disabled={isLoading || !selectedCandidate}
          >
            {isLoading ? '🔄 生成中...' : '🔐 生成提交資料'}
          </button>
        ) : (
          <div className="commit-data-actions">
            {!signatureData ? (
              <button 
                className="commit-btn sign"
                onClick={handleSignMessage}
                disabled={isSigningLoading}
              >
                {isSigningLoading ? '✍️ 簽名中...' : '✍️ 使用 MetaMask 簽名'}
              </button>
            ) : (
              <button 
                className="commit-btn execute"
                onClick={executeCommit}
                disabled={isLoading}
              >
                {isLoading ? '🔄 提交中...' : '🚀 執行提交'}
              </button>
            )}
            
            <button 
              className="commit-btn clear"
              onClick={clearData}
            >
              🗑️ 清除
            </button>
          </div>
        )}
      </div>

      {/* 選擇候選人提示 */}
      {!selectedCandidate && !loadingCandidates && candidates.length > 0 && !commitData && (
        <p className="warning">⚠️ 請先選擇候選人並連接 MetaMask 錢包</p>
      )}

      {/* 流程狀態指示 */}
      {commitData && (
        <div className="process-status">
          <div className="status-steps">
            <div className="status-step completed">
              <span className="step-icon">✅</span>
              <span className="step-text">生成資料</span>
            </div>
            <div className={`status-step ${signatureData ? 'completed' : 'pending'}`}>
              <span className="step-icon">{signatureData ? '✅' : '⏳'}</span>
              <span className="step-text">MetaMask 簽名</span>
            </div>
            <div className={`status-step ${signatureData ? 'ready' : 'disabled'}`}>
              <span className="step-icon">{signatureData ? '🚀' : '⏸️'}</span>
              <span className="step-text">代付提交</span>
            </div>
          </div>
        </div>
      )}

      {/* 提交資料預覽 - 移除 Gas 顯示 */}
      {commitData && (
        <div className="commit-data-display">
          <h4>📊 提交資料預覽</h4>
          <div className="data-item">
            <strong>候選人:</strong> {commitData.candidateName} (ID: {commitData.candidateId})
          </div>
          <div className="data-item">
            <strong>承諾哈希:</strong> 
            <code>{commitData.commitHash}</code>
          </div>
          <div className="data-item">
            <strong>投票者地址 (MetaMask):</strong> 
            <code>{commitData.userAddress}</code>
          </div>
          <div className="data-item">
            <strong>鏈上 Nonce:</strong> {commitData.onChainNonce}
          </div>
          {signatureData && (
            <div className="data-item">
              <strong>MetaMask 簽名:</strong> 
              <code className="signature">{signatureData.signature?.slice(0, 20)}...</code>
            </div>
          )}
          <div className="warning-box">
            ⚠️ <strong>重要提醒:</strong> 請務必保存好 nonce ({commitData.nonce}) 和 salt 資料，揭曉階段需要使用！提交後將自動下載完整資料。
          </div>
        </div>
      )}
    </div>
  );
};

export default MetaCommitVote;