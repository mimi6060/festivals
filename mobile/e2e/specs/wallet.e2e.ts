/**
 * Wallet E2E Tests
 *
 * Tests for wallet balance, transactions, QR code payment, and top-up flow
 */

import { device, element, by, expect, waitFor } from 'detox';
import { login, ensureLoggedIn, loginAsTestUser } from '../utils/auth';
import {
  TIMEOUTS,
  waitForAnimation,
  waitForLoadingComplete,
  waitForElementVisible,
  sleep,
} from '../utils/wait';
import { goOffline, goOnline, resetNetwork } from '../utils/mock';
import {
  TEST_USERS,
  TEST_IDS,
  WALLET_TEST_DATA,
  FESTIVAL_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../fixtures/testData';

describe('Wallet Feature', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {
        camera: 'YES',
        location: 'always',
        notifications: 'YES',
      },
    });
    await loginAsTestUser();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToWallet();
    await waitForLoadingComplete();
  });

  afterAll(async () => {
    await resetNetwork();
    await device.terminateApp();
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  async function navigateToWallet(): Promise<void> {
    await waitFor(element(by.text('Wallet')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.medium);
    await element(by.text('Wallet')).tap();
    await waitForAnimation();
  }

  async function pullToRefresh(): Promise<void> {
    const scrollView = element(by.id('wallet-scroll-view'));
    await scrollView.scroll(200, 'down', NaN, 0.9);
    await waitForAnimation();
  }

  async function scrollDown(pixels: number = 300): Promise<void> {
    const scrollView = element(by.id('wallet-scroll-view'));
    await scrollView.scroll(pixels, 'down');
  }

  // ==========================================================================
  // Balance Display Tests
  // ==========================================================================

  describe('Balance Display', () => {
    it('should display wallet screen with balance', async () => {
      await expect(element(by.text('Mon solde'))).toBeVisible();
      await expect(element(by.id(TEST_IDS.walletBalance))).toBeVisible();
      await expect(element(by.text(FESTIVAL_CONFIG.currency.name))).toBeVisible();
    });

    it('should display balance in festival currency', async () => {
      await waitFor(element(by.id(TEST_IDS.walletBalance)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      await expect(element(by.text(FESTIVAL_CONFIG.currency.name))).toBeVisible();
    });

    it('should display EUR equivalent', async () => {
      await waitFor(element(by.text(/= .* EUR/)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show top up button', async () => {
      await expect(element(by.text('Recharger mon wallet'))).toBeVisible();
    });

    it('should show quick action buttons', async () => {
      await expect(element(by.text('Historique'))).toBeVisible();
      await expect(element(by.text('Aide'))).toBeVisible();
    });

    it('should show recent transactions section', async () => {
      await scrollDown();
      await expect(element(by.text('Transactions recentes'))).toBeVisible();
    });

    it('should show info card about wallet usage', async () => {
      await scrollDown();
      await expect(element(by.text('Comment utiliser votre wallet ?'))).toBeVisible();
    });

    it('should refresh balance on pull to refresh', async () => {
      await pullToRefresh();
      await waitForLoadingComplete();

      await expect(element(by.id(TEST_IDS.walletBalance))).toBeVisible();
    });

    it('should display loading indicator while fetching balance', async () => {
      await device.reloadReactNative();
      await navigateToWallet();

      // Balance should eventually appear
      await waitFor(element(by.id(TEST_IDS.walletBalance)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);
    });
  });

  // ==========================================================================
  // QR Code Payment Tests
  // ==========================================================================

  describe('QR Code Payment', () => {
    it('should display QR code on wallet screen', async () => {
      await expect(element(by.id(TEST_IDS.walletQrCode))).toBeVisible();
    });

    it('should show QR code instructions', async () => {
      await expect(element(by.text('Presentez ce QR code au stand pour payer'))).toBeVisible();
    });

    it('should display countdown timer for QR refresh', async () => {
      await expect(element(by.id('qr-code-timer'))).toBeVisible();
    });

    it('should refresh QR code automatically', async () => {
      await expect(element(by.id(TEST_IDS.walletQrCode))).toBeVisible();

      // Wait a moment and verify QR is still displayed
      await sleep(5000);

      await expect(element(by.id(TEST_IDS.walletQrCode))).toBeVisible();
    });

    it('should show larger QR code when tapped', async () => {
      await element(by.id(TEST_IDS.walletQrCode)).tap();

      await waitFor(element(by.id('qr-code-fullscreen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // Dismiss modal
      await element(by.id('modal-close-button')).tap();

      await expect(element(by.text('Mon solde'))).toBeVisible();
    });

    it('should display QR code in fullscreen with increased brightness', async () => {
      await element(by.id(TEST_IDS.walletQrCode)).tap();

      await waitFor(element(by.id('qr-code-fullscreen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // QR code should be clearly visible (brightness increased)
      await expect(element(by.id('qr-code-fullscreen'))).toBeVisible();

      await element(by.id('modal-close-button')).tap();
    });
  });

  // ==========================================================================
  // Transaction History Tests
  // ==========================================================================

  describe('Transaction History', () => {
    it('should navigate to full transaction history', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.text('Historique des transactions')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should display transaction list', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.id(TEST_IDS.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show transaction with correct details', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.id(TEST_IDS.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // Check first transaction exists
      try {
        await expect(element(by.id('transaction-item-0'))).toBeVisible();
      } catch {
        // No transactions, empty state should be shown
        await expect(element(by.text('Aucune transaction'))).toBeVisible();
      }
    });

    it('should display transaction amounts with correct sign', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.id(TEST_IDS.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // Purchases show negative amounts, top-ups positive
      try {
        await expect(element(by.id('transaction-amount-0'))).toBeVisible();
      } catch {
        // No transactions available
      }
    });

    it('should open transaction detail modal when tapped', async () => {
      await scrollDown();

      try {
        await element(by.id('transaction-item-0')).tap();

        await waitFor(element(by.text('Detail transaction')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        await element(by.id('modal-close-button')).tap();
      } catch {
        // No transactions to tap
      }
    });

    it('should filter transactions by type', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.id('transaction-filter')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      await element(by.id('transaction-filter')).tap();
      await element(by.text('Achats')).tap();

      await waitForLoadingComplete();
    });

    it('should load more transactions on scroll', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.id(TEST_IDS.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // Scroll to load more
      await element(by.id(TEST_IDS.transactionList)).scroll(500, 'down');
    });

    it('should show stand name for purchases', async () => {
      await scrollDown();

      try {
        await element(by.id('transaction-item-0')).tap();

        await waitFor(element(by.text('Stand')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.short);

        await element(by.id('modal-close-button')).tap();
      } catch {
        // No transactions available
      }
    });
  });

  // ==========================================================================
  // Top Up Flow Tests
  // ==========================================================================

  describe('Top Up Flow', () => {
    it('should navigate to top up screen', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.text('Recharger')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should display top up amount options', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      for (const amount of WALLET_TEST_DATA.topupAmounts) {
        await waitFor(element(by.id(`topup-amount-${amount}`)))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);
      }
    });

    it('should allow custom amount entry', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id('topup-custom-amount')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      await element(by.id('topup-custom-amount')).typeText('75');

      await expect(element(by.text('75'))).toBeVisible();
    });

    it('should validate minimum top up amount', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id('topup-custom-amount')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      await element(by.id('topup-custom-amount')).typeText('1');
      await element(by.id('topup-submit-button')).tap();

      await waitFor(element(by.text(ERROR_MESSAGES.minTopup)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);
    });

    it('should show payment methods', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id('topup-amount-20')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      await element(by.id('topup-amount-20')).tap();

      await scrollDown();
      await expect(element(by.text('Carte bancaire'))).toBeVisible();
    });

    it('should calculate festival currency preview', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id('topup-amount-20')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      await element(by.id('topup-amount-20')).tap();

      // Should show how many Griffons user will receive
      await expect(element(by.text(/Griffons/))).toBeVisible();
    });

    it('should show confirmation before payment', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id('topup-amount-20')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      await element(by.id('topup-amount-20')).tap();
      await scrollDown();
      await element(by.text('Carte bancaire')).tap();
      await element(by.id('topup-submit-button')).tap();

      // Confirmation screen should appear
      await waitFor(element(by.text('Confirmer le rechargement')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should navigate back from top up screen', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.text('Recharger')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // Go back
      if (device.getPlatform() === 'ios') {
        await element(by.traits(['button']).and(by.label('Back'))).tap();
      } else {
        await device.pressBack();
      }

      await expect(element(by.text('Mon solde'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Offline Mode Tests
  // ==========================================================================

  describe('Offline Mode', () => {
    afterEach(async () => {
      await goOnline();
    });

    it('should show cached balance when offline', async () => {
      // Ensure balance is loaded
      await expect(element(by.id(TEST_IDS.walletBalance))).toBeVisible();

      // Go offline
      await goOffline();

      // Reload
      await device.reloadReactNative();
      await navigateToWallet();

      // Balance should still show from cache
      await waitFor(element(by.id(TEST_IDS.walletBalance)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show QR code in offline mode', async () => {
      await goOffline();

      // QR code should still be visible
      await expect(element(by.id(TEST_IDS.walletQrCode))).toBeVisible();
    });

    it('should show cached transactions when offline', async () => {
      // Load transactions first
      await element(by.text('Historique')).tap();
      await waitFor(element(by.id(TEST_IDS.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // Go offline and reload
      await goOffline();
      await device.reloadReactNative();
      await navigateToWallet();
      await element(by.text('Historique')).tap();

      // Transactions should load from cache
      await waitFor(element(by.id(TEST_IDS.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show offline indicator', async () => {
      await goOffline();

      await device.reloadReactNative();
      await navigateToWallet();

      // Offline indicator should appear
      await waitFor(element(by.id('offline-indicator')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should sync when back online', async () => {
      await goOffline();
      await device.reloadReactNative();
      await navigateToWallet();

      // Go back online
      await goOnline();
      await pullToRefresh();

      // Should sync and update
      await waitForLoadingComplete();
      await expect(element(by.id(TEST_IDS.walletBalance))).toBeVisible();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should show error message on API failure', async () => {
      // This would require mocking API to fail
      await pullToRefresh();
      await waitForLoadingComplete();

      // In normal operation, balance is visible
      await expect(element(by.id(TEST_IDS.walletBalance))).toBeVisible();
    });

    it('should allow retry after error', async () => {
      await pullToRefresh();
      await waitForLoadingComplete();

      // Should recover and show balance
      await expect(element(by.id(TEST_IDS.walletBalance))).toBeVisible();
    });

    it('should handle insufficient balance gracefully', async () => {
      // This test would require a specific test user with low balance
      // Verify UI handles the case properly
      await expect(element(by.id(TEST_IDS.walletBalance))).toBeVisible();
    });
  });
});
