/**
 * E2E Test: Refund Request Flow
 *
 * Tests the critical user journey for refund processing:
 * 1. User requests a refund
 * 2. Admin reviews the request
 * 3. Admin approves or rejects the refund
 * 4. User receives confirmation
 */

import { test, expect } from '@playwright/test';
import { testUsers, testFestivals, testWallets } from '../fixtures';
import {
  AuthHelper,
  createAuthHelper,
  waitForPageLoad,
} from '../utils/auth-helpers';
import { ApiHelper, createApiHelper, generateTestId } from '../utils/api-helpers';

let authHelper: AuthHelper;
let apiHelper: ApiHelper;

// Mock refund request data
const mockRefundRequest = {
  id: 'refund-test-001',
  festivalId: testFestivals.active.id,
  userId: testUsers.attendee.id,
  walletId: testWallets[0].id,
  amount: testWallets[0].balance,
  currency: 'EUR',
  status: 'PENDING' as const,
  method: 'BANK_TRANSFER',
  reason: 'Cannot attend the festival anymore',
  user: {
    id: testUsers.attendee.id,
    email: testUsers.attendee.email,
    firstName: testUsers.attendee.firstName,
    lastName: testUsers.attendee.lastName,
    phone: testUsers.attendee.phone,
  },
  wallet: {
    id: testWallets[0].id,
    balance: testWallets[0].balance,
    totalSpent: 54.50,
    totalTopUps: 100,
    ticketCode: 'TKT-TEST-001',
  },
  bankDetails: {
    accountHolder: `${testUsers.attendee.firstName} ${testUsers.attendee.lastName}`,
    iban: 'BE71 0961 2345 6769',
    bic: 'GKCCBEBB',
    bankName: 'Test Bank',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test.describe('Refund Request Flow', () => {
  test.beforeEach(async ({ page }) => {
    authHelper = createAuthHelper(page);
    apiHelper = createApiHelper(page);

    // Seed test data
    await apiHelper.seedTestData();
    await apiHelper.setupStandardMocks();
  });

  test.afterEach(async ({ page }) => {
    await apiHelper.cleanupTestData();
    await authHelper.logout();
  });

  test.describe('User Requests Refund', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('attendee');

      // Mock user's wallet
      await apiHelper.mockApiResponse('**/api/v1/account/wallets', {
        data: [{
          id: testWallets[0].id,
          festivalId: testFestivals.active.id,
          festivalName: testFestivals.active.name,
          balance: testWallets[0].balance,
          currency: 'EUR',
          nfcLinked: testWallets[0].nfcLinked,
          status: 'ACTIVE',
        }],
      });
    });

    test('should display refund button on wallet page', async ({ page }) => {
      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Refund button should be visible for active wallets with balance
      await expect(page.locator('button:has-text("Refund"), button:has-text("Remboursement"), button:has-text("Demander")')).toBeVisible();
    });

    test('should open refund request modal', async ({ page }) => {
      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      await page.click('button:has-text("Refund"), button:has-text("Remboursement"), button:has-text("Demander")');

      // Modal should be visible
      await expect(page.locator('[role="dialog"], .modal, text=Demander un remboursement')).toBeVisible();
    });

    test('should display current balance in refund form', async ({ page }) => {
      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      await page.click('button:has-text("Refund"), button:has-text("Remboursement")');

      // Balance should be displayed
      await expect(page.locator(`text=${testWallets[0].balance}`)).toBeVisible();
    });

    test('should validate bank details', async ({ page }) => {
      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      await page.click('button:has-text("Refund"), button:has-text("Remboursement")');

      // Try to submit without bank details
      await page.click('button:has-text("Submit"), button:has-text("Demander"), button[type="submit"]');

      // Validation errors should appear
      await expect(page.locator('text=IBAN, text=required, text=requis')).toBeVisible();
    });

    test('should submit refund request successfully', async ({ page }) => {
      // Mock successful refund request
      await apiHelper.mockRefundRequest('refund-new-001');

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      await page.click('button:has-text("Refund"), button:has-text("Remboursement")');

      // Fill bank details
      await page.fill('input[name="amount"], input[placeholder*="amount"]', testWallets[0].balance.toString());
      await page.fill('input[name="bankAccount"], input[placeholder*="IBAN"]', 'BE71 0961 2345 6769');
      await page.fill('input[name="bankName"], input[placeholder*="bank"]', 'Test Bank');
      await page.fill('input[name="accountHolder"], input[placeholder*="holder"]', 'Test Attendee');

      // Submit
      await page.click('button:has-text("Submit"), button:has-text("Demander")');

      // Success message
      await expect(page.locator('text=submitted, text=soumise, text=received')).toBeVisible();
    });

    test('should show pending refund status', async ({ page }) => {
      // Mock existing pending refund
      await apiHelper.mockApiResponse('**/api/v1/account/refunds', {
        data: [{
          ...mockRefundRequest,
          status: 'PENDING',
        }],
      });

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Pending status should be shown
      await expect(page.locator('text=pending, text=en attente, text=En cours')).toBeVisible();
    });

    test('should prevent duplicate refund requests', async ({ page }) => {
      // Mock existing pending refund
      await apiHelper.mockApiResponse('**/api/v1/account/wallets', {
        data: [{
          id: testWallets[0].id,
          festivalId: testFestivals.active.id,
          balance: testWallets[0].balance,
          status: 'ACTIVE',
          hasPendingRefund: true,
        }],
      });

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Refund button should be disabled or not visible
      const refundButton = page.locator('button:has-text("Refund"), button:has-text("Remboursement")');
      const isDisabled = await refundButton.isDisabled().catch(() => true);
      const isHidden = !(await refundButton.isVisible().catch(() => false));

      expect(isDisabled || isHidden).toBe(true);
    });
  });

  test.describe('Admin Reviews Refund Request', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('admin');

      // Mock refunds list
      await apiHelper.mockApiResponse(`**/api/v1/festivals/${testFestivals.active.id}/refunds`, {
        data: [mockRefundRequest],
        total: 1,
      });

      // Mock refund stats
      await apiHelper.mockApiResponse(`**/api/v1/festivals/${testFestivals.active.id}/refunds/stats`, {
        pending: 1,
        approved: 0,
        rejected: 0,
        completed: 0,
        totalPendingAmount: mockRefundRequest.amount,
        totalCompletedAmount: 0,
      });
    });

    test('should display refunds management page', async ({ page }) => {
      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      await expect(page.locator('h1:has-text("Refund"), h1:has-text("Remboursement")')).toBeVisible();
    });

    test('should display pending refunds count', async ({ page }) => {
      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      // Stats card should show pending count
      await expect(page.locator('text=1')).toBeVisible();
      await expect(page.locator('text=pending, text=attente, text=En attente')).toBeVisible();
    });

    test('should display refund request details', async ({ page }) => {
      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      // User info should be visible
      await expect(page.locator(`text=${mockRefundRequest.user.firstName}`)).toBeVisible();
      await expect(page.locator(`text=${mockRefundRequest.amount}`)).toBeVisible();
    });

    test('should filter refunds by status', async ({ page }) => {
      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      // Filter by pending
      const statusFilter = page.locator('select:has(option:has-text("PENDING")), select:has(option:has-text("En attente"))');
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('PENDING');
      }

      // Should still show the pending refund
      await expect(page.locator(`text=${mockRefundRequest.user.firstName}`)).toBeVisible();
    });

    test('should search refunds by user', async ({ page }) => {
      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      // Search by email
      const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="Rechercher"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill(mockRefundRequest.user.email);
        await searchInput.press('Enter');
      }

      // Should show matching refund
      await expect(page.locator(`text=${mockRefundRequest.user.firstName}`)).toBeVisible();
    });

    test('should view refund request detail', async ({ page }) => {
      // Mock single refund detail
      await apiHelper.mockApiResponse(`**/api/v1/refunds/${mockRefundRequest.id}`, mockRefundRequest);

      await page.goto(`/festivals/${testFestivals.active.id}/refunds/${mockRefundRequest.id}`);
      await waitForPageLoad(page);

      // All details should be visible
      await expect(page.locator(`text=${mockRefundRequest.user.email}`)).toBeVisible();
      await expect(page.locator(`text=${mockRefundRequest.bankDetails.iban}`)).toBeVisible();
      await expect(page.locator(`text=${mockRefundRequest.reason}`)).toBeVisible();
    });
  });

  test.describe('Admin Approves Refund', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('admin');

      await apiHelper.mockApiResponse(`**/api/v1/festivals/${testFestivals.active.id}/refunds`, {
        data: [mockRefundRequest],
      });
    });

    test('should display approve button', async ({ page }) => {
      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      await expect(page.locator('button:has-text("Approve"), button:has-text("Approuver")')).toBeVisible();
    });

    test('should approve single refund request', async ({ page }) => {
      // Mock approve endpoint
      await apiHelper.mockRefundApproval(mockRefundRequest.id);

      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      // Click approve on the refund
      const approveButton = page.locator('button:has-text("Approve"), button:has-text("Approuver")').first();
      await approveButton.click();

      // Confirm if needed
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Confirmer")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Success message
      await expect(page.locator('text=approved, text=approuve')).toBeVisible();
    });

    test('should batch approve multiple refunds', async ({ page }) => {
      // Mock multiple pending refunds
      await apiHelper.mockApiResponse(`**/api/v1/festivals/${testFestivals.active.id}/refunds`, {
        data: [
          mockRefundRequest,
          { ...mockRefundRequest, id: 'refund-test-002', user: { ...mockRefundRequest.user, firstName: 'Jane' } },
        ],
      });

      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      // Select all checkboxes
      const selectAllCheckbox = page.locator('input[type="checkbox"]').first();
      await selectAllCheckbox.click();

      // Click batch approve
      const batchApproveButton = page.locator('button:has-text("Approve"), button:has-text("Approuver")').last();
      if (await batchApproveButton.isVisible()) {
        await batchApproveButton.click();
      }
    });

    test('should update refund status after approval', async ({ page }) => {
      // Mock approved refund
      await apiHelper.mockApiResponse(`**/api/v1/festivals/${testFestivals.active.id}/refunds`, {
        data: [{
          ...mockRefundRequest,
          status: 'APPROVED',
          approvedAt: new Date().toISOString(),
          approvedBy: testUsers.admin.email,
        }],
      });

      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      // Status should show approved
      await expect(page.locator('text=APPROVED, text=Approuve')).toBeVisible();
    });
  });

  test.describe('Admin Rejects Refund', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('admin');

      await apiHelper.mockApiResponse(`**/api/v1/festivals/${testFestivals.active.id}/refunds`, {
        data: [mockRefundRequest],
      });
    });

    test('should display reject button', async ({ page }) => {
      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      await expect(page.locator('button:has-text("Reject"), button:has-text("Rejeter")')).toBeVisible();
    });

    test('should require rejection reason', async ({ page }) => {
      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      // Click reject
      await page.click('button:has-text("Reject"), button:has-text("Rejeter")');

      // Reason modal should appear
      await expect(page.locator('textarea[name="reason"], textarea[placeholder*="reason"]')).toBeVisible();

      // Try to submit without reason
      const submitButton = page.locator('button:has-text("Submit"), button:has-text("Rejeter")').last();
      await submitButton.click();

      // Should show validation error
      await expect(page.locator('text=required, text=requis, text=motif')).toBeVisible();
    });

    test('should reject refund with reason', async ({ page }) => {
      // Mock reject endpoint
      await apiHelper.mockApiResponse(`**/api/v1/refunds/${mockRefundRequest.id}/reject`, {
        id: mockRefundRequest.id,
        status: 'REJECTED',
        rejectionReason: 'Invalid bank details',
      }, { method: 'POST' });

      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      // Click reject
      await page.click('button:has-text("Reject"), button:has-text("Rejeter")');

      // Fill reason
      await page.fill('textarea[name="reason"], textarea[placeholder*="reason"]', 'Invalid bank details');

      // Submit
      await page.click('button:has-text("Submit"), button:has-text("Confirmer")');

      // Success message
      await expect(page.locator('text=rejected, text=rejete')).toBeVisible();
    });
  });

  test.describe('User Receives Confirmation', () => {
    test.beforeEach(async ({ page }) => {
      await authHelper.loginAs('attendee');
    });

    test('should show approved refund status to user', async ({ page }) => {
      // Mock approved refund for user
      await apiHelper.mockApiResponse('**/api/v1/account/refunds', {
        data: [{
          ...mockRefundRequest,
          status: 'APPROVED',
          approvedAt: new Date().toISOString(),
        }],
      });

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Approved status should be visible
      await expect(page.locator('text=approved, text=approuve')).toBeVisible();
    });

    test('should show rejected refund with reason to user', async ({ page }) => {
      const rejectionReason = 'Invalid IBAN provided';

      await apiHelper.mockApiResponse('**/api/v1/account/refunds', {
        data: [{
          ...mockRefundRequest,
          status: 'REJECTED',
          rejectedAt: new Date().toISOString(),
          rejectionReason,
        }],
      });

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Rejected status and reason should be visible
      await expect(page.locator('text=rejected, text=rejete')).toBeVisible();
      await expect(page.locator(`text=${rejectionReason}`)).toBeVisible();
    });

    test('should show completed refund status', async ({ page }) => {
      await apiHelper.mockApiResponse('**/api/v1/account/refunds', {
        data: [{
          ...mockRefundRequest,
          status: 'COMPLETED',
          processedAt: new Date().toISOString(),
        }],
      });

      // Mock updated wallet with zero balance
      await apiHelper.mockApiResponse('**/api/v1/account/wallets', {
        data: [{
          id: testWallets[0].id,
          festivalId: testFestivals.active.id,
          balance: 0,
          status: 'CLOSED',
        }],
      });

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Completed status should be visible
      await expect(page.locator('text=completed, text=complete, text=traite')).toBeVisible();
    });

    test('should allow user to request new refund after rejection', async ({ page }) => {
      await apiHelper.mockApiResponse('**/api/v1/account/refunds', {
        data: [{
          ...mockRefundRequest,
          status: 'REJECTED',
          rejectedAt: new Date().toISOString(),
        }],
      });

      await apiHelper.mockApiResponse('**/api/v1/account/wallets', {
        data: [{
          id: testWallets[0].id,
          festivalId: testFestivals.active.id,
          balance: testWallets[0].balance,
          status: 'ACTIVE',
          hasPendingRefund: false,
        }],
      });

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      // Refund button should be available again
      await expect(page.locator('button:has-text("Refund"), button:has-text("Remboursement")')).toBeVisible();
    });
  });

  test.describe('Complete Refund Flow', () => {
    test('should complete full refund request and approval flow', async ({ page }) => {
      // Step 1: User requests refund
      await authHelper.loginAs('attendee');

      await apiHelper.mockApiResponse('**/api/v1/account/wallets', {
        data: [{
          id: testWallets[0].id,
          festivalId: testFestivals.active.id,
          festivalName: testFestivals.active.name,
          balance: 50.00,
          currency: 'EUR',
          status: 'ACTIVE',
        }],
      });

      await apiHelper.mockRefundRequest('refund-flow-001');

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      await page.click('button:has-text("Remboursement"), button:has-text("Refund")');

      await page.fill('input[placeholder*="IBAN"]', 'BE71 0961 2345 6769');
      await page.fill('input[placeholder*="bank"]', 'Test Bank');
      await page.fill('input[placeholder*="holder"]', 'Test User');

      await page.click('button:has-text("Demander"), button:has-text("Submit")');

      await expect(page.locator('text=submitted, text=soumise')).toBeVisible();

      // Step 2: Admin approves refund
      await authHelper.logout();
      await authHelper.loginAs('admin');

      await apiHelper.mockApiResponse(`**/api/v1/festivals/${testFestivals.active.id}/refunds`, {
        data: [{
          id: 'refund-flow-001',
          ...mockRefundRequest,
          status: 'PENDING',
        }],
      });

      await apiHelper.mockRefundApproval('refund-flow-001');

      await page.goto(`/festivals/${testFestivals.active.id}/refunds`);
      await waitForPageLoad(page);

      await page.click('button:has-text("Approve"), button:has-text("Approuver")');

      const confirmButton = page.locator('button:has-text("Confirm")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      await expect(page.locator('text=approved, text=approuve')).toBeVisible();

      // Step 3: User sees confirmation
      await authHelper.logout();
      await authHelper.loginAs('attendee');

      await apiHelper.mockApiResponse('**/api/v1/account/refunds', {
        data: [{
          id: 'refund-flow-001',
          status: 'APPROVED',
          approvedAt: new Date().toISOString(),
        }],
      });

      await page.goto('/account/wallet');
      await waitForPageLoad(page);

      await expect(page.locator('text=approved, text=approuve')).toBeVisible();
    });
  });
});
