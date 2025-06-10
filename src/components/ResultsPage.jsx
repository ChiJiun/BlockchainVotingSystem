import { useState, useEffect } from 'react'

function ResultsPage() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  // 模擬結果數據
  useEffect(() => {
    setTimeout(() => {
      setResults([
        { id: 1, title: '提案 A：增加社區預算', votes: 45, percentage: 35.7 },
        { id: 2, title: '提案 B：環保政策', votes: 67, percentage: 53.2 },
        { id: 3, title: '提案 C：教育改革', votes: 14, percentage: 11.1 }
      ])
      setLoading(false)
    }, 1000)
  }, [])

  const totalVotes = results.reduce((sum, result) => sum + result.votes, 0)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2>📊 投票結果</h2>
        <p>載入中...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>📊 投票結果</h2>
      
      <div style={{
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        <h3>總投票數：{totalVotes} 票</h3>
      </div>

      <div style={{ marginBottom: '30px' }}>
        {results.map((result) => (
          <div
            key={result.id}
            style={{
              padding: '20px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              marginBottom: '15px',
              backgroundColor: '#fff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0, color: '#333' }}>{result.title}</h4>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>
                {result.votes} 票 ({result.percentage}%)
              </span>
            </div>
            
            {/* 進度條 */}
            <div style={{
              width: '100%',
              height: '20px',
              backgroundColor: '#e9ecef',
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${result.percentage}%`,
                height: '100%',
                backgroundColor: '#007bff',
                transition: 'width 0.5s ease'
              }}></div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '15px',
        backgroundColor: '#fff3cd',
        borderRadius: '8px',
        color: '#856404',
        border: '1px solid #ffeaa7'
      }}>
        <p style={{ margin: 0 }}>
          <strong>注意：</strong>投票結果每 5 分鐘更新一次，數據來自區塊鏈智能合約。
        </p>
      </div>
    </div>
  )
}

export default ResultsPage