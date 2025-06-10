require('dotenv').config();
const { ethers } = require('ethers');
const contractABI = require('../src/ABI.js');

async function main() {
    try {
        // 檢查環境變數
        const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS;
        if (!CONTRACT_ADDRESS) {
            throw new Error('未設定合約地址，請檢查 .env 文件');
        }

        // 設置提供者（使用 Sepolia 測試網）
        const provider = new ethers.providers.JsonRpcProvider(
            'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID'
        );

        // 讀取合約
        const contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            contractABI,
            provider
        );

        // 獲取所有提案
        console.log('正在讀取提案...');
        const proposals = await contract.getAllProposals();
        
        console.log('\n=== 提案列表 ===');
        proposals.forEach((proposal, index) => {
            console.log(`\n提案 ${index + 1}:`);
            console.log(`標題: ${proposal.title}`);
            console.log(`描述: ${proposal.description}`);
            console.log(`票數: ${proposal.voteCount.toString()}`);
            console.log(`狀態: ${proposal.isActive ? '投票中' : '已結束'}`);
        });

    } catch (error) {
        console.error('錯誤:', error.message);
        process.exit(1);
    }
}

main();