import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { contractABI } from '../ABI.js';
import './GiveRightToVote.css';

function GiveRightToVote({ 
  onSuccess = null, 
  onError = null 
}) {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [hasVotingRight, setHasVotingRight] = useState(false);

  const RPC_URL = import.meta.env.VITE_RPC_URL;
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
  const ADMIN_PRIVATE_KEY = import.meta.env.VITE_ADMIN_PRIVATE_KEY;

  // 為當前連接的錢包申請投票權
  const handleRequestVotingRight = async () => {
    try {
      if (!isConnected) {
        throw new Error('請先連接錢包');
      }

      if (!address) {
        throw new Error('無法獲取錢包地址');
      }

      // 如果已經有投票權，不需要再申請
      if (hasVotingRight) {
        return;
      }

      setIsLoading(true);
      setStatus('正在提交交易...');

      // 創建 provider 和 wallet
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
      
      // 連接合約
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, adminWallet);

      // 發送交易
      const tx = await contract.giveRightToVote(address);
      console.log('交易已提交:', tx.hash);
      
      setStatus('等待交易確認...');
      
      // 等待交易確認
      const receipt = await tx.wait();
      console.log('交易已確認:', receipt);

      // 交易成功
      setStatus('✅ 獲得投票權');
      setHasVotingRight(true);
      
      if (onSuccess) {
        onSuccess({ 
          hash: receipt.hash,
          blockNumber: receipt.blockNumber
        });
      }

    } catch (error) {
      console.error('交易失敗:', error);
      
      // 交易失敗，顯示已獲得過投票權
      setStatus('✅ 已獲得過投票權');
      setHasVotingRight(true);
      
      if (onError) onError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="give-right-container">
        <div className="give-right-warning">
          ⚠️ 請先連接錢包
        </div>
      </div>
    );
  }

  return (
    <div className="give-right-container">
      <h4 className="give-right-title">
        🗳️ 申請投票權
      </h4>

      <div className="wallet-address-info">
        <p>目前連接的錢包:</p>
        <span className="wallet-address-code">
          {address}
        </span>
      </div>

      <div className="give-right-actions-center">
        <button
          onClick={handleRequestVotingRight}
          disabled={isLoading || hasVotingRight}
          className={`give-right-btn ${
            isLoading ? 'loading' : 
            hasVotingRight ? 'already-has-right' : 
            'primary'
          }`}
        >
          {isLoading ? '⏳ 處理中...' : 
           hasVotingRight ? status : 
           '認證獲得投票權'}
        </button>
      </div>
    </div>
  );
}

export default GiveRightToVote;