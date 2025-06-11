import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { contractABI } from '../ABI.js'

function VotingPage() {
  const { isConnected, address, chain } = useAccount()
  const [proposals, setProposals] = useState([])
  const [isRequestingRights, setIsRequestingRights] = useState(false)
  const [requestStatus, setRequestStatus] = useState(null)
  
  // 從環境變數讀取智能合約地址
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS

  // 讀取所有提案
  const { data: proposalsData, isError, isLoading: proposalsLoading, refetch, error } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractABI,
    functionName: 'getAllProposals',
    enabled: !!CONTRACT_ADDRESS,
  })

  // 檢查用戶是否已有投票權
  const { data: hasVotingRight, isLoading: checkingRights, refetch: refetchRights } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractABI,
    functionName: 'hasVotingRight',
    args: [address],
    enabled: !!CONTRACT_ADDRESS && !!address && isConnected,
  })

  // 處理投票權申請
  const handleRequestVotingRights = async () => {
    if (!isConnected || !address) {
      alert('請先連接錢包')
      return
    }

    setIsRequestingRights(true)
    setRequestStatus(null)

    try {
      const token = import.meta.env.VITE_GITHUB_TOKEN
      
      if (!token) {
        throw new Error('GitHub Token 未設定，請檢查環境變數 VITE_GITHUB_TOKEN')
      }

      console.log('🔍 發送投票權申請...')
      console.log('錢包地址:', address)
      console.log('鏈 ID:', chain?.id)

      const response = await fetch('https://api.github.com/repos/ChiJiun/BlockchainVotingSystem/actions/workflows/give-right.yml/dispatches', {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            walletAddress: address,
            chainId: chain?.id?.toString() || '',
            requestTimestamp: new Date().toISOString()
          }
        })
      })

      console.log('GitHub API 回應狀態:', response.status)

      if (response.ok) {
        console.log('✅ GitHub Actions 觸發成功')
        setRequestStatus({
          type: 'success',
          message: '✅ 投票權申請已提交！GitHub Actions 正在處理中...',
          details: `錢包地址: ${address}`
        })
        
        // 30 秒後自動重新檢查投票權
        setTimeout(() => {
          refetchRights()
        }, 30000)
        
      } else {
        const errorText = await response.text()
        console.error('GitHub API 詳細錯誤:', errorText)
        
        if (response.status === 404) {
          throw new Error('找不到 GitHub Actions workflow 文件。請確保倉庫中存在 .github/workflows/give-right.yml 文件')
        } else if (response.status === 401) {
          throw new Error('GitHub Token 認證失敗。請檢查 token 是否正確且有效')
        } else if (response.status === 403) {
          throw new Error('GitHub Token 權限不足。請確保 token 有 Actions 權限')
        } else {
          throw new Error(`GitHub API 錯誤 (${response.status}): ${errorText}`)
        }
      }

    } catch (error) {
      console.error('申請投票權失敗:', error)
      setRequestStatus({
        type: 'error',
        message: `❌ 申請失敗: ${error.message}`,
        details: '請檢查錯誤信息並重試'
      })
    } finally {
      setIsRequestingRights(false)
    }
  }

  // 處理提案數據
  useEffect(() => {
    console.log('=== VotingPage 除錯信息 ===')
    console.log('錢包連接狀態:', isConnected)
    console.log('錢包地址:', address)
    console.log('當前網路:', chain?.name, chain?.id)
    console.log('合約地址:', CONTRACT_ADDRESS)
    console.log('ABI 函數數量:', contractABI?.length)
    console.log('proposalsData:', proposalsData)
    console.log('proposalsData 類型:', typeof proposalsData)
    console.log('是否為陣列:', Array.isArray(proposalsData))
    console.log('isError:', isError)
    console.log('error:', error)
    console.log('hasVotingRight:', hasVotingRight)
    console.log('========================')

    if (proposalsData) {
      console.log('處理提案數據:', proposalsData)
      try {
        let processedProposals = []
        
        if (Array.isArray(proposalsData)) {
          // 如果是陣列，直接處理
          processedProposals = proposalsData.map((proposal, index) => {
            console.log(`提案 ${index}:`, proposal)
            
            // 處理不同的數據格式
            if (typeof proposal === 'object' && proposal !== null) {
              // 如果是物件，嘗試提取屬性
              return {
                id: proposal.id || proposal[0] || index,
                title: proposal.title || proposal.name || proposal[1] || `提案 ${index + 1}`,
                description: proposal.description || proposal.desc || proposal[2] || '無描述',
                voteCount: proposal.voteCount || proposal.votes || proposal[3] || 0,
                isActive: proposal.isActive !== undefined ? proposal.isActive : proposal[4] !== undefined ? proposal[4] : true
              }
            } else if (Array.isArray(proposal)) {
              // 如果提案本身是陣列（可能來自 Solidity struct）
              return {
                id: proposal[0] || index,
                title: proposal[1] || `提案 ${index + 1}`,
                description: proposal[2] || '無描述',
                voteCount: proposal[3] || 0,
                isActive: proposal[4] !== undefined ? proposal[4] : true
              }
            } else {
              // 如果是基本類型
              return {
                id: index,
                title: `提案 ${index + 1}`,
                description: proposal.toString() || '無描述',
                voteCount: 0,
                isActive: true
              }
            }
          })
        } else if (proposalsData && typeof proposalsData === 'object') {
          // 如果是單一物件，轉換為陣列
          processedProposals = [proposalsData]
        }
        
        console.log('處理後的提案:', processedProposals)
        setProposals(processedProposals)
      } catch (err) {
        console.error('處理提案數據時發生錯誤:', err)
        setProposals([])
      }
    }
  }, [proposalsData, isConnected, address, chain, CONTRACT_ADDRESS, isError, error, hasVotingRight])

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
          onClick={() => refetch()}
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
      
      {/* 投票權管理區域 */}
      {isConnected && (
        <div style={{
          marginBottom: '30px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '10px',
          border: '2px solid #e9ecef'
        }}>
          <h3 style={{ color: '#000', marginTop: 0, marginBottom: '15px' }}>🗳️ 投票權管理</h3>
          
          {checkingRights ? (
            <div style={{ color: '#666' }}>
              <span>⏳ 檢查投票權狀態中...</span>
            </div>
          ) : hasVotingRight ? (
            <div style={{
              padding: '15px',
              backgroundColor: '#d4edda',
              borderRadius: '8px',
              border: '1px solid #c3e6cb',
              color: '#155724'
            }}>
              <span style={{ fontSize: '18px' }}>✅ 您已擁有投票權！</span>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                您可以對下方的提案進行投票
              </p>
            </div>
          ) : (
            <div>
              <div style={{
                padding: '15px',
                backgroundColor: '#fff3cd',
                borderRadius: '8px',
                border: '1px solid #ffeaa7',
                color: '#856404',
                marginBottom: '15px'
              }}>
                <span style={{ fontSize: '16px' }}>⚠️ 您尚未擁有投票權</span>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                  點擊下方按鈕申請投票權，系統將自動處理您的申請
                </p>
              </div>

              <button
                onClick={handleRequestVotingRights}
                disabled={isRequestingRights}
                style={{
                  padding: '12px 24px',
                  backgroundColor: isRequestingRights ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isRequestingRights ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isRequestingRights ? (
                  <>
                    <span>⏳</span>
                    <span>處理中...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>申請投票權</span>
                  </>
                )}
              </button>

              {/* 申請狀態顯示 */}
              {requestStatus && (
                <div style={{
                  marginTop: '15px',
                  padding: '15px',
                  borderRadius: '8px',
                  backgroundColor: requestStatus.type === 'success' ? '#d4edda' : '#f8d7da',
                  border: `1px solid ${requestStatus.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                  color: requestStatus.type === 'success' ? '#155724' : '#721c24'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                    {requestStatus.message}
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    {requestStatus.details}
                  </div>
                  {requestStatus.type === 'success' && (
                    <div style={{ 
                      marginTop: '10px', 
                      fontSize: '13px',
                      color: '#0c5460',
                      backgroundColor: '#b8daff',
                      padding: '8px',
                      borderRadius: '4px'
                    }}>
                      💡 提示: 處理可能需要 1-2 分鐘，請稍後刷新頁面查看結果
                      <button
                        onClick={() => refetchRights()}
                        style={{
                          marginLeft: '10px',
                          padding: '4px 8px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        🔄 檢查狀態
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 顯示連接信息 */}
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
          <p>🗳️ 投票權: {hasVotingRight ? '✅ 已擁有' : '❌ 未擁有'}</p>
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
      
      {/* 提案列表 */}
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
                📋 {proposal.title}
              </h4>
              <p style={{ margin: '0 0 10px 0', color: '#000' }}>
                {proposal.description}
              </p>
              <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#000' }}>
                <span>🆔 提案ID: {proposal.id}</span>
                <span>📊 票數: {proposal.voteCount?.toString() || '0'}</span>
                <span style={{ color: proposal.isActive ? '#28a745' : '#dc3545' }}>
                  {proposal.isActive ? '✅ 投票中' : '❌ 已結束'}
                </span>
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