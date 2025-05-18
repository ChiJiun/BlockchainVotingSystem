import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import './App.css'
import detectEthereumProvider from '@metamask/detect-provider'

const contractAddress = '0x12cc9447ceb3f8e75ddf4463a1a4d9feb42bdfec'
import { contractABI } from './abi';

function App() {
  const [account, setAccount] = useState(null)
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(false)

  const connectWallet = async () => {
    setLoading(true)
    console.log('connectWallet 被呼叫了')
    try {
      // 檢查 MetaMask 是否正確安裝
      if (typeof window.ethereum === 'undefined') {
        alert('找不到以太坊提供者，請安裝 MetaMask')
        setLoading(false)
        return
      }

      // 先嘗試獲取所有可用錢包擴充的資訊
      if (window.ethereum?.providers) {
        const providers = window.ethereum.providers;
        console.log('找到多個錢包擴充:', providers);
        providers.forEach((p, i) => {
          console.log(`錢包 ${i}:`, {
            isMetaMask: p.isMetaMask,
            selectedAddress: p.selectedAddress,
            chainId: p.chainId
          });
        });
      } else {
        console.log('單一錢包環境:', {
          isMetaMask: window.ethereum?.isMetaMask,
          selectedAddress: window.ethereum?.selectedAddress,
          chainId: window.ethereum?.chainId
        });
      }

      // 使用官方套件找出 MetaMask provider
      // 注意：Rabby 錢包會模擬 MetaMask API，所以我們需要明確檢查
      let provider = await detectEthereumProvider()
      
      if (provider) {
        // 檢查是否實際上是 Rabby 錢包
        if (provider._isRabby || provider.isRabby) {
          console.log('偵測到 Rabby 錢包，而非真正的 MetaMask')
          
          // 在有多個提供者的情況下，嘗試找到真正的 MetaMask
          if (window.ethereum?.providers) {
            // 嘗試找到沒有 _isRabby 的 MetaMask
            const realMetaMask = window.ethereum.providers.find(p => 
              p.isMetaMask && !p._isRabby && !p.isRabby)
            
            if (realMetaMask) {
              console.log('找到真正的 MetaMask')
              provider = realMetaMask
            } else {
              console.log('沒有找到真正的 MetaMask，將使用 Rabby 錢包')
              // 如果必須使用 Rabby，請確保它已經解鎖
              if (provider._isUnlocked === false) {
                alert('您的 Rabby 錢包似乎是鎖定狀態。請先解鎖 Rabby 錢包。')
                setLoading(false)
                return
              }
            }
          }
        }
      }
      
      if (!provider) {
        alert('請先安裝 MetaMask 錢包')
        setLoading(false)
        return
      }
      
      console.log('已找到 MetaMask!', provider)
      
      // 先直接檢查 provider 是否有 selectedAddress
      if (provider.selectedAddress) {
        console.log('已有選定的帳戶:', provider.selectedAddress)
        setAccount(provider.selectedAddress)
        
        // 建立 ethers provider、signer 與合約實例
        const ethersProvider = new ethers.BrowserProvider(provider)
        const signer = await ethersProvider.getSigner()
        const contractInstance = new ethers.Contract(contractAddress, contractABI, signer)
        setContract(contractInstance)
        console.log('已連接合約')
        setLoading(false)
        return
      }
      
      // 獲取帳戶
      // 先試試 eth_accounts 而非 eth_requestAccounts (不會彈出確認視窗)
      let accounts = await provider.request({ method: 'eth_accounts' })
      console.log('現有帳戶:', accounts)
      
      if (accounts.length === 0) {
        // 如果沒有找到帳戶，再嘗試請求用戶確認
        console.log('沒有發現現有帳戶，嘗試 eth_requestAccounts')
        try {
          accounts = await provider.request({ method: 'eth_requestAccounts' })
        } catch (reqError) {
          console.error('請求帳戶錯誤:', reqError)
          if (reqError.code === 4001) {
            alert('您拒絕了帳戶請求或 MetaMask 沒有帳戶。請在 MetaMask 中建立並解鎖帳戶。')
          } else {
            alert(`MetaMask 連接錯誤: ${reqError.message || reqError}`)
          }
          setLoading(false)
          return
        }
      }
      
      if (accounts.length === 0) {
        alert('請在 MetaMask 中建立或解鎖至少一個帳戶')
        setLoading(false)
        return
      }
      
      setAccount(accounts[0])
      console.log('已連接帳戶:', accounts[0])
        
      // 建立 ethers provider、signer 與合約實例
      const ethersProvider = new ethers.BrowserProvider(provider)
      const signer = await ethersProvider.getSigner()
      const contractInstance = new ethers.Contract(contractAddress, contractABI, signer)
      setContract(contractInstance)
      console.log('已連接合約')
    } catch (error) {
      console.error('連接錢包錯誤:', error)
      // 若用戶拒絕或未解鎖任何帳戶
      if (error.code === 4001) {
        alert('請在 MetaMask 中解鎖至少一個帳戶後再試')
      } else {
        alert(`連接錢包錯誤: ${error.message || error}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const vote = async (proposalIndex) => {
    if (!contract) {
      alert('尚未連接合約')
      return
    }
    try {
      const tx = await contract.vote(proposalIndex)
      await tx.wait()
      alert('投票成功')
    } catch (error) {
      console.error('投票失敗:', error)
    }
  }

  return (
    <div className="App">
      <h1>區塊鏈投票系統</h1>
      {account ? (
        <>
          <p>已連接帳戶：{account}</p>
          <button onClick={() => vote(0)}>投票給提案 0</button>
          <button onClick={() => vote(1)}>投票給提案 1</button>
        </>
      ) : (
        <button onClick={connectWallet} disabled={loading}>
          {loading ? '連接中...' : '連接錢包'}
        </button>
      )}
    </div>
  )
}

export default App
