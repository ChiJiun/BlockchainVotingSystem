import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractABI } from '../ABI.js';
import './ResetVoting.css';

const ResetVoting = ({ account }) => {
  const [formData, setFormData] = useState({
    proposalNames: '',
    startTime: '',
    endTime: '',
    revealTime: '',
    privacyMode: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contract, setContract] = useState(null);

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
          setContract(new ethers.Contract(contractAddress, contractABI, signer));
        } else {
          provider = new ethers.JsonRpcProvider(rpcUrl);
          setContract(new ethers.Contract(contractAddress, contractABI, provider));
        }
        
        setError('');
      } catch (err) {
        setError(err.message);
      }
    };
    
    initContract();
  }, [account]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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

      // 驗證輸入
      if (!formData.proposalNames.trim()) {
        throw new Error('請輸入提案名稱');
      }
      if (!formData.startTime || !formData.endTime || !formData.revealTime) {
        throw new Error('請填寫所有時間欄位');
      }

      // 轉換提案名稱為 bytes32
      const proposalNames = formData.proposalNames
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .map(name => {
          if (name.length > 31) {
            throw new Error(`提案名稱 "${name}" 太長，最大 31 字元`);
          }
          return ethers.encodeBytes32String(name);
        });

      // 轉換時間為 Unix 時間戳
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const endTime = Math.floor(new Date(formData.endTime).getTime() / 1000);
      const revealTime = Math.floor(new Date(formData.revealTime).getTime() / 1000);

      // 基本時間驗證
      const now = Math.floor(Date.now() / 1000);
      if (startTime <= now) throw new Error('開始時間必須晚於現在');
      if (endTime <= startTime) throw new Error('結束時間必須晚於開始時間');
      if (revealTime <= endTime) throw new Error('揭曉時間必須晚於結束時間');

      // 呼叫合約
      const tx = await contract.resetVoting(
        proposalNames,
        startTime,
        endTime,
        revealTime,
        formData.privacyMode
      );

      setSuccess(`交易已送出: ${tx.hash}`);
      
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        setSuccess(`投票重置成功！交易: ${tx.hash}`);
        // 重置表單
        setFormData({
          proposalNames: '',
          startTime: '',
          endTime: '',
          revealTime: '',
          privacyMode: false
        });
      }

    } catch (err) {
      console.error(err);
      let errorMsg = err.message;
      
      if (err.message.includes('OnlyChairperson')) {
        errorMsg = '只有主席可以重置投票';
      } else if (err.message.includes('user rejected')) {
        errorMsg = '使用者取消交易';
      } else if (err.message.includes('insufficient funds')) {
        errorMsg = '餘額不足';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-voting-container">
      <h2>重置投票系統</h2>
      
      {error && (
        <div style={{ color: 'red', padding: '10px', border: '1px solid red', margin: '10px 0' }}>
          錯誤：{error}
        </div>
      )}
      
      {success && (
        <div style={{ color: 'green', padding: '10px', border: '1px solid green', margin: '10px 0' }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>提案名稱 (用逗號分隔):</label>
          <input
            type="text"
            name="proposalNames"
            value={formData.proposalNames}
            onChange={handleInputChange}
            placeholder="提案A, 提案B, 提案C"
            required
          />
        </div>

        <div className="form-group">
          <label>開始時間:</label>
          <input
            type="datetime-local"
            name="startTime"
            value={formData.startTime}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>結束時間:</label>
          <input
            type="datetime-local"
            name="endTime"
            value={formData.endTime}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>揭曉時間:</label>
          <input
            type="datetime-local"
            name="revealTime"
            value={formData.revealTime}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="privacyMode"
              checked={formData.privacyMode}
              onChange={handleInputChange}
            />
            啟用隱私模式
          </label>
        </div>

        <button 
          type="submit" 
          disabled={loading || !contract || !account}
        >
          {loading ? '處理中...' : '重置投票'}
        </button>
      </form>
    </div>
  );
};

export default ResetVoting;