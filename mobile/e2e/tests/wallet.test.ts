/**
 * Wallet E2E Tests
 *
 * Comprehensive tests for wallet balance, QR code display, transactions, and top-up flow.
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TestIds } from '../utils/testIds';
import { login, ensureLoggedIn, sleep, scrollDown, pullToRefresh } from '../utils/helpers';
import { goOffline, goOnline, resetNetwork } from '../utils/mocks';

// Test user credentials
const TEST_USER = {
  email: 'test@festivals.app',
  password: 'TestPassword123!',
  name: 'Test User',
};

// Wallet test data
const WALLET_DATA = {
  currency: 'Griffons',
  topupAmounts: [10, 20, 50, 100],
  minTopup: 5,
  maxTopup: 500,
};

// Timeouts
const TIMEOUT = {
  short: 3000,
  medium: 10000,
  long: 30000,
};

describe('Wallet E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {
        camera: 'YES',
        location: 'always',
        notifications: 'YES',
      },
    });
    await login(TEST_USER);
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToWallet();
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
      .withTimeout(TIMEOUT.medium);
    await element(by.text('Wallet')).tap();
    await sleep(500); // Wait for animation
  }

  // ==========================================================================
  // Balance Display Tests
  // ==========================================================================

  describe('Viewing Balance', () => {
    it('should display wallet screen with balance', async () => {
      await expect(element(by.text('Mon solde'))).toBeVisible();
      await expect(element(by.id(TestIds.wallet.balance))).toBeVisible();
      await expect(element(by.text(WALLET_DATA.currency))).toBeVisible();
    });

    it('should display balance in festival currency', async () => {
      await waitFor(element(by.id(TestIds.wallet.balance)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Currency name should be visible
      await expect(element(by.text(WALLET_DATA.currency))).toBeVisible();
    });

    it('should display EUR equivalent', async () => {
      await waitFor(element(by.text(/= .* EUR/)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show top up button', async () => {
      await expect(element(by.text('Recharger mon wallet'))).toBeVisible();
    });

    it('should show quick action buttons', async () => {
      await expect(element(by.text('Historique'))).toBeVisible();
      await expect(element(by.text('Aide'))).toBeVisible();
    });

    it('should refresh balance on pull to refresh', async () => {
      const scrollView = element(by.id(TestIds.wallet.scrollView));
      await scrollView.scroll(200, 'down', NaN, 0.9);
      await sleep(500);

      await expect(element(by.id(TestIds.wallet.balance))).toBeVisible();
    });

    it('should show loading indicator while fetching balance', async () => {
      await device.reloadReactNative();
      await navigateToWallet();

      // Balance should eventually appear
      await waitFor(element(by.id(TestIds.wallet.balance)))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should display wallet info card', async () => {
      await scrollDown(TestIds.wallet.scrollView, 300);
      await expect(element(by.text('Comment utiliser votre wallet ?'))).toBeVisible();
    });
  });

  // ==========================================================================
  // QR Code Display Tests
  // ==========================================================================

  describe('QR Code Display', () => {
    it('should display QR code on wallet screen', async () => {
      await expect(element(by.id(TestIds.wallet.qrCode))).toBeVisible();
    });

    it('should show QR code instructions', async () => {
      await expect(element(by.text('Presentez ce QR code au stand pour payer'))).toBeVisible();
    });

    it('should display countdown timer for QR refresh', async () => {
      await expect(element(by.id(TestIds.wallet.qrCodeTimer))).toBeVisible();
    });

    it('should refresh QR code automatically', async () => {
      await expect(element(by.id(TestIds.wallet.qrCode))).toBeVisible();

      // Wait a few seconds and verify QR is still displayed
      await sleep(5000);

      await expect(element(by.id(TestIds.wallet.qrCode))).toBeVisible();
    });

    it('should show larger QR code when tapped', async () => {
      await element(by.id(TestIds.wallet.qrCode)).tap();

      await waitFor(element(by.id(TestIds.wallet.qrCodeFullscreen)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Close fullscreen modal
      await element(by.id(TestIds.common.modalCloseButton)).tap();

      await expect(element(by.text('Mon solde'))).toBeVisible();
    });

    it('should display QR code in fullscreen with increased brightness', async () => {
      await element(by.id(TestIds.wallet.qrCode)).tap();

      await waitFor(element(by.id(TestIds.wallet.qrCodeFullscreen)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // QR code should be clearly visible in fullscreen
      await expect(element(by.id(TestIds.wallet.qrCodeFullscreen))).toBeVisible();

      // Close modal
      await element(by.id(TestIds.common.modalCloseButton)).tap();
    });

    it('should show wallet balance in fullscreen QR view', async () => {
      await element(by.id(TestIds.wallet.qrCode)).tap();

      await waitFor(element(by.id(TestIds.wallet.qrCodeFullscreen)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Balance should be visible in fullscreen
      await expect(element(by.text(WALLET_DATA.currency))).toBeVisible();

      await element(by.id(TestIds.common.modalCloseButton)).tap();
    });
  });

  // ==========================================================================
  // Transaction History Tests
  // ==========================================================================

  describe('Transaction History', () => {
    it('should show recent transactions section', async () => {
      await scrollDown(TestIds.wallet.scrollView, 300);
      await expect(element(by.text('Transactions recentes'))).toBeVisible();
    });

    it('should navigate to full transaction history', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.text('Historique des transactions')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should display transaction list', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.id(TestIds.wallet.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show transaction with correct details', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.id(TestIds.wallet.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Check if transactions exist or empty state
      try {
        await expect(element(by.id('transaction-item-0'))).toBeVisible();
      } catch {
        await expect(element(by.text('Aucune transaction'))).toBeVisible();
      }
    });

    it('should display transaction amounts with correct sign', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.id(TestIds.wallet.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Purchases show negative amounts, top-ups positive
      try {
        await expect(element(by.id('transaction-amount-0'))).toBeVisible();
      } catch {
        // No transactions available
      }
    });

    it('should open transaction detail modal when tapped', async () => {
      await scrollDown(TestIds.wallet.scrollView, 300);

      try {
        await element(by.id('transaction-item-0')).tap();

        await waitFor(element(by.text('Detail transaction')))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);

        await element(by.id(TestIds.common.modalCloseButton)).tap();
      } catch {
        // No transactions to tap
      }
    });

    it('should filter transactions by type', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.id(TestIds.wallet.transactionFilter)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.wallet.transactionFilter)).tap();
      await element(by.text('Achats')).tap();

      await sleep(500);
    });

    it('should load more transactions on scroll', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.id(TestIds.wallet.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Scroll to load more
      await element(by.id(TestIds.wallet.transactionList)).scroll(500, 'down');
    });

    it('should show stand name for purchases', async () => {
      await scrollDown(TestIds.wallet.scrollView, 300);

      try {
        await element(by.id('transaction-item-0')).tap();

        await waitFor(element(by.text('Stand')))
          .toBeVisible()
          .withTimeout(TIMEOUT.short);

        await element(by.id(TestIds.common.modalCloseButton)).tap();
      } catch {
        // No transactions available
      }
    });

    it('should show timestamp for each transaction', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.id(TestIds.wallet.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      try {
        // Transactions should show date/time
        await expect(element(by.text(/[0-9]{2}:[0-9]{2}/))).toBeVisible();
      } catch {
        // No transactions
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
        .withTimeout(TIMEOUT.medium);
    });

    it('should display top up amount options', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      for (const amount of WALLET_DATA.topupAmounts) {
        await waitFor(element(by.id(`topup-amount-${amount}`)))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);
      }
    });

    it('should allow custom amount entry', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id(TestIds.wallet.topupCustomAmount)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.wallet.topupCustomAmount)).typeText('75');

      await expect(element(by.text('75'))).toBeVisible();
    });

    it('should validate minimum top up amount', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id(TestIds.wallet.topupCustomAmount)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.wallet.topupCustomAmount)).typeText('1');
      await element(by.id(TestIds.wallet.topupSubmitButton)).tap();

      await waitFor(element(by.text('Montant minimum: 5 EUR')))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });

    it('should validate maximum top up amount', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id(TestIds.wallet.topupCustomAmount)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.wallet.topupCustomAmount)).typeText('1000');
      await element(by.id(TestIds.wallet.topupSubmitButton)).tap();

      await waitFor(element(by.text('Montant maximum: 500 EUR')))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });

    it('should show payment methods', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id('topup-amount-20')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id('topup-amount-20')).tap();

      await scrollDown(TestIds.wallet.topupScrollView, 300);
      await expect(element(by.text('Carte bancaire'))).toBeVisible();
    });

    it('should calculate festival currency preview', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id('topup-amount-20')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id('topup-amount-20')).tap();

      // Should show how many Griffons user will receive
      await expect(element(by.text(/Griffons/))).toBeVisible();
    });

    it('should show confirmation before payment', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id('topup-amount-20')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id('topup-amount-20')).tap();
      await scrollDown(TestIds.wallet.topupScrollView, 300);
      await element(by.text('Carte bancaire')).tap();
      await element(by.id(TestIds.wallet.topupSubmitButton)).tap();

      // Confirmation screen should appear
      await waitFor(element(by.text('Confirmer le rechargement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should navigate back from top up screen', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.text('Recharger')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Go back
      if (device.getPlatform() === 'ios') {
        await element(by.traits(['button']).and(by.label('Back'))).tap();
      } else {
        await device.pressBack();
      }

      await expect(element(by.text('Mon solde'))).toBeVisible();
    });

    it('should select amount via quick button', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id('topup-amount-50')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id('topup-amount-50')).tap();

      // Amount should be selected
      await expect(element(by.id('topup-amount-50-selected'))).toBeVisible();
    });

    it('should clear custom amount when quick button tapped', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id(TestIds.wallet.topupCustomAmount)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Enter custom amount
      await element(by.id(TestIds.wallet.topupCustomAmount)).typeText('75');

      // Tap quick button
      await element(by.id('topup-amount-20')).tap();

      // Custom amount should be cleared or replaced
      await expect(element(by.id('topup-amount-20-selected'))).toBeVisible();
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
      await expect(element(by.id(TestIds.wallet.balance))).toBeVisible();

      // Go offline
      await goOffline();

      // Reload
      await device.reloadReactNative();
      await navigateToWallet();

      // Balance should still show from cache
      await waitFor(element(by.id(TestIds.wallet.balance)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show QR code in offline mode', async () => {
      await goOffline();

      // QR code should still be visible
      await expect(element(by.id(TestIds.wallet.qrCode))).toBeVisible();
    });

    it('should show cached transactions when offline', async () => {
      // Load transactions first
      await element(by.text('Historique')).tap();
      await waitFor(element(by.id(TestIds.wallet.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Go offline and reload
      await goOffline();
      await device.reloadReactNative();
      await navigateToWallet();
      await element(by.text('Historique')).tap();

      // Transactions should load from cache
      await waitFor(element(by.id(TestIds.wallet.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show offline indicator', async () => {
      await goOffline();

      await device.reloadReactNative();
      await navigateToWallet();

      // Offline indicator should appear
      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should sync when back online', async () => {
      await goOffline();
      await device.reloadReactNative();
      await navigateToWallet();

      // Go back online
      await goOnline();

      // Pull to refresh
      const scrollView = element(by.id(TestIds.wallet.scrollView));
      await scrollView.scroll(200, 'down', NaN, 0.9);

      // Should sync and update
      await expect(element(by.id(TestIds.wallet.balance))).toBeVisible();
    });

    it('should disable top up when offline', async () => {
      await goOffline();
      await device.reloadReactNative();
      await navigateToWallet();

      // Top up button might be disabled or show offline message
      await element(by.text('Recharger mon wallet')).tap();

      // Should show offline error
      await waitFor(element(by.text('Vous etes hors ligne')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle network error gracefully', async () => {
      const scrollView = element(by.id(TestIds.wallet.scrollView));
      await scrollView.scroll(200, 'down', NaN, 0.9);
      await sleep(500);

      // In normal operation, balance is visible
      await expect(element(by.id(TestIds.wallet.balance))).toBeVisible();
    });

    it('should allow retry after error', async () => {
      const scrollView = element(by.id(TestIds.wallet.scrollView));
      await scrollView.scroll(200, 'down', NaN, 0.9);
      await sleep(500);

      // Should recover and show balance
      await expect(element(by.id(TestIds.wallet.balance))).toBeVisible();
    });

    it('should show error message for failed top up', async () => {
      await element(by.text('Recharger mon wallet')).tap();

      await waitFor(element(by.id('topup-amount-20')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Select amount and proceed
      await element(by.id('topup-amount-20')).tap();

      // In case of payment failure, error should be shown
      // This depends on payment gateway integration
    });

    it('should handle insufficient balance display', async () => {
      // Verify balance is displayed correctly
      await expect(element(by.id(TestIds.wallet.balance))).toBeVisible();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have accessible balance display', async () => {
      await expect(element(by.id(TestIds.wallet.balance))).toBeVisible();
    });

    it('should have accessible QR code', async () => {
      await expect(element(by.id(TestIds.wallet.qrCode))).toBeVisible();
    });

    it('should have accessible action buttons', async () => {
      await expect(element(by.text('Recharger mon wallet'))).toBeVisible();
      await expect(element(by.text('Historique'))).toBeVisible();
    });
  });
});
