import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractABI } from '../ABI.js';
import './StartVotingEarly.css';

const StartVotingEarly = ({ account }) => {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const initContract = async () => {
      try {
        const rpcUrl = import.meta.env.VITE_RPC_URL;
        const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;

        if (!rpcUrl || !contractAddress) {
          throw new Error("請設定環境變數");
        }

        let provider;
        if (window.ethereum && account) {
          provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const contractInstance = new ethers.Contract(contractAddress, contractABI, signer);
          setContract(contractInstance);
        }
        
        setError('');
      } catch (err) {
        setError(err.message);
      }
    };
    
    initContract();
  }, [account]);

  const handleStartEarly = async () => {
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

      const tx = await contract.startVotingEarly();
      setSuccess(`交易已送出: ${tx.hash}`);
      
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        setSuccess(`提前開始投票成功！交易: ${tx.hash}`);
      }

    } catch (err) {
      console.error(err);
      let errorMsg = err.message;
      
      if (err.message.includes('OnlyChairperson')) {
        errorMsg = '只有主席可以提前開始投票';
      } else if (err.message.includes('VotingAlreadyStarted')) {
        errorMsg = '投票已經開始';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="start-voting-early-container">
      <h2>提前開始投票</h2>
      
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
        className="start-early-button"
        onClick={handleStartEarly}
        disabled={loading || !contract || !account}
      >
        {loading ? '處理中...' : '提前開始投票'}
      </button>
    </div>
  );
};

export default StartVotingEarly;