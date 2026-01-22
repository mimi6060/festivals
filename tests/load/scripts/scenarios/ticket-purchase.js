import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Ticket Purchase Scenario
 *
 * Simulates the complete ticket purchase flow:
 * 1. Browse festivals
 * 2. Select festival
 * 3. View ticket types
 * 4. Add to cart
 * 5. Checkout
 * 6. Payment
 * 7. Receive confirmation
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const purchaseSuccessRate = new Rate('purchase_success');
const checkoutLatency = new Trend('checkout_latency');
const paymentLatency = new Trend('payment_latency');
const totalPurchaseTime = new Trend('total_purchase_time');
const abandonedCarts = new Counter('abandoned_carts');
const completedPurchases = new Counter('completed_purchases');
const failedPayments = new Counter('failed_payments');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test data
const testUsers = new SharedArray('users', function () {
  return Array.from({ length: 100 }, (_, i) => ({
    email: `purchasetest_user_${i}@test.festivals.app`,
    password: 'PurchaseTest123!',
  }));
});

const ticketTypes = ['general', 'vip', 'backstage', 'camping', 'day_pass'];

export const options = {
  scenarios: {
    ticket_purchase: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 20 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    purchase_success: ['rate>0.95'],
    checkout_latency: ['p(95)<500'],
    payment_latency: ['p(95)<1000'],
    total_purchase_time: ['p(95)<5000'],
  },

  tags: {
    test_type: 'scenario',
    scenario: 'ticket_purchase',
  },
};

export function setup() {
  console.log('Starting ticket purchase scenario');

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('API not available');
  }

  return { baseUrl: BASE_URL };
}

export default function (data) {
  const baseUrl = data.baseUrl;
  const userIndex = __VU % testUsers.length;
  const user = testUsers[userIndex];

  const purchaseStartTime = Date.now();
  let accessToken = null;
  let selectedFestival = null;
  let selectedTicketType = null;
  let cartId = null;
  let purchaseCompleted = false;

  group('Ticket Purchase Flow', () => {

    // Step 1: Login
    group('1. Authentication', () => {
      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'purchase_login' },
        }
      );

      const passed = check(response, {
        'login successful': (r) => r.status === 200,
        'has access token': (r) => r.json('data.accessToken') !== undefined,
      });

      if (passed) {
        accessToken = response.json('data.accessToken');
      } else {
        console.error('Login failed, aborting purchase flow');
        errorRate.add(true);
        return;
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    if (!accessToken) {
      abandonedCarts.add(1);
      return;
    }

    sleep(randomIntBetween(1, 2));

    // Step 2: Browse festivals
    group('2. Browse Festivals', () => {
      const response = http.get(`${baseUrl}/api/v1/festivals?status=active&limit=20`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'browse_festivals' },
      });

      const passed = check(response, {
        'festivals loaded': (r) => r.status === 200,
        'has festival data': (r) => {
          const data = r.json('data');
          return data && data.length > 0;
        },
      });

      if (passed) {
        const festivals = response.json('data');
        selectedFestival = festivals[randomIntBetween(0, Math.min(festivals.length - 1, 4))];
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    if (!selectedFestival) {
      // Use mock festival if none returned
      selectedFestival = { id: 1 };
    }

    sleep(randomIntBetween(2, 4));

    // Step 3: View festival details
    group('3. View Festival Details', () => {
      const response = http.get(`${baseUrl}/api/v1/festivals/${selectedFestival.id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'festival_details' },
      });

      const passed = check(response, {
        'festival details loaded': (r) => r.status === 200 || r.status === 404,
      });

      errorRate.add(!passed);
      successRate.add(passed);
    });

    sleep(randomIntBetween(1, 3));

    // Step 4: View ticket types
    group('4. View Ticket Types', () => {
      const response = http.get(`${baseUrl}/api/v1/festivals/${selectedFestival.id}/tickets`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'ticket_types' },
      });

      const passed = check(response, {
        'ticket types loaded': (r) => r.status === 200 || r.status === 404,
      });

      if (passed && response.json('data')) {
        const tickets = response.json('data');
        if (tickets.length > 0) {
          selectedTicketType = tickets[randomIntBetween(0, tickets.length - 1)];
        }
      }

      // Use mock ticket type if none returned
      if (!selectedTicketType) {
        selectedTicketType = {
          id: `tt_${randomItem(ticketTypes)}`,
          price: randomIntBetween(50, 300) * 100,
        };
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    sleep(randomIntBetween(2, 5));

    // Step 5: Add to cart
    group('5. Add to Cart', () => {
      const quantity = randomIntBetween(1, 4);
      const cartPayload = JSON.stringify({
        festivalId: selectedFestival.id,
        ticketTypeId: selectedTicketType.id,
        quantity: quantity,
      });

      const response = http.post(`${baseUrl}/api/v1/cart/add`, cartPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        tags: { name: 'add_to_cart' },
      });

      const passed = check(response, {
        'added to cart': (r) => r.status === 200 || r.status === 201,
      });

      if (passed && response.json('data')) {
        cartId = response.json('data.cartId') || response.json('data.id');
      }

      // Simulate some users abandoning cart
      if (Math.random() < 0.1) {
        console.log('User abandoned cart');
        abandonedCarts.add(1);
        return;
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    if (!cartId) {
      cartId = `cart_${Date.now()}`;
    }

    sleep(randomIntBetween(1, 3));

    // Step 6: View cart
    group('6. View Cart', () => {
      const response = http.get(`${baseUrl}/api/v1/cart`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'view_cart' },
      });

      const passed = check(response, {
        'cart loaded': (r) => r.status === 200,
      });

      errorRate.add(!passed);
      successRate.add(passed);
    });

    sleep(randomIntBetween(1, 2));

    // Step 7: Checkout
    group('7. Checkout', () => {
      const checkoutStartTime = Date.now();

      const checkoutPayload = JSON.stringify({
        cartId: cartId,
        attendees: [
          {
            firstName: 'Test',
            lastName: `User${userIndex}`,
            email: user.email,
          },
        ],
      });

      const response = http.post(`${baseUrl}/api/v1/checkout`, checkoutPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        tags: { name: 'checkout' },
      });

      const checkoutDuration = Date.now() - checkoutStartTime;
      checkoutLatency.add(checkoutDuration);

      const passed = check(response, {
        'checkout initiated': (r) => r.status === 200 || r.status === 201,
        'checkout time < 500ms': () => checkoutDuration < 500,
      });

      errorRate.add(!passed);
      successRate.add(passed);
    });

    sleep(randomIntBetween(1, 2));

    // Step 8: Process payment
    group('8. Payment', () => {
      const paymentStartTime = Date.now();

      const paymentPayload = JSON.stringify({
        cartId: cartId,
        paymentMethod: 'card',
        cardToken: `tok_test_${Date.now()}`,
        billingAddress: {
          line1: '123 Test Street',
          city: 'Test City',
          postalCode: '12345',
          country: 'US',
        },
      });

      const response = http.post(`${baseUrl}/api/v1/payments/process`, paymentPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        tags: { name: 'payment' },
        timeout: '30s',
      });

      const paymentDuration = Date.now() - paymentStartTime;
      paymentLatency.add(paymentDuration);

      const passed = check(response, {
        'payment successful': (r) => r.status === 200 || r.status === 201,
        'payment time < 1000ms': () => paymentDuration < 1000,
      });

      if (passed) {
        purchaseCompleted = true;
        completedPurchases.add(1);
      } else {
        failedPayments.add(1);
      }

      errorRate.add(!passed);
      successRate.add(passed);
      purchaseSuccessRate.add(passed);
    });

    sleep(randomIntBetween(1, 2));

    // Step 9: Verify tickets
    if (purchaseCompleted) {
      group('9. Verify Tickets', () => {
        const response = http.get(`${baseUrl}/api/v1/tickets/my`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'verify_tickets' },
        });

        const passed = check(response, {
          'tickets retrieved': (r) => r.status === 200,
        });

        errorRate.add(!passed);
        successRate.add(passed);
      });
    }
  });

  // Record total purchase time
  const totalTime = Date.now() - purchaseStartTime;
  totalPurchaseTime.add(totalTime);

  // Think time before next iteration
  sleep(randomIntBetween(5, 15));
}

export function teardown(data) {
  console.log('Ticket purchase scenario completed');
  console.log('Review completed_purchases and failed_payments counters');
}
