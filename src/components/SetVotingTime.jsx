import React, { useState } from 'react';
import { ethers } from 'ethers';
import { contractABI } from '../ABI.js';
import './SetVotingTime.css';

const SetVotingTime = ({ onSuccess, onError }) => {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 從環境變數讀取合約地址
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

  // 將日期時間字符串轉換為 Unix 時間戳
  const dateTimeToTimestamp = (dateTimeString) => {
    if (!dateTimeString) return 0;
    return Math.floor(new Date(dateTimeString).getTime() / 1000);
  };

  // 格式化時間戳為可讀格式
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('zh-TW');
  };

  // 檢查 ABI 中 setVotingTime 函數的格式
  const getSetVotingTimeFunction = () => {
    const setVotingTimeFunction = contractABI.find(
      item => item.type === 'function' && item.name === 'setVotingTime'
    );
    
    if (!setVotingTimeFunction) {
      throw new Error('ABI 中未找到 setVotingTime 函數');
    }

    console.log('📋 setVotingTime 函數定義:', setVotingTimeFunction);
    
    // 檢查參數格式
    const inputs = setVotingTimeFunction.inputs;
    console.log('📝 預期參數格式:', inputs);
    
    return setVotingTimeFunction;
  };

  // 驗證時間設置
  const validateTimes = () => {
    const startTimestamp = dateTimeToTimestamp(startTime);
    const endTimestamp = dateTimeToTimestamp(endTime);

    if (!startTime || !endTime) {
      throw new Error('請填寫開始時間和結束時間');
    }

    if (startTimestamp >= endTimestamp) {
      throw new Error('開始時間必須早於結束時間');
    }

    const now = Math.floor(Date.now() / 1000);
    if (startTimestamp <= now) {
      throw new Error('開始時間必須晚於目前時間');
    }

    return { startTimestamp, endTimestamp };
  };

  // 執行設置投票時間
  const handleSetVotingTime = async () => {
    try {
      setIsLoading(true);

      if (!CONTRACT_ADDRESS) {
        throw new Error('未設定智能合約地址，請檢查環境變數 VITE_CONTRACT_ADDRESS');
      }

      // 檢查 ABI 函數格式
      const functionDef = getSetVotingTimeFunction();
      
      // 驗證時間設置
      const { startTimestamp, endTimestamp } = validateTimes();

      console.log('⏰ 設置投票時間參數:');
      console.log('📅 開始時間:', formatTimestamp(startTimestamp), `(${startTimestamp})`);
      console.log('📅 結束時間:', formatTimestamp(endTimestamp), `(${endTimestamp})`);

      // 檢查 MetaMask 連接
      if (!window.ethereum) {
        throw new Error('請安裝 MetaMask 錢包');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      console.log('👤 執行者地址:', userAddress);

      // 創建合約實例
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);

      // 檢查函數是否存在
      if (typeof contract.setVotingTime !== 'function') {
        throw new Error('智能合約中未找到 setVotingTime 函數，請檢查 ABI 配置');
      }

      // 根據 ABI 格式準備參數
      let callArgs;
      const inputs = functionDef.inputs;
      
      if (inputs.length === 2) {
        // 如果是 2 個參數 (startTime, endTime)
        callArgs = [startTimestamp, endTimestamp];
      } else if (inputs.length === 1 && inputs[0].type === 'tuple') {
        // 如果是一個結構體參數
        callArgs = [{
          startTime: startTimestamp,
          endTime: endTimestamp
        }];
      } else {
        // 預設格式：兩個獨立參數
        callArgs = [startTimestamp, endTimestamp];
      }

      console.log('📋 函數調用參數:', callArgs);

      // 估算 Gas
      let gasEstimate;
      try {
        gasEstimate = await contract.setVotingTime.estimateGas(...callArgs);
        console.log('⛽ Gas 估算:', gasEstimate.toString());
      } catch (gasError) {
        console.warn('Gas 估算失敗:', gasError);
        gasEstimate = BigInt(150000); // 使用預設值
      }

      // 執行交易
      const tx = await contract.setVotingTime(...callArgs, {
        gasLimit: Math.floor(Number(gasEstimate) * 1.2) // 增加 20% 緩衝
      });

      console.log('🚀 交易已提交:', tx.hash);
      console.log('⏳ 等待交易確認...');

      // 等待交易確認
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        console.log('✅ 投票時間設置成功！');
        console.log('📊 交易詳情:', {
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        });

        const result = {
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          votingTimes: {
            startTime: { timestamp: startTimestamp, formatted: formatTimestamp(startTimestamp) },
            endTime: { timestamp: endTimestamp, formatted: formatTimestamp(endTimestamp) }
          },
          functionDef: functionDef
        };

        if (onSuccess) {
          onSuccess(result);
        }

        alert('✅ 投票時間設置成功！');
        
        // 清空表單
        setStartTime('');
        setEndTime('');

      } else {
        throw new Error('交易執行失敗');
      }

    } catch (error) {
      console.error('❌ 設置投票時間失敗:', error);

      let errorMessage = error.message;
      if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = '帳戶餘額不足支付交易費用';
      } else if (error.code === 'USER_REJECTED') {
        errorMessage = '用戶取消了交易';
      } else if (error.code === 'CALL_EXCEPTION') {
        errorMessage = `合約執行失敗: ${error.reason || error.message}`;
      }

      if (onError) {
        onError(error);
      }

      alert(`❌ 設置失敗: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="set-voting-time-section">
      <div className="section-header">
        <h3>⏰ 設置投票時間</h3>
        <div className="contract-info-inline">
          <span>合約: </span>
          <code className="contract-address-inline">{CONTRACT_ADDRESS}</code>
        </div>
      </div>

      <div className="time-inputs-container">
        <div className="time-inputs-grid">
          <div className="time-input-group">
            <label htmlFor="startTime">
              <span className="label-icon">🕐</span>
              開始時間
            </label>
            <input
              type="datetime-local"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="time-input-group">
            <label htmlFor="endTime">
              <span className="label-icon">🕕</span>
              結束時間
            </label>
            <input
              type="datetime-local"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        </div>

        {(startTime || endTime) && (
          <div className="time-preview">
            <h4>⏰ 時間預覽</h4>
            <div className="time-preview-content">
              <div className="time-preview-item">
                <span className="phase-label">投票期間:</span>
                <span className="phase-time">
                  {startTime ? formatTimestamp(dateTimeToTimestamp(startTime)) : '未設定'} → {endTime ? formatTimestamp(dateTimeToTimestamp(endTime)) : '未設定'}
                </span>
              </div>
              {startTime && endTime && (
                <div className="time-preview-item">
                  <span className="phase-label">持續時間:</span>
                  <span className="phase-time">
                    {Math.floor((dateTimeToTimestamp(endTime) - dateTimeToTimestamp(startTime)) / 60)} 分鐘
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="time-actions">
          <button
            className="btn-set-time"
            onClick={handleSetVotingTime}
            disabled={isLoading || !startTime || !endTime}
          >
            {isLoading ? '⏳ 設置中...' : '⏰ 設置投票時間'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetVotingTime;