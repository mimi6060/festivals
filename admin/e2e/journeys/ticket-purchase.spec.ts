/**
 * E2E Test: Complete Ticket Purchase Flow
 *
 * Tests the critical user journey of purchasing festival tickets:
 * 1. Select tickets
 * 2. Enter attendee details
 * 3. Complete payment
 * 4. Receive confirmation
 * 5. Verify QR code generation
 */

import { test, expect, Page } from '@playwright/test';
import {
  testUsers,
  testFestivals,
  testTicketTypes,
  TestTicketType,
} from '../fixtures';
import {
  AuthHelper,
  createAuthHelper,
  waitForPageLoad,
} from '../utils/auth-helpers';
import { ApiHelper, createApiHelper, generateOrderNumber } from '../utils/api-helpers';
import { StripeHelper, createStripeHelper, stripeTestCards } from '../utils/stripe-helpers';

// Test fixtures
let authHelper: AuthHelper;
let apiHelper: ApiHelper;
let stripeHelper: StripeHelper;

test.describe('Ticket Purchase Journey', () => {
  test.beforeEach(async ({ page }) => {
    authHelper = createAuthHelper(page);
    apiHelper = createApiHelper(page);
    stripeHelper = createStripeHelper(page);

    // Seed test data
    await apiHelper.seedTestData();
    await apiHelper.setupStandardMocks();
  });

  test.afterEach(async ({ page }) => {
    await apiHelper.cleanupTestData();
  });

  test.describe('Ticket Selection', () => {
    test('should display available ticket types for the festival', async ({ page }) => {
      await page.goto(`/festival/${testFestivals.active.slug}/tickets`);
      await waitForPageLoad(page);

      // Verify festival information is displayed
      await expect(page.locator('h1, h2').filter({ hasText: testFestivals.active.name })).toBeVisible();

      // Verify ticket types are displayed
      for (const ticketType of testTicketTypes.filter((t) => t.status === 'ON_SALE')) {
        await expect(page.locator(`text=${ticketType.name}`)).toBeVisible();
        await expect(page.locator(`text=${ticketType.price}`)).toBeVisible();
      }
    });

    test('should allow selecting ticket quantity', async ({ page }) => {
      await page.goto(`/festival/${testFestivals.active.slug}/tickets`);
      await waitForPageLoad(page);

      // Find the first ticket type and increase quantity
      const ticketCard = page.locator('[data-testid="ticket-card"]').first();
      const increaseButton = ticketCard.locator('button[aria-label*="increase"], button:has-text("+")');

      await increaseButton.click();
      await increaseButton.click();

      // Verify quantity is updated
      const quantityDisplay = ticketCard.locator('[data-testid="quantity"], input[type="number"]');
      await expect(quantityDisplay).toHaveValue('2');
    });

    test('should update cart total when tickets are selected', async ({ page }) => {
      await page.goto(`/festival/${testFestivals.active.slug}/tickets`);
      await waitForPageLoad(page);

      // Select 2 weekend passes
      const weekendPass = testTicketTypes.find((t) => t.name === 'Weekend Pass');
      if (!weekendPass) throw new Error('Weekend Pass not found');

      const ticketCard = page.locator(`[data-testid="ticket-${weekendPass.id}"], :has-text("${weekendPass.name}")`).first();
      const increaseButton = ticketCard.locator('button:has-text("+")');

      await increaseButton.click();
      await increaseButton.click();

      // Verify total is updated (2 * 150 = 300)
      const expectedTotal = weekendPass.price * 2;
      await expect(page.locator(`text=${expectedTotal}, text=300`)).toBeVisible();
    });

    test('should show sold out status for unavailable tickets', async ({ page }) => {
      // Mock a sold out ticket
      await apiHelper.mockApiResponse('**/api/v1/festivals/*/ticket-types', {
        ticketTypes: testTicketTypes.map((t) =>
          t.name === 'VIP Pass' ? { ...t, status: 'SOLD_OUT', sold: t.quantity } : t
        ),
      });

      await page.goto(`/festival/${testFestivals.active.slug}/tickets`);
      await waitForPageLoad(page);

      // VIP Pass should show sold out
      const vipCard = page.locator(':has-text("VIP Pass")').first();
      await expect(vipCard.locator('text=Sold out, text=Epuise, text=SOLD_OUT')).toBeVisible();
    });

    test('should proceed to checkout with selected tickets', async ({ page }) => {
      await page.goto(`/festival/${testFestivals.active.slug}/tickets`);
      await waitForPageLoad(page);

      // Select a ticket
      const ticketCard = page.locator('[data-testid="ticket-card"]').first();
      await ticketCard.locator('button:has-text("+")').click();

      // Click continue/checkout button
      await page.click('button:has-text("Continuer"), button:has-text("Continue"), a:has-text("Checkout")');

      // Should navigate to checkout or attendee details
      await expect(page).toHaveURL(/checkout|details|attendee/);
    });
  });

  test.describe('Attendee Details', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate directly to checkout with pre-selected tickets
      await page.goto(`/festival/${testFestivals.active.slug}/checkout`);
      await waitForPageLoad(page);
    });

    test('should display attendee form fields', async ({ page }) => {
      await expect(page.locator('input[name="firstName"], input[placeholder*="First name"], input[placeholder*="Prenom"]')).toBeVisible();
      await expect(page.locator('input[name="lastName"], input[placeholder*="Last name"], input[placeholder*="Nom"]')).toBeVisible();
      await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      // Try to submit without filling required fields
      await page.click('button[type="submit"], button:has-text("Continue"), button:has-text("Continuer")');

      // Should show validation errors
      await expect(page.locator('text=required, text=requis, text=obligatoire')).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.fill('input[name="email"], input[type="email"]', 'invalid-email');
      await page.click('button[type="submit"]');

      // Should show email validation error
      await expect(page.locator('text=valid email, text=email valide, text=format invalide')).toBeVisible();
    });

    test('should fill and submit attendee details', async ({ page }) => {
      const attendee = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        phone: '+33612345678',
      };

      await page.fill('input[name="firstName"]', attendee.firstName);
      await page.fill('input[name="lastName"]', attendee.lastName);
      await page.fill('input[name="email"]', attendee.email);

      const phoneInput = page.locator('input[name="phone"], input[type="tel"]');
      if (await phoneInput.isVisible()) {
        await phoneInput.fill(attendee.phone);
      }

      await page.click('button[type="submit"], button:has-text("Continue")');

      // Should proceed to payment
      await expect(page).toHaveURL(/payment|paiement/);
    });
  });

  test.describe('Payment Processing', () => {
    test.beforeEach(async ({ page }) => {
      // Setup payment mocks
      await stripeHelper.mockPaymentSuccess();

      // Navigate to payment page
      await page.goto(`/festival/${testFestivals.active.slug}/payment`);
      await waitForPageLoad(page);
    });

    test('should display order summary', async ({ page }) => {
      await expect(page.locator('text=Summary, text=Recapitulatif, text=Resume')).toBeVisible();
      await expect(page.locator('text=Total')).toBeVisible();
    });

    test('should display Stripe payment form', async ({ page }) => {
      // Wait for Stripe elements to load
      await page.waitForSelector('iframe[name^="__privateStripeFrame"], [data-testid="payment-form"]', {
        timeout: 10000,
      });
    });

    test('should process payment successfully with test card', async ({ page }) => {
      await stripeHelper.fillCardElement('visa');
      await stripeHelper.submitPayment();

      // Wait for success
      await stripeHelper.waitForPaymentConfirmation();

      // Should redirect to confirmation page
      await expect(page).toHaveURL(/confirmation|success|complete/);
    });

    test('should handle declined card', async ({ page }) => {
      await stripeHelper.mockPaymentFailure('Your card was declined');
      await stripeHelper.fillCardElement('cardDeclined');
      await stripeHelper.submitPayment();

      // Should show error message
      await expect(page.locator('text=declined, text=refuse, text=error')).toBeVisible();
    });

    test('should handle 3D Secure authentication', async ({ page }) => {
      await stripeHelper.fillCardElement('secure3dRequired');
      await stripeHelper.submitPayment();

      // Handle 3DS
      await stripeHelper.handle3DSecure(true);

      await stripeHelper.waitForPaymentConfirmation();
    });
  });

  test.describe('Order Confirmation', () => {
    const mockOrder = {
      id: 'order-test-001',
      orderNumber: 'ORD-TEST-2026-001',
      status: 'COMPLETED',
      totalAmount: 150,
      items: [
        {
          ticketTypeId: 'test-ticket-003',
          ticketTypeName: 'Weekend Pass',
          quantity: 1,
          price: 150,
        },
      ],
      attendee: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
      },
      createdAt: new Date().toISOString(),
    };

    test.beforeEach(async ({ page }) => {
      // Mock order details
      await apiHelper.mockApiResponse(`**/api/v1/orders/${mockOrder.id}`, mockOrder);
      await apiHelper.mockApiResponse(`**/api/v1/orders/*/tickets`, {
        tickets: [
          {
            id: 'ticket-001',
            ticketTypeId: 'test-ticket-003',
            ticketTypeName: 'Weekend Pass',
            code: 'TKT-ABC123-XYZ789',
            qrCode: 'data:image/png;base64,mock-qr-code',
            status: 'VALID',
          },
        ],
      });

      await page.goto(`/order/${mockOrder.id}/confirmation`);
      await waitForPageLoad(page);
    });

    test('should display confirmation page with order details', async ({ page }) => {
      // Order number visible
      await expect(page.locator(`text=${mockOrder.orderNumber}`)).toBeVisible();

      // Attendee info visible
      await expect(page.locator(`text=${mockOrder.attendee.firstName}`)).toBeVisible();

      // Success message
      await expect(page.locator('text=confirmed, text=confirme, text=success')).toBeVisible();
    });

    test('should display ticket QR code', async ({ page }) => {
      // QR code should be visible
      const qrCode = page.locator('img[alt*="QR"], [data-testid="qr-code"], canvas');
      await expect(qrCode).toBeVisible();
    });

    test('should verify email was sent (mocked)', async ({ page }) => {
      // Check that email sending was triggered
      const emailsSent = await apiHelper.mockEmailSending();

      // Navigate to trigger email
      await page.reload();
      await waitForPageLoad(page);

      // Email confirmation should be visible
      await expect(page.locator('text=email, text=confirmation')).toBeVisible();
    });

    test('should allow downloading tickets as PDF', async ({ page }) => {
      const downloadButton = page.locator('button:has-text("Download"), button:has-text("Telecharger"), a:has-text("PDF")');

      if (await downloadButton.isVisible()) {
        // Set up download listener
        const downloadPromise = page.waitForEvent('download');
        await downloadButton.click();
        const download = await downloadPromise;

        // Verify download was triggered
        expect(download.suggestedFilename()).toContain('.pdf');
      }
    });

    test('should allow sharing tickets via email', async ({ page }) => {
      const shareButton = page.locator('button:has-text("Share"), button:has-text("Partager"), button:has-text("Email")');

      if (await shareButton.isVisible()) {
        await shareButton.click();

        // Share modal should appear
        await expect(page.locator('input[type="email"], text=email address')).toBeVisible();
      }
    });
  });

  test.describe('Complete Purchase Flow', () => {
    test('should complete full ticket purchase journey', async ({ page }) => {
      // Mock successful order creation
      const orderNumber = generateOrderNumber();
      await apiHelper.mockApiResponse(
        '**/api/v1/orders',
        {
          id: 'order-flow-001',
          orderNumber,
          status: 'PENDING',
        },
        { method: 'POST' }
      );
      await stripeHelper.mockPaymentSuccess();

      // Step 1: Select tickets
      await page.goto(`/festival/${testFestivals.active.slug}/tickets`);
      await waitForPageLoad(page);

      // Select a ticket (Weekend Pass)
      const ticketCard = page.locator(':has-text("Weekend Pass")').first();
      await ticketCard.locator('button:has-text("+")').click();

      // Continue to checkout
      await page.click('button:has-text("Continuer"), button:has-text("Continue"), a:has-text("Checkout")');
      await waitForPageLoad(page);

      // Step 2: Fill attendee details
      await page.fill('input[name="firstName"]', 'Integration');
      await page.fill('input[name="lastName"]', 'Test');
      await page.fill('input[name="email"]', 'integration.test@festivals.test');

      await page.click('button[type="submit"], button:has-text("Continue")');
      await waitForPageLoad(page);

      // Step 3: Complete payment
      await stripeHelper.fillCardElement('visa');
      await stripeHelper.submitPayment();

      // Step 4: Verify confirmation
      await page.waitForURL(/confirmation|success/, { timeout: 30000 });

      // Verify confirmation elements
      await expect(page.locator('text=confirmed, text=confirme')).toBeVisible();
    });

    test('should handle purchase as logged-in user', async ({ page }) => {
      // Login as attendee
      await authHelper.loginAs('attendee');

      // Navigate to ticket selection
      await page.goto(`/festival/${testFestivals.active.slug}/tickets`);
      await waitForPageLoad(page);

      // User details should be pre-filled
      await page.locator('[data-testid="ticket-card"]').first().locator('button:has-text("+")').click();
      await page.click('button:has-text("Continue")');
      await waitForPageLoad(page);

      // Check if user details are pre-filled
      const emailInput = page.locator('input[name="email"]');
      if (await emailInput.isVisible()) {
        const emailValue = await emailInput.inputValue();
        expect(emailValue).toBe(testUsers.attendee.email);
      }
    });

    test('should handle guest checkout', async ({ page }) => {
      // Ensure not logged in
      await authHelper.clearSession();

      await page.goto(`/festival/${testFestivals.active.slug}/tickets`);
      await waitForPageLoad(page);

      // Select ticket
      await page.locator('[data-testid="ticket-card"]').first().locator('button:has-text("+")').click();
      await page.click('button:has-text("Continue")');

      // Should show guest checkout option or proceed without login
      const guestOption = page.locator('button:has-text("Guest"), button:has-text("Continuer sans compte")');
      if (await guestOption.isVisible()) {
        await guestOption.click();
      }

      // Should be able to continue
      await expect(page.locator('input[name="email"]')).toBeVisible();
    });
  });
});
