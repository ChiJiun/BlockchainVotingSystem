import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { contractABI } from '../ABI.js'
import { giveRightToVote, checkVotingRight } from './giveRight.js'
import Time from "./Time.jsx"; // 確保引入路徑正確
import CommitButton from './CommitButton.jsx'

function VotingPage() {
  const { isConnected, address, chain } = useAccount()
  const [proposals, setProposals] = useState([])
  const [isGranting, setIsGranting] = useState(false)
  const [selectedProposalIndex, setSelectedProposalIndex] = useState(null)
  
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

  // 更強健的 uint256/bytes32 轉換函數
  const convertSolidityString = (value) => {
    if (!value) return ''
    
    try {
      console.log('轉換值:', value, '類型:', typeof value)
      
      // 如果已經是可讀字符串
      if (typeof value === 'string' && !/^\d+$/.test(value) && !/^0x[0-9a-fA-F]+$/.test(value)) {
        return value
      }
      
      // 處理十六進制字符串格式 (如 0x416c696365...)
      if (typeof value === 'string' && value.startsWith('0x')) {
        const hex = value.slice(2) // 去除 0x 前綴
        console.log('處理十六進制字符串:', hex)
        
        let result = ''
        for (let i = 0; i < hex.length; i += 2) {
          const byte = parseInt(hex.substr(i, 2), 16)
          if (byte > 0 && byte < 128) {
            result += String.fromCharCode(byte)
          }
        }
        
        const cleanResult = result.replace(/\0/g, '').trim()
        console.log('十六進制字符串轉換結果:', cleanResult)
        
        if (cleanResult.length > 0) {
          return cleanResult
        }
      }
      
      let bigintValue
      if (typeof value === 'bigint') {
        bigintValue = value
      } else if (typeof value === 'number') {
        bigintValue = BigInt(value)
      } else if (typeof value === 'string') {
        bigintValue = BigInt(value)
      } else {
        return value.toString()
      }
      
      // 如果值為 0，返回空字符串
      if (bigintValue === 0n) {
        console.log('值為 0，返回空字符串')
        return ''
      }
      
      // 轉換為十六進制
      let hex = bigintValue.toString(16)
      if (hex.length % 2 !== 0) {
        hex = '0' + hex
      }
      
      console.log('十六進制值:', hex)
      
      // 方法1: 嘗試直接從十六進制轉換為 ASCII
      let result = ''
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.substr(i, 2), 16)
        if (byte > 0 && byte < 128) {
          result += String.fromCharCode(byte)
        }
      }
      
      const cleanResult = result.replace(/\0/g, '').trim()
      console.log('ASCII 轉換結果:', cleanResult)
      
      if (cleanResult.length > 0) {
        return cleanResult
      }
      
      // 方法2: 嘗試反向讀取（小端序）
      result = ''
      for (let i = hex.length - 2; i >= 0; i -= 2) {
        const byte = parseInt(hex.substr(i, 2), 16)
        if (byte > 0 && byte < 128) {
          result = String.fromCharCode(byte) + result
        }
      }
      
      const cleanResult2 = result.replace(/\0/g, '').trim()
      console.log('反向 ASCII 轉換結果:', cleanResult2)
      
      if (cleanResult2.length > 0) {
        return cleanResult2
      }
      
      // 如果所有轉換都失敗，返回空字符串（不是原始數值）
      return ''
      
    } catch (error) {
      console.error('字符串轉換錯誤:', error)
      return ''
    }
  }

  // 修改 formatProposalData 函數，專門處理 getAllProposals 的回傳格式
  const formatProposalData = (proposalNames, voteCount, index) => {
    console.log(`\n=== 處理提案 ${index + 1} ===`)
    console.log('提案名稱原始數據:', proposalNames[index])
    console.log('投票數原始數據:', voteCount[index])
    
    let proposalName = `提案 ${index + 1}` // 默認名稱
    let votes = 0
    
    try {
      // 處理提案名稱 (bytes32)
      if (proposalNames && proposalNames[index] !== undefined) {
        const convertedName = convertSolidityString(proposalNames[index])
        console.log('轉換後的名稱:', convertedName)
        
        if (convertedName && convertedName.trim().length > 0) {
          proposalName = convertedName.trim()
        }
      }
      
      // 處理投票數 (uint)
      if (voteCount && voteCount[index] !== undefined) {
        const voteValue = voteCount[index]
        console.log('投票數值:', voteValue, '類型:', typeof voteValue)
        
        try {
          if (typeof voteValue === 'bigint') {
            votes = Number(voteValue)
          } else if (typeof voteValue === 'number') {
            votes = voteValue
          } else if (typeof voteValue === 'string') {
            votes = parseInt(voteValue) || 0
          } else {
            votes = 0
          }
        } catch (e) {
          console.log('投票數轉換失敗:', e)
          votes = 0
        }
      }
      
    } catch (error) {
      console.error(`處理提案 ${index + 1} 時發生錯誤:`, error)
    }
    
    const result = {
      id: index,
      name: proposalName,
      voteCount: votes
    }
    
    console.log(`提案 ${index + 1} 最終結果:`, result)
    console.log('========================\n')
    
    return result
  }

  // 處理提案數據的 useEffect
  useEffect(() => {
    console.log('\n=== VotingPage 數據處理 ===')
    console.log('proposalsData:', proposalsData)
    console.log('proposalsData 類型:', typeof proposalsData)
    console.log('是否為陣列:', Array.isArray(proposalsData))
    
    if (proposalsData) {
      console.log('開始處理提案數據...')
      
      try {
        let processedProposals = []
        
        // getAllProposals 回傳格式: [proposalNames[], voteCount[]]
        if (Array.isArray(proposalsData) && proposalsData.length === 2) {
          const [proposalNames, voteCounts] = proposalsData
          console.log('proposalNames:', proposalNames)
          console.log('voteCounts:', voteCounts)
          
          if (Array.isArray(proposalNames) && Array.isArray(voteCounts)) {
            const proposalCount = Math.min(proposalNames.length, voteCounts.length)
            console.log(`處理 ${proposalCount} 個提案`)
            
            processedProposals = Array.from({ length: proposalCount }, (_, index) => {
              return formatProposalData(proposalNames, voteCounts, index)
            })
          } else {
            console.log('提案數據格式不正確')
            processedProposals = []
          }
        } else if (Array.isArray(proposalsData)) {
          // 兼容舊格式或其他格式
          console.log('使用兼容模式處理提案數據')
          processedProposals = proposalsData.map((proposal, index) => {
            // 如果是舊的格式處理方式
            return formatProposalDataLegacy(proposal, index)
          })
        } else {
          console.log('未知的數據格式:', proposalsData)
          processedProposals = []
        }
        
        console.log('最終處理的提案列表:', processedProposals)
        setProposals(processedProposals)
        
      } catch (error) {
        console.error('處理提案數據時發生錯誤:', error)
        setProposals([])
      }
    } else {
      console.log('沒有提案數據')
      setProposals([])
    }
    
    console.log('=========================\n')
  }, [proposalsData])

  // 保留舊的處理函數作為兼容性備用
  const formatProposalDataLegacy = (proposalData, index) => {
    // ...原來的 formatProposalData 邏輯...
    let proposalName = `提案 ${index + 1}`
    let voteCount = 0
    
    // 簡化的處理邏輯
    if (Array.isArray(proposalData) && proposalData.length >= 1) {
      const convertedName = convertSolidityString(proposalData[0])
      if (convertedName && convertedName.trim().length > 0) {
        proposalName = convertedName.trim()
      }
      
      if (proposalData.length >= 2) {
        try {
          voteCount = typeof proposalData[1] === 'bigint' ? Number(proposalData[1]) : Number(proposalData[1]) || 0
        } catch (e) {
          voteCount = 0
        }
      }
    }
    
    return {
      id: index,
      name: proposalName,
      voteCount: voteCount
    }
  }

  // 檢查合約地址是否已設定
  if (!CONTRACT_ADDRESS) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2 style={{ color: '#000' }}>📋 投票系統</h2>
        <p style={{ color: 'red' }}>❌ 未設定合約地址，檢查 .env 文件中的 VITE_CONTRACT_ADDRESS</p>
      </div>
    )
  }


  // 顯示載入狀態
  if (proposalsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2 style={{ color: '#000' }}>📋 投票系統</h2>
        <p style={{ color: '#000' }}>⏳ 載入中...</p>
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
        <h2 style={{ color: '#000' }}>📋 投票系統</h2>
        <p style={{ color: 'red' }}>❌ 載入失敗</p>
        
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
      <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#000' }}>📋 投票系統</h2>
      <Time />
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
          <p style={{ margin: 0 }}>ℹ️ 請先連接錢包才能進行操作</p>
          <p style={{ margin: '8px 0 0 0' }}><strong>合約地址:</strong> {CONTRACT_ADDRESS}</p>
        </div>
      )}
      
      {/* CommitButton 組件 */}
      <CommitButton 
        proposals={proposals}
        selectedProposalIndex={selectedProposalIndex}
        onProposalSelect={setSelectedProposalIndex}
      />
    </div>
  )
}

export default VotingPage