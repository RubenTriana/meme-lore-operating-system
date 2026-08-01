import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { canonStatusPlugin } from './vite-canon-status-plugin'
import { geniusPlugin } from './vite-genius-plugin'
import { tantaloContextPlugin } from './vite-tantalo-context-plugin'

export default defineConfig({
  plugins: [react(), tailwindcss(), canonStatusPlugin(fileURLToPath(new URL('.', import.meta.url))), geniusPlugin(), tantaloContextPlugin(fileURLToPath(new URL('.', import.meta.url)))],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['@tanstack/react-query', 'zustand', 'zod'],
          charts: ['recharts'],
          graph: ['@xyflow/react'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})
