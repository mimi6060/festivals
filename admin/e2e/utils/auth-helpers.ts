/**
 * Authentication helpers for E2E tests
 * Provides utilities for login, logout, and session management
 */

import { Page, BrowserContext } from '@playwright/test';
import { testUsers, testCredentials, UserType, TestUser } from '../fixtures/test-users';

/**
 * Authentication helper class for managing user sessions
 */
export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Login as a specific user type by setting localStorage state
   * This bypasses the actual Auth0 flow for faster tests
   */
  async loginAs(userType: UserType): Promise<void> {
    const user = testUsers[userType];

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
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Login via the UI login page (for testing the actual login flow)
   */
  async loginViaUI(userType: UserType = 'admin'): Promise<void> {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');

    // Click the login button (mock Auth0 login)
    await this.page.click('button:has-text("Se connecter")');

    // Wait for redirect to dashboard
    await this.page.waitForURL(/\/(festival\/config|festivals|account)/);

    // Set the appropriate user data based on user type
    const user = testUsers[userType];
    await this.page.evaluate((userData) => {
      const storage = localStorage.getItem('auth-storage');
      if (storage) {
        const data = JSON.parse(storage);
        data.state.user = userData;
        localStorage.setItem('auth-storage', JSON.stringify(data));
      }
    }, user);

    await this.page.reload();
  }

  /**
   * Login with email and password credentials (for testing form validation)
   */
  async loginWithCredentials(email: string, password: string): Promise<void> {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');

    // If email/password fields exist, fill them
    const emailField = this.page.locator('input[type="email"], input[name="email"]');
    const passwordField = this.page.locator('input[type="password"], input[name="password"]');

    if (await emailField.isVisible()) {
      await emailField.fill(email);
      await passwordField.fill(password);
      await this.page.click('button[type="submit"]');
    } else {
      // Fall back to mock login
      await this.page.click('button:has-text("Se connecter")');
    }

    await this.page.waitForURL(/\/(festival\/config|festivals|account)/);
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.removeItem('auth-storage');
      localStorage.removeItem('festival-storage');
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
  async getCurrentUser(): Promise<TestUser | null> {
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

  /**
   * Check if current user has a specific role
   */
  async hasRole(role: string): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.roles.includes(role) ?? false;
  }

  /**
   * Check if current user has a specific permission
   */
  async hasPermission(permission: string): Promise<boolean> {
    const user = await this.getCurrentUser();
    if (!user?.permissions) return false;
    return user.permissions.includes(permission) || user.permissions.includes('*');
  }

  /**
   * Set session token (for API testing)
   */
  async setSessionToken(token: string): Promise<void> {
    await this.page.evaluate((sessionToken) => {
      localStorage.setItem('session-token', sessionToken);
    }, token);
  }

  /**
   * Get session token
   */
  async getSessionToken(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return localStorage.getItem('session-token');
    });
  }

  /**
   * Clear all session data
   */
  async clearSession(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Switch to staff mode (for staff users)
   */
  async switchToStaffMode(): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user?.roles.includes('STAFF') && !user?.roles.includes('CASHIER')) {
      throw new Error('Current user is not a staff member');
    }

    await this.page.evaluate(() => {
      const storage = localStorage.getItem('auth-storage');
      if (storage) {
        const data = JSON.parse(storage);
        data.state.staffMode = true;
        localStorage.setItem('auth-storage', JSON.stringify(data));
      }
    });

    await this.page.reload();
  }

  /**
   * Exit staff mode
   */
  async exitStaffMode(): Promise<void> {
    await this.page.evaluate(() => {
      const storage = localStorage.getItem('auth-storage');
      if (storage) {
        const data = JSON.parse(storage);
        data.state.staffMode = false;
        localStorage.setItem('auth-storage', JSON.stringify(data));
      }
    });

    await this.page.reload();
  }

  /**
   * Check if in staff mode
   */
  async isInStaffMode(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const storage = localStorage.getItem('auth-storage');
      if (!storage) return false;
      try {
        const data = JSON.parse(storage);
        return data.state?.staffMode === true;
      } catch {
        return false;
      }
    });
  }
}

/**
 * Create an auth helper instance for a page
 */
export function createAuthHelper(page: Page): AuthHelper {
  return new AuthHelper(page);
}

/**
 * Wait for page to fully load
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * Clear localStorage on a page
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear());
}

/**
 * Setup authenticated context with stored state
 */
export async function setupAuthenticatedContext(
  context: BrowserContext,
  userType: UserType
): Promise<void> {
  const user = testUsers[userType];

  await context.addInitScript((userData) => {
    const authState = {
      state: {
        user: userData,
        isAuthenticated: true,
      },
      version: 0,
    };
    localStorage.setItem('auth-storage', JSON.stringify(authState));
  }, user);
}
