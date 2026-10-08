const { defineConfig } = require('@playwright/test');

// Isolated UI fixtures: no database setup, production API calls or data changes.
module.exports = defineConfig({
  testDir: './tests/ui',
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
  webServer: {
    command: 'npm run dev -- --host localhost --port 4173',
    cwd: './client',
    url: 'http://localhost:4173/login',
    reuseExistingServer: !process.env.CI,
  },
});
