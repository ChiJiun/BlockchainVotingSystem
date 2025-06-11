export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { walletAddress, chainId, timestamp } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: "Wallet address is required" });
  }

  try {
    // 1. 驗證錢包地址格式
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new Error("Invalid wallet address format");
    }

    // 2. GitHub API 配置
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
    const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;

    if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
      throw new Error("GitHub configuration missing");
    }

    // 3. 準備請求數據
    const requestData = {
      walletAddress,
      chainId,
      timestamp,
      status: "pending",
      requestId: `req_${Date.now()}_${walletAddress.slice(-6)}`,
    };

    // 4. 創建或更新 GitHub 文件
    const filePath = `requests/${requestData.requestId}.json`;
    const fileContent = Buffer.from(
      JSON.stringify(requestData, null, 2)
    ).toString("base64");

    const githubResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          message: `Add voting rights request for ${walletAddress}`,
          content: fileContent,
          committer: {
            name: "Voting Rights Bot",
            email: "bot@votingapp.com",
          },
        }),
      }
    );

    if (!githubResponse.ok) {
      const errorData = await githubResponse.json();
      throw new Error(`GitHub API error: ${errorData.message}`);
    }

    const githubResult = await githubResponse.json();

    // 5. 觸發 GitHub Actions (可選)
    const workflowDispatchResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/grant-voting-rights.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            walletAddress: walletAddress,
            requestId: requestData.requestId,
          },
        }),
      }
    );

    console.log("GitHub Actions 觸發狀態:", workflowDispatchResponse.status);

    res.status(200).json({
      success: true,
      requestId: requestData.requestId,
      walletAddress,
      githubCommit: githubResult.commit.sha,
      message: "Voting rights request submitted successfully",
    });
  } catch (error) {
    console.error("請求投票權失敗:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}
