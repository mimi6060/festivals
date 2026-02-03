import { test as base, expect, Page, BrowserContext } from '@playwright/test';

// Test user data
export const testUsers = {
  admin: {
    id: 'test-admin-1',
    email: 'admin@festivals.test',
    name: 'Test Admin',
    roles: ['SUPER_ADMIN'],
  },
  festivalManager: {
    id: 'test-manager-1',
    email: 'manager@festivals.test',
    name: 'Festival Manager',
    roles: ['FESTIVAL_MANAGER'],
    festivalId: '1',
  },
  staffMember: {
    id: 'test-staff-1',
    email: 'staff@festivals.test',
    name: 'Staff Member',
    roles: ['STAFF'],
    festivalId: '1',
  },
};

// Mock festival data for tests
export const testFestival = {
  id: '1',
  name: 'Summer Fest 2026',
  slug: 'summer-fest-2026',
  description: 'The biggest summer festival',
  startDate: '2026-06-15',
  endDate: '2026-06-17',
  location: 'Brussels, Belgium',
  timezone: 'Europe/Brussels',
  currencyName: 'Griffons',
  exchangeRate: 0.1,
  status: 'ACTIVE' as const,
  settings: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// Auth helper class for managing authentication state
export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Login as a specific user by setting localStorage state
   */
  async loginAs(userType: keyof typeof testUsers) {
    const user = testUsers[userType];

    // Set auth state in localStorage (mimicking zustand persist)
    await this.page.evaluate((userData) => {
      const authState = {
        state: {
          user: userData,
          isAuthenticated: true,
        },
        version: 0,
      };
      localStorage.setItem('auth-storage', JSON.stringify(authState));
    }, user);

    // Reload page to pick up the auth state
    await this.page.reload();
  }

  /**
   * Login via the login page UI
   */
  async loginViaUI() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');

    // Click the login button (mock login)
    await this.page.click('button:has-text("Se connecter")');

    // Wait for redirect to dashboard
    await this.page.waitForURL(/\/(festival\/config|festivals)/);
  }

  /**
   * Logout the current user
   */
  async logout() {
    await this.page.evaluate(() => {
      localStorage.removeItem('auth-storage');
    });
    await this.page.reload();
  }

  /**
   * Check if user is currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const storage = localStorage.getItem('auth-storage');
      if (!storage) return false;
      try {
        const data = JSON.parse(storage);
        return data.state?.isAuthenticated === true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Get current user from storage
   */
  async getCurrentUser() {
    return await this.page.evaluate(() => {
      const storage = localStorage.getItem('auth-storage');
      if (!storage) return null;
      try {
        const data = JSON.parse(storage);
        return data.state?.user || null;
      } catch {
        return null;
      }
    });
  }
}

// Extended test fixture with auth helper
type TestFixtures = {
  authHelper: AuthHelper;
  authenticatedPage: Page;
};

export const test = base.extend<TestFixtures>({
  authHelper: async ({ page }, use) => {
    const authHelper = new AuthHelper(page);
    await use(authHelper);
  },

  authenticatedPage: async ({ page }, use) => {
    const authHelper = new AuthHelper(page);
    await authHelper.loginAs('admin');
    await use(page);
  },
});

export { expect };

// Helper functions for common test operations
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

export async function clearLocalStorage(page: Page) {
  await page.evaluate(() => localStorage.clear());
}

export async function setupFestivalStore(page: Page, festivals: typeof testFestival[] = [testFestival]) {
  await page.evaluate((festivalData) => {
    const festivalState = {
      state: {
        festivals: festivalData,
        currentFestival: festivalData[0] || null,
      },
      version: 0,
    };
    localStorage.setItem('festival-storage', JSON.stringify(festivalState));
  }, festivals);
}

// Test data generators
export function generateTestFestival(overrides: Partial<typeof testFestival> = {}) {
  const timestamp = Date.now();
  return {
    ...testFestival,
    id: `test-${timestamp}`,
    name: `Test Festival ${timestamp}`,
    slug: `test-festival-${timestamp}`,
    ...overrides,
  };
}

export function generateTestTicketType(festivalId: string, overrides: Record<string, unknown> = {}) {
  const timestamp = Date.now();
  return {
    id: `ticket-${timestamp}`,
    festivalId,
    name: `Test Ticket ${timestamp}`,
    description: 'Test ticket description',
    price: 99,
    quantity: 1000,
    sold: 0,
    checkedIn: 0,
    status: 'DRAFT' as const,
    validFrom: '2026-06-15T00:00:00Z',
    validUntil: '2026-06-17T23:59:59Z',
    benefits: ['Access to festival'],
    settings: {
      allowReentry: true,
      initialTopUpAmount: 10,
      transferable: true,
      transferDeadline: '2026-06-14T23:59:59Z',
      maxTransfers: 2,
      requiresId: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function generateTestStand(festivalId: string, overrides: Record<string, unknown> = {}) {
  const timestamp = Date.now();
  return {
    id: `stand-${timestamp}`,
    festivalId,
    name: `Test Stand ${timestamp}`,
    description: 'Test stand description',
    category: 'BAR' as const,
    isActive: true,
    location: {
      lat: 50.8503,
      lng: 4.3517,
      zone: 'Zone A',
    },
    settings: {
      acceptsOnlyTokens: true,
      requiresPin: false,
      allowsNegativeBalance: false,
      maxTransactionAmount: null,
    },
    staffCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Mock API response helper
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: object,
  options: { status?: number; delay?: number } = {}
) {
  const { status = 200, delay = 0 } = options;

  await page.route(urlPattern, async (route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

// Intercept and mock multiple API endpoints
export async function setupApiMocks(page: Page) {
  // Mock festivals list
  await mockApiResponse(page, '**/api/v1/festivals', {
    festivals: [testFestival],
    total: 1,
  });

  // Mock single festival
  await mockApiResponse(page, '**/api/v1/festivals/*', testFestival);

  // Mock ticket types
  await mockApiResponse(page, '**/api/v1/festivals/*/ticket-types', []);

  // Mock stands
  await mockApiResponse(page, '**/api/v1/festivals/*/stands', { stands: [] });
}
