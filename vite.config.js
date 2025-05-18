import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/BlockchainVotingSystem/', // ← 這行很重要！填上 GitHub 上 repo 的名稱
})
