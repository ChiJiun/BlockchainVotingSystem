import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { contractABI } from '../ABI.js'
import { giveRightToVote, checkVotingRight } from './giveRight.js'

function VotingPage() {
  const { isConnected, address, chain } = useAccount()
  const [proposals, setProposals] = useState([])
  const [isGranting, setIsGranting] = useState(false)
  
  // 從環境變數讀取智能合約地址
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS

  // 讀取所有提案
  const { data: proposalsData, isError, isLoading: proposalsLoading, refetch, error } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractABI,
    functionName: 'getAllProposals',
    enabled: !!CONTRACT_ADDRESS,
  })

  // 處理獲得投票權 - 使用當前連接的錢包地址
  const handleGrantVotingRight = async () => {
    if (!isConnected || !address) {
      alert('請先連接錢包')
      return
    }

    setIsGranting(true)

    try {
      const result = await giveRightToVote(address)
      
      if (result.success) {
        alert(`投票權獲得成功！\n目標地址: ${address}\n交易哈希: ${result.txHash}`)
      } else {
        alert(`獲得失敗: ${result.message}`)
      }
    } catch (error) {
      console.error('獲得投票權失敗:', error)
      alert('操作失敗，請檢查控制台')
    } finally {
      setIsGranting(false)
    }
  }

  // 將 uint256 轉換為字符串
  const uint256ToString = (uint256Value) => {
    if (!uint256Value) return ''
    
    try {
      // 如果是 BigInt 或數字，直接轉換
      if (typeof uint256Value === 'bigint' || typeof uint256Value === 'number') {
        const hexString = uint256Value.toString(16)
        // 移除前導零
        const cleanHex = hexString.replace(/^0+/, '') || '0'
        // 將十六進制轉換為字符串（假設每兩個字符是一個 ASCII 字符）
        let result = ''
        for (let i = 0; i < cleanHex.length; i += 2) {
          const byte = parseInt(cleanHex.substr(i, 2), 16)
          if (byte > 0) { // 跳過空字節
            result += String.fromCharCode(byte)
          }
        }
        return result || uint256Value.toString()
      }
      
      // 如果是字符串格式的數字
      if (typeof uint256Value === 'string') {
        // 如果已經是可讀的字符串，直接返回
        if (!/^\d+$/.test(uint256Value) && !/^0x[0-9a-fA-F]+$/.test(uint256Value)) {
          return uint256Value
        }
        
        // 嘗試將十六進制或十進制字符串轉換
        const num = BigInt(uint256Value)
        return uint256ToString(num)
      }
      
      return uint256Value.toString()
    } catch (error) {
      console.error('轉換 uint256 為字符串時出錯:', error)
      return uint256Value.toString()
    }
  }

  // 處理提案數據 - 簡化版本，只處理名稱
  const formatProposalData = (proposal, index) => {
    try {
      let proposalName = `提案 ${index + 1}`
      
      if (Array.isArray(proposal)) {
        // Solidity struct 格式 [name, ...]
        if (proposal[0] !== undefined) {
          proposalName = uint256ToString(proposal[0]) || proposalName
        } else if (proposal[1] !== undefined) {
          proposalName = uint256ToString(proposal[1]) || proposalName
        }
      } else if (typeof proposal === 'object' && proposal !== null) {
        // 物件格式
        if (proposal.name !== undefined) {
          proposalName = uint256ToString(proposal.name) || proposalName
        } else if (proposal.title !== undefined) {
          proposalName = uint256ToString(proposal.title) || proposalName
        } else if (proposal[0] !== undefined) {
          proposalName = uint256ToString(proposal[0]) || proposalName
        }
      } else if (proposal) {
        // 直接是名稱
        proposalName = uint256ToString(proposal) || proposalName
      }
      
      return {
        id: index,
        name: proposalName
      }
    } catch (error) {
      console.error(`處理提案 ${index} 時發生錯誤:`, error)
      return {
        id: index,
        name: `提案 ${index + 1}`
      }
    }
  }

  // 處理提案數據
  useEffect(() => {
    console.log('=== VotingPage 除錯信息 ===')
    console.log('錢包連接狀態:', isConnected)
    console.log('錢包地址:', address)
    console.log('當前網路:', chain?.name, chain?.id)
    console.log('合約地址:', CONTRACT_ADDRESS)
    console.log('proposalsData:', proposalsData)
    console.log('proposalsData 類型:', typeof proposalsData)
    console.log('是否為陣列:', Array.isArray(proposalsData))
    console.log('========================')

    if (proposalsData) {
      console.log('處理提案數據:', proposalsData)
      try {
        let processedProposals = []
        
        if (Array.isArray(proposalsData)) {
          // 如果是陣列，處理每個提案
          processedProposals = proposalsData.map((proposal, index) => {
            console.log(`原始提案 ${index}:`, proposal)
            const formatted = formatProposalData(proposal, index)
            console.log(`格式化提案 ${index}:`, formatted)
            return formatted
          })
        } else if (proposalsData && typeof proposalsData === 'object') {
          // 如果是單一物件，轉換為陣列
          const formatted = formatProposalData(proposalsData, 0)
          processedProposals = [formatted]
        }
        
        console.log('最終處理後的提案:', processedProposals)
        setProposals(processedProposals)
      } catch (err) {
        console.error('處理提案數據時發生錯誤:', err)
        setProposals([])
      }
    }
  }, [proposalsData, isConnected, address, chain, CONTRACT_ADDRESS, isError, error])

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

  // 顯示連接信息
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#000' }}>📋 提案列表</h2>
      
      {/* 簡化的獲得投票權區域 */}
      <div style={{
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #ddd'
      }}>
        <div style={{ textAlign: 'center' }}>
          {isConnected && address ? (
            <div>
              <p style={{ margin: '0 0 15px 0', color: '#000', fontSize: '14px' }}>
                <strong>目標錢包地址:</strong> 
                <code style={{ 
                  backgroundColor: '#e9ecef', 
                  padding: '2px 6px', 
                  borderRadius: '3px',
                  fontSize: '12px',
                  marginLeft: '8px',
                  wordBreak: 'break-all'
                }}>
                  {address}
                </code>
              </p>
              <button
                onClick={handleGrantVotingRight}
                disabled={isGranting}
                style={{
                  padding: '12px 24px',
                  backgroundColor: isGranting ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: isGranting ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {isGranting ? '⏳ 獲得中...' : '✅ 認證獲得投票權'}
              </button>
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 15px 0', color: '#856404' }}>
                ⚠️ 請先連接錢包才能獲得投票權
              </p>
              <button
                disabled
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'not-allowed',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                🔒 需要連接錢包
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 顯示連接信息 */}
      {isConnected ? (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#e8f5e8',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#000',
          border: '1px solid #c3e6cb'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <strong>錢包狀態:</strong> ✅ 已連接
            </div>
            <div>
              <strong>網路:</strong> {chain?.name} ({chain?.id})
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>錢包地址:</strong> {address}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>合約地址:</strong> {CONTRACT_ADDRESS}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#fff3cd',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#856404',
          border: '1px solid #ffeaa7'
        }}>
          <p style={{ margin: 0 }}>ℹ️ 您可以查看提案，但需要連接錢包才能操作</p>
          <p style={{ margin: '8px 0 0 0' }}><strong>合約地址:</strong> {CONTRACT_ADDRESS}</p>
        </div>
      )}
      
      {/* 提案列表 */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <h3 style={{ color: '#000', margin: 0 }}>所有提案</h3>
          <span style={{ 
            fontSize: '14px', 
            color: '#666',
            backgroundColor: '#f8f9fa',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            共 {proposals.length} 個
          </span>
        </div>

        {proposals && proposals.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {proposals.map((proposal, index) => (
              <div
                key={proposal.id}
                style={{
                  padding: '15px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  transition: 'all 0.2s ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#f8f9fa'
                  e.target.style.borderColor = '#007bff'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#fff'
                  e.target.style.borderColor = '#ddd'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ 
                    fontSize: '20px', 
                    color: '#007bff',
                    fontWeight: 'bold',
                    minWidth: '30px'
                  }}>
                    {index + 1}
                  </span>
                  <span style={{ 
                    color: '#000',
                    fontSize: '16px',
                    fontWeight: '500'
                  }}>
                    {proposal.name}
                  </span>
                </div>
                
                <span style={{ 
                  fontSize: '12px', 
                  color: '#666',
                  backgroundColor: '#f8f9fa',
                  padding: '2px 6px',
                  borderRadius: '3px'
                }}>
                  ID: {proposal.id}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 40px', 
            color: '#000',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            border: '2px dashed #ddd'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📋</div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>目前沒有提案</h4>
            <p style={{ margin: '0 0 20px 0', color: '#666' }}>
              可能是合約中還沒有提案，或者合約函數返回空數組
            </p>
            <button 
              onClick={() => refetch()}
              style={{
                padding: '12px 24px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#0056b3'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#007bff'}
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