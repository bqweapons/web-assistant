import { defineConfig } from '@playwright/test';

// E2E tests load the built extension from .output/chrome-mv3 (run `npm run build` first,
// or use `npm run test:e2e`, which builds). Set HEADED=1 to watch the browser.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
