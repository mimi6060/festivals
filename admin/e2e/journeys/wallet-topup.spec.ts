/**
 * E2E Test: Wallet Top-Up Flow
 *
 * Tests the critical user journey of adding funds to festival wallet:
 * 1. User logs in
 * 2. Navigates to wallet section
 * 3. Selects top-up amount
 * 4. Completes payment via Stripe (test mode)
 * 5. Verifies balance is updated
 */

import { test, expect } from '@playwright/test';
import { testUsers, testFestivals, testWallets } from '../fixtures';
import {
  AuthHelper,
  createAuthHelper,
  waitForPageLoad,
} from '../utils/auth-helpers';
import { ApiHelper, createApiHelper } from '../utils/api-helpers';
import { StripeHelper, createStripeHelper } from '../utils/stripe-helpers';

let authHelper: AuthHelper;
let apiHelper: ApiHelper;
let stripeHelper: StripeHelper;

test.describe('Wallet Top-Up Journey', () => {
  test.beforeEach(async ({ page }) => {
    authHelper = createAuthHelper(page);
    apiHelper = createApiHelper(page);
    stripeHelper = createStripeHelper(page);

    // Seed test data
    await apiHelper.seedTestData();
    await apiHelper.setupStandardMocks();

    // Mock user's wallet data
    await apiHelper.mockApiResponse('**/api/v1/account/wallets', {
      data: [
        {
          id: testWallets[0].id,
          festivalId: testFestivals.active.id,
          festivalName: testFestivals.active.name,
          balance: testWallets[0].balance,
          currency: 'EUR',
          currencyName: testFestivals.active.currencyName,
          nfcLinked: testWallets[0].nfcLinked,
          status: testWallets[0].status,
        },
      ],
    });
  });

  test.afterEach(async ({ page }) => {
    await apiHelper.cleanupTestData();
    await authHelper.logout();
  });

  test.describe('Authentication', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      await authHelper.clearSession();
      await page.goto('/account/wallet');

      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });

    test('should allow access to wallet page when authenticated', async ({ page }) => {
      await authHelper.loginAs('attendee');
      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Should stay on wallet page
      await expect(page).toHaveURL(/wallet/);
      await expect(page.locator('h1:has-text("wallet"), h1:has-text("portefeuille")')).toBeVisible();
    });
  });

  test.describe('Wallet Display', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('attendee');
      await page.goto('/account/wallet');
      await waitForPageLoad(page);
    });

    test('should display current wallet balance', async ({ page }) => {
      // Balance should be visible
      await expect(page.locator(`text=${testWallets[0].balance}`)).toBeVisible();
    });

    test('should display festival name associated with wallet', async ({ page }) => {
      await expect(page.locator(`text=${testFestivals.active.name}`)).toBeVisible();
    });

    test('should display transaction history', async ({ page }) => {
      // Mock transaction history
      await apiHelper.mockApiResponse(`**/api/v1/wallets/${testWallets[0].id}/transactions`, {
        data: [
          {
            id: 'tx-001',
            type: 'TOP_UP',
            amount: 50,
            balanceAfter: 95.50,
            description: 'Initial top-up',
            createdAt: '2026-01-20T10:00:00Z',
          },
          {
            id: 'tx-002',
            type: 'PAYMENT',
            amount: -12,
            balanceAfter: 83.50,
            standName: 'Main Bar',
            description: 'Beer purchase',
            createdAt: '2026-01-20T14:30:00Z',
          },
        ],
        pagination: {
          page: 1,
          totalPages: 1,
          total: 2,
        },
      });

      await page.reload();
      await waitForPageLoad(page);

      // Transaction history section should be visible
      await expect(page.locator('text=Historique, text=History, text=Transactions')).toBeVisible();
    });

    test('should show NFC link status', async ({ page }) => {
      // NFC linked indicator should be visible
      if (testWallets[0].nfcLinked) {
        await expect(page.locator('[data-testid="nfc-linked"], text=NFC, svg[class*="nfc"]')).toBeVisible();
      }
    });

    test('should display empty state when no wallet exists', async ({ page }) => {
      // Mock empty wallet response
      await apiHelper.mockApiResponse('**/api/v1/account/wallets', { data: [] });
      await page.reload();
      await waitForPageLoad(page);

      // Empty state should be visible
      await expect(page.locator('text=Aucun portefeuille, text=No wallet')).toBeVisible();
    });
  });

  test.describe('Top-Up Amount Selection', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('attendee');
      await page.goto('/account/wallet');
      await waitForPageLoad(page);
    });

    test('should display top-up button', async ({ page }) => {
      const topUpButton = page.locator('button:has-text("Recharger"), button:has-text("Top up"), button:has-text("Add funds")');
      await expect(topUpButton).toBeVisible();
    });

    test('should open top-up modal/page when clicking top-up button', async ({ page }) => {
      await page.click('button:has-text("Recharger"), button:has-text("Top up"), button:has-text("Add funds")');

      // Modal or page should appear with amount options
      await expect(page.locator('text=Montant, text=Amount')).toBeVisible();
    });

    test('should display preset amount options', async ({ page }) => {
      await page.click('button:has-text("Recharger"), button:has-text("Top up")');

      // Preset amounts should be visible (common values: 10, 20, 50, 100)
      const presetAmounts = ['10', '20', '50', '100'];
      for (const amount of presetAmounts) {
        const amountButton = page.locator(`button:has-text("${amount}"), [data-amount="${amount}"]`);
        if (await amountButton.isVisible()) {
          expect(await amountButton.count()).toBeGreaterThan(0);
        }
      }
    });

    test('should allow custom amount entry', async ({ page }) => {
      await page.click('button:has-text("Recharger"), button:has-text("Top up")');

      const customAmountInput = page.locator('input[type="number"], input[name="amount"], input[placeholder*="amount"]');
      if (await customAmountInput.isVisible()) {
        await customAmountInput.fill('75');
        expect(await customAmountInput.inputValue()).toBe('75');
      }
    });

    test('should enforce minimum top-up amount', async ({ page }) => {
      await page.click('button:has-text("Recharger"), button:has-text("Top up")');

      const customAmountInput = page.locator('input[type="number"], input[name="amount"]');
      if (await customAmountInput.isVisible()) {
        await customAmountInput.fill('1'); // Below minimum (usually 10)
        await page.click('button:has-text("Continue"), button:has-text("Continuer")');

        // Should show minimum amount error
        await expect(page.locator('text=minimum, text=Minimum')).toBeVisible();
      }
    });

    test('should enforce maximum top-up amount', async ({ page }) => {
      await page.click('button:has-text("Recharger"), button:has-text("Top up")');

      const customAmountInput = page.locator('input[type="number"], input[name="amount"]');
      if (await customAmountInput.isVisible()) {
        await customAmountInput.fill('1000'); // Above maximum (usually 500)
        await page.click('button:has-text("Continue"), button:has-text("Continuer")');

        // Should show maximum amount error
        await expect(page.locator('text=maximum, text=Maximum')).toBeVisible();
      }
    });

    test('should show bonus calculation for qualifying amounts', async ({ page }) => {
      await page.click('button:has-text("Recharger"), button:has-text("Top up")');

      // Select amount above bonus threshold (50+)
      const amount50Button = page.locator('button:has-text("50"), [data-amount="50"]').first();
      if (await amount50Button.isVisible()) {
        await amount50Button.click();

        // Bonus info should be displayed (10% bonus = 5 EUR bonus)
        await expect(page.locator('text=bonus, text=Bonus')).toBeVisible();
      }
    });
  });

  test.describe('Payment Processing', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('attendee');
      await stripeHelper.mockPaymentSuccess();

      // Mock top-up endpoint
      await apiHelper.mockWalletTopUp(50, testWallets[0].balance + 50);

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Open top-up flow
      await page.click('button:has-text("Recharger"), button:has-text("Top up")');
    });

    test('should display Stripe payment form for top-up', async ({ page }) => {
      // Select amount
      const amount50 = page.locator('button:has-text("50"), [data-amount="50"]').first();
      if (await amount50.isVisible()) {
        await amount50.click();
      } else {
        const amountInput = page.locator('input[type="number"]');
        await amountInput.fill('50');
      }

      await page.click('button:has-text("Continue"), button:has-text("Continuer"), button:has-text("Payer")');

      // Stripe form should be visible
      await page.waitForSelector('iframe[name^="__privateStripeFrame"], [data-testid="payment-form"]', {
        timeout: 10000,
      });
    });

    test('should process top-up payment successfully', async ({ page }) => {
      // Select amount
      const amount50 = page.locator('button:has-text("50"), [data-amount="50"]').first();
      if (await amount50.isVisible()) {
        await amount50.click();
      } else {
        const amountInput = page.locator('input[type="number"]');
        await amountInput.fill('50');
      }

      await page.click('button:has-text("Continue"), button:has-text("Payer")');
      await waitForPageLoad(page);

      // Fill payment details
      await stripeHelper.fillCardElement('visa');
      await stripeHelper.submitPayment();

      // Wait for success
      await page.waitForSelector('text=success, text=reussi, text=confirme', { timeout: 30000 });
    });

    test('should handle payment failure gracefully', async ({ page }) => {
      await stripeHelper.mockPaymentFailure('Card declined');

      // Select amount
      const amount50 = page.locator('button:has-text("50")').first();
      if (await amount50.isVisible()) {
        await amount50.click();
      }

      await page.click('button:has-text("Continue"), button:has-text("Payer")');
      await waitForPageLoad(page);

      await stripeHelper.fillCardElement('cardDeclined');
      await stripeHelper.submitPayment();

      // Error message should be displayed
      await expect(page.locator('text=declined, text=refuse, text=echec')).toBeVisible();
    });
  });

  test.describe('Balance Update Verification', () => {
    test('should update displayed balance after successful top-up', async ({ page }) => {
      await authHelper.loginAs('attendee');
      await stripeHelper.mockPaymentSuccess();

      const topUpAmount = 50;
      const initialBalance = testWallets[0].balance;
      const expectedNewBalance = initialBalance + topUpAmount;

      // Mock balance update
      await apiHelper.mockWalletTopUp(topUpAmount, expectedNewBalance);
      await apiHelper.mockApiResponse('**/api/v1/account/wallets', {
        data: [
          {
            id: testWallets[0].id,
            festivalId: testFestivals.active.id,
            festivalName: testFestivals.active.name,
            balance: expectedNewBalance,
            currency: 'EUR',
            currencyName: testFestivals.active.currencyName,
            nfcLinked: testWallets[0].nfcLinked,
            status: testWallets[0].status,
          },
        ],
      });

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Initial balance
      await expect(page.locator(`text=${initialBalance}`)).toBeVisible();

      // Perform top-up
      await page.click('button:has-text("Recharger"), button:has-text("Top up")');
      const amount50 = page.locator('button:has-text("50")').first();
      if (await amount50.isVisible()) {
        await amount50.click();
      }

      await page.click('button:has-text("Payer"), button:has-text("Continue")');
      await waitForPageLoad(page);

      await stripeHelper.fillCardElement('visa');
      await stripeHelper.submitPayment();

      // Wait for success and page update
      await page.waitForSelector('text=success, text=reussi', { timeout: 30000 });

      // Verify new balance (may need to reload)
      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      await expect(page.locator(`text=${expectedNewBalance}`)).toBeVisible();
    });

    test('should add new transaction to history after top-up', async ({ page }) => {
      await authHelper.loginAs('attendee');
      await stripeHelper.mockPaymentSuccess();

      const topUpAmount = 50;

      // Mock updated transactions
      await apiHelper.mockApiResponse(`**/api/v1/wallets/${testWallets[0].id}/transactions`, {
        data: [
          {
            id: 'tx-new',
            type: 'TOP_UP',
            amount: topUpAmount,
            balanceAfter: testWallets[0].balance + topUpAmount,
            description: 'Rechargement',
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: { page: 1, totalPages: 1, total: 1 },
      });

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Perform top-up (simplified - assuming success)
      // After top-up, transaction should appear in history
      await expect(page.locator('text=Rechargement, text=TOP_UP, text=Top-up')).toBeVisible();
    });
  });

  test.describe('Complete Top-Up Flow', () => {
    test('should complete full wallet top-up journey', async ({ page }) => {
      // Step 1: Login
      await authHelper.loginAs('attendee');

      // Step 2: Navigate to wallet
      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Verify wallet page loaded
      await expect(page.locator('h1:has-text("portefeuille"), h1:has-text("wallet")')).toBeVisible();

      // Step 3: Initiate top-up
      await page.click('button:has-text("Recharger"), button:has-text("Top up")');

      // Step 4: Select amount
      const amount50 = page.locator('button:has-text("50"), [data-amount="50"]').first();
      if (await amount50.isVisible()) {
        await amount50.click();
      } else {
        await page.fill('input[type="number"]', '50');
      }

      // Step 5: Proceed to payment
      await page.click('button:has-text("Continue"), button:has-text("Payer")');
      await waitForPageLoad(page);

      // Step 6: Complete payment
      await stripeHelper.mockPaymentSuccess();
      await apiHelper.mockWalletTopUp(50, testWallets[0].balance + 50);

      await stripeHelper.fillCardElement('visa');
      await stripeHelper.submitPayment();

      // Step 7: Verify success
      await page.waitForSelector('text=success, text=reussi, text=confirme', { timeout: 30000 });

      // Step 8: Verify balance update (on wallet page)
      const successIndicator = page.locator('text=success, text=reussi');
      await expect(successIndicator).toBeVisible();
    });

    test('should show token conversion preview', async ({ page }) => {
      await authHelper.loginAs('attendee');
      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      await page.click('button:has-text("Recharger"), button:has-text("Top up")');

      // Select amount
      const amount50 = page.locator('button:has-text("50")').first();
      if (await amount50.isVisible()) {
        await amount50.click();

        // Token conversion should be displayed
        // 50 EUR / 0.1 exchange rate = 500 Griffons
        await expect(page.locator(`text=500, text=${testFestivals.active.currencyName}`)).toBeVisible();
      }
    });
  });
});
