import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia } from "wagmi/chains";
import { http } from "wagmi";

export const config = getDefaultConfig({
  appName: "區塊鏈投票系統",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID, // 從 .env 讀取
  chains: [mainnet, sepolia],
  ssr: false,
  transports: {
    [mainnet.id]: http(import.meta.env.VITE_RPC_URL), // 從 .env 讀取
    [sepolia.id]: http(import.meta.env.VITE_RPC_URL), // 從 .env 讀取
  },
});
