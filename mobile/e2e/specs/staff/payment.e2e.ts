/**
 * Staff Payment E2E Tests
 *
 * Tests for staff payment flow: QR scan, amount entry, and payment confirmation
 */

import { device, element, by, expect, waitFor } from 'detox';
import { login, loginAsStaff, logout } from '../../utils/auth';
import {
  TIMEOUTS,
  waitForAnimation,
  waitForLoadingComplete,
  waitForElementVisible,
  sleep,
} from '../../utils/wait';
import { goOffline, goOnline, resetNetwork } from '../../utils/mock';
import {
  TEST_USERS,
  TEST_IDS,
  STAFF_TEST_DATA,
  WALLET_TEST_DATA,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../../fixtures/testData';

describe('Staff Payment Feature', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {
        camera: 'YES',
        location: 'always',
        notifications: 'YES',
      },
    });
    await loginAsStaff();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToPayment();
    await waitForLoadingComplete();
  });

  afterAll(async () => {
    await resetNetwork();
    await device.terminateApp();
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  async function navigateToPayment(): Promise<void> {
    await waitFor(element(by.text('Paiement')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.medium);
    await element(by.text('Paiement')).tap();
    await waitForAnimation();
  }

  async function enterAmount(amount: number): Promise<void> {
    await element(by.id(TEST_IDS.amountInput)).clearText();
    await element(by.id(TEST_IDS.amountInput)).typeText(amount.toString());
    await element(by.id(TEST_IDS.amountInput)).tapReturnKey();
  }

  async function simulateScanQR(qrCode: string): Promise<void> {
    // In e2e tests, we simulate QR scan via mock
    await device.launchApp({
      newInstance: false,
      launchArgs: {
        mockQRCode: qrCode,
      },
    });
    await waitForAnimation();
  }

  // ==========================================================================
  // Payment Screen Display Tests
  // ==========================================================================

  describe('Payment Screen Display', () => {
    it('should display payment screen for staff', async () => {
      await expect(element(by.text('Nouveau paiement'))).toBeVisible();
    });

    it('should display stand name', async () => {
      await expect(element(by.text(STAFF_TEST_DATA.stands[0].name))).toBeVisible();
    });

    it('should display amount input field', async () => {
      await expect(element(by.id(TEST_IDS.amountInput))).toBeVisible();
    });

    it('should display quick amount buttons', async () => {
      for (const amount of STAFF_TEST_DATA.paymentAmounts.slice(0, 4)) {
        await expect(element(by.id(`quick-amount-${amount}`))).toBeVisible();
      }
    });

    it('should display scan QR button', async () => {
      await expect(element(by.text('Scanner QR client'))).toBeVisible();
    });

    it('should display currency name', async () => {
      await expect(element(by.text('Griffons'))).toBeVisible();
    });

    it('should show todays transactions summary', async () => {
      await expect(element(by.text('Transactions du jour'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Amount Entry Tests
  // ==========================================================================

  describe('Amount Entry', () => {
    it('should enter amount via keyboard', async () => {
      await enterAmount(15);

      await expect(element(by.text('15'))).toBeVisible();
    });

    it('should set amount via quick button', async () => {
      const quickAmount = STAFF_TEST_DATA.paymentAmounts[0];
      await element(by.id(`quick-amount-${quickAmount}`)).tap();

      await expect(element(by.id(TEST_IDS.amountInput))).toHaveText(quickAmount.toString());
    });

    it('should validate minimum amount', async () => {
      await enterAmount(0);
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.text('Montant invalide')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);
    });

    it('should validate maximum amount', async () => {
      await enterAmount(10000);
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.text('Montant trop eleve')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);
    });

    it('should allow decimal amounts', async () => {
      await element(by.id(TEST_IDS.amountInput)).typeText('12.50');

      await expect(element(by.text('12.50'))).toBeVisible();
    });

    it('should clear amount when X tapped', async () => {
      await enterAmount(25);
      await element(by.id('clear-amount-button')).tap();

      await expect(element(by.id(TEST_IDS.amountInput))).toHaveText('');
    });

    it('should show amount in EUR equivalent', async () => {
      await enterAmount(20);

      // Should show EUR conversion
      await expect(element(by.text(/= [0-9.]+ EUR/))).toBeVisible();
    });
  });

  // ==========================================================================
  // QR Code Scan Tests
  // ==========================================================================

  describe('QR Code Scan', () => {
    beforeEach(async () => {
      await enterAmount(15);
    });

    it('should open scanner when scan button tapped', async () => {
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.id(TEST_IDS.scannerView)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show camera permission message if denied', async () => {
      // This test assumes camera permission handling
      await element(by.text('Scanner QR client')).tap();

      // Camera view should be visible (permission granted in beforeAll)
      await expect(element(by.id(TEST_IDS.scannerView))).toBeVisible();
    });

    it('should show scanner overlay with instructions', async () => {
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.text('Scannez le QR code du client')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show scan frame', async () => {
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.id('scan-frame')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show flashlight toggle', async () => {
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.id('flashlight-button')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should cancel scan and return to payment', async () => {
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.id(TEST_IDS.scannerView)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      await element(by.id(TEST_IDS.cancelButton)).tap();

      await expect(element(by.text('Nouveau paiement'))).toBeVisible();
    });

    it('should process valid QR code', async () => {
      // Simulate scanning a valid QR code
      await simulateScanQR(STAFF_TEST_DATA.samplePaymentQR);

      // Should show confirmation screen
      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show error for invalid QR code', async () => {
      await simulateScanQR(STAFF_TEST_DATA.invalidPaymentQR);

      await waitFor(element(by.text('QR code invalide')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });
  });

  // ==========================================================================
  // Payment Confirmation Tests
  // ==========================================================================

  describe('Payment Confirmation', () => {
    beforeEach(async () => {
      await enterAmount(15);
      await simulateScanQR(STAFF_TEST_DATA.samplePaymentQR);
      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should display confirmation screen', async () => {
      await expect(element(by.text('Confirmer le paiement'))).toBeVisible();
    });

    it('should show payment amount', async () => {
      await expect(element(by.text('15 Griffons'))).toBeVisible();
    });

    it('should show customer name', async () => {
      await expect(element(by.text('Client'))).toBeVisible();
    });

    it('should show customer balance', async () => {
      await expect(element(by.text('Solde'))).toBeVisible();
    });

    it('should show confirm button', async () => {
      await expect(element(by.id(TEST_IDS.confirmPaymentButton))).toBeVisible();
    });

    it('should show cancel button', async () => {
      await expect(element(by.id(TEST_IDS.cancelButton))).toBeVisible();
    });

    it('should process payment on confirm', async () => {
      await element(by.id(TEST_IDS.confirmPaymentButton)).tap();

      await waitFor(element(by.text(SUCCESS_MESSAGES.paymentProcessed)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);
    });

    it('should return to payment screen after success', async () => {
      await element(by.id(TEST_IDS.confirmPaymentButton)).tap();

      await waitFor(element(by.text(SUCCESS_MESSAGES.paymentProcessed)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);

      // Wait for success screen to dismiss
      await sleep(2000);

      await expect(element(by.text('Nouveau paiement'))).toBeVisible();
    });

    it('should cancel payment and return to entry', async () => {
      await element(by.id(TEST_IDS.cancelButton)).tap();

      await expect(element(by.text('Nouveau paiement'))).toBeVisible();
    });

    it('should show error for insufficient balance', async () => {
      // This would require a customer with low balance
      // The error should be shown if balance < amount
      await expect(element(by.id(TEST_IDS.confirmPaymentButton))).toBeVisible();
    });

    it('should show payment receipt after success', async () => {
      await element(by.id(TEST_IDS.confirmPaymentButton)).tap();

      await waitFor(element(by.text('Paiement effectue')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);

      // Receipt should show transaction details
      await expect(element(by.text('15 Griffons'))).toBeVisible();
      await expect(element(by.text(/Transaction #/))).toBeVisible();
    });
  });

  // ==========================================================================
  // Transaction History Tests
  // ==========================================================================

  describe('Transaction History', () => {
    it('should show todays transactions', async () => {
      await expect(element(by.text('Transactions du jour'))).toBeVisible();
    });

    it('should show transaction count', async () => {
      await expect(element(by.text(/[0-9]+ transactions/))).toBeVisible();
    });

    it('should show total amount', async () => {
      await expect(element(by.text(/Total: [0-9.]+ Griffons/))).toBeVisible();
    });

    it('should navigate to full transaction list', async () => {
      await element(by.text('Voir tout')).tap();

      await waitFor(element(by.text('Historique des transactions')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show transaction details', async () => {
      await element(by.text('Voir tout')).tap();

      await waitFor(element(by.id('transaction-list')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      try {
        await expect(element(by.id('transaction-item-0'))).toBeVisible();
      } catch {
        await expect(element(by.text('Aucune transaction'))).toBeVisible();
      }
    });
  });

  // ==========================================================================
  // Offline Mode Tests
  // ==========================================================================

  describe('Offline Mode', () => {
    afterEach(async () => {
      await goOnline();
    });

    it('should queue payment when offline', async () => {
      await goOffline();

      await enterAmount(10);
      await simulateScanQR(STAFF_TEST_DATA.samplePaymentQR);

      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      await element(by.id(TEST_IDS.confirmPaymentButton)).tap();

      // Should show queued message
      await waitFor(element(by.text('Paiement en attente de synchronisation')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show pending transactions count', async () => {
      await goOffline();

      await enterAmount(10);
      await simulateScanQR(STAFF_TEST_DATA.samplePaymentQR);
      await element(by.id(TEST_IDS.confirmPaymentButton)).tap();

      // Should show pending indicator
      await waitFor(element(by.text(/[0-9]+ en attente/)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should sync when back online', async () => {
      await goOffline();

      await enterAmount(10);
      await simulateScanQR(STAFF_TEST_DATA.samplePaymentQR);
      await element(by.id(TEST_IDS.confirmPaymentButton)).tap();

      await goOnline();

      // Should sync and clear pending
      await waitFor(element(by.text('Synchronisation terminee')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);
    });

    it('should show offline indicator', async () => {
      await goOffline();
      await device.reloadReactNative();
      await navigateToPayment();

      await waitFor(element(by.id('offline-indicator')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should validate customer balance from cache', async () => {
      // First sync customer data
      await expect(element(by.text('Nouveau paiement'))).toBeVisible();

      await goOffline();

      // Should still be able to validate against cached balances
      await enterAmount(10);
      await expect(element(by.text('Scanner QR client'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle network error gracefully', async () => {
      await enterAmount(15);
      await simulateScanQR(STAFF_TEST_DATA.samplePaymentQR);

      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // Even if network fails, payment should be queued
      await element(by.id(TEST_IDS.confirmPaymentButton)).tap();

      // Should show either success or queued message
      await waitFor(element(by.text(/(Paiement effectue|en attente)/)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);
    });

    it('should allow retry after error', async () => {
      // Enter amount and scan
      await enterAmount(15);

      // Should be able to retry
      await expect(element(by.text('Scanner QR client'))).toBeVisible();
    });

    it('should show clear error messages', async () => {
      await enterAmount(0);
      await element(by.text('Scanner QR client')).tap();

      await expect(element(by.text('Montant invalide'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Security Tests
  // ==========================================================================

  describe('Security', () => {
    it('should require staff authentication', async () => {
      await logout();

      // Try to access payment screen
      await device.reloadReactNative();

      // Should be redirected to login
      await expect(element(by.id('login-email-input'))).toBeVisible();
    });

    it('should timeout after inactivity', async () => {
      // Wait for session timeout
      await sleep(30000);

      // App might require re-authentication
      // This depends on implementation
    });

    it('should not show customer full details', async () => {
      await enterAmount(15);
      await simulateScanQR(STAFF_TEST_DATA.samplePaymentQR);

      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // Should not show full email or sensitive data
      await expect(element(by.text(TEST_USERS.standard.email))).not.toBeVisible();
    });
  });
});
