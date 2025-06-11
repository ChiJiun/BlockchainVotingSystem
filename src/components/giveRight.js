import { ethers } from "ethers";
import { contractABI } from "../ABI.js";

/**
 * 透過私鑰授予用戶投票權
 * @param {string} voterAddress - 要授予投票權的用戶地址
 * @returns {Promise<object>} 交易結果
 */
export const giveRightToVote = async (voterAddress) => {
  try {
    console.log("🔍 開始授予投票權...");
    console.log("目標錢包地址:", voterAddress);

    // 驗證輸入參數
    if (!voterAddress || !ethers.isAddress(voterAddress)) {
      throw new Error("無效的錢包地址");
    }

    // 從環境變數獲取必要配置
    const adminPrivateKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY;
    const rpcUrl = import.meta.env.VITE_RPC_URL;
    const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;

    // 檢查必要的環境變數
    if (!adminPrivateKey) {
      throw new Error(
        "管理員私鑰未設定，請檢查 .env 文件中的 VITE_ADMIN_PRIVATE_KEY"
      );
    }

    if (!rpcUrl) {
      throw new Error("RPC URL 未設定，請檢查 .env 文件中的 VITE_RPC_URL");
    }

    if (!contractAddress) {
      throw new Error(
        "合約地址未設定，請檢查 .env 文件中的 VITE_CONTRACT_ADDRESS"
      );
    }

    console.log("📋 配置信息:");
    console.log("- 合約地址:", contractAddress);
    console.log("- RPC URL:", rpcUrl);

    // 設置提供者和管理員錢包
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

    console.log("管理員錢包地址:", adminWallet.address);

    // 創建合約實例
    const contract = new ethers.Contract(
      contractAddress,
      contractABI,
      adminWallet
    );

    console.log("📋 檢查當前投票權狀態...");

    // 檢查用戶是否已經有投票權
    let currentHasRights = false;
    try {
      // 嘗試不同的函數名稱來檢查投票權
      const possibleCheckFunctions = [
        "hasVotingRight",
        "voters",
        "checkVotingRight",
      ];

      for (const funcName of possibleCheckFunctions) {
        try {
          if (contract[funcName]) {
            const result = await contract[funcName](voterAddress);

            if (typeof result === "boolean") {
              currentHasRights = result;
            } else if (Array.isArray(result)) {
              currentHasRights = result[0] || false;
            } else if (typeof result === "object" && result !== null) {
              currentHasRights = result.hasVoted || result.authorized || false;
            }

            console.log(`使用 ${funcName} 檢查結果:`, result);
            break;
          }
        } catch (e) {
          console.log(`函數 ${funcName} 檢查失敗:`, e.message);
        }
      }
    } catch (checkError) {
      console.warn("檢查投票權失敗，繼續授予投票權:", checkError.message);
    }

    if (currentHasRights) {
      return {
        success: true,
        message: "用戶已經擁有投票權",
        txHash: null,
        alreadyHasRights: true,
      };
    }

    console.log("⛽ 估算 Gas 費用...");

    // 嘗試不同的授權函數名稱
    const possibleGrantFunctions = [
      "giveRightToVote",
      "grantVotingRight",
      "addVoter",
      "authorize",
    ];
    let grantFunction = null;

    for (const funcName of possibleGrantFunctions) {
      try {
        if (contract[funcName]) {
          grantFunction = funcName;
          console.log(`找到授權函數: ${funcName}`);
          break;
        }
      } catch (e) {
        console.log(`函數 ${funcName} 不存在`);
      }
    }

    if (!grantFunction) {
      throw new Error("找不到授權函數，請檢查合約 ABI");
    }

    // 估算 Gas
    const gasEstimate = await contract[grantFunction].estimateGas(voterAddress);
    console.log("Gas 估算:", gasEstimate.toString());

    console.log("📝 執行投票權授予交易...");

    // 執行交易
    const tx = await contract[grantFunction](voterAddress, {
      gasLimit: Math.floor(Number(gasEstimate) * 1.2), // 增加 20% 的 Gas buffer
    });

    console.log("交易已提交，哈希:", tx.hash);

    // 等待交易確認
    console.log("⏳ 等待交易確認...");
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log("✅ 投票權授予成功！");
      console.log("區塊高度:", receipt.blockNumber);
      console.log("實際 Gas 使用:", receipt.gasUsed.toString());

      return {
        success: true,
        message: "投票權授予成功",
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        alreadyHasRights: false,
      };
    } else {
      throw new Error("交易失敗");
    }
  } catch (error) {
    console.error("❌ 授予投票權失敗:", error);

    return {
      success: false,
      message: error.message,
      error: error,
      txHash: null,
    };
  }
};

/**
 * 檢查用戶是否擁有投票權
 * @param {string} voterAddress - 要檢查的用戶地址
 * @returns {Promise<boolean>} 是否擁有投票權
 */
export const checkVotingRight = async (voterAddress) => {
  try {
    if (!voterAddress || !ethers.isAddress(voterAddress)) {
      throw new Error("無效的錢包地址");
    }

    const rpcUrl = import.meta.env.VITE_RPC_URL;
    const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;

    if (!rpcUrl || !contractAddress) {
      throw new Error("缺少必要的環境變數配置");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(
      contractAddress,
      contractABI,
      provider
    );

    // 嘗試不同的檢查函數
    const possibleCheckFunctions = [
      "hasVotingRight",
      "voters",
      "checkVotingRight",
    ];

    for (const funcName of possibleCheckFunctions) {
      try {
        if (contract[funcName]) {
          const result = await contract[funcName](voterAddress);

          if (typeof result === "boolean") {
            return result;
          } else if (Array.isArray(result)) {
            return result[0] || false;
          } else if (typeof result === "object" && result !== null) {
            return result.hasVoted || result.authorized || false;
          }
        }
      } catch (e) {
        console.log(`函數 ${funcName} 檢查失敗:`, e.message);
      }
    }

    return false;
  } catch (error) {
    console.error("檢查投票權失敗:", error);
    return false;
  }
};

// 導出主要函數
export default {
  giveRightToVote,
  checkVotingRight,
};
