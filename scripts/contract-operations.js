import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

async function main() {
  try {
    console.log("合約操作腳本開始執行...");

    // 從環境變數讀取設定
    const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS;
    const RPC_URL = process.env.RPC_URL;
    const NETWORK_NAME = process.env.NETWORK_NAME || "sepolia";
    const CHAIN_ID = process.env.CHAIN_ID || "11155111";

    // 檢查必要的環境變數
    if (!CONTRACT_ADDRESS) {
      console.error(
        "❌ 未設定合約地址，請檢查 .env 文件中的 VITE_CONTRACT_ADDRESS"
      );
      return;
    }

    if (!RPC_URL) {
      console.error("❌ 未設定 RPC URL，請檢查 .env 文件中的 RPC_URL");
      return;
    }

    console.log("✅ 合約地址:", CONTRACT_ADDRESS);
    console.log("✅ RPC URL:", RPC_URL);
    console.log("✅ 目標網路:", NETWORK_NAME, "(Chain ID:", CHAIN_ID, ")");

    // 使用環境變數中的 RPC URL 建立 Provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log("✅ Provider 已建立");

    // 網路連接測試
    try {
      console.log("🔄 正在測試網路連接...");
      const network = await provider.getNetwork();
      console.log(
        "✅ 成功連接到網路:",
        network.name || "unknown",
        "(Chain ID:",
        network.chainId.toString(),
        ")"
      );

      // 驗證是否連接到正確的網路
      if (network.chainId.toString() !== CHAIN_ID) {
        console.warn("⚠️  警告: 連接的網路 Chain ID 與設定不符");
        console.warn("   預期:", CHAIN_ID, "實際:", network.chainId.toString());
      }

      // 測試區塊高度
      const blockNumber = await provider.getBlockNumber();
      console.log("✅ 當前區塊高度:", blockNumber);
    } catch (networkError) {
      console.error("❌ 網路連接失敗:", networkError.message);
      console.error("請檢查 RPC_URL 是否正確:", RPC_URL);
      return;
    }

    // 檢查合約是否存在
    try {
      console.log("🔄 正在檢查合約...");
      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (code === "0x") {
        console.error("❌ 在指定地址找不到合約");
        console.error("請檢查合約地址是否正確，或合約是否已部署到正確的網路");
        return;
      }
      console.log("✅ 合約存在於指定地址");
      console.log("✅ 合約代碼長度:", code.length, "字符");
    } catch (contractError) {
      console.error("❌ 合約檢查失敗:", contractError.message);
      return;
    }

    // 嘗試動態導入 ABI（如果存在的話）
    try {
      console.log("🔄 正在嘗試載入 ABI...");
      const { contractABI } = await import("../src/ABI.js");

      console.log("✅ ABI 載入成功，函數數量:", contractABI.length);
      console.log("🔄 正在初始化合約實例...");

      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        contractABI,
        provider
      );

      console.log("🔄 正在讀取提案...");
      const proposals = await contract.getAllProposals();
      console.log("✅ 成功讀取", proposals.length, "個提案");

      if (proposals.length === 0) {
        console.log("📋 目前沒有任何提案");
      } else {
        console.log("\n" + "=".repeat(50));
        console.log("📋 提案列表:");
        console.log("=".repeat(50));

        proposals.forEach((proposal, index) => {
          console.log(`\n📋 提案 ${index + 1}:`);
          console.log(`   🆔 ID: ${proposal.id || index}`);
          console.log(
            `   📝 標題: ${proposal.title || proposal.name || "無標題"}`
          );
          console.log(
            `   📄 描述: ${proposal.description || proposal.desc || "無描述"}`
          );
          console.log(`   📊 票數: ${proposal.voteCount?.toString() || "0"}`);
          console.log(
            `   🔄 狀態: ${proposal.isActive ? "✅ 投票中" : "❌ 已結束"}`
          );
        });
        console.log("\n" + "=".repeat(50));
      }
    } catch (abiError) {
      console.log("ℹ️  無法載入或使用 ABI:", abiError.message);
      console.log("📝 請確保:");
      console.log("   1. src/ABI.js 文件存在");
      console.log("   2. 文件正確導出 contractABI");
      console.log("   3. ABI 包含 getAllProposals 函數");
    }

    console.log("✅ 腳本執行完成");
  } catch (error) {
    console.error("❌ 執行錯誤:", error.message);
    console.error("完整錯誤:", error);
    process.exit(1);
  }
}

main();
