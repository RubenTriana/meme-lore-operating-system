import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { canonStatusPlugin } from './vite-canon-status-plugin'
import { geniusPlugin } from './vite-genius-plugin'
import { tantaloContextPlugin } from './vite-tantalo-context-plugin'
import { tantaloEvaluationPlugin } from './vite-tantalo-evaluation-plugin'

export default defineConfig(({ mode }) => {
  const rootDirectory = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, rootDirectory, '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      canonStatusPlugin(rootDirectory),
      geniusPlugin(),
      tantaloContextPlugin(rootDirectory),
      tantaloEvaluationPlugin({
        rootDirectory,
        apiKey: env.TANTALO_OPENAI_API_KEY || process.env.TANTALO_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        model: env.TANTALO_EVALUATION_MODEL || process.env.TANTALO_EVALUATION_MODEL,
      }),
    ],
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
  }
})
