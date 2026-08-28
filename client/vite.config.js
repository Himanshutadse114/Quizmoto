import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))

// The platform SPA builds from app.html (not index.html) so the marketing
// site's static index.html can occupy the literal root path in dist/ without
// any collision or rewrite ambiguity - see scripts/prepare-marketing.mjs.
// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
  ],
  build: {
    rollupOptions: {
      input: resolve(rootDir, 'app.html'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5002',
      '/socket.io': {
        target: 'http://localhost:5002',
        ws: true,
      },
    }
  }
})
