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
  const generateCommitHash = (candidateId, nonce) => {
    // 使用 keccak256 生成承諾哈希: keccak256(abi.encodePacked(candidateId, nonce))
    const abiCoder = new ethers.AbiCoder();
    const encoded = abiCoder.encode(['uint256', 'bytes32'], [candidateId, nonce]);
    return ethers.keccak256(encoded);
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

    if (!contractABI || !Array.isArray(contractABI)) {
      throw new Error('contractABI 未正確載入或格式不正確');
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    const result = await contract.getAllProposals();
    console.log('📋 原始返回結果:', result);

    // 提取候選人名稱陣列 (只需要名稱，不需要票數)
    let candidateNames = [];

    try {
      if (result[0]) {
        console.log('📋 候選人名稱原始資料:', result[0]);
        candidateNames = Array.from(result[0]);
        console.log('📋 轉換後的候選人名稱陣列:', candidateNames);
      }
    } catch (extractError) {
      console.error('❌ 提取資料時發生錯誤:', extractError);
      throw new Error('無法提取候選人資料');
    }

    if (!Array.isArray(candidateNames) || candidateNames.length === 0) {
      throw new Error('沒有找到候選人名稱資料');
    }

    // 處理候選人資料（移除票數處理）
    const proposals = [];
    
    for (let i = 0; i < candidateNames.length; i++) {
      try {
        const b32 = candidateNames[i];
        
        console.log(`🔍 處理候選人 ${i}:`, { b32 });
        
        // 檢查是否為有效的 bytes32 字串
        if (!b32 || typeof b32 !== 'string' || !b32.startsWith('0x')) {
          console.warn(`⚠️ 候選人 ${i} 不是有效的 bytes32 字串:`, b32);
          continue;
        }
        
        // 檢查是否為空的 bytes32
        if (b32 === '0x0000000000000000000000000000000000000000000000000000000000000000') {
          console.warn(`⚠️ 候選人 ${i} 為空的 bytes32`);
          continue;
        }
        
        // 解碼候選人名稱
        let proposalName;
        try {
          proposalName = ethers.decodeBytes32String(b32);
          console.log(`✅ 成功解碼候選人 ${i}:`, proposalName);
        } catch (decodeError) {
          console.warn(`⚠️ 無法解碼候選人 ${i} 的 bytes32:`, decodeError.message);
          
          // 嘗試替代解碼方式
          try {
            const hexString = b32.slice(2); // 移除 '0x' 前綴
            const bytes = [];
            for (let j = 0; j < hexString.length; j += 2) {
              const byte = parseInt(hexString.substr(j, 2), 16);
              if (byte !== 0) bytes.push(byte);
            }
            proposalName = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
            console.log(`✅ 替代方式解碼候選人 ${i}:`, proposalName);
          } catch (altDecodeError) {
            console.warn(`⚠️ 替代解碼方式也失敗:`, altDecodeError.message);
            proposalName = `候選人 ${i}`;
          }
        }
        
        // 清理字串，移除空字符和多餘空格
        proposalName = proposalName.replace(/\0/g, '').trim();
        
        if (proposalName && proposalName !== '') {
          proposals.push({
            id: i,
            name: proposalName,
            description: ''
          });
          console.log(`✅ 成功添加候選人 ${i}:`, { name: proposalName });
        }
        
      } catch (itemError) {
        console.error(`❌ 處理候選人 ${i} 時發生錯誤:`, itemError.message);
        // 添加預設候選人以防錯誤
        proposals.push({
          id: i,
          name: `候選人 ${i}`,
          description: '解碼失敗'
        });
      }
    }

    console.log("📋 最終候選人陣列：", proposals);
    
    if (proposals.length === 0) {
      console.warn("⚠️ 沒有成功解析任何候選人");
    }
    
    // 更新狀態
    setCandidates(proposals);
    
    return proposals;
    
  } catch (error) {
    console.error("❌ 獲取候選人資料失敗：", error.message);
    console.error("❌ 完整錯誤：", error);
    setCandidates([]);
    return [];
  } finally {
    setLoadingCandidates(false);
  }
  };

  // 組件掛載時獲取候選人資料
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

      // 檢查 MetaMask 連接
      if (!window.ethereum) {
        throw new Error('請安裝 MetaMask 錢包');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      console.log('👤 用戶地址:', userAddress);
      console.log('🗳️ 選擇的候選人:', selectedCandidate);

      // 生成隨機 nonce
      const nonce = generateNonce();
      console.log('🎲 生成的 nonce:', ethers.hexlify(nonce));

      // 生成承諾哈希
      const commitHash = generateCommitHash(selectedCandidate.id, nonce);
      console.log('🔒 生成的承諾哈希:', commitHash);

      // 準備合約交易資料
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      const contract = new ethers.Contract(contractAddress, contractABI, signer);

      // 檢查 metaCommitVote 函數是否存在
      const availableFunctions = contractABI
        .filter(item => item.type === 'function')
        .map(item => item.name);

      console.log('📋 ABI 中可用的函數:', availableFunctions);

      if (!availableFunctions.includes('metaCommitVote')) {
        throw new Error('合約中未找到 metaCommitVote 函數，請檢查 ABI 配置');
      }

      // 獲取 metaCommitVote 函數定義
      const functionDef = contractABI.find(item => 
        item.type === 'function' && item.name === 'metaCommitVote'
      );
      
      console.log('📝 metaCommitVote 函數定義:', functionDef);

      // 估算 Gas
      let gasEstimate;
      try {
        console.log('🔧 嘗試估算 Gas，函數: metaCommitVote，參數:', [commitHash]);
        gasEstimate = await contract.metaCommitVote.estimateGas(commitHash);
        console.log('⛽ Gas 估算:', gasEstimate.toString());
      } catch (gasError) {
        console.warn('Gas 估算失敗:', gasError);
        console.warn('使用預設 Gas 值');
        gasEstimate = BigInt(100000); // 預設 Gas 限制
      }

      const commitDataObj = {
        candidateId: selectedCandidate.id,
        candidateName: selectedCandidate.name,
        nonce: ethers.hexlify(nonce),
        commitHash: commitHash,
        userAddress: userAddress,
        contractAddress: contractAddress,
        gasEstimate: gasEstimate.toString(),
        timestamp: new Date().toISOString(),
        commitFunctionName: 'metaCommitVote', // 固定使用 metaCommitVote
        functionDefinition: functionDef,
        // 用於後續揭曉階段的資料
        revealData: {
          candidateId: selectedCandidate.id,
          nonce: ethers.hexlify(nonce)
        }
      };

      setCommitData(commitDataObj);
      console.log('📊 完整提交資料:', commitDataObj);

      // 顯示成功訊息
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

  // 執行提交交易
  const executeCommit = async () => {
    if (!commitData) {
      await generateCommitData();
      return;
    }

    try {
      setIsLoading(true);
      console.log('📤 執行提交交易...');

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(commitData.contractAddress, contractABI, signer);

      console.log('🔧 使用函數: metaCommitVote');
      console.log('📝 函數定義:', commitData.functionDefinition);

      // 確認函數存在
      if (typeof contract.metaCommitVote !== 'function') {
        throw new Error('函數 metaCommitVote 在合約中不存在');
      }

      // 準備函數參數
      const callArgs = [commitData.commitHash];
      console.log('📋 調用參數:', callArgs);

      // 執行提交交易
      const tx = await contract.metaCommitVote(commitData.commitHash, {
        gasLimit: Math.floor(Number(commitData.gasEstimate) * 1.2) // 增加 20% Gas 緩衝
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

        // 保存提交資料到本地存儲（用於後續揭曉）
        const storageKey = `commit_${commitData.userAddress}_${tx.hash}`;
        localStorage.setItem(storageKey, JSON.stringify({
          ...commitData,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: 'committed'
        }));

        alert('✅ 投票提交成功！請保存好您的資料以便後續揭曉。');
        
        // 清除資料以防重複提交
        setCommitData(null);
        
      } else {
        throw new Error('交易失敗');
      }

    } catch (error) {
      console.error('❌ 提交交易失敗:', error);
      
      // 提供更詳細的錯誤信息
      let errorMessage = error.message;
      if (error.code === 'UNSUPPORTED_OPERATION') {
        errorMessage = `metaCommitVote 函數調用失敗，請檢查：
        1. ABI 中是否包含 metaCommitVote 函數定義
        2. 函數參數是否正確（應為 bytes32）
        3. 合約地址是否正確
        
        錯誤詳情: ${error.message}`;
      } else if (error.code === 'CALL_EXCEPTION') {
        errorMessage = `合約執行失敗: ${error.message}`;
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = '帳戶餘額不足支付交易費用';
      } else if (error.code === 'USER_REJECTED') {
        errorMessage = '用戶取消了交易';
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
  };

  // 重新載入候選人
  const refreshCandidates = () => {
    getAllProposals();
  };

  return (
    <div className="commit-button-container">
      {/* 候選人選擇區域 */}
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

      {!selectedCandidate && !loadingCandidates && candidates.length > 0 && (
        <p className="warning">⚠️ 請先選擇候選人</p>
      )}

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
            ⚠️ <strong>重要提醒:</strong> 請務必保存好 nonce 和候選人資料，揭曉階段需要使用！
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitButton;