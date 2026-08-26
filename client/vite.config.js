import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(clientDir, '..')
const brandAssets = {
  '/lumo-logo.png': resolve(repoRoot, 'logo (3).png'),
  '/favicon.png': resolve(repoRoot, 'favicon.png'),
}

function lumoBrandAssets() {
  return {
    name: 'lumo-brand-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const source = brandAssets[req.url?.split('?')[0]]
        if (!source || !existsSync(source)) return next()
        res.setHeader('Content-Type', 'image/png')
        res.setHeader('Cache-Control', 'no-cache')
        createReadStream(source).pipe(res)
      })
    },
    closeBundle() {
      const distDir = resolve(clientDir, 'dist')
      mkdirSync(distDir, { recursive: true })
      for (const [publicPath, source] of Object.entries(brandAssets)) {
        if (!existsSync(source)) {
          throw new Error(`Missing Lumo brand asset: ${source}`)
        }
        copyFileSync(source, resolve(distDir, publicPath.slice(1)))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    lumoBrandAssets(),
  ],
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
