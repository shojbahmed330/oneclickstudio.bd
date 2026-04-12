
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: [
      '@typescript/ata',
      '@typescript/vfs',
      'typescript',
      'lucide-react',
      'framer-motion',
      'clsx',
      'tailwind-merge'
    ]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "assert": path.resolve(__dirname, "./src/utils/assert-polyfill.ts"),
      "path": "path-browserify",
    },
  },
  define: {
    // This allows process.env.API_KEY to be replaced with the actual value during build
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  }
})
