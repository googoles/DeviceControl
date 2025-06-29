import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 상대 경로로 설정 (중요!)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Electron에서 사용할 수 있도록 설정
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  },
  // 개발 서버 설정
  server: {
    port: 5173,
    strictPort: true
  }
})