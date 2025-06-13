import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { contractABI } from '../ABI.js';
import './giverighttovote.css';

function GiveRightToVote({ 
  buttonText = "🗳️ 獲得投票權", 
  onSuccess = null, 
  onError = null,
  compact = false,
  showStatus = true 
}) {
  const { address, isConnected } = useAccount();
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
  const checkVotingRight = async () => {
    if (!isConnected || !address) {
      setVotingRightStatus(null);
      return;
    }
    
    setIsChecking(true);
    try {
      // 這裡需要調用合約的檢查函數，暫時設為已有投票權
      // 您可以根據實際合約方法來實現
      console.log('檢查投票權狀態中...');
      setVotingRightStatus(true); // 暫時假設已有投票權
    } catch (error) {
      console.error('檢查投票權失敗:', error);
      setVotingRightStatus(false);
    } finally {
      setIsChecking(false);
    }
  };

  // 給予投票權的函數 - 重新定義在組件內
  const handleGiveRightToVote = async (voterAddress) => {
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
    // 如果已有投票權，直接返回不執行
    if (votingRightStatus) {
      return;
    }
    
    if (address) {
      await handleGiveRightToVote(address);
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
      if (onSuccess) onSuccess({ hash, address });
      // 成功後重新檢查投票權狀態
      setTimeout(() => checkVotingRight(), 1000);
    } else if (hash && !isConfirming && !isConfirmed) {
      setStatus('❌ 交易失敗');
      setIsLoading(false);
      if (onError) onError(new Error('交易失敗'));
    }
  }, [isPending, isConfirming, isConfirmed, hash, onSuccess, onError]);

  // 組件掛載時檢查投票權
  useEffect(() => {
    if (isConnected && address && showStatus) {
      checkVotingRight();
    }
  }, [isConnected, address, showStatus]);

  // 判斷按鈕是否應該被禁用
  const isButtonDisabled = !isConnected || isLoading || votingRightStatus;

  // 如果是緊湊模式，只顯示按鈕
  if (compact) {
    return (
      <div className="give-right-compact">
        <button
          onClick={handleGrantVotingRight}
          disabled={isButtonDisabled}
          className={`give-right-btn ${
            !isConnected 
              ? 'disabled' 
              : isLoading 
                ? 'loading' 
                : votingRightStatus 
                  ? 'success disabled' 
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

      {/* 置中的操作按鈕 - 已有投票權時禁用 */}
      <div className="give-right-actions-center">
        <button
          onClick={handleGrantVotingRight}
          disabled={isButtonDisabled}
          className={`give-right-btn ${
            !isConnected 
              ? 'disabled' 
              : isLoading 
                ? 'loading' 
                : votingRightStatus 
                  ? 'success disabled' 
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

      {/* 已有投票權的提示 */}
      {votingRightStatus && (
        <div className="give-right-info">
          ℹ️ 您已擁有投票權，可以參與投票了！
        </div>
      )}
    </div>
  );
}

export default GiveRightToVote;