import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Public Site E2E tests
 * See https://playwright.dev/docs/test-configuration
 */

const baseURL = process.env.BASE_URL || 'http://localhost:3001';

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Test file pattern
  testMatch: '**/*.spec.ts',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI for stability
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['list', {}],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ...(process.env.CI ? [['github', {}] as const] : []),
  ],

  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL,

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording on first retry
    video: 'on-first-retry',

    // Default timeout for actions
    actionTimeout: 15000,

    // Default navigation timeout
    navigationTimeout: 30000,

    // Ignore HTTPS errors (for local development)
    ignoreHTTPSErrors: true,

    // Locale and timezone
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Browser context options
    contextOptions: {
      strictSelectors: true,
    },
  },

  // Global timeout for each test
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Configure projects for major browsers
  projects: [
    // Desktop Chrome
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // Desktop Firefox
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // Desktop Safari (WebKit)
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile Chrome (responsive testing)
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },

    // Mobile Safari (responsive testing)
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Output directory for artifacts
  outputDir: 'test-results',

  // Metadata
  metadata: {
    project: 'festivals-public',
    environment: process.env.CI ? 'ci' : 'local',
  },
});
