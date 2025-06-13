import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { contractABI } from '../ABI.js'
import { giveRightToVote } from './giveRight.js'
import Time from "./Time.jsx"
import CommitButton from './CommitButton.jsx'
import './VotingPage.css'

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

  // 處理獲得投票權
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

  // 轉換 Solidity 字符串
  const convertSolidityString = (value) => {
    if (!value) return ''
    
    try {
      // 如果已經是可讀字符串
      if (typeof value === 'string' && !/^\d+$/.test(value) && !/^0x[0-9a-fA-F]+$/.test(value)) {
        return value
      }
      
      // 處理十六進制字符串格式
      if (typeof value === 'string' && value.startsWith('0x')) {
        const hex = value.slice(2)
        let result = ''
        for (let i = 0; i < hex.length; i += 2) {
          const byte = parseInt(hex.substr(i, 2), 16)
          if (byte > 0 && byte < 128) {
            result += String.fromCharCode(byte)
          }
        }
        return result.replace(/\0/g, '').trim()
      }
      
      // 處理 BigInt 類型
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
      
      if (bigintValue === 0n) return ''
      
      // 轉換為十六進制並解析為 ASCII
      let hex = bigintValue.toString(16)
      if (hex.length % 2 !== 0) {
        hex = '0' + hex
      }
      
      let result = ''
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.substr(i, 2), 16)
        if (byte > 0 && byte < 128) {
          result += String.fromCharCode(byte)
        }
      }
      
      return result.replace(/\0/g, '').trim()
      
    } catch (error) {
      console.error('字符串轉換錯誤:', error)
      return ''
    }
  }

  // 格式化提案數據
  const formatProposalData = (proposalNames, voteCount, index) => {
    let proposalName = `提案 ${index + 1}`
    let votes = 0
    
    try {
      // 處理提案名稱
      if (proposalNames && proposalNames[index] !== undefined) {
        const convertedName = convertSolidityString(proposalNames[index])
        if (convertedName && convertedName.trim().length > 0) {
          proposalName = convertedName.trim()
        }
      }
      
      // 處理投票數
      if (voteCount && voteCount[index] !== undefined) {
        const voteValue = voteCount[index]
        if (typeof voteValue === 'bigint') {
          votes = Number(voteValue)
        } else if (typeof voteValue === 'number') {
          votes = voteValue
        } else if (typeof voteValue === 'string') {
          votes = parseInt(voteValue) || 0
        }
      }
      
    } catch (error) {
      console.error(`處理提案 ${index + 1} 時發生錯誤:`, error)
    }
    
    return {
      id: index,
      name: proposalName,
      voteCount: votes
    }
  }

  // 處理提案數據
  useEffect(() => {
    if (proposalsData) {
      try {
        let processedProposals = []
        
        // getAllProposals 回傳格式: [proposalNames[], voteCount[]]
        if (Array.isArray(proposalsData) && proposalsData.length === 2) {
          const [proposalNames, voteCounts] = proposalsData
          
          if (Array.isArray(proposalNames) && Array.isArray(voteCounts)) {
            const proposalCount = Math.min(proposalNames.length, voteCounts.length)
            processedProposals = Array.from({ length: proposalCount }, (_, index) => {
              return formatProposalData(proposalNames, voteCounts, index)
            })
          }
        }
        
        setProposals(processedProposals)
        
      } catch (error) {
        console.error('處理提案數據時發生錯誤:', error)
        setProposals([])
      }
    } else {
      setProposals([])
    }
  }, [proposalsData])

  // 檢查合約地址
  if (!CONTRACT_ADDRESS) {
    return (
      <div className="error-container">
        <h2 className="voting-page-title">📋 投票系統</h2>
        <p className="error-message">❌ 未設定合約地址，檢查 .env 文件中的 VITE_CONTRACT_ADDRESS</p>
      </div>
    )
  }

  // 載入狀態
  if (proposalsLoading) {
    return (
      <div className="error-container">
        <h2 className="voting-page-title">📋 投票系統</h2>
        <p className="loading-message">⏳ 載入中...</p>
        <div className="network-info">
          <p>合約地址: {CONTRACT_ADDRESS}</p>
          {chain && <p>網路: {chain?.name} ({chain?.id})</p>}
        </div>
      </div>
    )
  }

  // 錯誤狀態
  if (isError) {
    return (
      <div className="error-container">
        <h2 className="voting-page-title">📋 投票系統</h2>
        <p className="error-message">❌ 載入失敗</p>
        
        <div className="error-details">
          <h4>錯誤詳情:</h4>
          <div className="error-details-content">
            <p><strong>錯誤訊息:</strong> {error?.message || '未知錯誤'}</p>
            <p><strong>合約地址:</strong> {CONTRACT_ADDRESS}</p>
            <p><strong>錢包地址:</strong> {address || '未連接'}</p>
            <p><strong>當前網路:</strong> {chain?.name ? `${chain.name} (ID: ${chain.id})` : '未連接'}</p>
            <p><strong>錢包連接:</strong> {isConnected ? '已連接' : '未連接'}</p>
          </div>
          
          {error && (
            <details>
              <summary>顯示完整錯誤</summary>
              <pre>{JSON.stringify(error, null, 2)}</pre>
            </details>
          )}
        </div>
        
        <button onClick={() => refetch()} className="reload-button">
          🔄 重新載入
        </button>
      </div>
    )
  }

  // 主要渲染
  return (
    <div className="voting-page">
      <h2 className="voting-page-title">📋 投票系統</h2>
      <Time />
      
      {/* 投票權區域 */}
      <div className="voting-rights-section">
        <div className="voting-rights-content">
          {isConnected && address ? (
            <div>
              <p className="wallet-address-display">
                <strong>目標錢包地址:</strong> 
                <code className="wallet-address-code">{address}</code>
              </p>
              <button
                onClick={handleGrantVotingRight}
                disabled={isGranting}
                className={`grant-voting-button ${isGranting ? 'loading' : 'active'}`}
              >
                {isGranting ? '⏳ 獲得中...' : '✅ 認證獲得投票權'}
              </button>
            </div>
          ) : (
            <div>
              <p className="wallet-warning">⚠️ 請先連接錢包才能獲得投票權</p>
              <button disabled className="grant-voting-button disabled">
                🔒 需要連接錢包
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 連接信息 */}
      {isConnected ? (
        <div className="connection-info connected">
          <div className="connection-grid">
            <div><strong>錢包狀態:</strong> ✅ 已連接</div>
            <div><strong>網路:</strong> {chain?.name} ({chain?.id})</div>
            <div className="connection-grid-full"><strong>錢包地址:</strong> {address}</div>
            <div className="connection-grid-full"><strong>合約地址:</strong> {CONTRACT_ADDRESS}</div>
          </div>
        </div>
      ) : (
        <div className="connection-info disconnected">
          <p>ℹ️ 請先連接錢包才能進行操作</p>
          <p><strong>合約地址:</strong> {CONTRACT_ADDRESS}</p>
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