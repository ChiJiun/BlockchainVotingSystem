const { ethers } = require("ethers");
require("dotenv").config();

async function grantVotingRights() {
  try {
    // 1. 環境變數檢查
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL;
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const walletAddress = process.env.WALLET_ADDRESS;

    if (!privateKey || !rpcUrl || !contractAddress || !walletAddress) {
      throw new Error("Missing required environment variables");
    }

    console.log("開始處理投票權授予...");
    console.log("目標錢包地址:", walletAddress);
    console.log("合約地址:", contractAddress);

    // 2. 設置提供者和錢包
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const adminWallet = new ethers.Wallet(privateKey, provider);

    console.log("管理員錢包地址:", adminWallet.address);

    // 3. 合約 ABI (簡化版，只包含需要的函數)
    const contractABI = [
      "function giveRightToVote(address voter) external",
      "function hasVotingRight(address voter) external view returns (bool)",
    ];

    // 4. 連接合約
    const contract = new ethers.Contract(
      contractAddress,
      contractABI,
      adminWallet
    );

    // 5. 檢查用戶是否已經有投票權
    console.log("檢查用戶當前投票權狀態...");
    const hasRights = await contract.hasVotingRight(walletAddress);

    if (hasRights) {
      console.log("✅ 用戶已經擁有投票權，無需重複授予");
      process.exit(0);
    }

    // 6. 授予投票權
    console.log("🔄 正在授予投票權...");
    const tx = await contract.giveRightToVote(walletAddress);

    console.log("交易已提交，哈希:", tx.hash);
    console.log("等待交易確認...");

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log("✅ 投票權授予成功！");
      console.log("區塊高度:", receipt.blockNumber);
      console.log("Gas 使用量:", receipt.gasUsed.toString());

      // 7. 驗證投票權
      const finalCheck = await contract.hasVotingRight(walletAddress);
      if (finalCheck) {
        console.log("✅ 投票權驗證成功");

        // 設置成功標誌供後續步驟使用
        process.env.GRANT_SUCCESS = "true";
        process.env.TX_HASH = tx.hash;
        process.env.BLOCK_NUMBER = receipt.blockNumber.toString();
      } else {
        throw new Error("投票權驗證失敗");
      }
    } else {
      throw new Error("交易失敗");
    }
  } catch (error) {
    console.error("❌ 授予投票權失敗:", error.message);

    // 設置失敗標誌
    process.env.GRANT_SUCCESS = "false";
    process.env.ERROR_MESSAGE = error.message;

    process.exit(1);
  }
}

grantVotingRights();
