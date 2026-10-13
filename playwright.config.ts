import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    viewport: { width: 1600, height: 950 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
