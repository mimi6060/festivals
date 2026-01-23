/**
 * API helpers for E2E tests
 * Provides utilities for seeding data, mocking API responses, and cleanup
 */

import { Page, Route, Request } from '@playwright/test';
import {
  testFestivals,
  testStands,
  testTicketTypes,
  testWallets,
  TestFestival,
  TestStand,
  TestTicketType,
  TestWallet,
} from '../fixtures/test-festival';
import { allProducts, TestProduct } from '../fixtures/test-products';
import { testUsers, TestUser } from '../fixtures/test-users';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/api/v1';

/**
 * API Helper class for managing test data and API mocking
 */
export class ApiHelper {
  constructor(private page: Page) {}

  /**
   * Seed initial data via API calls
   */
  async seedTestData(): Promise<void> {
    // In a real implementation, this would call the API to seed data
    // For now, we set up localStorage with mock data
    await this.page.evaluate(
      ({ festivals, stands, tickets, products, wallets }) => {
        // Festival store
        localStorage.setItem(
          'festival-storage',
          JSON.stringify({
            state: {
              festivals: Object.values(festivals),
              currentFestival: festivals.active,
            },
            version: 0,
          })
        );

        // Stands store
        localStorage.setItem(
          'stands-storage',
          JSON.stringify({
            state: { stands },
            version: 0,
          })
        );

        // Tickets store
        localStorage.setItem(
          'tickets-storage',
          JSON.stringify({
            state: { ticketTypes: tickets },
            version: 0,
          })
        );

        // Products store
        localStorage.setItem(
          'products-storage',
          JSON.stringify({
            state: { products },
            version: 0,
          })
        );

        // Wallets store
        localStorage.setItem(
          'wallets-storage',
          JSON.stringify({
            state: { wallets },
            version: 0,
          })
        );
      },
      {
        festivals: testFestivals,
        stands: testStands,
        tickets: testTicketTypes,
        products: allProducts,
        wallets: testWallets,
      }
    );
  }

  /**
   * Clean up test data
   */
  async cleanupTestData(): Promise<void> {
    await this.page.evaluate(() => {
      // Remove test-specific data from localStorage
      const keysToRemove = [
        'festival-storage',
        'stands-storage',
        'tickets-storage',
        'products-storage',
        'wallets-storage',
        'cart-storage',
        'order-storage',
      ];
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    });
  }

  /**
   * Mock a specific API endpoint
   */
  async mockApiResponse(
    urlPattern: string | RegExp,
    response: object,
    options: { status?: number; delay?: number; method?: string } = {}
  ): Promise<void> {
    const { status = 200, delay = 0, method } = options;

    await this.page.route(urlPattern, async (route: Route, request: Request) => {
      if (method && request.method() !== method) {
        await route.continue();
        return;
      }

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * Mock API error response
   */
  async mockApiError(
    urlPattern: string | RegExp,
    statusCode: number,
    errorMessage: string
  ): Promise<void> {
    await this.page.route(urlPattern, async (route: Route) => {
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          error: errorMessage,
          statusCode,
        }),
      });
    });
  }

  /**
   * Set up standard API mocks for common endpoints
   */
  async setupStandardMocks(): Promise<void> {
    // Festivals
    await this.mockApiResponse('**/api/v1/festivals', {
      festivals: Object.values(testFestivals),
      total: 3,
    });

    await this.mockApiResponse('**/api/v1/festivals/*', testFestivals.active);

    // Ticket types
    await this.mockApiResponse('**/api/v1/festivals/*/ticket-types', {
      ticketTypes: testTicketTypes,
    });

    // Stands
    await this.mockApiResponse('**/api/v1/festivals/*/stands', {
      stands: testStands,
    });

    // Products
    await this.mockApiResponse('**/api/v1/stands/*/products', {
      products: allProducts,
    });

    // Wallets
    await this.mockApiResponse('**/api/v1/wallets/**', {
      wallets: testWallets,
    });
  }

  /**
   * Mock successful order creation
   */
  async mockOrderCreation(orderId: string = 'test-order-001'): Promise<void> {
    await this.mockApiResponse(
      '**/api/v1/orders',
      {
        id: orderId,
        orderNumber: `ORD-${Date.now()}`,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      },
      { method: 'POST' }
    );
  }

  /**
   * Mock successful payment
   */
  async mockPaymentSuccess(paymentId: string = 'test-payment-001'): Promise<void> {
    await this.mockApiResponse(
      '**/api/v1/payments',
      {
        id: paymentId,
        status: 'COMPLETED',
        processedAt: new Date().toISOString(),
      },
      { method: 'POST' }
    );
  }

  /**
   * Mock wallet top-up
   */
  async mockWalletTopUp(amount: number, newBalance: number): Promise<void> {
    await this.mockApiResponse(
      '**/api/v1/wallets/*/topup',
      {
        success: true,
        transaction: {
          id: `txn-${Date.now()}`,
          type: 'TOP_UP',
          amount,
          balanceAfter: newBalance,
          createdAt: new Date().toISOString(),
        },
      },
      { method: 'POST' }
    );
  }

  /**
   * Mock refund request creation
   */
  async mockRefundRequest(refundId: string = 'test-refund-001'): Promise<void> {
    await this.mockApiResponse(
      '**/api/v1/refunds',
      {
        id: refundId,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      },
      { method: 'POST' }
    );
  }

  /**
   * Mock refund approval
   */
  async mockRefundApproval(refundId: string): Promise<void> {
    await this.mockApiResponse(
      `**/api/v1/refunds/${refundId}/approve`,
      {
        id: refundId,
        status: 'APPROVED',
        approvedAt: new Date().toISOString(),
      },
      { method: 'POST' }
    );
  }

  /**
   * Mock email sending
   */
  async mockEmailSending(): Promise<{ sent: boolean; to: string }[]> {
    const sentEmails: { sent: boolean; to: string }[] = [];

    await this.page.route('**/api/v1/emails/**', async (route: Route, request: Request) => {
      const body = request.postDataJSON();
      sentEmails.push({ sent: true, to: body?.to || 'unknown' });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sent: true, messageId: `msg-${Date.now()}` }),
      });
    });

    return sentEmails;
  }

  /**
   * Wait for an API request to be made
   */
  async waitForRequest(urlPattern: string | RegExp): Promise<Request> {
    return await this.page.waitForRequest(urlPattern);
  }

  /**
   * Wait for an API response
   */
  async waitForResponse(urlPattern: string | RegExp): Promise<any> {
    const response = await this.page.waitForResponse(urlPattern);
    return await response.json();
  }

  /**
   * Intercept and capture API requests
   */
  async captureRequests(urlPattern: string | RegExp): Promise<Request[]> {
    const requests: Request[] = [];

    await this.page.route(urlPattern, async (route: Route, request: Request) => {
      requests.push(request);
      await route.continue();
    });

    return requests;
  }

  /**
   * Create a test festival via mock API
   */
  async createFestival(festival: Partial<TestFestival>): Promise<TestFestival> {
    const newFestival: TestFestival = {
      id: `festival-${Date.now()}`,
      name: 'New Test Festival',
      slug: 'new-test-festival',
      description: 'A new festival for testing',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      location: 'Test City, Test Country',
      timezone: 'Europe/Brussels',
      currencyName: 'TestCoins',
      exchangeRate: 0.1,
      status: 'DRAFT',
      settings: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...festival,
    };

    await this.mockApiResponse(
      '**/api/v1/festivals',
      newFestival,
      { method: 'POST' }
    );

    return newFestival;
  }

  /**
   * Create a test stand via mock API
   */
  async createStand(stand: Partial<TestStand>): Promise<TestStand> {
    const newStand: TestStand = {
      id: `stand-${Date.now()}`,
      festivalId: 'test-festival-001',
      name: 'New Test Stand',
      description: 'A new stand for testing',
      category: 'BAR',
      isActive: true,
      location: { lat: 50.8503, lng: 4.3517, zone: 'Test Zone' },
      settings: {
        acceptsOnlyTokens: true,
        requiresPin: false,
        allowsNegativeBalance: false,
        maxTransactionAmount: null,
      },
      ...stand,
    };

    await this.mockApiResponse(
      '**/api/v1/festivals/*/stands',
      newStand,
      { method: 'POST' }
    );

    return newStand;
  }

  /**
   * Update festival store directly in localStorage
   */
  async updateFestivalStore(festivals: TestFestival[]): Promise<void> {
    await this.page.evaluate((festivalData) => {
      localStorage.setItem(
        'festival-storage',
        JSON.stringify({
          state: {
            festivals: festivalData,
            currentFestival: festivalData[0] || null,
          },
          version: 0,
        })
      );
    }, festivals);
  }
}

/**
 * Create an API helper instance for a page
 */
export function createApiHelper(page: Page): ApiHelper {
  return new ApiHelper(page);
}

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generate a random order number
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

/**
 * Format currency for comparison
 */
export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-BE', {
    style: 'currency',
    currency,
  }).format(amount);
}
