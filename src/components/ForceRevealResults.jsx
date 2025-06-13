import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractABI } from '../ABI.js';
import './ForceRevealResults.css';

const ForceRevealResults = ({ account }) => {
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

  const handleForceReveal = async () => {
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

      const tx = await contract.forceRevealResults();
      setSuccess(`交易已送出: ${tx.hash}`);
      
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        setSuccess(`提前結束揭示期成功！交易: ${tx.hash}`);
      }

    } catch (err) {
      console.error(err);
      let errorMsg = err.message;
      
      if (err.message.includes('OnlyChairperson')) {
        errorMsg = '只有主席可以提前結束揭示期';
      } else if (err.message.includes('VotingNotEnded')) {
        errorMsg = '投票尚未結束';
      } else if (err.message.includes('AlreadyRevealed')) {
        errorMsg = '結果已經揭示';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="force-reveal-container">
      <h2>提前結束揭示期</h2>
      
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
        className="force-reveal-button"
        onClick={handleForceReveal}
        disabled={loading || !contract || !account}
      >
        {loading ? '處理中...' : '提前結束揭示期'}
      </button>
    </div>
  );
};

export default ForceRevealResults;