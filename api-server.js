const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");

const app = express();
app.use(cors());
app.use(express.json());

// 配置
const PRIVATE_KEY = process.env.CHAIRPERSON_PRIVATE_KEY; // 主席私鑰
const RPC_URL = process.env.RPC_URL || "http://localhost:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// 合約 ABI（簡化版）
const CONTRACT_ABI = [
  "function metaVote(address, uint, uint256, bytes)",
  "function verifyMetaVoteSignature(address, uint, uint256, bytes) view returns (bool)",
];

// 初始化 provider 和 wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const chairpersonWallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  chairpersonWallet
);

// 存儲待處理的投票
const pendingVotes = new Map();

/**
 * 提交投票簽名
 */
app.post("/api/submit-vote", async (req, res) => {
  try {
    const { voter, proposal, nonce, signature, chainId, contractAddress } =
      req.body;

    // 驗證數據
    if (!voter || proposal === undefined || !nonce || !signature) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數",
      });
    }

    // 驗證簽名
    const isValid = await contract.verifyMetaVoteSignature(
      voter,
      proposal,
      nonce,
      signature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: "簽名驗證失敗",
      });
    }

    // 生成唯一 ID
    const voteId = `${voter}_${Date.now()}`;

    // 存儲投票數據
    pendingVotes.set(voteId, {
      voter,
      proposal,
      nonce,
      signature,
      timestamp: Date.now(),
      status: "pending",
    });

    console.log(`📝 收到投票簽名: ${voter} -> 提案 ${proposal}`);

    res.json({
      success: true,
      voteId: voteId,
      message: "簽名已提交，等待處理",
    });

    // 異步執行投票
    executeVoteAsync(voteId);
  } catch (error) {
    console.error("提交投票失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 查詢投票狀態
 */
app.get("/api/vote-status/:voteId", (req, res) => {
  const { voteId } = req.params;
  const vote = pendingVotes.get(voteId);

  if (!vote) {
    return res.status(404).json({
      success: false,
      error: "投票記錄不存在",
    });
  }

  res.json({
    success: true,
    vote: vote,
  });
});

/**
 * 異步執行投票
 */
async function executeVoteAsync(voteId) {
  const vote = pendingVotes.get(voteId);
  if (!vote) return;

  try {
    console.log(`🚀 開始執行代付投票: ${vote.voter}`);

    // 更新狀態
    vote.status = "executing";

    // 執行交易
    const tx = await contract.metaVote(
      vote.voter,
      vote.proposal,
      vote.nonce,
      vote.signature,
      { gasLimit: 200000 }
    );

    console.log(`📝 交易已提交: ${tx.hash}`);
    vote.txHash = tx.hash;
    vote.status = "submitted";

    // 等待確認
    const receipt = await tx.wait();

    console.log(`✅ 投票成功確認: ${vote.voter}, 區塊: ${receipt.blockNumber}`);

    vote.status = "confirmed";
    vote.blockNumber = receipt.blockNumber;
    vote.gasUsed = receipt.gasUsed.toString();
  } catch (error) {
    console.error(`❌ 代付投票失敗: ${vote.voter}`, error);

    vote.status = "failed";
    vote.error = error.message;
  }
}

/**
 * 獲取所有投票記錄
 */
app.get("/api/votes", (req, res) => {
  const votes = Array.from(pendingVotes.entries()).map(([id, vote]) => ({
    id,
    ...vote,
  }));

  res.json({
    success: true,
    votes: votes,
  });
});

// 健康檢查
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MetaVote API 服務器運行在端口 ${PORT}`);
  console.log(`📝 合約地址: ${CONTRACT_ADDRESS}`);
});
