import { ethers } from "ethers";
import { contractABI } from "../ABI.js";

/**
 * 執行 Meta Commit 操作
 * @param {string} voterAddress - 投票者地址
 * @param {number} proposalId - 提案ID
 * @param {string} commitment - 承諾值 (hash)
 * @param {string} signature - 簽名
 * @returns {Promise<object>} 交易結果
 */
export const executeMetaCommit = async (voterAddress, proposalId, commitment, signature) => {
  try {
    console.log("🔍 開始執行 Meta Commit...");
    console.log("投票者地址:", voterAddress);
    console.log("提案ID:", proposalId);
    console.log("承諾值:", commitment);

    // 驗證輸入參數
    if (!voterAddress || !ethers.isAddress(voterAddress)) {
      throw new Error("無效的投票者地址");
    }

    if (proposalId === undefined || proposalId === null) {
      throw new Error("請提供有效的提案ID");
    }

    if (!commitment) {
      throw new Error("請提供承諾值");
    }

    if (!signature) {
      throw new Error("請提供簽名");
    }

    // 從環境變數獲取必要配置
    const adminPrivateKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY;
    const rpcUrl = import.meta.env.VITE_RPC_URL;
    const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;

    // 檢查必要的環境變數
    if (!adminPrivateKey) {
      throw new Error("管理員私鑰未設定，請檢查 .env 文件中的 VITE_ADMIN_PRIVATE_KEY");
    }

    if (!rpcUrl) {
      throw new Error("RPC URL 未設定，請檢查 .env 文件中的 VITE_RPC_URL");
    }

    if (!contractAddress) {
      throw new Error("合約地址未設定，請檢查 .env 文件中的 VITE_CONTRACT_ADDRESS");
    }

    console.log("📋 配置信息:");
    console.log("- 合約地址:", contractAddress);
    console.log("- RPC URL:", rpcUrl);

    // 設置提供者和管理員錢包
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

    console.log("管理員錢包地址:", adminWallet.address);

    // 創建合約實例
    const contract = new ethers.Contract(contractAddress, contractABI, adminWallet);

    // 檢查合約是否有 metaCommit 函數
    if (!contract.metaCommit) {
      throw new Error("合約中找不到 metaCommit 函數，請檢查 ABI");
    }

    console.log("⛽ 估算 Gas 費用...");

    // 估算 Gas
    const gasEstimate = await contract.metaCommit.estimateGas(
      voterAddress,
      proposalId,
      commitment,
      signature
    );
    console.log("Gas 估算:", gasEstimate.toString());

    console.log("📝 執行 Meta Commit 交易...");

    // 執行交易
    const tx = await contract.metaCommit(voterAddress, proposalId, commitment, signature, {
      gasLimit: Math.floor(Number(gasEstimate) * 1.2), // 增加 20% 的 Gas buffer
    });

    console.log("交易已提交，哈希:", tx.hash);

    // 等待交易確認
    console.log("⏳ 等待交易確認...");
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log("✅ Meta Commit 執行成功！");
      console.log("區塊高度:", receipt.blockNumber);
      console.log("實際 Gas 使用:", receipt.gasUsed.toString());

      return {
        success: true,
        message: "Meta Commit 執行成功",
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        voterAddress,
        proposalId,
        commitment
      };
    } else {
      throw new Error("交易失敗");
    }
  } catch (error) {
    console.error("❌ Meta Commit 執行失敗:", error);

    return {
      success: false,
      message: error.message,
      error: error,
      txHash: null,
    };
  }
};

/**
 * 生成承諾值 (commitment hash)
 * @param {number} choice - 投票選擇
 * @param {string} nonce - 隨機數
 * @returns {string} 承諾值哈希
 */
export const generateCommitment = (choice, nonce) => {
  try {
    if (choice === undefined || choice === null) {
      throw new Error("請提供投票選擇");
    }

    if (!nonce) {
      throw new Error("請提供隨機數");
    }

    // 使用 keccak256 計算承諾值
    const commitment = ethers.keccak256(
      ethers.solidityPacked(["uint256", "uint256"], [choice, nonce])
    );

    console.log("生成承諾值:");
    console.log("- 選擇:", choice);
    console.log("- 隨機數:", nonce);
    console.log("- 承諾值:", commitment);

    return commitment;
  } catch (error) {
    console.error("生成承諾值失敗:", error);
    throw error;
  }
};

/**
 * 生成隨機 nonce
 * @returns {string} 隨機數
 */
export const generateNonce = () => {
  return ethers.randomBytes(32);
};

/**
 * 簽名 meta transaction 數據
 * @param {string} privateKey - 私鑰
 * @param {string} voterAddress - 投票者地址
 * @param {number} proposalId - 提案ID
 * @param {string} commitment - 承諾值
 * @returns {Promise<string>} 簽名
 */
export const signMetaCommit = async (privateKey, voterAddress, proposalId, commitment) => {
  try {
    const wallet = new ethers.Wallet(privateKey);
    
    // 構建要簽名的消息
    const message = ethers.solidityPacked(
      ["address", "uint256", "bytes32"],
      [voterAddress, proposalId, commitment]
    );
    
    const messageHash = ethers.keccak256(message);
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    
    console.log("簽名生成成功:", signature);
    return signature;
  } catch (error) {
    console.error("簽名失敗:", error);
    throw error;
  }
};

// 導出主要函數
export default {
  executeMetaCommit,
  generateCommitment,
  generateNonce,
  signMetaCommit
};