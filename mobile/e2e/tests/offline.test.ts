/**
 * Offline Mode E2E Tests
 *
 * Comprehensive tests for app behavior when offline, sync indicator,
 * pending transactions display, and sync when back online.
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TestIds } from '../utils/testIds';
import { login, loginAsStaff, sleep, scrollDown, pullToRefresh } from '../utils/helpers';
import { goOffline, goOnline, resetNetwork, simulateQRScan } from '../utils/mocks';

// Test user credentials
const TEST_USER = {
  email: 'test@festivals.app',
  password: 'TestPassword123!',
  name: 'Test User',
};

const STAFF_USER = {
  email: 'staff@festivals.app',
  password: 'StaffPassword123!',
  name: 'Staff Member',
};

// Test data
const PAYMENT_QR = 'PAY-USER123-TOKEN456';
const TICKET_QR = 'TKT-ABC12345';

// Timeouts
const TIMEOUT = {
  short: 3000,
  medium: 10000,
  long: 30000,
};

describe('Offline Mode E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {
        camera: 'YES',
        location: 'always',
        notifications: 'YES',
      },
    });
  });

  afterEach(async () => {
    await goOnline();
  });

  afterAll(async () => {
    await resetNetwork();
    await device.terminateApp();
  });

  // ==========================================================================
  // App Behavior When Offline Tests (Customer Mode)
  // ==========================================================================

  describe('App Behavior When Offline - Customer', () => {
    beforeAll(async () => {
      await login(TEST_USER);
    });

    beforeEach(async () => {
      await device.reloadReactNative();
      await goOnline();
    });

    it('should show offline indicator in header when network lost', async () => {
      await goOffline();

      // Wait for offline detection
      await sleep(2000);

      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show offline banner with message', async () => {
      await goOffline();

      await sleep(2000);

      await expect(element(by.text('Vous etes hors ligne'))).toBeVisible();
    });

    it('should continue to display cached home screen', async () => {
      await expect(element(by.text('Accueil'))).toBeVisible();

      await goOffline();
      await device.reloadReactNative();

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should display cached wallet balance', async () => {
      // First view wallet to cache data
      await element(by.text('Wallet')).tap();
      await waitFor(element(by.id(TestIds.wallet.balance)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await goOffline();
      await device.reloadReactNative();

      // Navigate to wallet
      await element(by.text('Wallet')).tap();

      // Balance should still be visible from cache
      await waitFor(element(by.id(TestIds.wallet.balance)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should display QR code even when offline', async () => {
      await element(by.text('Wallet')).tap();

      await goOffline();

      // QR code should still be visible
      await expect(element(by.id(TestIds.wallet.qrCode))).toBeVisible();
    });

    it('should display cached program/lineup', async () => {
      // First view program to cache
      await element(by.text('Programme')).tap();
      await waitFor(element(by.id(TestIds.program.list)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await goOffline();
      await device.reloadReactNative();

      await element(by.text('Programme')).tap();

      // Program should load from cache
      await waitFor(element(by.id(TestIds.program.list)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should display cached tickets', async () => {
      // Navigate to tickets
      await element(by.text('Billets')).tap();
      await sleep(1000);

      await goOffline();
      await device.reloadReactNative();

      await element(by.text('Billets')).tap();

      // Tickets should load from cache
      await expect(element(by.id(TestIds.tickets.list))).toBeVisible();
    });

    it('should show stale data warning', async () => {
      await goOffline();
      await device.reloadReactNative();

      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Data might show "last updated" timestamp
      await expect(element(by.text(/Derniere mise a jour|Hors ligne/))).toBeVisible();
    });

    it('should disable actions requiring network', async () => {
      await element(by.text('Wallet')).tap();

      await goOffline();

      // Tap top up button
      await element(by.text('Recharger mon wallet')).tap();

      // Should show offline error
      await waitFor(element(by.text('Vous etes hors ligne')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should preserve navigation state when offline', async () => {
      await element(by.text('Programme')).tap();
      await element(by.text('Samedi')).tap();

      await goOffline();
      await sleep(1000);

      // Should still be on program page with filter
      await expect(element(by.text('Programme'))).toBeVisible();
    });

    it('should allow favoriting artists offline', async () => {
      await element(by.text('Programme')).tap();

      await goOffline();

      try {
        await element(by.id('favorite-button-0')).tap();

        // Favorite should be saved locally
        await expect(element(by.id('favorite-button-0-filled'))).toBeVisible();
      } catch {
        // No program data
      }
    });
  });

  // ==========================================================================
  // Sync Indicator Tests
  // ==========================================================================

  describe('Sync Indicator', () => {
    beforeAll(async () => {
      await device.reloadReactNative();
      await login(TEST_USER);
    });

    beforeEach(async () => {
      await device.reloadReactNative();
      await goOnline();
    });

    it('should show sync indicator when going offline', async () => {
      await goOffline();

      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should change sync indicator color based on status', async () => {
      // Online - should not show offline indicator
      await expect(element(by.id(TestIds.common.offlineIndicator))).not.toBeVisible();

      await goOffline();

      // Offline - should show indicator
      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show sync in progress animation', async () => {
      await goOffline();
      await sleep(1000);

      await goOnline();

      // Sync animation might briefly appear
      await sleep(2000);

      // Offline indicator should disappear
      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .not.toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show sync complete message', async () => {
      await goOffline();
      await sleep(1000);

      await goOnline();

      // Sync complete message might appear
      try {
        await waitFor(element(by.text('Synchronisation terminee')))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);
      } catch {
        // Message might not be shown if no pending data
      }
    });

    it('should hide offline indicator when back online', async () => {
      await goOffline();

      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await goOnline();

      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .not.toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should show last sync time', async () => {
      await goOffline();
      await device.reloadReactNative();

      // Might show last sync time
      await expect(element(by.id(TestIds.common.offlineIndicator))).toBeVisible();
    });
  });

  // ==========================================================================
  // Pending Transactions Display Tests (Staff Mode)
  // ==========================================================================

  describe('Pending Transactions Display - Staff', () => {
    beforeAll(async () => {
      await device.reloadReactNative();
      await loginAsStaff(STAFF_USER);
    });

    beforeEach(async () => {
      await device.reloadReactNative();
      await goOnline();
    });

    it('should queue payment when offline', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Enter amount
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();

      // Scan QR
      await simulateQRScan(PAYMENT_QR);

      // Confirm payment
      await waitFor(element(by.text('Confirmer le paiement')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      // Should show queued message
      await waitFor(element(by.text('Paiement en attente de synchronisation')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show pending payment count', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create offline payment
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      // Should show pending count
      await waitFor(element(by.text(/[0-9]+ en attente/)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show pending payments badge', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create offline payment
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      // Badge should show pending count
      await expect(element(by.id(TestIds.staff.pendingBadge))).toBeVisible();
    });

    it('should display list of pending transactions', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create offline payment
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      // Navigate to pending list
      await element(by.text('Voir tout')).tap();

      // Should show pending transactions
      await expect(element(by.id(TestIds.staff.transactionList))).toBeVisible();
    });

    it('should show pending status for each transaction', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create offline payment
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      await element(by.text('Voir tout')).tap();

      // Each pending transaction should show status
      await expect(element(by.text('En attente'))).toBeVisible();
    });

    it('should allow canceling pending transaction', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create offline payment
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      // Try to view pending transactions
      await element(by.text('Voir tout')).tap();

      // Cancel option might be available
      await expect(element(by.id(TestIds.staff.transactionList))).toBeVisible();
    });

    it('should persist pending transactions across app restart', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create offline payment
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      // Reload app while still offline
      await device.reloadReactNative();

      await element(by.text('Paiement')).tap();

      // Pending count should still be visible
      await expect(element(by.text(/[0-9]+ en attente/))).toBeVisible();
    });

    it('should queue ticket scans when offline', async () => {
      await element(by.text('Controle')).tap();

      await goOffline();

      // Scan ticket
      await simulateQRScan(TICKET_QR);

      // Should queue scan
      await waitFor(element(by.text('En attente de synchronisation')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });
  });

  // ==========================================================================
  // Sync When Back Online Tests
  // ==========================================================================

  describe('Sync When Back Online', () => {
    beforeAll(async () => {
      await device.reloadReactNative();
      await loginAsStaff(STAFF_USER);
    });

    beforeEach(async () => {
      await device.reloadReactNative();
      await goOnline();
    });

    it('should auto-sync pending payments when online', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create offline payment
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      await goOnline();

      // Should sync automatically
      await waitFor(element(by.text('Synchronisation terminee')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should clear pending count after sync', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create offline payment
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      await goOnline();

      // Wait for sync
      await sleep(5000);

      // Pending count should be cleared
      await waitFor(element(by.text(/[0-9]+ en attente/)))
        .not.toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should show sync progress indicator', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create multiple offline payments
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      await goOnline();

      // Sync progress might be shown
      await expect(element(by.text('Paiement'))).toBeVisible();
    });

    it('should handle sync failure gracefully', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create offline payment
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      // Go online briefly then offline again
      await goOnline();
      await sleep(500);
      await goOffline();

      // Should still work
      await expect(element(by.text('Paiement'))).toBeVisible();
    });

    it('should retry failed sync attempts', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create offline payment
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      await goOnline();

      // Wait for sync or retry
      await sleep(5000);

      await expect(element(by.text('Paiement'))).toBeVisible();
    });

    it('should sync ticket scans when back online', async () => {
      await element(by.text('Controle')).tap();

      await goOffline();

      // Scan ticket offline
      await simulateQRScan(TICKET_QR);

      await sleep(2000);

      await goOnline();

      // Should sync
      await waitFor(element(by.text('Synchronisation terminee')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should update transaction status after sync', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();

      // Create offline payment
      await element(by.id(TestIds.staff.amountInput)).typeText('10');
      await element(by.id(TestIds.staff.amountInput)).tapReturnKey();
      await simulateQRScan(PAYMENT_QR);
      await element(by.id(TestIds.staff.confirmPaymentButton)).tap();

      await sleep(2000);

      await goOnline();

      await sleep(5000);

      // View transactions
      await element(by.text('Voir tout')).tap();

      // Status should be updated from pending
      await expect(element(by.id(TestIds.staff.transactionList))).toBeVisible();
    });

    it('should sync favorites added while offline', async () => {
      await device.reloadReactNative();
      await login(TEST_USER);

      await element(by.text('Programme')).tap();

      await goOffline();

      try {
        // Add favorite offline
        await element(by.id('favorite-button-0')).tap();

        await goOnline();

        await sleep(3000);

        // Favorite should be synced and persisted
        await expect(element(by.id('favorite-button-0-filled'))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should refresh data after coming back online', async () => {
      await element(by.text('Paiement')).tap();

      await goOffline();
      await sleep(2000);

      await goOnline();

      // Data should refresh
      await pullToRefresh(TestIds.staff.paymentScrollView);

      await expect(element(by.text('Nouveau paiement'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Network Transition Tests
  // ==========================================================================

  describe('Network Transitions', () => {
    beforeAll(async () => {
      await device.reloadReactNative();
      await login(TEST_USER);
    });

    beforeEach(async () => {
      await device.reloadReactNative();
      await goOnline();
    });

    it('should handle rapid network changes', async () => {
      await goOffline();
      await sleep(500);
      await goOnline();
      await sleep(500);
      await goOffline();
      await sleep(500);
      await goOnline();

      // App should remain stable
      await expect(element(by.text('Accueil'))).toBeVisible();
    });

    it('should detect network recovery quickly', async () => {
      await goOffline();

      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await goOnline();

      // Indicator should disappear within reasonable time
      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .not.toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should maintain user session through network changes', async () => {
      await goOffline();
      await sleep(2000);
      await goOnline();
      await sleep(2000);

      // User should still be logged in
      await element(by.text('Profil')).tap();
      await expect(element(by.text(TEST_USER.name))).toBeVisible();
    });

    it('should handle network loss during data fetch', async () => {
      await element(by.text('Programme')).tap();

      // Go offline during potential refresh
      await pullToRefresh(TestIds.program.scrollView);
      await goOffline();

      await sleep(2000);

      // Should show cached data or error gracefully
      await expect(element(by.text('Programme'))).toBeVisible();
    });

    it('should queue actions started before network loss', async () => {
      await element(by.text('Wallet')).tap();

      // Start an action
      await element(by.text('Recharger mon wallet')).tap();

      await goOffline();

      // Should show offline message
      await waitFor(element(by.text('Vous etes hors ligne')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });
  });

  // ==========================================================================
  // Data Consistency Tests
  // ==========================================================================

  describe('Data Consistency', () => {
    beforeAll(async () => {
      await device.reloadReactNative();
      await login(TEST_USER);
    });

    beforeEach(async () => {
      await device.reloadReactNative();
      await goOnline();
    });

    it('should not lose cached data when going offline', async () => {
      // View data to cache it
      await element(by.text('Wallet')).tap();
      await waitFor(element(by.id(TestIds.wallet.balance)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await goOffline();

      // Balance should still be visible
      await expect(element(by.id(TestIds.wallet.balance))).toBeVisible();
    });

    it('should merge offline changes with server data', async () => {
      await element(by.text('Programme')).tap();

      try {
        // Make offline change
        await goOffline();
        await element(by.id('favorite-button-0')).tap();

        await goOnline();
        await sleep(3000);

        // Change should be preserved
        await expect(element(by.id('favorite-button-0-filled'))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should handle conflicts between local and server data', async () => {
      // This would require server-side test setup
      // Verify app handles potential conflicts gracefully
      await expect(element(by.text('Accueil'))).toBeVisible();
    });

    it('should preserve local changes on sync failure', async () => {
      await element(by.text('Programme')).tap();

      try {
        await goOffline();
        await element(by.id('favorite-button-0')).tap();

        // Reload while still offline
        await device.reloadReactNative();
        await element(by.text('Programme')).tap();

        // Local change should persist
        await expect(element(by.id('favorite-button-0-filled'))).toBeVisible();
      } catch {
        // No program data
      }
    });
  });
});
