import { defineConfig } from '@playwright/test';

// Separate from the group's production Playwright config.
// The demo fixture is enabled ONLY in Vite development mode.
export default defineConfig({
  testDir: '.',
  testMatch: 'phat-preprocessing.spec.ts',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -w @dashboard/web',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
