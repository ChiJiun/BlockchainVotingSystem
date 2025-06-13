import { useState } from 'react'
import { useAccount } from 'wagmi'
import { giveRightToVote, checkVotingRight } from './giveRight.js'

function GiveRightToVote({ 
  buttonText = "🗳️ 獲得投票權", 
  onSuccess = null, 
  onError = null,
  compact = false,
  showStatus = true 
}) {
  const { isConnected, address } = useAccount()
  const [isGranting, setIsGranting] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [votingRightStatus, setVotingRightStatus] = useState(null)

  // 處理獲得投票權
  const handleGrantVotingRight = async () => {
    if (!address) {
      alert('請先連接錢包')
      return
    }

    setIsGranting(true)

    try {
      const result = await giveRightToVote(address)
      
      if (result.success) {
        if (result.alreadyHasRights) {
          alert(`您已經擁有投票權！`)
        } else {
          alert(`投票權授予成功！\n交易哈希: ${result.txHash}`)
        }
        
        // 更新狀態
        setVotingRightStatus(true)
        
        // 調用成功回調
        if (onSuccess) {
          onSuccess(result)
        }
      } else {
        alert(`授予失敗: ${result.message}`)
        if (onError) {
          onError(result)
        }
      }
    } catch (error) {
      console.error('獲得投票權失敗:', error)
      alert('操作失敗，請檢查控制台')
      if (onError) {
        onError(error)
      }
    } finally {
      setIsGranting(false)
    }
  }

  // 檢查投票權狀態
  const handleCheckVotingRight = async () => {
    if (!address) return

    setIsChecking(true)
    try {
      const hasRight = await checkVotingRight(address)
      setVotingRightStatus(hasRight)
    } catch (error) {
      console.error('檢查投票權失敗:', error)
      setVotingRightStatus(null)
    } finally {
      setIsChecking(false)
    }
  }

  // 組件加載時自動檢查投票權狀態
  React.useEffect(() => {
    if (isConnected && address && showStatus) {
      handleCheckVotingRight()
    }
  }, [isConnected, address])

  // 如果是緊湊模式，只顯示按鈕
  if (compact) {
    return (
      <button
        onClick={handleGrantVotingRight}
        disabled={!isConnected || isGranting}
        style={{
          padding: '10px 20px',
          backgroundColor: !isConnected 
            ? '#6c757d' 
            : isGranting 
              ? '#6c757d' 
              : votingRightStatus 
                ? '#28a745' 
                : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: (!isConnected || isGranting) ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          fontSize: '14px'
        }}
      >
        {!isConnected 
          ? '🔒 需要連接錢包' 
          : isGranting 
            ? '⏳ 處理中...' 
            : votingRightStatus 
              ? '✅ 已有投票權' 
              : buttonText
        }
      </button>
    )
  }

  // 完整模式顯示
  return (
    <div style={{
      marginBottom: '20px',
      padding: '15px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
      <h4 style={{ margin: '0 0 15px 0', color: '#000', fontSize: '16px' }}>
        🗳️ 投票權管理
      </h4>

      {/* 顯示當前狀態 */}
      {isConnected && address && showStatus && (
        <div style={{ marginBottom: '15px' }}>
          <p style={{ margin: '0 0 8px 0', color: '#000', fontSize: '14px' }}>
            <strong>錢包地址:</strong>
            <br />
            <code style={{ 
              backgroundColor: '#e9ecef', 
              padding: '2px 6px', 
              borderRadius: '3px',
              fontSize: '12px',
              wordBreak: 'break-all'
            }}>
              {address}
            </code>
          </p>
          
          {votingRightStatus !== null && (
            <p style={{ 
              margin: '8px 0 0 0', 
              color: votingRightStatus ? '#28a745' : '#dc3545',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              投票權狀態: {votingRightStatus ? '✅ 已擁有' : '❌ 未擁有'}
            </p>
          )}
        </div>
      )}

      {/* 操作按鈕 */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={handleGrantVotingRight}
          disabled={!isConnected || isGranting}
          style={{
            padding: '10px 20px',
            backgroundColor: !isConnected 
              ? '#6c757d' 
              : isGranting 
                ? '#6c757d' 
                : votingRightStatus 
                  ? '#28a745' 
                  : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: (!isConnected || isGranting) ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          {!isConnected 
            ? '🔒 需要連接錢包' 
            : isGranting 
              ? '⏳ 處理中...' 
              : votingRightStatus 
                ? '✅ 已有投票權' 
                : buttonText
          }
        </button>

        {showStatus && isConnected && (
          <button
            onClick={handleCheckVotingRight}
            disabled={isChecking}
            style={{
              padding: '10px 20px',
              backgroundColor: isChecking ? '#6c757d' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: isChecking ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            {isChecking ? '⏳ 檢查中...' : '🔍 重新檢查'}
          </button>
        )}
      </div>

      {/* 未連接錢包的提示 */}
      {!isConnected && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#fff3cd',
          borderRadius: '6px',
          border: '1px solid #ffeaa7',
          fontSize: '14px',
          color: '#856404'
        }}>
          ⚠️ 請先連接錢包才能管理投票權
        </div>
      )}
    </div>
  )
}

export default GiveRightToVote