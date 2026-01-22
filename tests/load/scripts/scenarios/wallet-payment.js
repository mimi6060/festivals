import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Wallet Payment Scenario
 *
 * Simulates wallet operations at festival:
 * 1. Login
 * 2. Check wallet balance
 * 3. Top up if needed
 * 4. Make multiple purchases
 * 5. View transaction history
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const paymentSuccessRate = new Rate('payment_success');
const topUpLatency = new Trend('topup_latency');
const paymentLatency = new Trend('payment_latency');
const balanceCheckLatency = new Trend('balance_check_latency');
const successfulPayments = new Counter('successful_payments');
const failedPayments = new Counter('failed_payments');
const insufficientFunds = new Counter('insufficient_funds');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test data
const testUsers = new SharedArray('users', function () {
  return Array.from({ length: 100 }, (_, i) => ({
    email: `wallettest_user_${i}@test.festivals.app`,
    password: 'WalletTest123!',
  }));
});

const vendors = [
  { id: 'vendor_food_1', name: 'Pizza Stand', category: 'food' },
  { id: 'vendor_food_2', name: 'Burger Joint', category: 'food' },
  { id: 'vendor_drinks_1', name: 'Beer Tent', category: 'drinks' },
  { id: 'vendor_drinks_2', name: 'Cocktail Bar', category: 'drinks' },
  { id: 'vendor_merch_1', name: 'Festival Merch', category: 'merchandise' },
];

const products = {
  food: [
    { name: 'Pizza Slice', price: 800 },
    { name: 'Burger', price: 1200 },
    { name: 'Fries', price: 500 },
    { name: 'Hot Dog', price: 600 },
  ],
  drinks: [
    { name: 'Beer', price: 700 },
    { name: 'Cocktail', price: 1200 },
    { name: 'Soft Drink', price: 400 },
    { name: 'Water', price: 300 },
  ],
  merchandise: [
    { name: 'T-Shirt', price: 3500 },
    { name: 'Hat', price: 2000 },
    { name: 'Poster', price: 1500 },
  ],
};

export const options = {
  scenarios: {
    wallet_payment: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '5m', target: 80 },
        { duration: '3m', target: 80 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    payment_success: ['rate>0.98'],
    topup_latency: ['p(95)<500'],
    payment_latency: ['p(95)<200'],
    balance_check_latency: ['p(95)<100'],
  },

  tags: {
    test_type: 'scenario',
    scenario: 'wallet_payment',
  },
};

export function setup() {
  console.log('Starting wallet payment scenario');

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

  let accessToken = null;
  let walletBalance = 0;

  group('Wallet Payment Flow', () => {

    // Step 1: Login
    group('1. Authentication', () => {
      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'wallet_login' },
        }
      );

      const passed = check(response, {
        'login successful': (r) => r.status === 200,
        'has access token': (r) => r.json('data.accessToken') !== undefined,
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

    // Step 2: Check initial balance
    group('2. Check Balance', () => {
      const startTime = Date.now();

      const response = http.get(`${baseUrl}/api/v1/wallet/balance`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'check_balance' },
      });

      balanceCheckLatency.add(Date.now() - startTime);

      const passed = check(response, {
        'balance retrieved': (r) => r.status === 200,
        'has balance field': (r) => r.json('data.balance') !== undefined,
      });

      if (passed) {
        walletBalance = response.json('data.balance') || 0;
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    sleep(0.5);

    // Step 3: Top up if balance low
    const minBalanceForShopping = 5000; // 50.00
    if (walletBalance < minBalanceForShopping) {
      group('3. Top Up Wallet', () => {
        const topUpAmount = randomIntBetween(50, 200) * 100; // 50-200 euros
        const startTime = Date.now();

        const topUpPayload = JSON.stringify({
          amount: topUpAmount,
          paymentMethod: 'card',
          cardToken: `tok_test_${Date.now()}`,
        });

        const response = http.post(`${baseUrl}/api/v1/wallet/topup`, topUpPayload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'topup' },
        });

        topUpLatency.add(Date.now() - startTime);

        const passed = check(response, {
          'top up successful': (r) => r.status === 200 || r.status === 201,
          'balance updated': (r) => r.json('data.newBalance') !== undefined,
        });

        if (passed) {
          walletBalance = response.json('data.newBalance') || walletBalance + topUpAmount;
        }

        errorRate.add(!passed);
        successRate.add(passed);
      });

      sleep(1);
    }

    // Step 4: Make multiple purchases
    const numPurchases = randomIntBetween(1, 5);

    for (let i = 0; i < numPurchases; i++) {
      group(`4. Purchase ${i + 1}`, () => {
        // Select random vendor and product
        const vendor = randomItem(vendors);
        const categoryProducts = products[vendor.category];
        const product = randomItem(categoryProducts);
        const quantity = randomIntBetween(1, 3);
        const totalAmount = product.price * quantity;

        // Check if enough balance
        if (walletBalance < totalAmount) {
          insufficientFunds.add(1);
          return;
        }

        const startTime = Date.now();

        const paymentPayload = JSON.stringify({
          vendorId: vendor.id,
          amount: totalAmount,
          items: [
            {
              name: product.name,
              quantity: quantity,
              unitPrice: product.price,
            },
          ],
          nfcTag: `nfc_user_${userIndex}`,
        });

        const response = http.post(`${baseUrl}/api/v1/wallet/pay`, paymentPayload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'wallet_payment' },
        });

        paymentLatency.add(Date.now() - startTime);

        const passed = check(response, {
          'payment successful': (r) => r.status === 200 || r.status === 201,
          'payment time < 200ms': () => (Date.now() - startTime) < 200,
        });

        if (passed) {
          successfulPayments.add(1);
          walletBalance -= totalAmount;
          if (response.json('data.newBalance') !== undefined) {
            walletBalance = response.json('data.newBalance');
          }
        } else {
          failedPayments.add(1);
        }

        errorRate.add(!passed);
        successRate.add(passed);
        paymentSuccessRate.add(passed);
      });

      // Wait between purchases
      sleep(randomIntBetween(2, 10));
    }

    // Step 5: Check updated balance
    group('5. Verify Balance', () => {
      const response = http.get(`${baseUrl}/api/v1/wallet/balance`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'verify_balance' },
      });

      const passed = check(response, {
        'balance retrieved': (r) => r.status === 200,
      });

      errorRate.add(!passed);
      successRate.add(passed);
    });

    sleep(0.5);

    // Step 6: View transaction history
    group('6. Transaction History', () => {
      const response = http.get(`${baseUrl}/api/v1/wallet/transactions?limit=20`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'transactions' },
      });

      const passed = check(response, {
        'transactions retrieved': (r) => r.status === 200,
        'has transaction data': (r) => r.json('data') !== undefined,
      });

      errorRate.add(!passed);
      successRate.add(passed);
    });

    sleep(1);
  });

  // Think time before next iteration
  sleep(randomIntBetween(5, 15));
}

export function teardown(data) {
  console.log('Wallet payment scenario completed');
  console.log('Review successful_payments, failed_payments, and insufficient_funds counters');
}
