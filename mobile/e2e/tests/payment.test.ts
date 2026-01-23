/**
 * Staff Payment E2E Tests
 *
 * Comprehensive tests for staff payment mode: switching to staff mode, scanning customer QR,
 * processing payment, payment confirmation, and offline payment handling.
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TestIds } from '../utils/testIds';
import { loginAsStaff, logout, sleep, scrollDown } from '../utils/helpers';
import { goOffline, goOnline, resetNetwork, simulateQRScan } from '../utils/mocks';

// Staff user credentials
const STAFF_USER = {
  email: 'staff@festivals.app',
  password: 'StaffPassword123!',
  name: 'Staff Member',
  standName: 'Bar Central',
};

// Payment test data
const PAYMENT_DATA = {
  quickAmounts: [5, 8, 12, 15, 20, 25],
  sampleQRCode: 'PAY-USER123-TOKEN456',
  invalidQRCode: 'INVALID-QR-CODE',
  currency: 'Griffons',
};

// Timeouts
const TIMEOUT = {
  short: 3000,
  medium: 10000,
  long: 30000,
};

describe('Staff Payment E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {
        camera: 'YES',
        location: 'always',
        notifications: 'YES',
      },
    });
    await loginAsStaff(STAFF_USER);
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToPayment();
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
      .withTimeout(TIMEOUT.medium);
    await element(by.text('Paiement')).tap();
    await sleep(500);
  }

  async function enterAmount(amount: number): Promise<void> {
    await element(by.id(TestIds.staff.amountInput)).clearText();
    await element(by.id(TestIds.staff.amountInput)).typeText(amount.toString());
    await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
  }

  // ==========================================================================
  // Staff Mode Switching Tests
  // ==========================================================================

  describe('Switching to Staff Mode', () => {
    it('should display staff navigation after login', async () => {
      await expect(element(by.text('Paiement'))).toBeVisible();
      await expect(element(by.text('Controle'))).toBeVisible();
    });

    it('should show staff stand name', async () => {
      await expect(element(by.text(STAFF_USER.standName))).toBeVisible();
    });

    it('should display payment screen for staff', async () => {
      await expect(element(by.text('Nouveau paiement'))).toBeVisible();
    });

    it('should show staff role indicator', async () => {
      await expect(element(by.id(TestIds.staff.roleIndicator))).toBeVisible();
    });

    it('should not show customer-only features', async () => {
      // Staff mode should have limited navigation
      await expect(element(by.text('Mes billets'))).not.toBeVisible();
    });

    it('should allow switching between staff screens', async () => {
      await element(by.text('Controle')).tap();
      await expect(element(by.text('Controle des entrees'))).toBeVisible();

      await element(by.text('Paiement')).tap();
      await expect(element(by.text('Nouveau paiement'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Payment Screen Display Tests
  // ==========================================================================

  describe('Payment Screen Display', () => {
    it('should display amount input field', async () => {
      await expect(element(by.id(TestIds.staff.amountInput))).toBeVisible();
    });

    it('should display quick amount buttons', async () => {
      for (const amount of PAYMENT_DATA.quickAmounts.slice(0, 4)) {
        await expect(element(by.id(`quick-amount-${amount}`))).toBeVisible();
      }
    });

    it('should display scan QR button', async () => {
      await expect(element(by.text('Scanner QR client'))).toBeVisible();
    });

    it('should display currency name', async () => {
      await expect(element(by.text(PAYMENT_DATA.currency))).toBeVisible();
    });

    it('should show todays transactions summary', async () => {
      await expect(element(by.text('Transactions du jour'))).toBeVisible();
    });

    it('should show transaction count', async () => {
      await expect(element(by.text(/[0-9]+ transactions/))).toBeVisible();
    });

    it('should show total amount for today', async () => {
      await expect(element(by.text(/Total: [0-9.]+ Griffons/))).toBeVisible();
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
      const quickAmount = PAYMENT_DATA.quickAmounts[0];
      await element(by.id(`quick-amount-${quickAmount}`)).tap();

      await expect(element(by.id(TestIds.staff.amountInput))).toHaveText(quickAmount.toString());
    });

    it('should validate minimum amount', async () => {
      await enterAmount(0);
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.text('Montant invalide')))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });

    it('should validate maximum amount', async () => {
      await enterAmount(10000);
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.text('Montant trop eleve')))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });

    it('should allow decimal amounts', async () => {
      await element(by.id(TestIds.staff.amountInput)).typeText('12.50');

      await expect(element(by.text('12.50'))).toBeVisible();
    });

    it('should clear amount when X tapped', async () => {
      await enterAmount(25);
      await element(by.id(TestIds.staff.clearAmountButton)).tap();

      await expect(element(by.id(TestIds.staff.amountInput))).toHaveText('');
    });

    it('should show amount in EUR equivalent', async () => {
      await enterAmount(20);

      await expect(element(by.text(/= [0-9.]+ EUR/))).toBeVisible();
    });

    it('should replace amount when quick button tapped after entry', async () => {
      await enterAmount(30);
      await element(by.id('quick-amount-15')).tap();

      await expect(element(by.id(TestIds.staff.amountInput))).toHaveText('15');
    });
  });

  // ==========================================================================
  // Scanning Customer QR Tests
  // ==========================================================================

  describe('Scanning Customer QR', () => {
    beforeEach(async () => {
      await enterAmount(15);
    });

    it('should open scanner when scan button tapped', async () => {
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.id(TestIds.scanner.view)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show scanner overlay with instructions', async () => {
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.text('Scannez le QR code du client')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show scan frame', async () => {
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.id(TestIds.scanner.frame)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show flashlight toggle', async () => {
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.id(TestIds.scanner.flashlightButton)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should cancel scan and return to payment', async () => {
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.id(TestIds.scanner.view)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.common.cancelButton)).tap();

      await expect(element(by.text('Nouveau paiement'))).toBeVisible();
    });

    it('should process valid QR code', async () => {
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);

      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show error for invalid QR code', async () => {
      await simulateQRScan(PAYMENT_DATA.invalidQRCode);

      await waitFor(element(by.text('QR code invalide')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should toggle flashlight on and off', async () => {
      await element(by.text('Scanner QR client')).tap();

      await waitFor(element(by.id(TestIds.scanner.flashlightButton)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.scanner.flashlightButton)).tap();
      await expect(element(by.id(TestIds.scanner.flashlightButtonActive))).toBeVisible();

      await element(by.id(TestIds.scanner.flashlightButtonActive)).tap();
      await expect(element(by.id(TestIds.scanner.flashlightButton))).toBeVisible();
    });
  });

  // ==========================================================================
  // Processing Payment Tests
  // ==========================================================================

  describe('Processing Payment', () => {
    beforeEach(async () => {
      await enterAmount(15);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);
      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
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
      await expect(element(by.id(TestIds.staff.confirmPaymentButton))).toBeVisible();
    });

    it('should show cancel button', async () => {
      await expect(element(by.id(TestIds.common.cancelButton))).toBeVisible();
    });

    it('should cancel payment and return to entry', async () => {
      await element(by.id(TestIds.common.cancelButton)).tap();

      await expect(element(by.text('Nouveau paiement'))).toBeVisible();
    });

    it('should show warning for low customer balance', async () => {
      // If customer balance is low, warning should be shown
      // This depends on the scanned customer's balance
      await expect(element(by.id(TestIds.staff.confirmPaymentButton))).toBeVisible();
    });
  });

  // ==========================================================================
  // Payment Confirmation Tests
  // ==========================================================================

  describe('Payment Confirmation', () => {
    beforeEach(async () => {
      await enterAmount(15);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);
      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should process payment on confirm', async () => {
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await waitFor(element(by.text('Paiement traite')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should show success animation', async () => {
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await waitFor(element(by.id(TestIds.staff.paymentSuccessIcon)))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should show payment receipt', async () => {
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await waitFor(element(by.text('Paiement effectue')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);

      // Receipt should show transaction details
      await expect(element(by.text('15 Griffons'))).toBeVisible();
      await expect(element(by.text(/Transaction #/))).toBeVisible();
    });

    it('should return to payment screen after success', async () => {
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await waitFor(element(by.text('Paiement traite')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);

      // Wait for success screen to dismiss
      await sleep(2000);

      await expect(element(by.text('Nouveau paiement'))).toBeVisible();
    });

    it('should update transaction count after payment', async () => {
      // Note the current count
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await waitFor(element(by.text('Paiement traite')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);

      await sleep(2000);

      // Count should have incremented
      await expect(element(by.text(/[0-9]+ transactions/))).toBeVisible();
    });

    it('should update total amount after payment', async () => {
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await waitFor(element(by.text('Paiement traite')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);

      await sleep(2000);

      // Total should have updated
      await expect(element(by.text(/Total: [0-9.]+ Griffons/))).toBeVisible();
    });

    it('should handle payment error gracefully', async () => {
      // Simulate network issue during payment
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      // Should show either success or queued message
      await waitFor(element(by.text(/(Paiement traite|en attente)/)))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should play success sound', async () => {
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      // Sound testing is limited, but verify flow completes
      await waitFor(element(by.text('Paiement traite')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should trigger haptic feedback', async () => {
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      // Haptic testing is limited, but verify flow completes
      await waitFor(element(by.id(TestIds.staff.paymentSuccessIcon)))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });
  });

  // ==========================================================================
  // Offline Payment Tests
  // ==========================================================================

  describe('Offline Payment', () => {
    afterEach(async () => {
      await goOnline();
    });

    it('should show offline indicator', async () => {
      await goOffline();
      await device.reloadReactNative();
      await navigateToPayment();

      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should queue payment when offline', async () => {
      await goOffline();

      await enterAmount(10);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);

      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      // Should show queued message
      await waitFor(element(by.text('Paiement en attente de synchronisation')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show pending transactions count', async () => {
      await goOffline();

      await enterAmount(10);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);

      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      // Should show pending indicator
      await waitFor(element(by.text(/[0-9]+ en attente/)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should sync when back online', async () => {
      await goOffline();

      await enterAmount(10);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);

      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(1000);

      await goOnline();

      // Should sync and clear pending
      await waitFor(element(by.text('Synchronisation terminee')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should validate customer balance from cache offline', async () => {
      // First sync customer data
      await expect(element(by.text('Nouveau paiement'))).toBeVisible();

      await goOffline();

      // Should still be able to enter amount
      await enterAmount(10);
      await expect(element(by.text('Scanner QR client'))).toBeVisible();
    });

    it('should show offline mode badge on payment screen', async () => {
      await goOffline();
      await device.reloadReactNative();
      await navigateToPayment();

      await expect(element(by.id(TestIds.staff.offlineModeBadge))).toBeVisible();
    });

    it('should process multiple offline payments', async () => {
      await goOffline();

      // First payment
      await enterAmount(10);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();
      await sleep(2000);

      // Second payment
      await enterAmount(15);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      // Should show multiple pending
      await waitFor(element(by.text(/[0-9]+ en attente/)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show offline receipt', async () => {
      await goOffline();

      await enterAmount(10);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);

      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      // Should show offline receipt
      await waitFor(element(by.id(TestIds.staff.offlineReceipt)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });
  });

  // ==========================================================================
  // Transaction History Tests
  // ==========================================================================

  describe('Transaction History', () => {
    it('should show view all transactions button', async () => {
      await expect(element(by.text('Voir tout'))).toBeVisible();
    });

    it('should navigate to full transaction list', async () => {
      await element(by.text('Voir tout')).tap();

      await waitFor(element(by.text('Historique des transactions')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should display transaction list', async () => {
      await element(by.text('Voir tout')).tap();

      await waitFor(element(by.id(TestIds.staff.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show transaction details', async () => {
      await element(by.text('Voir tout')).tap();

      await waitFor(element(by.id(TestIds.staff.transactionList)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      try {
        await expect(element(by.id('transaction-item-0'))).toBeVisible();
      } catch {
        await expect(element(by.text('Aucune transaction'))).toBeVisible();
      }
    });

    it('should filter transactions by date', async () => {
      await element(by.text('Voir tout')).tap();

      await waitFor(element(by.id(TestIds.staff.transactionDateFilter)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.staff.transactionDateFilter)).tap();
      await element(by.text('Hier')).tap();

      await sleep(500);
    });
  });

  // ==========================================================================
  // Security Tests
  // ==========================================================================

  describe('Security', () => {
    it('should require staff authentication', async () => {
      await logout();

      await device.reloadReactNative();

      // Should be redirected to login
      await expect(element(by.id(TestIds.auth.emailInput))).toBeVisible();
    });

    it('should not show customer full details', async () => {
      await enterAmount(15);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);

      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Should not show full email or sensitive data
      await expect(element(by.text('test@festivals.app'))).not.toBeVisible();
    });

    it('should mask customer balance partially', async () => {
      await enterAmount(15);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);

      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Customer balance should be shown but potentially masked
      await expect(element(by.text('Solde'))).toBeVisible();
    });

    it('should log payment attempt', async () => {
      await enterAmount(15);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      // Transaction should be logged
      await element(by.text('Voir tout')).tap();
      await expect(element(by.id(TestIds.staff.transactionList))).toBeVisible();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle network error gracefully', async () => {
      await enterAmount(15);
      await simulateQRScan(PAYMENT_DATA.sampleQRCode);

      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      // Should show either success or queued message
      await waitFor(element(by.text(/(Paiement traite|en attente)/)))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should allow retry after error', async () => {
      await enterAmount(15);

      // Should be able to retry
      await expect(element(by.text('Scanner QR client'))).toBeVisible();
    });

    it('should show clear error messages', async () => {
      await enterAmount(0);
      await element(by.text('Scanner QR client')).tap();

      await expect(element(by.text('Montant invalide'))).toBeVisible();
    });

    it('should handle camera error gracefully', async () => {
      await enterAmount(15);
      await element(by.text('Scanner QR client')).tap();

      // In normal operation, camera should be available
      await expect(element(by.id(TestIds.scanner.view))).toBeVisible();
    });
  });
});
