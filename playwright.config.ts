import { defineConfig } from '@playwright/test';

// End-to-end tests: the built extension in Playwright's Chromium against local fixture pages
// (SPEC §5). The fixture server's port is recorded in CLAUDE.md.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: 'http://localhost:3211' },
  webServer: {
    command: 'node tests/e2e/fixture-server.ts',
    url: 'http://localhost:3211/plain.html',
    reuseExistingServer: !process.env.CI,
  },
});
