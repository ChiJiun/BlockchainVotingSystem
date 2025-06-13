import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { contractABI } from '../ABI.js';
import './GiveRightToVote.css';

function GiveRightToVote({ 
  buttonText = "🗳️ 獲得投票權", 
  onSuccess = null, 
  onError = null,
  compact = false,
  showStatus = true 
}) {
  const { address, isConnected } = useAccount();
  const [targetAddress, setTargetAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [votingRightStatus, setVotingRightStatus] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  // 從環境變數獲取合約地址
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

  // 使用 wagmi 的 writeContract hook
  const { writeContract, data: hash, isPending } = useWriteContract();

  // 等待交易確認
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // 檢查投票權狀態的函數
  const handleCheckVotingRight = async () => {
    if (!isConnected || !address) return;
    
    setIsChecking(true);
    try {
      // 這裡需要調用合約的檢查函數
      // 暫時設為 null，需要根據您的合約實現
      setVotingRightStatus(null);
    } catch (error) {
      console.error('檢查投票權失敗:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // 給予投票權的函數
  const giveRightToVote = async (voterAddress) => {
    try {
      if (!isConnected) {
        throw new Error('錢包未連接');
      }

      if (!voterAddress) {
        throw new Error('請輸入有效的錢包地址');
      }

      if (!CONTRACT_ADDRESS) {
        throw new Error('合約地址未配置');
      }

      setIsLoading(true);
      setStatus('正在提交交易...');

      // 調用合約的 giveRightToVote 函數
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: contractABI,
        functionName: 'giveRightToVote',
        args: [voterAddress],
      });

    } catch (error) {
      console.error('給予投票權失敗:', error);
      setStatus(`錯誤: ${error.message}`);
      setIsLoading(false);
      if (onError) onError(error);
    }
  };

  // 處理獲得投票權按鈕點擊
  const handleGrantVotingRight = async () => {
    if (address) {
      await giveRightToVote(address);
    }
  };

  // 處理交易狀態變化
  useEffect(() => {
    if (isPending) {
      setStatus('交易提交中...');
      setIsLoading(true);
    } else if (isConfirming) {
      setStatus('等待交易確認...');
    } else if (isConfirmed) {
      setStatus('✅ 投票權給予成功！');
      setIsLoading(false);
      setTargetAddress(''); // 清除輸入欄位
      if (onSuccess) onSuccess({ hash, address });
    } else if (hash && !isConfirming && !isConfirmed) {
      setStatus('❌ 交易失敗');
      setIsLoading(false);
      if (onError) onError(new Error('交易失敗'));
    }
  }, [isPending, isConfirming, isConfirmed, hash, onSuccess, onError]);

  // 組件掛載時檢查投票權
  useEffect(() => {
    if (isConnected && address && showStatus) {
      handleCheckVotingRight();
    }
  }, [isConnected, address, showStatus]);

  // 如果是緊湊模式，只顯示按鈕
  if (compact) {
    return (
      <div className="give-right-compact">
        <button
          onClick={handleGrantVotingRight}
          disabled={!isConnected || isLoading}
          className={`give-right-btn ${
            !isConnected 
              ? 'disabled' 
              : isLoading 
                ? 'loading' 
                : votingRightStatus 
                  ? 'success' 
                  : 'primary'
          }`}
        >
          {!isConnected 
            ? '🔒 需要連接錢包' 
            : isLoading 
              ? '⏳ 處理中...' 
              : votingRightStatus 
                ? '✅ 已有投票權' 
                : buttonText
          }
        </button>
      </div>
    );
  }

  // 完整模式顯示
  return (
    <div className="give-right-container">
      <h4 className="give-right-title">
        🗳️ 投票權管理
      </h4>

      {/* 顯示當前狀態 */}
      {isConnected && address && showStatus && (
        <div className="give-right-status">
          <p className="wallet-address-info">
            <strong>錢包地址:</strong>
            <code className="wallet-address-code">
              {address}
            </code>
          </p>
          
          {votingRightStatus !== null && (
            <p className={`voting-right-status ${votingRightStatus ? 'has-right' : 'no-right'}`}>
              投票權狀態: {votingRightStatus ? '✅ 已擁有' : '❌ 未擁有'}
            </p>
          )}
        </div>
      )}

      {/* 操作按鈕 */}
      <div className="give-right-actions">
        <button
          onClick={handleGrantVotingRight}
          disabled={!isConnected || isLoading}
          className={`give-right-btn ${
            !isConnected 
              ? 'disabled' 
              : isLoading 
                ? 'loading' 
                : votingRightStatus 
                  ? 'success' 
                  : 'primary'
          }`}
        >
          {!isConnected 
            ? '🔒 需要連接錢包' 
            : isLoading 
              ? '⏳ 處理中...' 
              : votingRightStatus 
                ? '✅ 已有投票權' 
                : buttonText
          }
        </button>

        {showStatus && isConnected && (
          <button
            onClick={handleCheckVotingRight}
            disabled={isChecking}
            className={`give-right-btn ${isChecking ? 'loading' : 'secondary'}`}
          >
            {isChecking ? '⏳ 檢查中...' : '🔍 重新檢查'}
          </button>
        )}
      </div>

      {/* 狀態訊息顯示 */}
      {status && showStatus && (
        <div className="give-right-status">
          <p className={`voting-right-status ${status.includes('✅') ? 'has-right' : 'no-right'}`}>
            {status}
          </p>
        </div>
      )}

      {/* 未連接錢包的提示 */}
      {!isConnected && (
        <div className="give-right-warning">
          ⚠️ 請先連接錢包才能管理投票權
        </div>
      )}
    </div>
  );
}

export default GiveRightToVote;