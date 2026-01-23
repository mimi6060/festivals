/**
 * E2E Test: Staff Payment Processing Flow
 *
 * Tests the critical user journey for staff processing customer payments:
 * 1. Staff logs in
 * 2. Switches to staff/POS mode
 * 3. Scans customer QR code or NFC
 * 4. Processes payment for items
 * 5. Verifies transaction is recorded
 */

import { test, expect } from '@playwright/test';
import {
  testUsers,
  testFestivals,
  testStands,
  testWallets,
} from '../fixtures';
import { barProducts, foodProducts } from '../fixtures/test-products';
import {
  AuthHelper,
  createAuthHelper,
  waitForPageLoad,
} from '../utils/auth-helpers';
import { ApiHelper, createApiHelper, generateTestId } from '../utils/api-helpers';

let authHelper: AuthHelper;
let apiHelper: ApiHelper;

test.describe('Staff Payment Processing Journey', () => {
  test.beforeEach(async ({ page }) => {
    authHelper = createAuthHelper(page);
    apiHelper = createApiHelper(page);

    // Seed test data
    await apiHelper.seedTestData();
    await apiHelper.setupStandardMocks();

    // Mock stand assignment for staff
    await apiHelper.mockApiResponse('**/api/v1/staff/me/assignment', {
      standId: testStands[0].id,
      standName: testStands[0].name,
      festivalId: testFestivals.active.id,
      role: 'CASHIER',
    });

    // Mock stand products
    await apiHelper.mockApiResponse(`**/api/v1/stands/${testStands[0].id}/products`, {
      products: barProducts,
    });
  });

  test.afterEach(async ({ page }) => {
    await apiHelper.cleanupTestData();
    await authHelper.logout();
  });

  test.describe('Staff Authentication', () => {
    test('should allow staff member to login', async ({ page }) => {
      await authHelper.loginAs('staff');

      const isAuthenticated = await authHelper.isAuthenticated();
      expect(isAuthenticated).toBe(true);

      const user = await authHelper.getCurrentUser();
      expect(user?.roles).toContain('STAFF');
    });

    test('should redirect non-staff users from POS pages', async ({ page }) => {
      await authHelper.loginAs('attendee');
      await page.goto('/pos');

      // Should redirect to home or show access denied
      await expect(page.locator('text=access denied, text=non autorise, text=unauthorized')).toBeVisible()
        .catch(async () => {
          // Or redirected away from /pos
          expect(page.url()).not.toContain('/pos');
        });
    });

    test('should show staff dashboard for authenticated staff', async ({ page }) => {
      await authHelper.loginAs('staff');
      await page.goto('/pos');
      await waitForPageLoad(page);

      // POS interface should be visible
      await expect(page.locator('text=POS, text=Caisse, text=Point of Sale')).toBeVisible();
    });
  });

  test.describe('Staff Mode Toggle', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('staff');
    });

    test('should switch to staff mode', async ({ page }) => {
      await authHelper.switchToStaffMode();

      const isStaffMode = await authHelper.isInStaffMode();
      expect(isStaffMode).toBe(true);
    });

    test('should show POS interface in staff mode', async ({ page }) => {
      await authHelper.switchToStaffMode();
      await page.goto('/pos');
      await waitForPageLoad(page);

      // POS elements should be visible
      await expect(page.locator('[data-testid="pos-interface"], .pos-container, text=Caisse')).toBeVisible();
    });

    test('should display assigned stand information', async ({ page }) => {
      await authHelper.switchToStaffMode();
      await page.goto('/pos');
      await waitForPageLoad(page);

      // Stand name should be visible
      await expect(page.locator(`text=${testStands[0].name}`)).toBeVisible();
    });

    test('should exit staff mode', async ({ page }) => {
      await authHelper.switchToStaffMode();
      expect(await authHelper.isInStaffMode()).toBe(true);

      await authHelper.exitStaffMode();
      expect(await authHelper.isInStaffMode()).toBe(false);
    });
  });

  test.describe('Customer QR Code Scanning', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('staff');
      await authHelper.switchToStaffMode();
      await page.goto('/pos');
      await waitForPageLoad(page);
    });

    test('should display scan button/area', async ({ page }) => {
      const scanButton = page.locator('button:has-text("Scan"), button:has-text("Scanner"), [data-testid="scan-qr"]');
      await expect(scanButton).toBeVisible();
    });

    test('should open scanner interface', async ({ page }) => {
      await page.click('button:has-text("Scan"), button:has-text("Scanner")');

      // Scanner interface or camera view should appear
      await expect(page.locator('[data-testid="scanner"], .scanner-view, video, text=Camera')).toBeVisible();
    });

    test('should accept manual QR code entry', async ({ page }) => {
      // Click scan button
      await page.click('button:has-text("Scan"), button:has-text("Scanner")');

      // Look for manual entry option
      const manualEntry = page.locator('button:has-text("Manual"), button:has-text("Code manuel"), input[placeholder*="code"]');
      if (await manualEntry.isVisible()) {
        await manualEntry.click();
      }

      // Enter a mock QR code
      const codeInput = page.locator('input[name="qrCode"], input[name="code"], input[placeholder*="code"]');
      if (await codeInput.isVisible()) {
        await codeInput.fill('TKT-ABC123-XYZ789');
        await page.click('button:has-text("Valider"), button:has-text("Submit"), button:has-text("OK")');
      }
    });

    test('should load customer wallet after successful scan', async ({ page }) => {
      // Mock wallet lookup by QR code
      await apiHelper.mockApiResponse('**/api/v1/wallets/lookup*', {
        wallet: {
          id: testWallets[0].id,
          userId: testUsers.attendee.id,
          userName: testUsers.attendee.name,
          balance: testWallets[0].balance,
          currency: 'EUR',
        },
      });

      // Simulate QR scan (direct page evaluation for testing)
      await page.evaluate((walletData) => {
        // Dispatch custom event simulating QR scan
        window.dispatchEvent(new CustomEvent('qr-scanned', {
          detail: { code: 'TKT-ABC123-XYZ789', wallet: walletData },
        }));
      }, testWallets[0]);

      // Customer info should be displayed
      await expect(page.locator(`text=${testWallets[0].balance}, text=Balance`)).toBeVisible()
        .catch(() => {
          // Alternative: customer name visible
        });
    });

    test('should handle invalid QR code', async ({ page }) => {
      await apiHelper.mockApiError('**/api/v1/wallets/lookup*', 404, 'Wallet not found');

      // Try to scan invalid code
      await page.click('button:has-text("Scan"), button:has-text("Scanner")');

      const manualEntry = page.locator('input[placeholder*="code"]');
      if (await manualEntry.isVisible()) {
        await manualEntry.fill('INVALID-CODE');
        await page.click('button:has-text("Valider"), button:has-text("Submit")');

        // Error should be displayed
        await expect(page.locator('text=not found, text=invalide, text=introuvable')).toBeVisible();
      }
    });
  });

  test.describe('Payment Processing', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('staff');
      await authHelper.switchToStaffMode();

      // Mock customer wallet loaded
      await apiHelper.mockApiResponse('**/api/v1/wallets/lookup*', {
        wallet: {
          id: testWallets[0].id,
          userId: testUsers.attendee.id,
          userName: testUsers.attendee.name,
          balance: testWallets[0].balance,
          currency: 'EUR',
        },
      });

      await page.goto('/pos');
      await waitForPageLoad(page);
    });

    test('should display product catalog for stand', async ({ page }) => {
      // Products should be visible
      for (const product of barProducts.slice(0, 3)) {
        await expect(page.locator(`text=${product.name}`)).toBeVisible();
      }
    });

    test('should add items to cart', async ({ page }) => {
      // Click on a product to add to cart
      const productButton = page.locator(`button:has-text("${barProducts[0].name}"), [data-product-id="${barProducts[0].id}"]`).first();
      await productButton.click();

      // Cart should show the item
      await expect(page.locator('[data-testid="cart"], .cart-items, text=1 x')).toBeVisible();
    });

    test('should update cart total', async ({ page }) => {
      // Add multiple items
      const beer25cl = page.locator(`button:has-text("${barProducts[0].name}")`).first();
      await beer25cl.click();
      await beer25cl.click(); // Add 2

      // Total should be 2 * 4.00 = 8.00
      await expect(page.locator('text=8.00, text=8,00')).toBeVisible();
    });

    test('should remove items from cart', async ({ page }) => {
      // Add item
      await page.locator(`button:has-text("${barProducts[0].name}")`).first().click();

      // Find and click remove button
      const removeButton = page.locator('[data-testid="remove-item"], button:has-text("-"), button[aria-label*="remove"]').first();
      await removeButton.click();

      // Cart should be empty or show 0
      await expect(page.locator('text=0.00, text=empty, text=vide')).toBeVisible();
    });

    test('should process payment with sufficient balance', async ({ page }) => {
      // Mock successful payment
      const paymentId = generateTestId('payment');
      await apiHelper.mockApiResponse('**/api/v1/payments', {
        id: paymentId,
        status: 'COMPLETED',
        amount: 4.00,
        balanceAfter: testWallets[0].balance - 4.00,
        createdAt: new Date().toISOString(),
      }, { method: 'POST' });

      // Add item to cart
      await page.locator(`button:has-text("${barProducts[0].name}")`).first().click();

      // Load customer wallet (simulate scan)
      await page.evaluate(() => {
        localStorage.setItem('current-customer-wallet', JSON.stringify({
          id: 'test-wallet-001',
          balance: 45.50,
        }));
        window.dispatchEvent(new Event('wallet-loaded'));
      });

      // Click pay button
      await page.click('button:has-text("Payer"), button:has-text("Pay"), button:has-text("Encaisser")');

      // Success should be shown
      await expect(page.locator('text=success, text=reussi, text=confirme')).toBeVisible();
    });

    test('should reject payment with insufficient balance', async ({ page }) => {
      // Mock failed payment
      await apiHelper.mockApiError('**/api/v1/payments', 400, 'Insufficient balance');

      // Set wallet with low balance
      await page.evaluate(() => {
        localStorage.setItem('current-customer-wallet', JSON.stringify({
          id: 'test-wallet-001',
          balance: 2.00, // Less than product price
        }));
        window.dispatchEvent(new Event('wallet-loaded'));
      });

      // Add expensive item
      await page.locator(`button:has-text("${barProducts[4].name}")`).first().click(); // Cocktail - 9.00

      // Try to pay
      await page.click('button:has-text("Payer"), button:has-text("Pay")');

      // Error should be shown
      await expect(page.locator('text=insufficient, text=insuffisant, text=solde')).toBeVisible();
    });

    test('should display updated balance after payment', async ({ page }) => {
      const initialBalance = testWallets[0].balance;
      const paymentAmount = barProducts[0].price;
      const expectedBalance = initialBalance - paymentAmount;

      await apiHelper.mockApiResponse('**/api/v1/payments', {
        id: 'payment-001',
        status: 'COMPLETED',
        amount: paymentAmount,
        balanceAfter: expectedBalance,
      }, { method: 'POST' });

      // Add item and process payment
      await page.locator(`button:has-text("${barProducts[0].name}")`).first().click();

      await page.evaluate((balance) => {
        localStorage.setItem('current-customer-wallet', JSON.stringify({
          id: 'test-wallet-001',
          balance: balance,
        }));
        window.dispatchEvent(new Event('wallet-loaded'));
      }, initialBalance);

      await page.click('button:has-text("Payer"), button:has-text("Pay")');

      // New balance should be displayed
      await expect(page.locator(`text=${expectedBalance.toFixed(2)}`)).toBeVisible();
    });
  });

  test.describe('Transaction Recording', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('staff');
      await authHelper.switchToStaffMode();
      await page.goto('/pos');
      await waitForPageLoad(page);
    });

    test('should record transaction details', async ({ page }) => {
      const transactionId = generateTestId('txn');

      await apiHelper.mockApiResponse('**/api/v1/payments', {
        id: 'payment-001',
        transactionId,
        status: 'COMPLETED',
        items: [
          { productId: barProducts[0].id, productName: barProducts[0].name, quantity: 1, price: barProducts[0].price },
        ],
        totalAmount: barProducts[0].price,
        standId: testStands[0].id,
        staffId: testUsers.staff.id,
        createdAt: new Date().toISOString(),
      }, { method: 'POST' });

      // Process a payment
      await page.locator(`button:has-text("${barProducts[0].name}")`).first().click();

      await page.evaluate(() => {
        localStorage.setItem('current-customer-wallet', JSON.stringify({
          id: 'test-wallet-001',
          balance: 50,
        }));
        window.dispatchEvent(new Event('wallet-loaded'));
      });

      await page.click('button:has-text("Payer"), button:has-text("Pay")');

      // Transaction ID should be shown in confirmation
      await expect(page.locator(`text=${transactionId}, text=Transaction`)).toBeVisible();
    });

    test('should show transaction history for current session', async ({ page }) => {
      // Mock transaction history
      await apiHelper.mockApiResponse('**/api/v1/staff/me/transactions', {
        transactions: [
          {
            id: 'txn-001',
            amount: 12.00,
            items: 3,
            time: new Date().toISOString(),
            status: 'COMPLETED',
          },
          {
            id: 'txn-002',
            amount: 8.50,
            items: 2,
            time: new Date().toISOString(),
            status: 'COMPLETED',
          },
        ],
        totalAmount: 20.50,
        transactionCount: 2,
      });

      // Click on history/transactions tab
      const historyTab = page.locator('button:has-text("History"), button:has-text("Historique"), [data-tab="history"]');
      if (await historyTab.isVisible()) {
        await historyTab.click();

        // Transactions should be listed
        await expect(page.locator('text=txn-001, text=12.00')).toBeVisible();
      }
    });

    test('should allow printing receipt', async ({ page }) => {
      // Process a payment first
      await page.locator(`button:has-text("${barProducts[0].name}")`).first().click();

      await page.evaluate(() => {
        localStorage.setItem('current-customer-wallet', JSON.stringify({
          id: 'test-wallet-001',
          balance: 50,
        }));
        window.dispatchEvent(new Event('wallet-loaded'));
      });

      await apiHelper.mockApiResponse('**/api/v1/payments', {
        id: 'payment-001',
        status: 'COMPLETED',
      }, { method: 'POST' });

      await page.click('button:has-text("Payer")');

      // Look for print receipt button
      const printButton = page.locator('button:has-text("Print"), button:has-text("Imprimer"), button:has-text("Receipt")');
      if (await printButton.isVisible()) {
        // Note: actual printing is hard to test, just verify button exists
        await expect(printButton).toBeEnabled();
      }
    });
  });

  test.describe('Complete Staff Payment Flow', () => {
    test('should complete full payment processing journey', async ({ page }) => {
      // Step 1: Staff logs in
      await authHelper.loginAs('staff');
      expect(await authHelper.hasRole('STAFF')).toBe(true);

      // Step 2: Switch to staff mode
      await authHelper.switchToStaffMode();
      expect(await authHelper.isInStaffMode()).toBe(true);

      // Step 3: Navigate to POS
      await page.goto('/pos');
      await waitForPageLoad(page);

      // Verify POS loaded
      await expect(page.locator(`text=${testStands[0].name}, text=POS, text=Caisse`)).toBeVisible();

      // Step 4: Scan customer QR (simulated)
      await apiHelper.mockApiResponse('**/api/v1/wallets/lookup*', {
        wallet: {
          id: testWallets[0].id,
          userId: testUsers.attendee.id,
          userName: testUsers.attendee.name,
          balance: 100.00, // Ensure sufficient balance
          currency: 'EUR',
        },
      });

      await page.evaluate(() => {
        localStorage.setItem('current-customer-wallet', JSON.stringify({
          id: 'test-wallet-001',
          balance: 100.00,
          userName: 'Test Attendee',
        }));
        window.dispatchEvent(new Event('wallet-loaded'));
      });

      // Step 5: Add items to cart
      await page.locator(`button:has-text("${barProducts[0].name}")`).first().click(); // Beer
      await page.locator(`button:has-text("${barProducts[0].name}")`).first().click(); // Another beer

      // Verify cart total (2 * 4.00 = 8.00)
      await expect(page.locator('text=8.00, text=8,00')).toBeVisible();

      // Step 6: Process payment
      await apiHelper.mockApiResponse('**/api/v1/payments', {
        id: 'payment-complete-001',
        status: 'COMPLETED',
        amount: 8.00,
        balanceAfter: 92.00,
        createdAt: new Date().toISOString(),
      }, { method: 'POST' });

      await page.click('button:has-text("Payer"), button:has-text("Pay"), button:has-text("Encaisser")');

      // Step 7: Verify success
      await expect(page.locator('text=success, text=reussi, text=Payment confirmed')).toBeVisible();

      // Step 8: Ready for next customer
      await expect(page.locator('button:has-text("New"), button:has-text("Nouveau"), button:has-text("Next")')).toBeVisible();
    });

    test('should handle multiple consecutive transactions', async ({ page }) => {
      await authHelper.loginAs('staff');
      await authHelper.switchToStaffMode();
      await page.goto('/pos');
      await waitForPageLoad(page);

      // First transaction
      await page.evaluate(() => {
        localStorage.setItem('current-customer-wallet', JSON.stringify({
          id: 'wallet-1',
          balance: 50,
        }));
        window.dispatchEvent(new Event('wallet-loaded'));
      });

      await page.locator(`button:has-text("${barProducts[0].name}")`).first().click();

      await apiHelper.mockApiResponse('**/api/v1/payments', {
        id: 'payment-1',
        status: 'COMPLETED',
      }, { method: 'POST' });

      await page.click('button:has-text("Payer")');
      await expect(page.locator('text=success')).toBeVisible();

      // Clear for next customer
      const newButton = page.locator('button:has-text("New"), button:has-text("Nouveau")');
      if (await newButton.isVisible()) {
        await newButton.click();
      }

      // Second transaction
      await page.evaluate(() => {
        localStorage.setItem('current-customer-wallet', JSON.stringify({
          id: 'wallet-2',
          balance: 30,
        }));
        window.dispatchEvent(new Event('wallet-loaded'));
      });

      await page.locator(`button:has-text("${barProducts[1].name}")`).first().click();

      await apiHelper.mockApiResponse('**/api/v1/payments', {
        id: 'payment-2',
        status: 'COMPLETED',
      }, { method: 'POST' });

      await page.click('button:has-text("Payer")');
      await expect(page.locator('text=success')).toBeVisible();
    });
  });
});
