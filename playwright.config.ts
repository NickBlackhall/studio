import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Multi-context tests drive 3 browsers through create/join/ready/start —
  // legitimately >30s (Playwright's default), especially on a dev server.
  timeout: 120_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  // No baseline screenshots are committed, so visual-regression tests can
  // only fail in CI. Run them locally (npx playwright test --update-snapshots
  // to create baselines), then commit the snapshots and drop this ignore.
  testIgnore: process.env.CI ? ['**/visual-regression.spec.ts'] : [],
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:9003',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  // CI runs chromium only: 3 browsers × ~60 tests on a single worker blows
  // far past any sane job timeout. Add firefox/webkit back once the
  // chromium suite is stable and we know its runtime.
  projects: process.env.CI
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
      ],
  webServer: {
    command: process.env.CI ? 'npm start' : 'npm run dev',
    url: 'http://localhost:9003',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});