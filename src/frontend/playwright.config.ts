import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';
const API_URL = process.env.API_URL ?? 'http://localhost:5000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'list' : 'html',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    // Auth setup — runs first, saves storage state for each role
    { name: 'setup', testDir: './e2e/fixtures', testMatch: 'auth.setup.ts' },

    // Authenticated tests — pre-loaded admin session, skips auth specs
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: /auth.*\.spec\.ts/,
    },

    // Unauthenticated tests (login, register) — no setup dependency, no storage state
    {
      name: 'no-auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth.*\.spec\.ts/,
    },
  ],

  // Disabled when running inside Docker (frontend container already serves the app)
  webServer: process.env.PLAYWRIGHT_DOCKER
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },

  expect: {
    timeout: 5_000,
  },
});
