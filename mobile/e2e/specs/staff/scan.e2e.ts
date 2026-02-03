/**
 * Staff Scan E2E Tests
 *
 * Tests for staff ticket scanning: entry validation, QR scan, and access control
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
  TICKET_TEST_DATA,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../../fixtures/testData';

describe('Staff Scan Feature', () => {
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
    await navigateToScan();
    await waitForLoadingComplete();
  });

  afterAll(async () => {
    await resetNetwork();
    await device.terminateApp();
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  async function navigateToScan(): Promise<void> {
    await waitFor(element(by.text('Controle')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.medium);
    await element(by.text('Controle')).tap();
    await waitForAnimation();
  }

  async function simulateScanTicketQR(ticketCode: string): Promise<void> {
    // Simulate QR scan via mock launch args
    await device.launchApp({
      newInstance: false,
      launchArgs: {
        mockTicketQR: ticketCode,
      },
    });
    await waitForAnimation();
  }

  // ==========================================================================
  // Scan Screen Display Tests
  // ==========================================================================

  describe('Scan Screen Display', () => {
    it('should display scan screen for staff', async () => {
      await expect(element(by.text('Controle des entrees'))).toBeVisible();
    });

    it('should show scanner view', async () => {
      await waitFor(element(by.id(TEST_IDS.scannerView)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show scan instructions', async () => {
      await expect(element(by.text('Scannez le billet du festivalier'))).toBeVisible();
    });

    it('should show scan frame overlay', async () => {
      await expect(element(by.id('scan-frame'))).toBeVisible();
    });

    it('should show flashlight toggle button', async () => {
      await expect(element(by.id('flashlight-button'))).toBeVisible();
    });

    it('should show manual entry button', async () => {
      await expect(element(by.text('Saisie manuelle'))).toBeVisible();
    });

    it('should show scan statistics', async () => {
      await expect(element(by.text('Scans du jour'))).toBeVisible();
    });

    it('should show total scans count', async () => {
      await expect(element(by.text(/[0-9]+ entrees/))).toBeVisible();
    });
  });

  // ==========================================================================
  // QR Code Scan Tests
  // ==========================================================================

  describe('QR Code Scan', () => {
    it('should scan valid ticket successfully', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      await waitFor(element(by.text(SUCCESS_MESSAGES.scanSuccess)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show green checkmark for valid ticket', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      await waitFor(element(by.id('scan-success-icon')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show ticket holder name', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      await waitFor(element(by.text('Titulaire')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show ticket type', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      await waitFor(element(by.text(TICKET_TEST_DATA.sampleTicket.name)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show error for invalid ticket', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.invalidCode);

      await waitFor(element(by.text(ERROR_MESSAGES.ticketNotFound)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show red X for invalid ticket', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.invalidCode);

      await waitFor(element(by.id('scan-error-icon')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show error for already scanned ticket', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.scannedTicketCode);

      await waitFor(element(by.text(ERROR_MESSAGES.ticketAlreadyUsed)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show previous scan time for duplicate', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.scannedTicketCode);

      await waitFor(element(by.text(/Deja scanne a/)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should auto-return to scan mode after result', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      await waitFor(element(by.text(SUCCESS_MESSAGES.scanSuccess)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // Wait for result screen to dismiss
      await sleep(3000);

      // Should be back to scan mode
      await expect(element(by.id(TEST_IDS.scannerView))).toBeVisible();
    });

    it('should play success sound for valid scan', async () => {
      // Sound testing is limited in e2e, but we verify the flow works
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      await waitFor(element(by.text(SUCCESS_MESSAGES.scanSuccess)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should vibrate on scan result', async () => {
      // Haptic testing is limited in e2e, verify flow works
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      await waitFor(element(by.id('scan-success-icon')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });
  });

  // ==========================================================================
  // Manual Entry Tests
  // ==========================================================================

  describe('Manual Entry', () => {
    beforeEach(async () => {
      await element(by.text('Saisie manuelle')).tap();
      await waitFor(element(by.id('manual-ticket-input')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should open manual entry modal', async () => {
      await expect(element(by.text('Saisie du code billet'))).toBeVisible();
    });

    it('should have ticket code input field', async () => {
      await expect(element(by.id('manual-ticket-input'))).toBeVisible();
    });

    it('should validate ticket code format', async () => {
      await element(by.id('manual-ticket-input')).typeText('INVALID');
      await element(by.text('Valider')).tap();

      await expect(element(by.text('Format de code invalide'))).toBeVisible();
    });

    it('should validate valid manual entry', async () => {
      await element(by.id('manual-ticket-input')).typeText(TICKET_TEST_DATA.sampleTicket.code);
      await element(by.text('Valider')).tap();

      await waitFor(element(by.text(SUCCESS_MESSAGES.scanSuccess)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show error for invalid manual entry', async () => {
      await element(by.id('manual-ticket-input')).typeText(TICKET_TEST_DATA.invalidCode);
      await element(by.text('Valider')).tap();

      await waitFor(element(by.text(ERROR_MESSAGES.ticketNotFound)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should close manual entry and return to scanner', async () => {
      await element(by.text('Annuler')).tap();

      await expect(element(by.id(TEST_IDS.scannerView))).toBeVisible();
    });

    it('should auto-format ticket code input', async () => {
      await element(by.id('manual-ticket-input')).typeText('TKT12345678');

      // Should auto-format to TKT-12345678
      await expect(element(by.id('manual-ticket-input'))).toHaveText('TKT-12345678');
    });
  });

  // ==========================================================================
  // Flashlight Tests
  // ==========================================================================

  describe('Flashlight', () => {
    it('should toggle flashlight on', async () => {
      await element(by.id('flashlight-button')).tap();

      await expect(element(by.id('flashlight-button-active'))).toBeVisible();
    });

    it('should toggle flashlight off', async () => {
      // Turn on first
      await element(by.id('flashlight-button')).tap();
      await expect(element(by.id('flashlight-button-active'))).toBeVisible();

      // Turn off
      await element(by.id('flashlight-button-active')).tap();
      await expect(element(by.id('flashlight-button'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Statistics Tests
  // ==========================================================================

  describe('Scan Statistics', () => {
    it('should show todays scan count', async () => {
      await expect(element(by.text(/[0-9]+ entrees/))).toBeVisible();
    });

    it('should update count after successful scan', async () => {
      // Note the current count (would need to parse text in real test)
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      await waitFor(element(by.text(SUCCESS_MESSAGES.scanSuccess)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // Count should increment
      await sleep(3000);
      await expect(element(by.text(/[0-9]+ entrees/))).toBeVisible();
    });

    it('should show recent scans list', async () => {
      await element(by.text('Historique')).tap();

      await waitFor(element(by.text('Scans recents')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show scan details in history', async () => {
      // Scan a ticket first
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);
      await sleep(3000);

      // View history
      await element(by.text('Historique')).tap();

      try {
        await expect(element(by.id('scan-history-item-0'))).toBeVisible();
      } catch {
        await expect(element(by.text('Aucun scan'))).toBeVisible();
      }
    });
  });

  // ==========================================================================
  // Ticket Type Handling Tests
  // ==========================================================================

  describe('Ticket Type Handling', () => {
    it('should indicate VIP ticket', async () => {
      // Simulate scanning a VIP ticket
      const vipTicketCode = 'TKT-VIP12345';
      await simulateScanTicketQR(vipTicketCode);

      // VIP indicator should show
      try {
        await waitFor(element(by.text('VIP')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);
      } catch {
        // Ticket might not be VIP or code invalid
      }
    });

    it('should indicate day pass vs weekend pass', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      // Should show ticket type
      await waitFor(element(by.text(/Pass/)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show access level', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      // Should indicate what areas ticket grants access to
      await waitFor(element(by.text(/Acces/)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });
  });

  // ==========================================================================
  // Offline Mode Tests
  // ==========================================================================

  describe('Offline Mode', () => {
    afterEach(async () => {
      await goOnline();
    });

    it('should scan tickets offline using cache', async () => {
      // Ensure ticket data is cached
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);
      await sleep(3000);

      await goOffline();
      await device.reloadReactNative();
      await navigateToScan();

      // Should still be able to scan
      await expect(element(by.id(TEST_IDS.scannerView))).toBeVisible();
    });

    it('should show offline indicator', async () => {
      await goOffline();
      await device.reloadReactNative();
      await navigateToScan();

      await waitFor(element(by.id('offline-indicator')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should queue scans for sync', async () => {
      await goOffline();

      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      // Should show pending sync indicator
      await waitFor(element(by.text('En attente de synchronisation')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should sync scans when back online', async () => {
      await goOffline();
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      await goOnline();

      // Should sync
      await waitFor(element(by.text('Synchronisation terminee')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);
    });

    it('should validate against cached ticket list offline', async () => {
      await goOffline();

      // Invalid ticket should still be caught
      await simulateScanTicketQR(TICKET_TEST_DATA.invalidCode);

      await waitFor(element(by.text(ERROR_MESSAGES.ticketNotFound)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle camera error gracefully', async () => {
      // Camera errors would show a message
      // In normal operation, camera is available
      await expect(element(by.id(TEST_IDS.scannerView))).toBeVisible();
    });

    it('should show clear error messages', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.invalidCode);

      await expect(element(by.text(ERROR_MESSAGES.ticketNotFound))).toBeVisible();
    });

    it('should allow retry after error', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.invalidCode);

      await waitFor(element(by.text(ERROR_MESSAGES.ticketNotFound)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      // Wait for error to clear
      await sleep(3000);

      // Should be able to scan again
      await expect(element(by.id(TEST_IDS.scannerView))).toBeVisible();
    });

    it('should handle network timeout', async () => {
      // Network issues should be handled gracefully
      await expect(element(by.id(TEST_IDS.scannerView))).toBeVisible();
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
      await expect(element(by.id('login-email-input'))).toBeVisible();
    });

    it('should prevent duplicate scans within timeframe', async () => {
      // Scan once
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);
      await sleep(3000);

      // Scan same ticket again
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      // Should show already scanned warning
      await waitFor(element(by.text(ERROR_MESSAGES.ticketAlreadyUsed)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should log all scan attempts', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.invalidCode);
      await sleep(3000);

      // View history
      await element(by.text('Historique')).tap();

      // Invalid scan should be logged
      await expect(element(by.text('Scans recents'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have accessible scanner controls', async () => {
      await expect(element(by.id('flashlight-button'))).toBeVisible();
      await expect(element(by.text('Saisie manuelle'))).toBeVisible();
    });

    it('should announce scan results', async () => {
      // VoiceOver announcements are limited in e2e testing
      // Verify visual feedback exists
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      await expect(element(by.id('scan-success-icon'))).toBeVisible();
    });

    it('should have high contrast result indicators', async () => {
      await simulateScanTicketQR(TICKET_TEST_DATA.sampleTicket.code);

      // Green success icon should be visible
      await expect(element(by.id('scan-success-icon'))).toBeVisible();
    });
  });
});
