import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { base: env.VITE_BASE_PATH || '/', plugins: [vue()], server: { host: '127.0.0.1', port: 5212, strictPort: true,
    proxy: { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3000', changeOrigin: true } } } }
})
