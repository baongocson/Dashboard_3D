import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/atlas-e2e',
  workers: 1,
  timeout: 90_000,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run build && npm start',
      url: 'http://localhost:3001/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
