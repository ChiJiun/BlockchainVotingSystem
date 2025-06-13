import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { contractABI } from '../ABI.js'
import Time, { getTimeData, getCurrentPhaseValue } from "./Time.jsx"
import MetaCommitVote from './MetaCommitVote.jsx';
import RevealVote from './RevealVote.jsx';
import './VotingPage.css'

function VotingPage() {
  const { isConnected, address, chain } = useAccount()
  const [proposals, setProposals] = useState([])
  const [isGranting, setIsGranting] = useState(false)
  const [selectedProposalIndex, setSelectedProposalIndex] = useState(null)
  const [currentPhase, setCurrentPhase] = useState('載入中...') // 當前階段狀態
  const [timeData, setTimeData] = useState(null) // 時間資料狀態
  
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

  // 獲取時間資料並計算當前階段
  useEffect(() => {
    const fetchAndUpdatePhase = async () => {
      try {
        const data = await getTimeData()
        if (data) {
          setTimeData(data)
          const phase = getCurrentPhaseValue(data, new Date())
          setCurrentPhase(phase)
        } else {
          setCurrentPhase('無法獲取時間資料')
        }
      } catch (error) {
        console.error('獲取階段狀態失敗:', error)
        setCurrentPhase('狀態錯誤')
      }
    }

    // 初始獲取
    fetchAndUpdatePhase()

    // 降低更新頻率：從 30 秒改為 2 分鐘
    const dataInterval = setInterval(fetchAndUpdatePhase, 120000)

    return () => clearInterval(dataInterval)
  }, [])

  // 每秒更新階段狀態（使用已獲取的時間資料）
  useEffect(() => {
    if (!timeData) return

    const updatePhase = () => {
      try {
        const phase = getCurrentPhaseValue(timeData, new Date())
        setCurrentPhase(phase)
      } catch (error) {
        console.error('更新階段狀態失敗:', error)
        setCurrentPhase('狀態錯誤')
      }
    }

    // 每秒更新階段
    const phaseInterval = setInterval(updatePhase, 1000)

    return () => clearInterval(phaseInterval)
  }, [timeData])

  // 檢查合約地址
  if (!CONTRACT_ADDRESS) {
    return (
      <div className="error-container">
        <h2 className="voting-page-title">📋 投票系統</h2>
        <p className="error-message">❌ 未設定合約地址，檢查 .env 文件中的 VITE_CONTRACT_ADDRESS</p>
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

  // 現在您可以在整個組件中使用 currentPhase 變數
  console.log('當前投票階段:', currentPhase)

  // 主要渲染
  return (
    <div className="voting-page">
      <h2 className="voting-page-title">📋 投票系統</h2>
      
      {/* Time 組件置中顯示 */}
      <div className="time-center">
        <Time />
      </div>
      
      {/* 根據階段顯示不同的狀態提示 */}
      {currentPhase === '投票尚未開始' && (
        <div style={{ padding: '15px', background: '#fff3cd', borderRadius: '8px', margin: '15px 0', textAlign: 'center' }}>
          ⏳ 投票尚未開始，請等待投票開始時間
        </div>
      )}

      {currentPhase === '投票進行中' && (
        <div style={{ padding: '15px', background: '#d1ecf1', borderRadius: '8px', margin: '15px 0', textAlign: 'center' }}>
          ✅ 投票正在進行中，您可以提交投票！
        </div>
      )}

      {currentPhase === '投票已結束，等待揭曉' && (
        <div style={{ padding: '15px', background: '#fff3cd', borderRadius: '8px', margin: '15px 0', textAlign: 'center' }}>
          ⏰ 投票已結束，現在可以揭曉您的投票！
        </div>
      )}

      {currentPhase === '結果已揭曉' && (
        <div style={{ padding: '15px', background: '#d4edda', borderRadius: '8px', margin: '15px 0', textAlign: 'center' }}>
          🎉 投票結果已揭曉！
        </div>
      )}

      {currentPhase === '投票已結束' && (
        <div style={{ padding: '15px', background: '#f8d7da', borderRadius: '8px', margin: '15px 0', textAlign: 'center' }}>
          ⏹️ 投票已結束
        </div>
      )}

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
      
      {/* 條件性顯示 MetaCommitVote 組件 - 僅在投票進行中時顯示 */}
      {currentPhase === '投票進行中' && (
        <MetaCommitVote 
          proposals={proposals}
          selectedProposalIndex={selectedProposalIndex}
          onProposalSelect={setSelectedProposalIndex}
          currentPhase={currentPhase}
        />
      )}
      
      {/* 條件性顯示 RevealVote 組件 - 僅在投票結束等待揭曉期間顯示 */}
      {currentPhase === '投票已結束，等待揭曉' && (
        <RevealVote 
          onRevealSuccess={(data) => console.log('揭曉成功:', data)}
          onRevealError={(error) => console.error('揭曉失敗:', error)}
          currentPhase={currentPhase}
        />
      )}

      {/* 在頁面底部顯示當前階段 */}
      <div className="phase-display-footer">
        <div className="phase-display-content">
          <h4>📊 當前投票階段</h4>
          <div className={`phase-status-display ${
            currentPhase.includes('進行中') ? 'active' : 
            currentPhase.includes('已結束') && currentPhase.includes('等待揭曉') ? 'ended' : 
            currentPhase.includes('已揭曉') ? 'revealed' : 'pending'
          }`}>
            {currentPhase}
          </div>
          <div className="phase-timestamp">
            更新時間: {new Date().toLocaleString('zh-TW')}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VotingPage