import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import VotingPage from './components/VotingPage'
import ResultsPage from './components/ResultsPage'
import AdminPanel from './components/AdminPage'
import './App.css'

function App() {
  const { address, isConnected } = useAccount()
  const [currentPage, setCurrentPage] = useState('voting') // 預設為投票頁面

  const pages = [
    { id: 'voting', name: '投票頁面', emoji: '🗳️' },
    { id: 'results', name: '結果查看', emoji: '📊' },
    { id: 'admin', name: '管理面板', emoji: '⚙️' },
  ]

  const renderPageContent = () => {
    switch(currentPage) {
      case 'voting':
        return <VotingPage />
      case 'results':
        return <ResultsPage />
      case 'admin':
        return <AdminPanel />
      default:
        return <VotingPage />
    }
  }

  return (
    <div className="App">
      <h1>區塊鏈投票系統</h1>

      {/* 錢包連接按鈕 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
        <ConnectButton showBalance={false} />
      </div>
      
      {/* 錢包連接狀態顯示 */}
      {isConnected && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#d4edda', 
          borderRadius: '8px',
          color: '#155724',
          border: '1px solid #c3e6cb',
          marginBottom: '30px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '16px' }}>✅ 錢包已連接：{address?.slice(0, 6)}...{address?.slice(-4)}</span>
        </div>
      )}

            {/* 頁面導航按鈕 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '15px',
        maxWidth: '500px',
        margin: '0 auto 30px auto'
      }}>
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => setCurrentPage(page.id)}
            style={{
              padding: '15px',
              fontSize: '14px',
              backgroundColor: currentPage === page.id ? '#007bff' : '#f8f9fa',
              color: currentPage === page.id ? 'white' : '#333',
              border: '2px solid #007bff',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span style={{ fontSize: '20px' }}>{page.emoji}</span>
            <span>{page.name}</span>
          </button>
        ))}
      </div>

      {/* 頁面內容 */}
      <div style={{ 
        marginTop: '20px', 
        padding: '20px', 
        backgroundColor: '#ffffff', 
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        minHeight: '400px'
      }}>
        {renderPageContent()}
      </div>
    </div>
  )
}

export default App
