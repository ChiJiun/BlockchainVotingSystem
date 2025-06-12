import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { contractABI } from '../ABI.js';
import './Time.css';

const Time = () => {
  const [timeData, setTimeData] = useState({
    startTime: null,
    endTime: null,
    revealTime: null,
    loading: true,
    error: null
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  // 使用 useCallback 來記憶化函數，避免重複執行
  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return '--';
    
    try {
      let timestampNum;
      if (typeof timestamp === 'bigint') {
        timestampNum = Number(timestamp);
      } else if (typeof timestamp === 'object' && timestamp._hex) {
        timestampNum = parseInt(timestamp._hex, 16);
      } else {
        timestampNum = Number(timestamp);
      }
      
      // 移除重複的 console.log，只在需要除錯時開啟
      // console.log('原始時間戳:', timestamp, '轉換後:', timestampNum);
      
      const date = new Date(timestampNum * 1000);
      
      if (isNaN(date.getTime())) {
        return '無效時間';
      }
      
      return date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('時間格式化錯誤:', error);
      return '格式錯誤';
    }
  }, []);

  const getTimeRemaining = useCallback((targetTimestamp) => {
    if (!targetTimestamp) return null;
    
    try {
      let timestampNum;
      if (typeof targetTimestamp === 'bigint') {
        timestampNum = Number(targetTimestamp);
      } else if (typeof targetTimestamp === 'object' && targetTimestamp._hex) {
        timestampNum = parseInt(targetTimestamp._hex, 16);
      } else {
        timestampNum = Number(targetTimestamp);
      }
      
      const target = new Date(timestampNum * 1000);
      const now = currentTime;
      const diff = target - now;
      
      if (diff <= 0) return '已結束';
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (days > 0) {
        return `${days}天 ${hours}小時 ${minutes}分鐘`;
      } else if (hours > 0) {
        return `${hours}小時 ${minutes}分鐘 ${seconds}秒`;
      } else {
        return `${minutes}分鐘 ${seconds}秒`;
      }
    } catch (error) {
      console.error('計算剩餘時間錯誤:', error);
      return '計算錯誤';
    }
  }, [currentTime]);

  const getCurrentPhase = useCallback(() => {
    try {
      const now = currentTime;
      
      let startTimeNum = null;
      let endTimeNum = null;
      let revealTimeNum = null;
      
      if (timeData.startTime) {
        startTimeNum = typeof timeData.startTime === 'bigint' ? 
          Number(timeData.startTime) : 
          (timeData.startTime._hex ? parseInt(timeData.startTime._hex, 16) : Number(timeData.startTime));
      }
      
      if (timeData.endTime) {
        endTimeNum = typeof timeData.endTime === 'bigint' ? 
          Number(timeData.endTime) : 
          (timeData.endTime._hex ? parseInt(timeData.endTime._hex, 16) : Number(timeData.endTime));
      }
      
      if (timeData.revealTime) {
        revealTimeNum = typeof timeData.revealTime === 'bigint' ? 
          Number(timeData.revealTime) : 
          (timeData.revealTime._hex ? parseInt(timeData.revealTime._hex, 16) : Number(timeData.revealTime));
      }
      
      if (!startTimeNum || !endTimeNum) return '未知階段';
      
      const startTime = new Date(startTimeNum * 1000);
      const endTime = new Date(endTimeNum * 1000);
      const revealTime = revealTimeNum ? new Date(revealTimeNum * 1000) : null;

      if (now < startTime) {
        return '投票尚未開始';
      } else if (now >= startTime && now < endTime) {
        return '投票進行中';
      } else if (revealTime && now >= endTime && now < revealTime) {
        return '投票已結束，等待揭曉';
      } else if (revealTime && now >= revealTime) {
        return '結果已揭曉';
      } else {
        return '投票已結束';
      }
    } catch (error) {
      console.error('階段判斷錯誤:', error);
      return '狀態錯誤';
    }
  }, [currentTime, timeData.startTime, timeData.endTime, timeData.revealTime]);

  // 使用 useCallback 來記憶化 fetchTimeData 函數
  const fetchTimeData = useCallback(async () => {
    try {
      console.log('🔍 開始獲取時間數據...');
      
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

      // 簡化除錯輸出，避免重複日誌
      const functionNames = contractABI
        .filter(item => item.type === 'function')
        .map(item => item.name);
      
      console.log('📋 可用函數:', functionNames);

      const results = {};
      const timeFields = [
        { key: 'startTime', possibleNames: ['startTime'] },
        { key: 'endTime', possibleNames: ['endTime'] },
        { key: 'revealTime', possibleNames: ['revealTime'] }
      ];

      for (const field of timeFields) {
        let foundValue = null;
        
        for (const funcName of field.possibleNames) {
          try {
            if (typeof contract[funcName] === 'function') {
              const result = await contract[funcName]();
              console.log(`✅ ${funcName}:`, result.toString());
              foundValue = result;
              break;
            }
          } catch (error) {
            // 靜默處理錯誤，避免過多日誌
          }
        }
        
        results[field.key] = foundValue;
      }

      setTimeData({
        startTime: results.startTime,
        endTime: results.endTime,
        revealTime: results.revealTime,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('❌ 獲取時間數據失敗:', error);
      setTimeData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  }, []); // 空依賴陣列，只在掛載時執行一次

  // 只在組件掛載時獲取一次數據
  useEffect(() => {
    fetchTimeData();
  }, [fetchTimeData]);

  // 每秒更新當前時間
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRefresh = useCallback(() => {
    setTimeData(prev => ({ ...prev, loading: true }));
    fetchTimeData();
  }, [fetchTimeData]);

  // 記憶化計算結果，避免重複計算
  const currentPhase = getCurrentPhase();

  if (timeData.loading) {
    return (
      <div className="time-widget">
        <div className="time-header">
          <h3>📅 投票時程</h3>
        </div>
        <div className="loading">載入中...</div>
      </div>
    );
  }

  if (timeData.error) {
    return (
      <div className="time-widget error">
        <div className="time-header">
          <h3>📅 投票時程</h3>
          <button onClick={handleRefresh} className="refresh-btn">🔄</button>
        </div>
        <div className="error-message">
          載入失敗: {timeData.error}
        </div>
      </div>
    );
  }

  return (
    <div className="time-widget">
      <div className="time-header">
        <h3>📅 投票時程</h3>
        <button onClick={handleRefresh} className="refresh-btn">🔄</button>
      </div>
      
      <div className="current-phase">
        <div className="phase-status">
          <span className={`status-indicator ${
            currentPhase.includes('進行中') ? 'active' : 
            currentPhase.includes('已結束') ? 'ended' : 'pending'
          }`}></span>
          {currentPhase}
        </div>
        <div className="current-time">
          當前時間: {currentTime.toLocaleString('zh-TW')}
        </div>
      </div>

      <div className="time-schedule">
        <div className="time-item">
          <div className="time-label">🚀 投票開始</div>
          <div className="time-value">
            {formatTimestamp(timeData.startTime)}
          </div>
          <div className="time-remaining">
            {timeData.startTime && (
              <span className="remaining">
                {getTimeRemaining(timeData.startTime)}
              </span>
            )}
          </div>
        </div>

        <div className="time-item">
          <div className="time-label">⏰ 投票結束</div>
          <div className="time-value">
            {formatTimestamp(timeData.endTime)}
          </div>
          <div className="time-remaining">
            {timeData.endTime && (
              <span className="remaining">
                {getTimeRemaining(timeData.endTime)}
              </span>
            )}
          </div>
        </div>

        {timeData.revealTime && (
          <div className="time-item">
            <div className="time-label">🎉 結果揭曉</div>
            <div className="time-value">
              {formatTimestamp(timeData.revealTime)}
            </div>
            <div className="time-remaining">
              <span className="remaining">
                {getTimeRemaining(timeData.revealTime)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Time;