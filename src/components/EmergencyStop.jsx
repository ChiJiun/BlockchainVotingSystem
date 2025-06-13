import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractABI } from '../ABI.js';
import './EmergencyStop.css';

const EmergencyStop = ({ account }) => {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [votingStatus, setVotingStatus] = useState({
    isActive: false,
    hasEnded: false
  });

  useEffect(() => {
    const initContract = async () => {
      try {
        const rpcUrl = import.meta.env.VITE_RPC_URL;
        const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;

        if (!rpcUrl || !contractAddress) {
          throw new Error("請設定環境變數");
        }

        if (window.ethereum && account) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const contractInstance = new ethers.Contract(contractAddress, contractABI, signer);
          setContract(contractInstance);
          
          // 獲取投票狀態
          const status = await contractInstance.getVotingStatus();
          setVotingStatus({
            isActive: status.isActive,
            hasEnded: status.hasEnded
          });
        }
      } catch (err) {
        console.error('Contract initialization error:', err);
        setError(err.message);
      }
    };
    
    initContract();
  }, [account]);

  const handleEmergencyStop = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!contract) {
        throw new Error('合約未初始化');
      }

      if (!account) {
        throw new Error('請先連接錢包');
      }

      const tx = await contract.emergencyStop();
      setSuccess(`交易已送出: ${tx.hash}`);
      
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        // 更新投票狀態
        const newStatus = await contract.getVotingStatus();
        setVotingStatus({
          isActive: newStatus.isActive,
          hasEnded: newStatus.hasEnded
        });
        setSuccess('緊急停止投票成功！');
      }

    } catch (err) {
      console.error('Transaction error:', err);
      let errorMsg = err.message;
      
      if (err.message.includes('OnlyChairperson')) {
        errorMsg = '只有主席可以執行緊急停止';
      } else if (err.message.includes('VotingInProgress')) {
        errorMsg = '投票正在進行中';
      } else if (err.message.includes('user rejected')) {
        errorMsg = '使用者取消交易';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="emergency-stop-container">
      <h2>緊急停止系統</h2>
      
      <div className="status-info">
        <p>投票狀態: {votingStatus.isActive ? '進行中' : (votingStatus.hasEnded ? '已結束' : '未開始')}</p>
      </div>
      
      {error && (
        <div className="error-message">
          錯誤：{error}
        </div>
      )}
      
      {success && (
        <div className="success-message">
          {success}
        </div>
      )}

      <button 
        className="emergency-button stop"
        onClick={handleEmergencyStop}
        disabled={loading || !contract || !account || votingStatus.hasEnded}
      >
        {loading ? '處理中...' : '緊急停止投票'}
      </button>
    </div>
  );
};

export default EmergencyStop;