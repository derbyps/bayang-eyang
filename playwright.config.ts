import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/visual',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
