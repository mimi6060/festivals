import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Mixed Realistic Scenario
 *
 * Simulates realistic festival traffic with weighted user behaviors:
 * - 30% Browse festivals
 * - 20% View lineup
 * - 15% Purchase tickets
 * - 10% Top up wallet
 * - 15% Make payments
 * - 5% View profile
 * - 5% Search content
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const actionLatency = new Trend('action_latency');
const browseLatency = new Trend('browse_latency');
const purchaseLatency = new Trend('purchase_latency');
const paymentLatency = new Trend('payment_latency');
const searchLatency = new Trend('search_latency');

const actionCounts = {
  browse: new Counter('action_browse'),
  lineup: new Counter('action_lineup'),
  purchase: new Counter('action_purchase'),
  topup: new Counter('action_topup'),
  payment: new Counter('action_payment'),
  profile: new Counter('action_profile'),
  search: new Counter('action_search'),
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test data
const testUsers = new SharedArray('users', function () {
  return Array.from({ length: 200 }, (_, i) => ({
    email: `mixedtest_user_${i}@test.festivals.app`,
    password: 'MixedTest123!',
  }));
});

// User behavior weights (total = 100)
const BEHAVIORS = {
  browseFestivals: { weight: 30, action: 'browse' },
  viewLineup: { weight: 20, action: 'lineup' },
  purchaseTicket: { weight: 15, action: 'purchase' },
  walletTopUp: { weight: 10, action: 'topup' },
  walletPayment: { weight: 15, action: 'payment' },
  viewProfile: { weight: 5, action: 'profile' },
  searchContent: { weight: 5, action: 'search' },
};

export const options = {
  scenarios: {
    // Anonymous users (browsing only)
    anonymous_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 30 },
        { duration: '5m', target: 50 },
        { duration: '3m', target: 30 },
        { duration: '2m', target: 0 },
      ],
      exec: 'anonymousUser',
      tags: { user_type: 'anonymous' },
    },
    // Authenticated users (full functionality)
    authenticated_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 80 },
        { duration: '3m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      exec: 'authenticatedUser',
      tags: { user_type: 'authenticated' },
    },
    // At-festival users (payments and scans)
    at_festival_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 40 },
        { duration: '3m', target: 20 },
        { duration: '2m', target: 0 },
      ],
      exec: 'atFestivalUser',
      tags: { user_type: 'at_festival' },
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.02'],
    success: ['rate>0.98'],
    browse_latency: ['p(95)<150'],
    purchase_latency: ['p(95)<500'],
    payment_latency: ['p(95)<200'],
    search_latency: ['p(95)<300'],
  },

  tags: {
    test_type: 'scenario',
    scenario: 'mixed',
  },
};

function selectBehavior() {
  let random = randomIntBetween(1, 100);
  for (const [name, config] of Object.entries(BEHAVIORS)) {
    random -= config.weight;
    if (random <= 0) {
      return { name, ...config };
    }
  }
  return { name: 'browseFestivals', ...BEHAVIORS.browseFestivals };
}

export function setup() {
  console.log('Starting mixed realistic scenario');

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('API not available');
  }

  return { baseUrl: BASE_URL };
}

// Anonymous user flow (browsing only)
export function anonymousUser(data) {
  const baseUrl = data.baseUrl;

  group('Anonymous User Session', () => {

    // Browse festivals
    group('Browse Festivals', () => {
      const startTime = Date.now();
      const page = randomIntBetween(1, 5);

      const response = http.get(`${baseUrl}/api/v1/festivals?page=${page}&limit=20`, {
        tags: { name: 'anon_browse' },
      });

      browseLatency.add(Date.now() - startTime);
      actionLatency.add(Date.now() - startTime);
      actionCounts.browse.add(1);

      const passed = check(response, {
        'festivals loaded': (r) => r.status === 200,
      });

      errorRate.add(!passed);
      successRate.add(passed);
    });

    sleep(randomIntBetween(1, 3));

    // View festival details
    group('View Festival', () => {
      const festivalId = randomIntBetween(1, 10);
      const response = http.get(`${baseUrl}/api/v1/festivals/${festivalId}`, {
        tags: { name: 'anon_festival' },
      });

      const passed = check(response, {
        'festival detail ok': (r) => r.status === 200 || r.status === 404,
      });

      errorRate.add(!passed);
      successRate.add(passed);
    });

    sleep(randomIntBetween(1, 2));

    // View lineup (50% chance)
    if (Math.random() < 0.5) {
      group('View Lineup', () => {
        const festivalId = randomIntBetween(1, 10);
        const response = http.get(`${baseUrl}/api/v1/festivals/${festivalId}/lineup`, {
          tags: { name: 'anon_lineup' },
        });

        actionCounts.lineup.add(1);

        const passed = check(response, {
          'lineup ok': (r) => r.status === 200 || r.status === 404,
        });

        errorRate.add(!passed);
        successRate.add(passed);
      });
    }

    sleep(randomIntBetween(1, 2));

    // Search (30% chance)
    if (Math.random() < 0.3) {
      group('Search', () => {
        const startTime = Date.now();
        const queries = ['rock', 'jazz', 'electronic', 'summer', 'music'];
        const query = randomItem(queries);

        const response = http.get(`${baseUrl}/api/v1/search?q=${query}&limit=10`, {
          tags: { name: 'anon_search' },
        });

        searchLatency.add(Date.now() - startTime);
        actionCounts.search.add(1);

        const passed = check(response, {
          'search ok': (r) => r.status === 200,
        });

        errorRate.add(!passed);
        successRate.add(passed);
      });
    }
  });

  sleep(randomIntBetween(3, 8));
}

// Authenticated user flow (full functionality)
export function authenticatedUser(data) {
  const baseUrl = data.baseUrl;
  const userIndex = __VU % testUsers.length;
  const user = testUsers[userIndex];

  let accessToken = null;

  group('Authenticated User Session', () => {

    // Login
    group('Login', () => {
      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'auth_login' },
        }
      );

      const passed = check(response, {
        'login successful': (r) => r.status === 200,
      });

      if (passed) {
        accessToken = response.json('data.accessToken');
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    if (!accessToken) {
      return;
    }

    sleep(1);

    // Select and perform action based on weights
    const behavior = selectBehavior();

    switch (behavior.name) {
      case 'browseFestivals':
        group('Browse Festivals', () => {
          const startTime = Date.now();
          const response = http.get(`${baseUrl}/api/v1/festivals?limit=20`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: 'auth_browse' },
          });

          browseLatency.add(Date.now() - startTime);
          actionCounts.browse.add(1);

          const passed = check(response, {
            'festivals loaded': (r) => r.status === 200,
          });

          errorRate.add(!passed);
          successRate.add(passed);
        });
        break;

      case 'viewLineup':
        group('View Lineup', () => {
          const festivalId = randomIntBetween(1, 10);
          const response = http.get(`${baseUrl}/api/v1/festivals/${festivalId}/lineup`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: 'auth_lineup' },
          });

          actionCounts.lineup.add(1);

          const passed = check(response, {
            'lineup ok': (r) => r.status === 200 || r.status === 404,
          });

          errorRate.add(!passed);
          successRate.add(passed);
        });
        break;

      case 'purchaseTicket':
        group('Purchase Ticket', () => {
          const startTime = Date.now();

          // View ticket types
          const ticketsResp = http.get(`${baseUrl}/api/v1/festivals/1/tickets`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: 'view_tickets' },
          });

          sleep(0.5);

          // Add to cart
          const cartResp = http.post(
            `${baseUrl}/api/v1/cart/add`,
            JSON.stringify({
              festivalId: 1,
              ticketTypeId: 'tt_general',
              quantity: randomIntBetween(1, 4),
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              tags: { name: 'add_cart' },
            }
          );

          purchaseLatency.add(Date.now() - startTime);
          actionCounts.purchase.add(1);

          const passed = check(cartResp, {
            'cart updated': (r) => r.status === 200 || r.status === 201,
          });

          errorRate.add(!passed);
          successRate.add(passed);
        });
        break;

      case 'walletTopUp':
        group('Top Up Wallet', () => {
          const response = http.post(
            `${baseUrl}/api/v1/wallet/topup`,
            JSON.stringify({
              amount: randomIntBetween(20, 100) * 100,
              paymentMethod: 'card',
              cardToken: `tok_test_${Date.now()}`,
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              tags: { name: 'topup' },
            }
          );

          actionCounts.topup.add(1);

          const passed = check(response, {
            'topup ok': (r) => r.status === 200 || r.status === 201,
          });

          errorRate.add(!passed);
          successRate.add(passed);
        });
        break;

      case 'viewProfile':
        group('View Profile', () => {
          const response = http.get(`${baseUrl}/api/v1/users/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: 'profile' },
          });

          actionCounts.profile.add(1);

          const passed = check(response, {
            'profile ok': (r) => r.status === 200,
          });

          errorRate.add(!passed);
          successRate.add(passed);
        });
        break;

      case 'searchContent':
        group('Search', () => {
          const startTime = Date.now();
          const queries = ['rock', 'jazz', 'electronic', 'summer', 'music'];
          const query = randomItem(queries);

          const response = http.get(`${baseUrl}/api/v1/search?q=${query}&limit=10`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: 'auth_search' },
          });

          searchLatency.add(Date.now() - startTime);
          actionCounts.search.add(1);

          const passed = check(response, {
            'search ok': (r) => r.status === 200,
          });

          errorRate.add(!passed);
          successRate.add(passed);
        });
        break;
    }
  });

  sleep(randomIntBetween(2, 6));
}

// At-festival user flow (mostly payments)
export function atFestivalUser(data) {
  const baseUrl = data.baseUrl;
  const userIndex = __VU % testUsers.length;
  const user = testUsers[userIndex];

  let accessToken = null;

  group('At-Festival User Session', () => {

    // Login
    group('Login', () => {
      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'fest_login' },
        }
      );

      const passed = check(response, {
        'login successful': (r) => r.status === 200,
      });

      if (passed) {
        accessToken = response.json('data.accessToken');
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    if (!accessToken) {
      return;
    }

    sleep(0.5);

    // Check balance
    group('Check Balance', () => {
      const response = http.get(`${baseUrl}/api/v1/wallet/balance`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'fest_balance' },
      });

      const passed = check(response, {
        'balance ok': (r) => r.status === 200,
      });

      errorRate.add(!passed);
      successRate.add(passed);
    });

    sleep(0.5);

    // Make payment
    group('Make Payment', () => {
      const startTime = Date.now();

      const response = http.post(
        `${baseUrl}/api/v1/wallet/pay`,
        JSON.stringify({
          vendorId: `vendor_${randomIntBetween(1, 10)}`,
          amount: randomIntBetween(5, 30) * 100,
          items: [{ name: 'Item', quantity: 1, unitPrice: randomIntBetween(5, 30) * 100 }],
          nfcTag: `nfc_${userIndex}`,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'fest_payment' },
        }
      );

      paymentLatency.add(Date.now() - startTime);
      actionCounts.payment.add(1);

      const passed = check(response, {
        'payment ok': (r) => r.status === 200 || r.status === 201,
      });

      errorRate.add(!passed);
      successRate.add(passed);
    });

    // View my tickets (10% chance)
    if (Math.random() < 0.1) {
      group('View Tickets', () => {
        const response = http.get(`${baseUrl}/api/v1/tickets/my`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'fest_tickets' },
        });

        const passed = check(response, {
          'tickets ok': (r) => r.status === 200,
        });

        errorRate.add(!passed);
        successRate.add(passed);
      });
    }
  });

  // Shorter think time for at-festival users
  sleep(randomIntBetween(3, 10));
}

export function teardown(data) {
  console.log('Mixed scenario completed');
  console.log('Review action_* counters for behavior distribution');
}
