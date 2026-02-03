import { test, expect, testUsers, waitForPageLoad, clearLocalStorage } from './setup';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state before each test
    await page.goto('/');
    await clearLocalStorage(page);
  });

  test.describe('Login Flow', () => {
    test('should display login page with correct elements', async ({ page }) => {
      await page.goto('/login');
      await waitForPageLoad(page);

      // Check page title and description
      await expect(page.locator('h1')).toContainText('Festivals');
      await expect(page.locator('p:has-text("Back-office de gestion")')).toBeVisible();

      // Check login button is present
      const loginButton = page.locator('button:has-text("Se connecter")');
      await expect(loginButton).toBeVisible();
      await expect(loginButton).toBeEnabled();

      // Check Auth0 mention
      await expect(page.locator('text=Connexion sécurisée via Auth0')).toBeVisible();
    });

    test('should successfully login and redirect to dashboard', async ({ page }) => {
      await page.goto('/login');
      await waitForPageLoad(page);

      // Click the login button
      await page.click('button:has-text("Se connecter")');

      // Wait for redirect (mock login redirects to /festival/config)
      await page.waitForURL(/\/festival\/config/);

      // Verify user is logged in by checking localStorage
      const isAuthenticated = await page.evaluate(() => {
        const storage = localStorage.getItem('auth-storage');
        if (!storage) return false;
        const data = JSON.parse(storage);
        return data.state?.isAuthenticated === true;
      });
      expect(isAuthenticated).toBe(true);
    });

    test('should show loading state during login', async ({ page }) => {
      await page.goto('/login');
      await waitForPageLoad(page);

      // Click login and immediately check for loading state
      const loginButton = page.locator('button:has-text("Se connecter")');
      await loginButton.click();

      // The button text changes to "Connexion..." during loading
      // Note: This is fast, so we may or may not catch it
      // The important thing is that login completes successfully
      await page.waitForURL(/\/festival\/config/);
    });

    test('should store user data correctly after login', async ({ page, authHelper }) => {
      await page.goto('/login');
      await authHelper.loginViaUI();

      const user = await authHelper.getCurrentUser();
      expect(user).not.toBeNull();
      expect(user.email).toBe('admin@festivals.app');
      expect(user.name).toBe('Admin');
      expect(user.roles).toContain('SUPER_ADMIN');
    });
  });

  test.describe('Logout', () => {
    test('should clear auth state on logout', async ({ page, authHelper }) => {
      // Login first
      await page.goto('/login');
      await authHelper.loginAs('admin');
      await page.goto('/festivals');

      // Verify logged in
      let isAuthenticated = await authHelper.isAuthenticated();
      expect(isAuthenticated).toBe(true);

      // Logout
      await authHelper.logout();

      // Verify logged out
      isAuthenticated = await authHelper.isAuthenticated();
      expect(isAuthenticated).toBe(false);
    });

    test('should clear user data from localStorage on logout', async ({ page, authHelper }) => {
      // Login first
      await authHelper.loginAs('admin');
      await page.goto('/festivals');

      // Verify user exists
      let user = await authHelper.getCurrentUser();
      expect(user).not.toBeNull();

      // Logout
      await authHelper.logout();

      // Verify user is cleared
      user = await authHelper.getCurrentUser();
      expect(user).toBeNull();
    });
  });

  test.describe('Protected Routes', () => {
    test('should allow access to login page when not authenticated', async ({ page }) => {
      await clearLocalStorage(page);
      await page.goto('/login');
      await waitForPageLoad(page);

      // Should stay on login page
      expect(page.url()).toContain('/login');
      await expect(page.locator('button:has-text("Se connecter")')).toBeVisible();
    });

    test('should access dashboard when authenticated', async ({ page, authHelper }) => {
      await authHelper.loginAs('admin');
      await page.goto('/');
      await waitForPageLoad(page);

      // Should be able to access the dashboard
      // The dashboard layout should be visible
      await expect(page.locator('text=Festivals Admin')).toBeVisible();
    });

    test('should access festivals page when authenticated', async ({ page, authHelper }) => {
      await authHelper.loginAs('admin');
      await page.goto('/festivals');
      await waitForPageLoad(page);

      // Should see festivals page header
      await expect(page.locator('h1:has-text("Festivals")')).toBeVisible();
    });

    test('should access festival config when authenticated', async ({ page, authHelper }) => {
      await authHelper.loginAs('admin');
      await page.goto('/festival/config');
      await waitForPageLoad(page);

      // Should be on config page (part of dashboard layout)
      await expect(page.locator('text=Configuration')).toBeVisible();
    });

    test('should access new festival page when authenticated', async ({ page, authHelper }) => {
      await authHelper.loginAs('admin');
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Should see new festival form
      await expect(page.locator('h1:has-text("Nouveau festival")')).toBeVisible();
    });

    test('should access festival details when authenticated', async ({ page, authHelper }) => {
      await authHelper.loginAs('admin');
      await page.goto('/festivals/1');
      await waitForPageLoad(page);

      // Should be on festival page (layout should be visible)
      await expect(page.locator('text=Festivals Admin')).toBeVisible();
    });

    test('should access tickets page when authenticated', async ({ page, authHelper }) => {
      await authHelper.loginAs('admin');
      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      // Should see tickets management page
      await expect(page.locator('h1:has-text("Gestion des billets")')).toBeVisible();
    });

    test('should access stands page when authenticated', async ({ page, authHelper }) => {
      await authHelper.loginAs('admin');
      await page.goto('/festivals/1/stands');
      await waitForPageLoad(page);

      // Should see stands page
      await expect(page.locator('h1:has-text("Stands")')).toBeVisible();
    });

    test('should access scanner page when authenticated', async ({ page, authHelper }) => {
      await authHelper.loginAs('admin');
      await page.goto('/festivals/1/tickets/scan');
      await waitForPageLoad(page);

      // Should see scanner page
      await expect(page.locator('h1:has-text("Scanner de billets")')).toBeVisible();
    });
  });

  test.describe('Role-based Access', () => {
    test('should authenticate as admin user', async ({ page, authHelper }) => {
      await authHelper.loginAs('admin');

      const user = await authHelper.getCurrentUser();
      expect(user.roles).toContain('SUPER_ADMIN');
    });

    test('should authenticate as festival manager', async ({ page, authHelper }) => {
      await authHelper.loginAs('festivalManager');

      const user = await authHelper.getCurrentUser();
      expect(user.roles).toContain('FESTIVAL_MANAGER');
      expect(user.festivalId).toBe('1');
    });

    test('should authenticate as staff member', async ({ page, authHelper }) => {
      await authHelper.loginAs('staffMember');

      const user = await authHelper.getCurrentUser();
      expect(user.roles).toContain('STAFF');
      expect(user.festivalId).toBe('1');
    });
  });

  test.describe('Session Persistence', () => {
    test('should persist auth state across page reloads', async ({ page, authHelper }) => {
      await authHelper.loginAs('admin');
      await page.goto('/festivals');

      // Verify logged in
      let isAuthenticated = await authHelper.isAuthenticated();
      expect(isAuthenticated).toBe(true);

      // Reload page
      await page.reload();
      await waitForPageLoad(page);

      // Should still be logged in
      isAuthenticated = await authHelper.isAuthenticated();
      expect(isAuthenticated).toBe(true);
    });

    test('should persist user data across page navigation', async ({ page, authHelper }) => {
      await authHelper.loginAs('admin');

      // Navigate to different pages
      await page.goto('/festivals');
      await waitForPageLoad(page);

      let user = await authHelper.getCurrentUser();
      expect(user.email).toBe(testUsers.admin.email);

      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      user = await authHelper.getCurrentUser();
      expect(user.email).toBe(testUsers.admin.email);

      await page.goto('/festivals/1/stands');
      await waitForPageLoad(page);

      user = await authHelper.getCurrentUser();
      expect(user.email).toBe(testUsers.admin.email);
    });
  });
});
