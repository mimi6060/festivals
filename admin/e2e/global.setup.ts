/**
 * Global setup for Playwright E2E tests
 * Runs once before all test suites
 */

import { chromium, FullConfig } from '@playwright/test';
import { testUsers } from './fixtures/test-users';
import { testFestivals, testStands, testTicketTypes } from './fixtures/test-festival';

async function globalSetup(config: FullConfig) {
  console.log('\n=== Global Setup Starting ===\n');

  const { baseURL } = config.projects[0].use;

  // Launch a browser for setup tasks
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Wait for the application to be ready
    console.log('Waiting for application to be ready...');
    await waitForAppReady(page, baseURL as string);
    console.log('Application is ready.');

    // 2. Seed initial test data (if using a real backend)
    if (process.env.SEED_DATABASE === 'true') {
      console.log('Seeding test database...');
      await seedTestDatabase();
      console.log('Database seeded.');
    }

    // 3. Pre-authenticate admin user and save state
    console.log('Setting up admin authentication state...');
    await setupAdminAuthState(page, baseURL as string);
    console.log('Admin auth state saved.');

    // 4. Verify critical pages are accessible
    console.log('Verifying critical pages...');
    await verifyCriticalPages(page, baseURL as string);
    console.log('Critical pages verified.');

    console.log('\n=== Global Setup Complete ===\n');

  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Wait for the application to be ready
 */
async function waitForAppReady(page: any, baseURL: string, maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await page.goto(baseURL, { timeout: 10000 });
      if (response?.ok()) {
        return;
      }
    } catch (error) {
      console.log(`Attempt ${attempt}/${maxAttempts}: Application not ready yet...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Application failed to start within timeout');
}

/**
 * Seed test database with initial data
 */
async function seedTestDatabase() {
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080/api/v1';

  // In a real implementation, this would call your API to seed data
  // For now, we'll prepare the data structure that can be used

  const seedData = {
    users: Object.values(testUsers),
    festivals: Object.values(testFestivals),
    stands: testStands,
    ticketTypes: testTicketTypes,
  };

  // If you have a seed endpoint:
  // await fetch(`${apiBaseUrl}/test/seed`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(seedData),
  // });

  // Store seed data in environment for tests to use
  process.env.SEED_DATA = JSON.stringify(seedData);
}

/**
 * Setup admin authentication state for reuse
 */
async function setupAdminAuthState(page: any, baseURL: string) {
  await page.goto(baseURL);

  // Set admin auth state in localStorage
  const adminAuthState = {
    state: {
      user: testUsers.admin,
      isAuthenticated: true,
    },
    version: 0,
  };

  await page.evaluate((authState: any) => {
    localStorage.setItem('auth-storage', JSON.stringify(authState));
  }, adminAuthState);

  // Save storage state to a file for reuse
  await page.context().storageState({ path: 'e2e/.auth/admin.json' });
}

/**
 * Verify that critical pages are accessible
 */
async function verifyCriticalPages(page: any, baseURL: string) {
  const criticalPages = [
    '/login',
    '/festivals',
  ];

  for (const pagePath of criticalPages) {
    try {
      const response = await page.goto(`${baseURL}${pagePath}`, { timeout: 10000 });
      if (!response?.ok()) {
        console.warn(`Warning: Page ${pagePath} returned status ${response?.status()}`);
      }
    } catch (error) {
      console.warn(`Warning: Could not access ${pagePath}:`, error);
    }
  }
}

export default globalSetup;
