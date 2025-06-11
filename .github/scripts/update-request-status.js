const fs = require("fs");
const path = require("path");

async function updateRequestStatus() {
  try {
    const requestId = process.env.REQUEST_ID;
    const success = process.env.GRANT_SUCCESS === "true";

    if (!requestId) {
      console.log("沒有請求 ID，跳過狀態更新");
      return;
    }

    const requestFilePath = path.join("requests", `${requestId}.json`);

    if (!fs.existsSync(requestFilePath)) {
      console.log("請求文件不存在:", requestFilePath);
      return;
    }

    // 讀取現有請求數據
    const requestData = JSON.parse(fs.readFileSync(requestFilePath, "utf8"));

    // 更新狀態
    requestData.status = success ? "completed" : "failed";
    requestData.processedAt = new Date().toISOString();

    if (success) {
      requestData.txHash = process.env.TX_HASH;
      requestData.blockNumber = process.env.BLOCK_NUMBER;
    } else {
      requestData.errorMessage = process.env.ERROR_MESSAGE;
    }

    // 寫回文件
    fs.writeFileSync(requestFilePath, JSON.stringify(requestData, null, 2));

    console.log(`✅ 請求狀態已更新: ${requestData.status}`);
  } catch (error) {
    console.error("❌ 更新請求狀態失敗:", error.message);
  }
}

updateRequestStatus();
