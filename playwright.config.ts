import { defineConfig } from '@playwright/test';

// E2E_PORT lets parallel worktrees run the suite without sharing (or reusing) one preview server.
const port = Number(process.env.E2E_PORT ?? 4173);
const isolated = process.env.E2E_PORT !== undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    viewport: { width: 1600, height: 950 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !isolated,
    timeout: 180_000,
  },
});
