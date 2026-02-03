import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests
 * See https://playwright.dev/docs/test-configuration
 */

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

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
    locale: 'fr-BE',
    timezoneId: 'Europe/Brussels',

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
    // Setup project - runs before all tests
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      teardown: 'teardown',
    },

    // Teardown project - runs after all tests
    {
      name: 'teardown',
      testMatch: /global\.teardown\.ts/,
    },

    // Desktop Chrome
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-web-security'], // For testing cross-origin requests
        },
      },
      dependencies: ['setup'],
    },

    // Desktop Firefox
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },

    // Desktop Safari (WebKit)
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    // Mobile Chrome (responsive testing)
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },

    // Mobile Safari (responsive testing)
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup'],
    },

    // Tablet (responsive testing)
    {
      name: 'tablet',
      use: { ...devices['iPad (gen 7)'] },
      dependencies: ['setup'],
    },

    // Journey tests only (critical paths)
    {
      name: 'journeys',
      testDir: './e2e/journeys',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    // Authentication tests only
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
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

  // Global setup and teardown
  globalSetup: require.resolve('./e2e/global.setup.ts'),
  globalTeardown: require.resolve('./e2e/global.teardown.ts'),

  // Metadata
  metadata: {
    project: 'festivals-admin',
    environment: process.env.CI ? 'ci' : 'local',
  },
});
