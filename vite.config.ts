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
  build: {
    // 可选：明确开启资产哈希（Vite 默认开启，写出来更清晰）
    assetsInlineLimit: 4096, // 小于4kb的资源内联，不生成单独文件
    rollupOptions: {
      output: {
        // 强制指定哈希格式（name=文件名，hash=内容哈希）
        assetFileNames: 'assets/[name].[hash].[ext]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
      }
    }
  }
})
