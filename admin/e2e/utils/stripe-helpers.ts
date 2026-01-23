/**
 * Stripe test helpers for E2E tests
 * Provides utilities for handling Stripe test mode payments
 */

import { Page, Frame } from '@playwright/test';

/**
 * Stripe test card numbers
 * See: https://stripe.com/docs/testing#cards
 */
export const stripeTestCards = {
  // Successful payments
  visa: {
    number: '4242424242424242',
    expiry: '12/28',
    cvc: '123',
    name: 'Visa Test Card',
  },
  visaDebit: {
    number: '4000056655665556',
    expiry: '12/28',
    cvc: '123',
    name: 'Visa Debit Test Card',
  },
  mastercard: {
    number: '5555555555554444',
    expiry: '12/28',
    cvc: '123',
    name: 'Mastercard Test Card',
  },
  amex: {
    number: '378282246310005',
    expiry: '12/28',
    cvc: '1234',
    name: 'American Express Test Card',
  },

  // Decline scenarios
  cardDeclined: {
    number: '4000000000000002',
    expiry: '12/28',
    cvc: '123',
    name: 'Card Declined',
  },
  insufficientFunds: {
    number: '4000000000009995',
    expiry: '12/28',
    cvc: '123',
    name: 'Insufficient Funds',
  },
  lostCard: {
    number: '4000000000009987',
    expiry: '12/28',
    cvc: '123',
    name: 'Lost Card',
  },
  expiredCard: {
    number: '4000000000000069',
    expiry: '12/28',
    cvc: '123',
    name: 'Expired Card',
  },
  incorrectCvc: {
    number: '4000000000000127',
    expiry: '12/28',
    cvc: '123',
    name: 'Incorrect CVC',
  },
  processingError: {
    number: '4000000000000119',
    expiry: '12/28',
    cvc: '123',
    name: 'Processing Error',
  },

  // 3D Secure scenarios
  secure3dRequired: {
    number: '4000002500003155',
    expiry: '12/28',
    cvc: '123',
    name: '3D Secure Required',
  },
  secure3dOptional: {
    number: '4000002760003184',
    expiry: '12/28',
    cvc: '123',
    name: '3D Secure Optional',
  },

  // Specific scenarios
  chargeSucceedsAfterAttach: {
    number: '4000000000000341',
    expiry: '12/28',
    cvc: '123',
    name: 'Charge Succeeds After Attach',
  },
};

export type TestCardType = keyof typeof stripeTestCards;

/**
 * Stripe helper class for handling payment forms
 */
export class StripeHelper {
  constructor(private page: Page) {}

  /**
   * Fill Stripe card element with test card data
   */
  async fillCardElement(cardType: TestCardType = 'visa'): Promise<void> {
    const card = stripeTestCards[cardType];

    // Wait for Stripe iframe to load
    const stripeFrame = await this.getStripeFrame();

    if (stripeFrame) {
      // New Stripe Elements (single iframe)
      await stripeFrame.locator('input[name="cardnumber"]').fill(card.number);
      await stripeFrame.locator('input[name="exp-date"]').fill(card.expiry);
      await stripeFrame.locator('input[name="cvc"]').fill(card.cvc);
    } else {
      // Try separate iframe approach (older Stripe Elements)
      await this.fillSeparateElements(card);
    }
  }

  /**
   * Get Stripe iframe
   */
  private async getStripeFrame(): Promise<Frame | null> {
    try {
      // Wait for any Stripe iframe
      const frameLocator = this.page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
      await frameLocator.locator('input').first().waitFor({ timeout: 5000 });
      return this.page.frames().find((f) => f.name().startsWith('__privateStripeFrame')) || null;
    } catch {
      return null;
    }
  }

  /**
   * Fill separate Stripe Elements (card number, expiry, CVC in separate iframes)
   */
  private async fillSeparateElements(card: typeof stripeTestCards.visa): Promise<void> {
    // Card number iframe
    const cardNumberFrame = this.page.frameLocator('iframe[name*="card-number"]').first();
    await cardNumberFrame.locator('input').fill(card.number);

    // Expiry iframe
    const expiryFrame = this.page.frameLocator('iframe[name*="card-expiry"]').first();
    await expiryFrame.locator('input').fill(card.expiry);

    // CVC iframe
    const cvcFrame = this.page.frameLocator('iframe[name*="card-cvc"]').first();
    await cvcFrame.locator('input').fill(card.cvc);
  }

  /**
   * Fill Stripe Payment Element (new unified payment form)
   */
  async fillPaymentElement(cardType: TestCardType = 'visa'): Promise<void> {
    const card = stripeTestCards[cardType];

    // Wait for Payment Element iframe
    const paymentFrame = this.page.frameLocator('iframe[name^="__privateStripeFrame"]').first();

    // Select card payment method if needed
    const cardOption = paymentFrame.locator('[data-testid="card-tab"], button:has-text("Card")');
    if (await cardOption.isVisible()) {
      await cardOption.click();
    }

    // Fill card details
    await paymentFrame.locator('input[name="number"]').fill(card.number);
    await paymentFrame.locator('input[name="expiry"]').fill(card.expiry);
    await paymentFrame.locator('input[name="cvc"]').fill(card.cvc);
  }

  /**
   * Handle 3D Secure authentication
   */
  async handle3DSecure(authorize: boolean = true): Promise<void> {
    try {
      // Wait for 3DS iframe or redirect
      const frame = this.page.frameLocator('iframe[name="stripe-challenge-frame"]').first();
      await frame.locator('body').waitFor({ timeout: 10000 });

      if (authorize) {
        // Complete authentication
        await frame.locator('button#test-source-authorize-3ds').click();
      } else {
        // Fail authentication
        await frame.locator('button#test-source-fail-3ds').click();
      }
    } catch {
      // 3DS might not be triggered, which is fine for test cards
    }
  }

  /**
   * Mock Stripe Elements (for faster tests without actual Stripe loading)
   */
  async mockStripeElements(): Promise<void> {
    await this.page.addInitScript(() => {
      // Mock Stripe object
      (window as any).Stripe = () => ({
        elements: () => ({
          create: (type: string) => ({
            mount: () => {},
            unmount: () => {},
            on: () => {},
            update: () => {},
          }),
          getElement: () => null,
        }),
        confirmCardPayment: async () => ({
          paymentIntent: {
            id: 'pi_test_123',
            status: 'succeeded',
          },
        }),
        confirmPayment: async () => ({
          paymentIntent: {
            id: 'pi_test_123',
            status: 'succeeded',
          },
        }),
        createPaymentMethod: async () => ({
          paymentMethod: {
            id: 'pm_test_123',
          },
        }),
      });
    });
  }

  /**
   * Mock successful payment via API route
   */
  async mockPaymentSuccess(): Promise<void> {
    await this.page.route('**/api/v1/payments/create-payment-intent', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clientSecret: 'pi_test_secret_123',
          paymentIntentId: 'pi_test_123',
        }),
      });
    });

    await this.page.route('**/api/v1/payments/confirm', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          paymentId: 'pay_test_123',
          status: 'COMPLETED',
        }),
      });
    });
  }

  /**
   * Mock payment failure
   */
  async mockPaymentFailure(errorMessage: string = 'Payment declined'): Promise<void> {
    await this.page.route('**/api/v1/payments/confirm', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: errorMessage,
          code: 'card_declined',
        }),
      });
    });
  }

  /**
   * Fill cardholder name field (if present)
   */
  async fillCardholderName(name: string): Promise<void> {
    const nameInput = this.page.locator('input[name="cardholderName"], input[name="name"], input[placeholder*="cardholder"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill(name);
    }
  }

  /**
   * Fill billing address (if required)
   */
  async fillBillingAddress(address: {
    line1: string;
    city: string;
    postalCode: string;
    country: string;
  }): Promise<void> {
    const addressLine = this.page.locator('input[name="address"], input[name="line1"]');
    if (await addressLine.isVisible()) {
      await addressLine.fill(address.line1);
      await this.page.locator('input[name="city"]').fill(address.city);
      await this.page.locator('input[name="postalCode"], input[name="postal_code"]').fill(address.postalCode);

      const countrySelect = this.page.locator('select[name="country"]');
      if (await countrySelect.isVisible()) {
        await countrySelect.selectOption(address.country);
      }
    }
  }

  /**
   * Submit payment form
   */
  async submitPayment(): Promise<void> {
    const submitButton = this.page.locator('button[type="submit"]:has-text("Pay"), button:has-text("Confirm"), button:has-text("Payer")');
    await submitButton.click();
  }

  /**
   * Wait for payment confirmation
   */
  async waitForPaymentConfirmation(): Promise<void> {
    await this.page.waitForSelector(
      'text=Payment successful, text=Paiement reussi, [data-testid="payment-success"]',
      { timeout: 30000 }
    );
  }

  /**
   * Complete a full test payment flow
   */
  async completeTestPayment(cardType: TestCardType = 'visa'): Promise<void> {
    await this.fillCardElement(cardType);
    await this.submitPayment();
    await this.handle3DSecure(true);
    await this.waitForPaymentConfirmation();
  }
}

/**
 * Create a Stripe helper instance for a page
 */
export function createStripeHelper(page: Page): StripeHelper {
  return new StripeHelper(page);
}

/**
 * Generate a random amount for testing (between min and max in cents)
 */
export function generateTestAmount(min: number = 100, max: number = 10000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Format amount from cents to display format
 */
export function formatAmount(cents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-BE', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
