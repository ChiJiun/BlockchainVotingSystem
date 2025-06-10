# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Ballot Contract - MetaVote 使用指南

## MetaVote 功能說明

MetaVote 允許投票者創建簽名，由主席代付 gas 費用執行投票交易。

## 簽署流程

### 1. 前端準備

```javascript
// 安裝依賴
npm install ethers

// 引入合約 ABI
const ballotContract = new ethers.Contract(contractAddress, ABI, signer);
```

### 2. 獲取簽名數據

```javascript
// 獲取用戶當前 nonce
const nonce = await ballotContract.getUserNonce(userAddress);

// 獲取網絡信息
const network = await provider.getNetwork();
const chainId = network.chainId;
```

### 3. 創建 EIP-712 簽名

```javascript
const domain = {
  name: "Ballot",
  version: "1",
  chainId: chainId,
  verifyingContract: contractAddress,
};

const types = {
  MetaVote: [
    { name: "voter", type: "address" },
    { name: "proposal", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};

const value = {
  voter: userAddress,
  proposal: proposalIndex,
  nonce: nonce,
};

const signature = await signer._signTypedData(domain, types, value);
```

### 4. 主席執行代付交易

```javascript
// 主席調用 metaVote
const tx = await ballotContract
  .connect(chairperson)
  .metaVote(userAddress, proposalIndex, nonce, signature);
```

## 安全注意事項

1. **Nonce 管理**：每次簽名後 nonce 會自動增加，防止重放攻擊
2. **時間窗口**：只能在投票期間內執行
3. **權限檢查**：用戶必須有投票權且未投票
4. **簽名驗證**：使用 EIP-712 標準確保簽名安全

## 錯誤處理

- `InvalidNonce()`：nonce 不匹配
- `InvalidSignature()`：簽名無效
- `NoRightToVote()`：無投票權或已投票
- `NotWithinVotingPeriod()`：不在投票時間內

## 完整範例

參見 `metaVoteExample.js` 文件中的完整實作範例。
