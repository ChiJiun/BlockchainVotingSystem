import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractABI } from '../ABI.js';

const ResultsPage = ({ account }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [votingStatus, setVotingStatus] = useState(null);
  const [winningProposal, setWinningProposal] = useState(null);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError('');

      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      const rpcUrl = import.meta.env.VITE_RPC_URL;

      if (!contractAddress || !rpcUrl) {
        throw new Error('請設定環境變數');
      }

      // 創建 provider
      let provider;
      if (window.ethereum && account) {
        provider = new ethers.BrowserProvider(window.ethereum);
      } else {
        provider = new ethers.JsonRpcProvider(rpcUrl);
      }

      const contract = new ethers.Contract(contractAddress, contractABI, provider);

      // 獲取投票狀態
      const status = await contract.getVotingStatus();
      setVotingStatus({
        hasEnded: status.hasEnded,
        isActive: status.isActive,
        isRevealPeriod: status.isRevealPeriod,
        resultsPublic: status.resultsPublic,
        proposalCount: Number(status.proposalCount)
      });

      // 檢查是否可以查看結果
      if (!status.resultsPublic) {
        if (status.isActive) {
          setError('投票進行中，結果尚未公開');
        } else if (status.isRevealPeriod) {
          setError('投票已結束，正在等待揭密期結束');
        } else {
          setError('結果尚未公開');
        }
        setLoading(false);
        return;
      }

      // 獲取提案和投票結果
      const [proposalNames, voteCounts] = await contract.getAllProposals();
      
      // 計算總投票數
      const totalVotes = voteCounts.reduce((sum, count) => sum + Number(count), 0);

      // 轉換數據格式
      const formattedResults = proposalNames.map((name, index) => {
        const votes = Number(voteCounts[index]);
        const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
        
        return {
          id: index,
          title: ethers.decodeBytes32String(name),
          votes: votes,
          percentage: parseFloat(percentage)
        };
      });

      // 按票數排序
      formattedResults.sort((a, b) => b.votes - a.votes);
      setResults(formattedResults);

      // 獲取獲勝提案
      try {
        const winner = await contract.getWinningProposal();
        setWinningProposal({
          index: Number(winner.winningProposal),
          votes: Number(winner.winningVoteCount),
          isTie: winner.isTie
        });
      } catch (winnerError) {
        console.warn('無法獲取獲勝提案:', winnerError);
      }

    } catch (err) {
      console.error('獲取結果失敗:', err);
      let errorMessage = err.message;
      
      if (err.message.includes('ResultsNotYetPublic')) {
        errorMessage = '投票結果尚未公開，請等待揭密期結束';
      } else if (err.message.includes('NoProposalsAvailable')) {
        errorMessage = '沒有可用的提案';
      } else if (err.message.includes('VotingInProgress')) {
        errorMessage = '投票仍在進行中';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [account]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>📊 投票結果</h2>
        <p style={{ color: '#666', fontSize: '16px' }}>載入中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>📊 投票結果</h2>
        
        <div style={{
          padding: '20px',
          backgroundColor: '#ffebee',
          borderRadius: '8px',
          color: '#c62828',
          border: '2px solid #f44336',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#c62828', marginBottom: '15px' }}>無法載入結果</h3>
          <p style={{ color: '#d32f2f', marginBottom: '15px', fontSize: '16px' }}>{error}</p>
          <button 
            onClick={fetchResults}
            style={{
              background: '#f44336',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            重新載入
          </button>
        </div>

        {/* 投票狀態信息 */}
        {votingStatus && (
          <div style={{
            padding: '20px',
            backgroundColor: '#e8f5e8',
            borderRadius: '8px',
            color: '#2e7d32',
            border: '2px solid #4caf50',
            marginTop: '20px'
          }}>
            <h4 style={{ color: '#1b5e20', marginBottom: '15px' }}>投票狀態</h4>
            <ul style={{ paddingLeft: '20px', color: '#2e7d32' }}>
              <li>投票狀態: {votingStatus.isActive ? '進行中' : '已結束'}</li>
              <li>是否在揭密期: {votingStatus.isRevealPeriod ? '是' : '否'}</li>
              <li>結果是否公開: {votingStatus.resultsPublic ? '是' : '否'}</li>
              <li>提案數量: {votingStatus.proposalCount}</li>
            </ul>
          </div>
        )}
      </div>
    );
  }

  const totalVotes = results.reduce((sum, result) => sum + result.votes, 0);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>📊 投票結果</h2>
      
      {/* 總投票數和狀態 */}
      <div style={{
        padding: '20px',
        backgroundColor: '#f0f2f5',
        borderRadius: '8px',
        marginBottom: '30px',
        textAlign: 'center',
        border: '1px solid #ddd'
      }}>
        <h3 style={{ color: '#333', marginBottom: '10px' }}>總投票數：{totalVotes} 票</h3>
        {votingStatus && (
          <div style={{ marginTop: '10px', fontSize: '14px', color: '#555' }}>
            <span>狀態: {votingStatus.hasEnded ? '投票已結束' : '投票進行中'}</span>
            {votingStatus.isRevealPeriod && <span> | 揭密期</span>}
          </div>
        )}
      </div>

      {/* 獲勝提案 */}
      {winningProposal && results.length > 0 && (
        <div style={{
          padding: '20px',
          backgroundColor: winningProposal.isTie ? '#fff8e1' : '#e8f5e8',
          borderRadius: '8px',
          marginBottom: '30px',
          border: `3px solid ${winningProposal.isTie ? '#ff9800' : '#4caf50'}`
        }}>
          <h3 style={{ 
            margin: '0 0 10px 0', 
            color: winningProposal.isTie ? '#e65100' : '#1b5e20',
            fontSize: '20px'
          }}>
            {winningProposal.isTie ? '🤝 平手結果' : '🏆 獲勝提案'}
          </h3>
          {winningProposal.isTie ? (
            <p style={{ margin: 0, color: '#f57c00', fontSize: '16px', fontWeight: 'bold' }}>
              多個提案獲得相同票數 ({winningProposal.votes} 票)
            </p>
          ) : (
            <p style={{ margin: 0, color: '#2e7d32', fontSize: '16px', fontWeight: 'bold' }}>
              {results[winningProposal.index]?.title} - {winningProposal.votes} 票
            </p>
          )}
        </div>
      )}

      {/* 投票結果列表 */}
      <div style={{ marginBottom: '30px' }}>
        {results.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            color: '#495057',
            border: '2px solid #dee2e6'
          }}>
            <h3 style={{ color: '#6c757d', marginBottom: '15px' }}>沒有投票結果</h3>
            <p style={{ color: '#6c757d', fontSize: '16px' }}>目前沒有可顯示的投票結果</p>
          </div>
        ) : (
          results.map((result, index) => (
            <div
              key={result.id}
              style={{
                padding: '20px',
                border: `2px solid ${index === 0 && !winningProposal?.isTie ? '#4caf50' : '#e0e0e0'}`,
                borderRadius: '8px',
                marginBottom: '15px',
                backgroundColor: index === 0 && !winningProposal?.isTie ? '#f1f8e9' : '#fff'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '15px' 
              }}>
                <h4 style={{ 
                  margin: 0, 
                  color: index === 0 && !winningProposal?.isTie ? '#1b5e20' : '#333',
                  fontSize: '18px'
                }}>
                  {index === 0 && !winningProposal?.isTie && '🏆 '}
                  {result.title}
                </h4>
                <span style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: index === 0 && !winningProposal?.isTie ? '#2e7d32' : '#1976d2',
                  backgroundColor: index === 0 && !winningProposal?.isTie ? '#e8f5e8' : '#e3f2fd',
                  padding: '8px 12px',
                  borderRadius: '20px'
                }}>
                  {result.votes} 票 ({result.percentage}%)
                </span>
              </div>
              
              {/* 進度條 */}
              <div style={{
                width: '100%',
                height: '24px',
                backgroundColor: '#f5f5f5',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid #ddd'
              }}>
                <div style={{
                  width: `${result.percentage}%`,
                  height: '100%',
                  backgroundColor: index === 0 && !winningProposal?.isTie ? '#4caf50' : '#2196f3',
                  transition: 'width 0.5s ease',
                  borderRadius: '12px'
                }}></div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 刷新按鈕 */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button 
          onClick={fetchResults}
          disabled={loading}
          style={{
            background: loading ? '#9e9e9e' : '#2196f3',
            color: 'white',
            border: 'none',
            padding: '14px 28px',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }}
        >
          {loading ? '載入中...' : '🔄 刷新結果'}
        </button>
      </div>

      {/* 說明信息 */}
      <div style={{
        padding: '18px',
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        color: '#0d47a1',
        border: '2px solid #2196f3'
      }}>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
          <strong style={{ color: '#1565c0' }}>說明：</strong>
          <span style={{ color: '#1976d2' }}>
            數據直接來自區塊鏈智能合約，點擊「刷新結果」按鈕獲取最新結果。
            {votingStatus?.isRevealPeriod && ' 目前處於揭密期，結果可能會持續更新。'}
          </span>
        </p>
      </div>
    </div>
  );
};

export default ResultsPage;