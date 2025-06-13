import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractABI } from '../ABI.js';
import './RevealVote.css';

const RevealVote = ({ onRevealSuccess, onRevealError, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [revealData, setRevealData] = useState({
    proposal: '',
    nonce: '',
    salt: ''
  });
  const [revealStatus, setRevealStatus] = useState(null); // 只保留揭曉狀態
  const [userAddress, setUserAddress] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // 創建私鑰錢包實例
  const createWalletFromPrivateKey = () => {
    const privateKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('未設置管理員私鑰');
    }

    const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL || 'http://localhost:8545');
    return new ethers.Wallet(privateKey, provider);
  };

  // 獲取合約實例
  const getContract = () => {
    const wallet = createWalletFromPrivateKey();
    const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
    return new ethers.Contract(contractAddress, contractABI, wallet);
  };

  // 獲取用戶地址（從 MetaMask）
  const getUserAddress = async () => {
    if (!window.ethereum) {
      throw new Error('請安裝 MetaMask 錢包');
    }

    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return await signer.getAddress();
  };

  // 載入狀態和候選人資料
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoadingStatus(true);
        
        // 獲取用戶地址
        const address = await getUserAddress();
        setUserAddress(address);

        const contract = getContract();

        // 獲取用戶揭曉狀態 - 這是從智能合約的 revealed 映射中獲取
        const hasRevealed = await contract.revealed(address);
        setRevealStatus({
          hasRevealed: hasRevealed
        });

        console.log('🔍 用戶揭曉狀態:', {
          address: address,
          hasRevealed: hasRevealed
        });

        // 獲取候選人資料
        const proposalsResult = await contract.getAllProposals();
        const candidateNames = Array.from(proposalsResult[0]);
        
        const candidateList = [];
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
            
            if (proposalName && proposalName.trim()) {
              candidateList.push({
                id: i,
                name: proposalName.trim(),
                description: `候選人 ${i + 1}`
              });
            }
          } catch (itemError) {
            console.warn(`處理候選人 ${i} 時出錯:`, itemError);
          }
        }
        
        setCandidates(candidateList);
        console.log('📋 載入的候選人:', candidateList);

      } catch (error) {
        console.error('❌ 載入初始資料失敗:', error);
        alert(`載入資料失敗: ${error.message}`);
      } finally {
        setLoadingStatus(false);
      }
    };

    loadInitialData();
  }, []);

  // 處理輸入變更
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setRevealData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 驗證承諾
  const verifyCommitment = async () => {
    try {
      if (!revealData.proposal || !revealData.nonce || !revealData.salt) {
        alert('❌ 請填寫完整的揭曉資料');
        return;
      }

      const contract = getContract();
      
      // 從合約獲取用戶的承諾哈希
      const storedCommitment = await contract.voteCommitments(userAddress);
      
      if (storedCommitment === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        alert('❌ 未找到您的投票承諾，請先進行投票');
        return;
      }

      // 生成承諾哈希進行驗證
      const commitment = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256', 'bytes32'],
        [userAddress, parseInt(revealData.proposal), parseInt(revealData.nonce), revealData.salt]
      );

      console.log('🔍 驗證承諾:', {
        userAddress,
        proposal: revealData.proposal,
        nonce: revealData.nonce,
        salt: revealData.salt,
        generatedCommitment: commitment,
        storedCommitment: storedCommitment
      });

      if (commitment === storedCommitment) {
        alert('✅ 承諾驗證成功！資料正確。');
      } else {
        alert('❌ 承諾驗證失敗！請檢查輸入的資料是否正確。');
      }
    } catch (error) {
      console.error('❌ 驗證承諾失敗:', error);
      alert(`驗證失敗: ${error.message}`);
    }
  };

  // 執行揭曉投票
  const executeReveal = async () => {
    if (!revealData.proposal || !revealData.nonce || !revealData.salt) {
      alert('❌ 請填寫完整的揭曉資料');
      return;
    }

    try {
      setIsLoading(true);
      console.log('🔓 開始執行揭曉投票...');

      const contract = getContract();
      const wallet = createWalletFromPrivateKey();

      console.log('📋 揭曉參數:', {
        userAddress,
        proposal: revealData.proposal,
        nonce: revealData.nonce,
        salt: revealData.salt
      });

      console.log('💰 交易發送者 (私鑰錢包):', wallet.address);

      // 檢查函數是否存在
      if (typeof contract.revealVote !== 'function') {
        throw new Error('函數 revealVote 在合約中不存在');
      }

      // 估算 Gas
      let gasEstimate;
      try {
        gasEstimate = await contract.revealVote.estimateGas(
          parseInt(revealData.proposal),
          parseInt(revealData.nonce),
          revealData.salt
        );
        console.log('⛽ Gas 估算:', gasEstimate.toString());
      } catch (gasError) {
        console.warn('Gas 估算失敗:', gasError);
        gasEstimate = BigInt(200000); // 預設 Gas 限制
      }

      // 執行揭曉交易
      const tx = await contract.revealVote(
        parseInt(revealData.proposal), // proposal (uint256)
        parseInt(revealData.nonce),    // nonce (uint256)
        revealData.salt,               // salt (bytes32)
        {
          gasLimit: Math.floor(Number(gasEstimate) * 1.5)
        }
      );

      console.log('🚀 揭曉交易已提交:', tx.hash);
      console.log('⏳ 等待交易確認...');

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        console.log('✅ 揭曉成功！');
        console.log('📊 交易詳情:', {
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        });

        // 更新揭曉狀態
        const hasRevealed = await contract.revealed(userAddress);
        setRevealStatus({
          hasRevealed: hasRevealed
        });

        alert('✅ 投票揭曉成功！您的投票已被記錄。');
        
        // 清除輸入資料
        setRevealData({
          proposal: '',
          nonce: '',
          salt: ''
        });

        if (onRevealSuccess) {
          onRevealSuccess({
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            proposal: revealData.proposal,
            userAddress
          });
        }
        
      } else {
        throw new Error('交易失敗');
      }

    } catch (error) {
      console.error('❌ 揭曉交易失敗:', error);
      
      let errorMessage = error.message;
      
      if (error.code === 'CALL_EXCEPTION') {
        const reason = error.reason || error.message || '';
        const errorData = error.data || '';
        
        if (reason.includes('AlreadyRevealed') || errorData.includes('AlreadyRevealed')) {
          errorMessage = '您已經揭曉過投票了';
        } else if (reason.includes('InvalidCommitment') || errorData.includes('InvalidCommitment')) {
          errorMessage = '承諾無效，請檢查輸入的資料是否正確';
        } else if (reason.includes('NotWithinRevealPeriod') || errorData.includes('NotWithinRevealPeriod')) {
          errorMessage = '不在揭曉期間內';
        } else if (reason.includes('InvalidProposalIndex') || errorData.includes('InvalidProposalIndex')) {
          errorMessage = '無效的候選人編號';
        } else {
          errorMessage = '合約執行失敗，請檢查輸入資料';
        }
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = '私鑰錢包餘額不足支付交易費用';
      }
      
      alert(`❌ 揭曉失敗: ${errorMessage}`);
      
      if (onRevealError) {
        onRevealError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 獲取候選人名稱
  const getCandidateName = (proposalId) => {
    const candidate = candidates.find(c => c.id === parseInt(proposalId));
    return candidate ? candidate.name : `候選人 ${parseInt(proposalId) + 1}`;
  };

  if (loadingStatus) {
    return (
      <div className="reveal-vote-container">
        <div className="reveal-vote-modal">
          <div className="loading">📋 載入資料中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="reveal-vote-container">
      <div className="reveal-vote-modal">
        {/* 關閉按鈕 */}
        {onClose && (
          <button className="modal-close-btn" onClick={onClose} title="關閉">
            ×
          </button>
        )}
        
        {/* 內容容器 */}
        <div className="modal-content">
          <h3>🔓 揭曉投票</h3>
          
          {/* 狀態顯示 - 只顯示揭曉狀態 */}
          <div className="status-section">
            <h4>📊 當前狀態</h4>
            <div className="status-grid">
              <div className="status-item">
                <strong>投票者地址:</strong>
                <code>{userAddress.slice(0, 6)}...{userAddress.slice(-4)}</code>
              </div>
              <div className="status-item">
                <strong>揭曉狀態:</strong>
                <span className={`status-badge ${revealStatus?.hasRevealed ? 'success' : 'pending'}`}>
                  {revealStatus?.hasRevealed ? '✅ 已揭曉' : '⏳ 待揭曉'}
                </span>
              </div>
            </div>
          </div>

          {/* 輸入表單 */}
          <div className="input-section">
            <h4>📝 揭曉資料</h4>
            
            <div className="input-group">
              <label htmlFor="proposal">候選人:</label>
              <select
                id="proposal"
                name="proposal"
                value={revealData.proposal}
                onChange={handleInputChange}
                disabled={isLoading}
              >
                <option value="">選擇候選人</option>
                {candidates.map(candidate => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.id} - {candidate.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="nonce">投票 Nonce:</label>
              <input
                type="number"
                id="nonce"
                name="nonce"
                value={revealData.nonce}
                onChange={handleInputChange}
                placeholder="輸入隨機數"
                disabled={isLoading}
              />
            </div>

            <div className="input-group">
              <label htmlFor="salt">Salt:</label>
              <input
                type="text"
                id="salt"
                name="salt"
                value={revealData.salt}
                onChange={handleInputChange}
                placeholder="0x..."
                disabled={isLoading}
              />
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="actions-section">
            <button
              className="btn secondary"
              onClick={verifyCommitment}
              disabled={isLoading || !revealData.proposal || !revealData.nonce || !revealData.salt}
            >
              🔍 驗證
            </button>
            
            <button
              className="btn primary"
              onClick={executeReveal}
              disabled={
                isLoading || 
                !revealData.proposal || 
                !revealData.nonce || 
                !revealData.salt ||
                revealStatus?.hasRevealed
              }
            >
              {isLoading ? '🔄 揭曉中...' : '🔓 執行揭曉'}
            </button>
          </div>

          {/* 預覽資料 */}
          {(revealData.proposal || revealData.nonce || revealData.salt) && (
            <div className="preview-section">
              <h4>👁️ 預覽</h4>
              <div className="preview-data">
                {revealData.proposal && (
                  <div className="preview-item">
                    <strong>候選人:</strong> {getCandidateName(revealData.proposal)} (ID: {revealData.proposal})
                  </div>
                )}
                {revealData.nonce && (
                  <div className="preview-item">
                    <strong>Nonce:</strong> {revealData.nonce}
                  </div>
                )}
                {revealData.salt && (
                  <div className="preview-item">
                    <strong>Salt:</strong> <code>{revealData.salt.slice(0, 8)}...{revealData.salt.slice(-4)}</code>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 提示資訊 */}
          <div className="info-section">
            <div className="info-box">
              ℹ️ <strong>說明:</strong>
              <ul>
                <li>需要投票時的原始資料</li>
                <li>資料必須完全一致</li>
                <li>每個地址只能揭曉一次</li>
              </ul>
            </div>
            
            {revealStatus?.hasRevealed && (
              <div className="success-box">
                ✅ <strong>完成:</strong> 您已完成投票揭曉。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevealVote;