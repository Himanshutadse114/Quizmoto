import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function lmsgenRouteMigration() {
  return {
    name: 'lmsgen-route-migration',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/src/') || id.endsWith('/src/App.jsx') || !/\.[cm]?[jt]sx?$/.test(id)) {
        return null
      }

      // Migrate legacy absolute platform links without touching asset names such
      // as /atelora-logo.svg. App.jsx intentionally keeps the old route so it
      // can redirect existing bookmarks to the new LMSGEN URL.
      const migrated = code.replace(/(['"`])\/atelora(?=\/|['"`])/g, '$1/lmsgen')
      return migrated === code ? null : { code: migrated, map: null }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [lmsgenRouteMigration(), react()],
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
