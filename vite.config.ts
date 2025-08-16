import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
      '@/assets': '/assets'
    }
  },
  build: {
    target: 'esnext',
    outDir: 'dist'
  },
  server: {
    port: 3000,
    open: true
  }
})