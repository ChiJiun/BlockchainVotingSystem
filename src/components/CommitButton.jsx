import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractABI } from '../ABI.js';
import './CommitButton.css';

const CommitButton = ({ onCommitSuccess, onCommitError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [commitData, setCommitData] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [loadingCandidates, setLoadingCandidates] = useState(true);

  // 生成隨機數作為 nonce
  const generateNonce = () => {
    return ethers.randomBytes(32);
  };

  // 生成承諾哈希
  const generateCommitHash = (userAddress, candidateId, nonce, salt) => {
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

  // 獲取用戶地址（優先使用私鑰錢包）
  const getUserAddress = async () => {
    try {
      // 優先使用私鑰錢包
      const privateKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY;
      if (privateKey) {
        const wallet = createWalletFromPrivateKey();
        return wallet.address;
      }

      // 備用方案：使用 MetaMask
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        return await signer.getAddress();
      }

      throw new Error('沒有可用的錢包配置');
    } catch (error) {
      console.error('❌ 獲取用戶地址失敗:', error);
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

  // 生成提交資料
  const generateCommitData = async () => {
    try {
      setIsLoading(true);
      console.log('🔐 開始生成提交資料...');

      if (!selectedCandidate) {
        throw new Error('請先選擇候選人');
      }

      // 獲取用戶地址
      const userAddress = await getUserAddress();
      console.log('👤 用戶地址:', userAddress);
      console.log('🗳️ 選擇的候選人:', selectedCandidate);

      // 生成隨機數據
      const nonce = Math.floor(Math.random() * 1000000);
      const salt = ethers.randomBytes(32);
      
      console.log('🎲 生成的 nonce:', nonce);
      console.log('🧂 生成的 salt:', ethers.hexlify(salt));

      // 生成承諾哈希
      const commitHash = generateCommitHash(userAddress, selectedCandidate.id, nonce, salt);
      console.log('🔒 生成的承諾哈希:', commitHash);

      // 估算 Gas
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      let gasEstimate;
      
      try {
        const privateKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY;
        let contract;

        if (privateKey) {
          // 使用私鑰錢包
          const wallet = createWalletFromPrivateKey();
          contract = new ethers.Contract(contractAddress, contractABI, wallet);
        } else {
          // 使用 MetaMask
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          contract = new ethers.Contract(contractAddress, contractABI, signer);
        }

        gasEstimate = await contract.commitVote.estimateGas(commitHash);
        console.log('⛽ Gas 估算:', gasEstimate.toString());
      } catch (gasError) {
        console.warn('Gas 估算失敗:', gasError);
        gasEstimate = BigInt(150000);
      }

      const commitDataObj = {
        candidateId: selectedCandidate.id,
        candidateName: selectedCandidate.name,
        nonce: nonce,
        salt: ethers.hexlify(salt),
        commitHash: commitHash,
        userAddress: userAddress,
        contractAddress: contractAddress,
        gasEstimate: gasEstimate.toString(),
        timestamp: new Date().toISOString(),
        revealData: {
          candidateId: selectedCandidate.id,
          nonce: nonce,
          salt: ethers.hexlify(salt)
        }
      };

      setCommitData(commitDataObj);
      console.log('📊 完整提交資料:', commitDataObj);

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

  // 執行提交交易（使用私鑰）
  const executeCommit = async () => {
    if (!commitData) {
      await generateCommitData();
      return;
    }

    try {
      setIsLoading(true);
      console.log('📤 執行提交交易...');

      const privateKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY;
      let contract;
      let signer;

      if (privateKey) {
        // 使用私鑰錢包
        console.log('🔑 使用私鑰進行交易');
        const wallet = createWalletFromPrivateKey();
        contract = new ethers.Contract(commitData.contractAddress, contractABI, wallet);
        signer = wallet;
      } else {
        // 使用 MetaMask
        console.log('🦊 使用 MetaMask 進行交易');
        const provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        contract = new ethers.Contract(commitData.contractAddress, contractABI, signer);
      }

      console.log('📤 發送者地址:', await signer.getAddress());

      // 檢查函數是否存在
      if (typeof contract.commitVote !== 'function') {
        throw new Error('函數 commitVote 在合約中不存在');
      }

      // 執行提交交易
      const gasLimit = Math.floor(Number(commitData.gasEstimate) * 1.3);
      
      const tx = await contract.commitVote(commitData.commitHash, {
        gasLimit: gasLimit
      });

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

        // 保存提交資料到本地存儲
        const storageKey = `commit_${commitData.userAddress}_${tx.hash}`;
        localStorage.setItem(storageKey, JSON.stringify({
          ...commitData,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: 'committed'
        }));

        alert('✅ 投票承諾提交成功！請保存好您的資料以便後續揭曉。');
        setCommitData(null);
        
      } else {
        throw new Error('交易失敗');
      }

    } catch (error) {
      console.error('❌ 提交交易失敗:', error);
      
      let errorMessage = error.message;
      if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = '帳戶餘額不足支付交易費用';
      } else if (error.code === 'USER_REJECTED') {
        errorMessage = '用戶取消了交易';
      } else if (error.code === 'CALL_EXCEPTION') {
        errorMessage = `合約執行失敗: ${error.reason || error.message}`;
      }
      
      alert(`❌ 提交失敗: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 下載提交資料
  const downloadCommitData = () => {
    if (!commitData) return;

    const dataStr = JSON.stringify(commitData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `commit_data_${commitData.userAddress}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  // 清除資料
  const clearData = () => {
    setCommitData(null);
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
            <button 
              className="commit-btn execute"
              onClick={executeCommit}
              disabled={isLoading}
            >
              {isLoading ? '🔄 提交中...' : '🚀 執行提交'}
            </button>
            
            <button 
              className="commit-btn download"
              onClick={downloadCommitData}
            >
              💾 下載資料
            </button>
            
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
        <p className="warning">⚠️ 請先選擇候選人</p>
      )}

      {/* 提交資料預覽 */}
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
            <strong>用戶地址:</strong> 
            <code>{commitData.userAddress}</code>
          </div>
          <div className="data-item">
            <strong>Gas 估算:</strong> {commitData.gasEstimate}
          </div>
          <div className="warning-box">
            ⚠️ <strong>重要提醒:</strong> 請務必保存好 nonce ({commitData.nonce}) 和 salt 資料，揭曉階段需要使用！
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitButton;