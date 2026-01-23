/**
 * E2E Test: Festival Setup Flow
 *
 * Tests the critical admin journey of setting up a new festival:
 * 1. Admin creates a new festival
 * 2. Configures festival settings
 * 3. Adds stands and products
 * 4. Adds staff members
 * 5. Publishes the festival
 */

import { test, expect } from '@playwright/test';
import { testUsers, testFestivals, testStands, testTicketTypes } from '../fixtures';
import { barProducts } from '../fixtures/test-products';
import {
  AuthHelper,
  createAuthHelper,
  waitForPageLoad,
} from '../utils/auth-helpers';
import { ApiHelper, createApiHelper, generateTestId } from '../utils/api-helpers';

let authHelper: AuthHelper;
let apiHelper: ApiHelper;

test.describe('Festival Setup Journey', () => {
  test.beforeEach(async ({ page }) => {
    authHelper = createAuthHelper(page);
    apiHelper = createApiHelper(page);

    // Seed initial data
    await apiHelper.seedTestData();
    await apiHelper.setupStandardMocks();

    // Login as admin
    await authHelper.loginAs('admin');
  });

  test.afterEach(async ({ page }) => {
    await apiHelper.cleanupTestData();
    await authHelper.logout();
  });

  test.describe('Festival Creation', () => {
    test('should display new festival form', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Form title should be visible
      await expect(page.locator('h1:has-text("Nouveau festival"), h1:has-text("New Festival")')).toBeVisible();

      // Form fields should be visible
      await expect(page.locator('input[placeholder*="Summer Fest"], input[name="name"]')).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Try to submit empty form
      await page.click('button:has-text("Creer"), button:has-text("Create")');

      // Validation errors should appear
      await expect(page.locator('text=requis, text=required')).toBeVisible();
    });

    test('should auto-generate slug from name', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Enter festival name
      await page.fill('input[placeholder*="Summer Fest"], input[name="name"]', 'My Awesome Festival 2026');

      // Slug should be auto-generated
      const slugInput = page.locator('input[readonly], input[name="slug"]');
      await expect(slugInput).toHaveValue('my-awesome-festival-2026');
    });

    test('should show currency conversion preview', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Fill currency settings
      await page.fill('input[placeholder*="Griffons"], input[name="currencyName"]', 'TestCoins');
      await page.fill('input[step="0.01"], input[name="exchangeRate"]', '0.5');

      // Conversion preview should be shown
      await expect(page.locator('text=Exemple, text=Example')).toBeVisible();
      await expect(page.locator('text=20 TestCoins')).toBeVisible(); // 10 EUR / 0.5 = 20
    });

    test('should create festival successfully', async ({ page }) => {
      const newFestivalId = generateTestId('festival');
      const newFestivalName = 'E2E Test Festival';

      // Mock festival creation
      await apiHelper.mockApiResponse('**/api/v1/festivals', {
        id: newFestivalId,
        name: newFestivalName,
        slug: 'e2e-test-festival',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
      }, { method: 'POST' });

      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Fill form
      await page.fill('input[placeholder*="Summer Fest"], input[name="name"]', newFestivalName);
      await page.fill('textarea[placeholder*="Description"]', 'A test festival for E2E testing');

      // Set dates
      const dateInputs = page.locator('input[type="date"]');
      await dateInputs.nth(0).fill('2026-08-01');
      await dateInputs.nth(1).fill('2026-08-03');

      await page.fill('input[placeholder*="Brussels"], input[name="location"]', 'Test City, Belgium');
      await page.fill('input[placeholder*="Griffons"], input[name="currencyName"]', 'TestTokens');

      // Submit
      await page.click('button:has-text("Creer le festival"), button:has-text("Create")');

      // Should redirect to festival page
      await page.waitForURL(/\/festivals\/\w+/, { timeout: 10000 });
    });
  });

  test.describe('Festival Settings Configuration', () => {
    const festivalId = testFestivals.draft.id;

    test.beforeEach(async ({ page }) => {
      await page.goto(`/festivals/${festivalId}/settings`);
      await waitForPageLoad(page);
    });

    test('should display settings page', async ({ page }) => {
      await expect(page.locator('h1:has-text("Settings"), h1:has-text("Parametres")')).toBeVisible();
    });

    test('should configure refund settings', async ({ page }) => {
      // Navigate to refund settings if in separate section
      const refundTab = page.locator('button:has-text("Refund"), a:has-text("Remboursements")');
      if (await refundTab.isVisible()) {
        await refundTab.click();
      }

      // Toggle refund option
      const allowRefundsToggle = page.locator('input[name="allowRefunds"], [data-testid="allow-refunds-toggle"]');
      if (await allowRefundsToggle.isVisible()) {
        await allowRefundsToggle.click();
      }

      // Set refund deadline
      const refundDeadlineInput = page.locator('input[name="refundDeadline"], input[type="datetime-local"]');
      if (await refundDeadlineInput.isVisible()) {
        await refundDeadlineInput.fill('2026-07-31T23:59');
      }
    });

    test('should configure top-up bonus settings', async ({ page }) => {
      // Navigate to payment settings if separate
      const paymentTab = page.locator('button:has-text("Payment"), a:has-text("Paiements")');
      if (await paymentTab.isVisible()) {
        await paymentTab.click();
      }

      // Set bonus threshold
      const bonusThresholdInput = page.locator('input[name="topUpBonusThreshold"]');
      if (await bonusThresholdInput.isVisible()) {
        await bonusThresholdInput.fill('50');
      }

      // Set bonus percentage
      const bonusPercentInput = page.locator('input[name="topUpBonusPercent"]');
      if (await bonusPercentInput.isVisible()) {
        await bonusPercentInput.fill('10');
      }
    });

    test('should save settings successfully', async ({ page }) => {
      // Mock settings update
      await apiHelper.mockApiResponse(`**/api/v1/festivals/${festivalId}/settings`, {
        success: true,
        settings: {},
      }, { method: 'PUT' });

      // Make a change
      const minTopUpInput = page.locator('input[name="minTopUpAmount"]');
      if (await minTopUpInput.isVisible()) {
        await minTopUpInput.fill('10');
      }

      // Save
      await page.click('button:has-text("Save"), button:has-text("Enregistrer")');

      // Success message
      await expect(page.locator('text=saved, text=enregistre, text=success')).toBeVisible();
    });
  });

  test.describe('Adding Stands and Products', () => {
    const festivalId = testFestivals.draft.id;

    test('should navigate to stands page', async ({ page }) => {
      await page.goto(`/festivals/${festivalId}/stands`);
      await waitForPageLoad(page);

      await expect(page.locator('h1:has-text("Stands")')).toBeVisible();
    });

    test('should display add stand button', async ({ page }) => {
      await page.goto(`/festivals/${festivalId}/stands`);
      await waitForPageLoad(page);

      await expect(page.locator('a:has-text("Nouveau stand"), button:has-text("Add Stand")')).toBeVisible();
    });

    test('should create a new stand', async ({ page }) => {
      const newStandId = generateTestId('stand');

      // Mock stand creation
      await apiHelper.mockApiResponse('**/api/v1/festivals/*/stands', {
        id: newStandId,
        name: 'Test Bar',
        category: 'BAR',
        isActive: true,
      }, { method: 'POST' });

      await page.goto(`/festivals/${festivalId}/stands/new`);
      await waitForPageLoad(page);

      // Fill stand form
      await page.fill('input[name="name"], input[placeholder*="name"]', 'Test Bar');
      await page.fill('textarea[name="description"]', 'A test bar for E2E testing');

      // Select category
      const categorySelect = page.locator('select[name="category"], [data-testid="category-select"]');
      if (await categorySelect.isVisible()) {
        await categorySelect.selectOption('BAR');
      }

      // Submit
      await page.click('button:has-text("Creer"), button:has-text("Create")');

      // Should redirect to stand page or show success
      await page.waitForURL(/\/stands\/\w+|\/stands$/);
    });

    test('should add products to a stand', async ({ page }) => {
      const standId = testStands[0].id;

      // Mock product creation
      await apiHelper.mockApiResponse(`**/api/v1/stands/${standId}/products`, {
        id: generateTestId('product'),
        name: 'Test Beer',
        price: 5.00,
      }, { method: 'POST' });

      await page.goto(`/festivals/${festivalId}/stands/${standId}/products`);
      await waitForPageLoad(page);

      // Click add product
      await page.click('button:has-text("Add"), button:has-text("Ajouter")');

      // Fill product form
      await page.fill('input[name="name"]', 'Test Beer');
      await page.fill('input[name="price"]', '5.00');

      // Save product
      await page.click('button:has-text("Save"), button:has-text("Enregistrer")');

      // Product should appear in list
      await expect(page.locator('text=Test Beer')).toBeVisible();
    });

    test('should bulk import products', async ({ page }) => {
      const standId = testStands[0].id;

      await page.goto(`/festivals/${festivalId}/stands/${standId}/products`);
      await waitForPageLoad(page);

      // Look for import button
      const importButton = page.locator('button:has-text("Import"), button:has-text("Importer")');
      if (await importButton.isVisible()) {
        await importButton.click();

        // Import modal should appear
        await expect(page.locator('text=Import, text=CSV')).toBeVisible();
      }
    });
  });

  test.describe('Adding Staff Members', () => {
    const festivalId = testFestivals.draft.id;

    test('should navigate to staff page', async ({ page }) => {
      await page.goto(`/festivals/${festivalId}/staff`);
      await waitForPageLoad(page);

      await expect(page.locator('h1:has-text("Staff"), h1:has-text("Personnel"), h1:has-text("Equipe")')).toBeVisible();
    });

    test('should display add staff button', async ({ page }) => {
      await page.goto(`/festivals/${festivalId}/staff`);
      await waitForPageLoad(page);

      await expect(page.locator('button:has-text("Ajouter"), button:has-text("Add"), a:has-text("Invite")')).toBeVisible();
    });

    test('should invite a new staff member', async ({ page }) => {
      // Mock staff invitation
      await apiHelper.mockApiResponse('**/api/v1/festivals/*/staff/invite', {
        success: true,
        invitation: {
          id: generateTestId('invite'),
          email: 'newstaff@test.com',
          role: 'CASHIER',
          status: 'PENDING',
        },
      }, { method: 'POST' });

      await page.goto(`/festivals/${festivalId}/staff`);
      await waitForPageLoad(page);

      // Click invite button
      await page.click('button:has-text("Ajouter"), button:has-text("Invite")');

      // Fill invitation form
      await page.fill('input[name="email"], input[type="email"]', 'newstaff@test.com');

      // Select role
      const roleSelect = page.locator('select[name="role"], [data-testid="role-select"]');
      if (await roleSelect.isVisible()) {
        await roleSelect.selectOption('CASHIER');
      }

      // Submit
      await page.click('button:has-text("Envoyer"), button:has-text("Send"), button:has-text("Invite")');

      // Success message
      await expect(page.locator('text=invitation sent, text=invite, text=envoye')).toBeVisible();
    });

    test('should assign staff to stands', async ({ page }) => {
      await page.goto(`/festivals/${festivalId}/staff`);
      await waitForPageLoad(page);

      // Find a staff member row and click assign
      const assignButton = page.locator('button:has-text("Assign"), button:has-text("Affecter")').first();
      if (await assignButton.isVisible()) {
        await assignButton.click();

        // Stand selection should appear
        await expect(page.locator('text=Stand, select[name="standId"]')).toBeVisible();
      }
    });

    test('should set staff schedule', async ({ page }) => {
      await page.goto(`/festivals/${festivalId}/staff/schedule`);
      await waitForPageLoad(page);

      // Schedule view should be visible
      await expect(page.locator('text=Schedule, text=Planning, text=Horaires')).toBeVisible();
    });
  });

  test.describe('Festival Publishing', () => {
    const festivalId = testFestivals.draft.id;

    test('should show publish button for draft festivals', async ({ page }) => {
      await page.goto(`/festivals/${festivalId}`);
      await waitForPageLoad(page);

      await expect(page.locator('button:has-text("Publish"), button:has-text("Publier")')).toBeVisible();
    });

    test('should show pre-publish checklist', async ({ page }) => {
      await page.goto(`/festivals/${festivalId}/settings`);
      await waitForPageLoad(page);

      // Look for checklist or requirements
      const checklistSection = page.locator('[data-testid="publish-checklist"], text=Checklist, text=Requirements');
      if (await checklistSection.isVisible()) {
        // Should show what's needed before publishing
        await expect(page.locator('text=ticket, text=billet')).toBeVisible();
      }
    });

    test('should validate before publishing', async ({ page }) => {
      await page.goto(`/festivals/${festivalId}`);
      await waitForPageLoad(page);

      // Click publish
      await page.click('button:has-text("Publish"), button:has-text("Publier")');

      // Should show confirmation or validation warnings
      await expect(page.locator('[role="dialog"], .modal, text=Confirm, text=Warning')).toBeVisible();
    });

    test('should publish festival successfully', async ({ page }) => {
      // Mock successful publish
      await apiHelper.mockApiResponse(`**/api/v1/festivals/${festivalId}/publish`, {
        id: festivalId,
        status: 'ACTIVE',
        publishedAt: new Date().toISOString(),
      }, { method: 'POST' });

      await page.goto(`/festivals/${festivalId}`);
      await waitForPageLoad(page);

      // Click publish
      await page.click('button:has-text("Publish"), button:has-text("Publier")');

      // Confirm in modal
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Confirmer")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Success message
      await expect(page.locator('text=published, text=publie, text=active')).toBeVisible();
    });

    test('should update festival status after publishing', async ({ page }) => {
      // Mock published festival
      await apiHelper.mockApiResponse(`**/api/v1/festivals/${festivalId}`, {
        ...testFestivals.draft,
        status: 'ACTIVE',
        publishedAt: new Date().toISOString(),
      });

      await page.goto(`/festivals/${festivalId}`);
      await waitForPageLoad(page);

      // Status badge should show Active
      await expect(page.locator('text=Active, text=Actif, span:has-text("ACTIVE")')).toBeVisible();
    });
  });

  test.describe('Complete Festival Setup Flow', () => {
    test('should complete full festival setup journey', async ({ page }) => {
      const newFestivalId = generateTestId('festival');
      const newFestivalName = 'Complete Setup Festival';

      // Step 1: Create festival
      await apiHelper.mockApiResponse('**/api/v1/festivals', {
        id: newFestivalId,
        name: newFestivalName,
        slug: 'complete-setup-festival',
        status: 'DRAFT',
      }, { method: 'POST' });

      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      await page.fill('input[name="name"]', newFestivalName);
      await page.fill('textarea[name="description"]', 'Complete setup test');

      const dateInputs = page.locator('input[type="date"]');
      await dateInputs.nth(0).fill('2026-09-01');
      await dateInputs.nth(1).fill('2026-09-03');

      await page.fill('input[name="location"]', 'Setup City');
      await page.fill('input[name="currencyName"]', 'SetupCoins');

      await page.click('button:has-text("Creer")');
      await page.waitForURL(/\/festivals\/\w+/);

      // Step 2: Configure settings
      await page.goto(`/festivals/${newFestivalId}/settings`);
      await waitForPageLoad(page);

      // Step 3: Add a stand
      await apiHelper.mockApiResponse('**/api/v1/festivals/*/stands', {
        id: generateTestId('stand'),
        name: 'Main Bar',
        category: 'BAR',
      }, { method: 'POST' });

      await page.goto(`/festivals/${newFestivalId}/stands/new`);
      await waitForPageLoad(page);

      await page.fill('input[name="name"]', 'Main Bar');

      const categorySelect = page.locator('select[name="category"]');
      if (await categorySelect.isVisible()) {
        await categorySelect.selectOption('BAR');
      }

      await page.click('button:has-text("Creer")');

      // Step 4: Add ticket types
      await apiHelper.mockApiResponse('**/api/v1/festivals/*/ticket-types', {
        id: generateTestId('ticket'),
        name: 'Day Pass',
        price: 50,
        status: 'DRAFT',
      }, { method: 'POST' });

      await page.goto(`/festivals/${newFestivalId}/tickets/new`);
      await waitForPageLoad(page);

      await page.fill('input[name="name"]', 'Day Pass');
      await page.fill('input[name="price"]', '50');
      await page.fill('input[name="quantity"]', '1000');

      await page.click('button:has-text("Creer")');

      // Step 5: Add staff
      await apiHelper.mockApiResponse('**/api/v1/festivals/*/staff/invite', {
        success: true,
      }, { method: 'POST' });

      await page.goto(`/festivals/${newFestivalId}/staff`);
      await waitForPageLoad(page);

      await page.click('button:has-text("Ajouter"), button:has-text("Invite")');
      await page.fill('input[type="email"]', 'staff@setup.test');
      await page.click('button:has-text("Envoyer"), button:has-text("Send")');

      // Step 6: Publish
      await apiHelper.mockApiResponse(`**/api/v1/festivals/${newFestivalId}/publish`, {
        id: newFestivalId,
        status: 'ACTIVE',
      }, { method: 'POST' });

      await page.goto(`/festivals/${newFestivalId}`);
      await waitForPageLoad(page);

      const publishButton = page.locator('button:has-text("Publish"), button:has-text("Publier")');
      if (await publishButton.isVisible()) {
        await publishButton.click();

        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      }

      // Verify published
      await expect(page.locator('text=published, text=publie, text=Active')).toBeVisible();
    });
  });
});
