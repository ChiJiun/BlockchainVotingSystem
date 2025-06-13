import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { contractABI } from '../ABI.js'
import ResetVoting from './ResetVoting.jsx'
import SetVotingTime from './SetVotingTime';
import './AdminPage.css'

function AdminPage() {
  const { address, isConnected } = useAccount()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [newProposal, setNewProposal] = useState({ title: '', description: '' })
  const [proposals, setProposals] = useState([])
  const [showSetTimeModal, setShowSetTimeModal] = useState(false);

  // 從環境變數獲取合約地址
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS

  // 讀取合約中的 chairperson 地址
  const { data: chairpersonAddress, isError, isLoading: contractLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractABI,
    functionName: 'chairperson',
  })

  // 檢查是否為管理員
  useEffect(() => {
    if (isConnected && address && chairpersonAddress) {
      const isChairperson = address.toLowerCase() === chairpersonAddress.toLowerCase()
      setIsAdmin(isChairperson)
      setIsLoading(false)
    } else if (!isConnected) {
      setIsLoading(false)
    }
  }, [address, isConnected, chairpersonAddress])

  // 處理合約讀取錯誤
  useEffect(() => {
    if (isError) {
      console.error('無法讀取合約數據')
      setIsLoading(false)
    }
  }, [isError])

  const handleCreateProposal = async () => {
    if (!newProposal.title || !newProposal.description) {
      alert('請填寫完整的提案信息')
      return
    }

    try {
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

  // 載入中狀態
  if (isLoading || contractLoading) {
    return (
      <div className="status-container">
        <h2>⚙️ 管理面板</h2>
        <div className="status-box loading">
          <p>正在驗證管理員權限...</p>
        </div>
      </div>
    )
  }

  // 未連接錢包
  if (!isConnected) {
    return (
      <div className="status-container">
        <h2>⚙️ 管理面板</h2>
        <div className="status-box warning">
          <p>請先連接錢包以使用管理功能</p>
        </div>
      </div>
    )
  }

  // 合約讀取錯誤
  if (isError) {
    return (
      <div className="status-container">
        <h2>⚙️ 管理面板</h2>
        <div className="status-box error">
          <p>無法連接到智能合約，請檢查網絡連接和合約地址配置。</p>
        </div>
      </div>
    )
  }

  // 非管理員用戶
  if (!isAdmin) {
    return (
      <div className="status-container">
        <h2>⚙️ 管理面板</h2>
        <div className="status-box error">
          <p>您沒有管理員權限，無法訪問此頁面。</p>
          <p>只有合約部署者（chairperson）才能訪問管理功能。</p>
        </div>
      </div>
    )
  }

  // 管理員界面
  return (
    <div className="admin-page">
      <h2 className="admin-page-title">
        ⚙️ 管理面板
        <div className="admin-address">
          管理員地址: {address}
        </div>
      </h2>
      <ResetVoting account={address} />
      <SetVotingTime
        onClose={() => setShowSetTimeModal(false)}
        onSuccess={(result) => {
          console.log('設置成功:', result);
          setShowSetTimeModal(false);
        }}
        onError={(error) => {
          console.error('設置失敗:', error);
        }}
      />
    </div>
  )
}

export default AdminPage