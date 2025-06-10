import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'

function AdminPanel() {
  const { address, isConnected } = useAccount()
  const [isAdmin, setIsAdmin] = useState(false)
  const [newProposal, setNewProposal] = useState({ title: '', description: '' })
  const [proposals, setProposals] = useState([])

  // 檢查是否為管理員（這裡簡化處理，實際應該檢查智能合約）
  useEffect(() => {
    if (isConnected && address) {
      // 模擬管理員檢查
      const adminAddresses = ['0x1234...', '0x5678...'] // 實際應該從合約獲取
      setIsAdmin(true) // 為了演示目的，暫時設為 true
    }
  }, [address, isConnected])

  const handleCreateProposal = async () => {
    if (!newProposal.title || !newProposal.description) {
      alert('請填寫完整的提案信息')
      return
    }

    try {
      // 這裡將來會連接智能合約
      const proposal = {
        id: proposals.length + 1,
        title: newProposal.title,
        description: newProposal.description,
        votes: 0,
        status: '進行中',
        createdAt: new Date().toLocaleDateString()
      }
      
      setProposals([...proposals, proposal])
      setNewProposal({ title: '', description: '' })
      alert('提案創建成功！')
    } catch (error) {
      console.error('創建提案失敗:', error)
      alert('創建提案失敗，請重試')
    }
  }

  const handleEndVoting = (proposalId) => {
    setProposals(proposals.map(p => 
      p.id === proposalId ? { ...p, status: '已結束' } : p
    ))
    alert(`提案 ${proposalId} 的投票已結束`)
  }

  if (!isConnected) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2>⚙️ 管理面板</h2>
        <p>請先連接錢包以使用管理功能</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2>⚙️ 管理面板</h2>
        <div style={{
          padding: '20px',
          backgroundColor: '#f8d7da',
          borderRadius: '8px',
          color: '#721c24',
          border: '1px solid #f5c6cb'
        }}>
          <p>您沒有管理員權限，無法訪問此頁面。</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>⚙️ 管理面板</h2>
      
      {/* 創建新提案 */}
      <div style={{
        padding: '20px',
        border: '2px solid #007bff',
        borderRadius: '8px',
        marginBottom: '30px',
        backgroundColor: '#f8f9fa'
      }}>
        <h3>創建新提案</h3>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            提案標題：
          </label>
          <input
            type="text"
            value={newProposal.title}
            onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '16px'
            }}
            placeholder="輸入提案標題"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            提案描述：
          </label>
          <textarea
            value={newProposal.description}
            onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
            rows="4"
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '16px',
              resize: 'vertical'
            }}
            placeholder="輸入提案詳細描述"
          />
        </div>
        
        <button
          onClick={handleCreateProposal}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          創建提案
        </button>
      </div>

      {/* 提案管理 */}
      <div>
        <h3>提案管理</h3>
        {proposals.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666' }}>暫無提案</p>
        ) : (
          proposals.map((proposal) => (
            <div
              key={proposal.id}
              style={{
                padding: '20px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                marginBottom: '15px',
                backgroundColor: '#fff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>{proposal.title}</h4>
                  <p style={{ margin: '0 0 10px 0', color: '#666' }}>{proposal.description}</p>
                  <div style={{ fontSize: '14px', color: '#888' }}>
                    <span>狀態：{proposal.status}</span> | 
                    <span> 創建時間：{proposal.createdAt}</span> | 
                    <span> 當前票數：{proposal.votes}</span>
                  </div>
                </div>
                
                {proposal.status === '進行中' && (
                  <button
                    onClick={() => handleEndVoting(proposal.id)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginLeft: '15px'
                    }}
                  >
                    結束投票
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default AdminPanel