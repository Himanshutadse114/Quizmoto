import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
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
