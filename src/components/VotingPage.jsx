import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { contractABI } from '../ABI.js' // 導入您的 ABI

function VotingPage() {
  const { isConnected, address, chain } = useAccount()
  const [proposals, setProposals] = useState([])
  
  // 從環境變數讀取智能合約地址
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS

  // 讀取所有提案 - 移除錢包連接的限制
  const { data: proposalsData, isError, isLoading: proposalsLoading, refetch, error } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractABI,
    functionName: 'getAllProposals',
    enabled: !!CONTRACT_ADDRESS, // 只要有合約地址就執行，不需要錢包連接
  })

  // 添加除錯日誌
  useEffect(() => {
    console.log('=== VotingPage 除錯信息 ===')
    console.log('錢包連接狀態:', isConnected)
    console.log('錢包地址:', address)
    console.log('當前網路:', chain?.name, chain?.id)
    console.log('合約地址:', CONTRACT_ADDRESS)
    console.log('ABI 函數數量:', contractABI?.length)
    console.log('proposalsData:', proposalsData)
    console.log('isError:', isError)
    console.log('error:', error)
    console.log('========================')
  }, [isConnected, address, chain, CONTRACT_ADDRESS, proposalsData, isError, error])

  // 處理提案數據
  useEffect(() => {
    if (proposalsData) {
      console.log('處理提案數據:', proposalsData)
      try {
        // 檢查返回的數據格式
        if (Array.isArray(proposalsData)) {
          setProposals(proposalsData)
        } else {
          console.warn('提案數據不是陣列格式:', proposalsData)
          setProposals([])
        }
      } catch (err) {
        console.error('處理提案數據時發生錯誤:', err)
        setProposals([])
      }
    }
  }, [proposalsData])

  // 檢查合約地址是否已設定
  if (!CONTRACT_ADDRESS) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2 style={{ color: '#000' }}>📋 提案列表</h2>
        <p style={{ color: 'red' }}>❌ 未設定合約地址，檢查 .env 文件中的 VITE_CONTRACT_ADDRESS</p>
      </div>
    )
  }

  // 顯示載入狀態
  if (proposalsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2 style={{ color: '#000' }}>📋 提案列表</h2>
        <p style={{ color: '#000' }}>⏳ 載入提案中...</p>
        <div style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
          <p>合約地址: {CONTRACT_ADDRESS}</p>
          {chain && <p>網路: {chain?.name} ({chain?.id})</p>}
        </div>
      </div>
    )
  }

  // 顯示錯誤狀態
  if (isError) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2 style={{ color: '#000' }}>📋 提案列表</h2>
        <p style={{ color: 'red' }}>❌ 載入提案失敗</p>
        
        {/* 詳細錯誤信息 */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#ffe6e6',
          borderRadius: '8px',
          border: '1px solid #ff9999',
          textAlign: 'left',
          maxWidth: '600px',
          margin: '20px auto'
        }}>
          <h4 style={{ color: '#000', marginTop: 0 }}>錯誤詳情:</h4>
          <div style={{ fontSize: '14px', color: '#000' }}>
            <p><strong>錯誤訊息:</strong> {error?.message || '未知錯誤'}</p>
            <p><strong>合約地址:</strong> {CONTRACT_ADDRESS}</p>
            <p><strong>錢包地址:</strong> {address || '未連接'}</p>
            <p><strong>當前網路:</strong> {chain?.name ? `${chain.name} (ID: ${chain.id})` : '未連接'}</p>
            <p><strong>錢包連接:</strong> {isConnected ? '已連接' : '未連接'}</p>
          </div>
          
          {error && (
            <details style={{ marginTop: '10px' }}>
              <summary style={{ cursor: 'pointer', color: '#000' }}>顯示完整錯誤</summary>
              <pre style={{ 
                marginTop: '8px', 
                whiteSpace: 'pre-wrap', 
                fontSize: '12px',
                backgroundColor: '#f5f5f5',
                padding: '10px',
                borderRadius: '4px',
                overflow: 'auto'
              }}>
                {JSON.stringify(error, null, 2)}
              </pre>
            </details>
          )}
        </div>
        
        <button 
          onClick={() => {
            console.log('重新載入提案...')
            refetch()
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '15px'
          }}
        >
          🔄 重新載入
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#000' }}>📋 提案列表</h2>
      
      {/* 顯示連接信息 - 可選顯示 */}
      {isConnected ? (
        <div style={{
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: '#e8f5e8',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#000'
        }}>
          <p>✅ 錢包已連接: {address}</p>
          <p>🌐 網路: {chain?.name} (ID: {chain?.id})</p>
          <p>📄 合約: {CONTRACT_ADDRESS}</p>
        </div>
      ) : (
        <div style={{
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: '#fff3cd',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#856404',
          border: '1px solid #ffeaa7'
        }}>
          <p>ℹ️ 您可以查看提案，但需要連接錢包才能投票</p>
          <p>📄 合約: {CONTRACT_ADDRESS}</p>
        </div>
      )}
      
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#000' }}>所有提案：</h3>
        {proposals && proposals.length > 0 ? (
          proposals.map((proposal, index) => (
            <div
              key={proposal.id || index}
              style={{
                padding: '20px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                marginBottom: '15px',
                backgroundColor: '#fff'
              }}
            >
              <h4 style={{ margin: '0 0 10px 0', color: '#000' }}>
                📋 {proposal.title || proposal.name || `提案 ${index + 1}`}
              </h4>
              <p style={{ margin: '0 0 10px 0', color: '#000' }}>
                {proposal.description || proposal.desc || '無描述'}
              </p>
              <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#000' }}>
                <span>🆔 提案ID: {proposal.id || index}</span>
                {proposal.voteCount && (
                  <span>📊 票數: {proposal.voteCount.toString()}</span>
                )}
                {proposal.isActive !== undefined && (
                  <span style={{ color: proposal.isActive ? '#28a745' : '#dc3545' }}>
                    {proposal.isActive ? '✅ 投票中' : '❌ 已結束'}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#000',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '2px dashed #ddd'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>📋</div>
            <h4>目前沒有提案</h4>
            <p style={{ margin: '10px 0 0 0' }}>可能是合約中還沒有提案，或者合約函數返回空數組</p>
            <button 
              onClick={() => refetch()}
              style={{
                marginTop: '15px',
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              🔄 重新載入提案
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default VotingPage