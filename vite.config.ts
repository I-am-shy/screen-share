import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/screen-share/',
  server: {
    port: 5173,
    host: true
  },
  define: {
    // 注入全局变量，让构建内容包含这个戳（触发哈希变化）
    __BUILD_VERSION__: JSON.stringify(Date.now().toString())
  },
})
