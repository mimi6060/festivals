import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Wallet Load Test
 *
 * Comprehensive load testing for wallet operations:
 * 1. Wallet top-up under varying load (100, 500, 1000 concurrent users)
 * 2. Payment transaction throughput
 * 3. Balance query performance
 * 4. Measures p50, p95, p99 latencies
 */

// Custom metrics for detailed analysis
const errorRate = new Rate('errors');
const successRate = new Rate('success');

// Top-up metrics
const topUpSuccessRate = new Rate('topup_success');
const topUpLatency = new Trend('topup_latency', true);
const topUpP50 = new Trend('topup_p50', true);
const topUpP95 = new Trend('topup_p95', true);
const topUpP99 = new Trend('topup_p99', true);
const topUpCount = new Counter('topup_count');
const topUpFailures = new Counter('topup_failures');

// Payment metrics
const paymentSuccessRate = new Rate('payment_success');
const paymentLatency = new Trend('payment_latency', true);
const paymentP50 = new Trend('payment_p50', true);
const paymentP95 = new Trend('payment_p95', true);
const paymentP99 = new Trend('payment_p99', true);
const paymentCount = new Counter('payment_count');
const paymentFailures = new Counter('payment_failures');
const paymentThroughput = new Counter('payment_throughput');

// Balance check metrics
const balanceCheckSuccessRate = new Rate('balance_check_success');
const balanceCheckLatency = new Trend('balance_check_latency', true);
const balanceCheckP50 = new Trend('balance_check_p50', true);
const balanceCheckP95 = new Trend('balance_check_p95', true);
const balanceCheckP99 = new Trend('balance_check_p99', true);
const balanceCheckCount = new Counter('balance_check_count');

// Transaction history metrics
const txHistoryLatency = new Trend('tx_history_latency', true);

// System metrics
const activeWallets = new Gauge('active_wallets');
const totalVolume = new Counter('total_volume_cents');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const FESTIVAL_ID = __ENV.FESTIVAL_ID || 'fest_001';
const LOAD_PROFILE = __ENV.LOAD_PROFILE || 'standard'; // standard, high, peak

// Test users (pre-created in test environment)
const testUsers = new SharedArray('users', function () {
  return Array.from({ length: 1000 }, (_, i) => ({
    email: `walletload_user_${i}@test.festivals.app`,
    password: 'WalletLoad123!',
    userId: `user_${i}`,
    walletId: `wallet_${i}`,
  }));
});

// Test vendors/stands
const vendors = new SharedArray('vendors', function () {
  return [
    { id: 'vendor_food_1', name: 'Main Food Court', category: 'food', avgTransaction: 1500 },
    { id: 'vendor_food_2', name: 'Pizza Stand', category: 'food', avgTransaction: 1200 },
    { id: 'vendor_food_3', name: 'Burger Station', category: 'food', avgTransaction: 1400 },
    { id: 'vendor_bar_1', name: 'Main Bar', category: 'drinks', avgTransaction: 800 },
    { id: 'vendor_bar_2', name: 'VIP Lounge Bar', category: 'drinks', avgTransaction: 1500 },
    { id: 'vendor_bar_3', name: 'Beer Garden', category: 'drinks', avgTransaction: 600 },
    { id: 'vendor_merch_1', name: 'Official Merch', category: 'merchandise', avgTransaction: 3500 },
    { id: 'vendor_merch_2', name: 'Artist Merch', category: 'merchandise', avgTransaction: 2500 },
    { id: 'vendor_service_1', name: 'Lockers', category: 'services', avgTransaction: 1000 },
    { id: 'vendor_service_2', name: 'Photo Booth', category: 'services', avgTransaction: 500 },
  ];
});

// Load profiles
const loadProfiles = {
  standard: {
    stages: [
      { duration: '1m', target: 100 },   // Ramp up to 100 users
      { duration: '5m', target: 100 },   // Sustain 100 users
      { duration: '2m', target: 500 },   // Ramp to 500 users
      { duration: '5m', target: 500 },   // Sustain 500 users
      { duration: '2m', target: 100 },   // Ramp down
      { duration: '1m', target: 0 },     // Cool down
    ],
  },
  high: {
    stages: [
      { duration: '2m', target: 200 },
      { duration: '5m', target: 500 },
      { duration: '3m', target: 1000 },
      { duration: '5m', target: 1000 },
      { duration: '2m', target: 500 },
      { duration: '2m', target: 0 },
    ],
  },
  peak: {
    stages: [
      { duration: '1m', target: 500 },
      { duration: '2m', target: 1000 },
      { duration: '10m', target: 1000 },  // Sustained peak load
      { duration: '2m', target: 500 },
      { duration: '1m', target: 0 },
    ],
  },
};

export const options = {
  scenarios: {
    wallet_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: loadProfiles[LOAD_PROFILE]?.stages || loadProfiles.standard.stages,
      gracefulRampDown: '30s',
    },
  },

  thresholds: {
    // Overall HTTP metrics
    http_req_duration: ['p(50)<100', 'p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],

    // Top-up specific thresholds
    topup_latency: ['p(50)<150', 'p(95)<300', 'p(99)<500'],
    topup_success: ['rate>0.98'],

    // Payment specific thresholds (critical path)
    payment_latency: ['p(50)<80', 'p(95)<150', 'p(99)<200'],
    payment_success: ['rate>0.99'],

    // Balance check thresholds (should be very fast)
    balance_check_latency: ['p(50)<30', 'p(95)<50', 'p(99)<100'],
    balance_check_success: ['rate>0.999'],

    // Error rates
    errors: ['rate<0.02'],
    success: ['rate>0.98'],
  },

  tags: {
    test_type: 'wallet_load',
    load_profile: LOAD_PROFILE,
    festival_id: FESTIVAL_ID,
  },
};

export function setup() {
  console.log(`Starting Wallet Load Test`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Festival ID: ${FESTIVAL_ID}`);
  console.log(`Load Profile: ${LOAD_PROFILE}`);

  // Health check
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  console.log('API is healthy, starting load test...');

  return {
    baseUrl: BASE_URL,
    festivalId: FESTIVAL_ID,
    startTime: Date.now(),
  };
}

export default function (data) {
  const baseUrl = data.baseUrl;
  const festivalId = data.festivalId;
  const userIndex = __VU % testUsers.length;
  const user = testUsers[userIndex];

  let accessToken = null;
  let walletId = null;
  let currentBalance = 0;

  group('Wallet Load Test', () => {

    // Step 1: Authentication
    group('1. Login', () => {
      const startTime = Date.now();

      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'login', operation: 'auth' },
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
      console.error(`Login failed for user ${user.email}`);
      return;
    }

    sleep(0.2);

    // Step 2: Get or create wallet
    group('2. Get Wallet', () => {
      const response = http.get(
        `${baseUrl}/api/v1/me/wallets/${festivalId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          tags: { name: 'get_wallet', operation: 'wallet' },
        }
      );

      const passed = check(response, {
        'wallet retrieved': (r) => r.status === 200,
        'has wallet id': (r) => r.json('data.id') !== undefined,
      });

      if (passed) {
        walletId = response.json('data.id');
        currentBalance = response.json('data.balance') || 0;
        activeWallets.add(1);
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    if (!walletId) {
      return;
    }

    sleep(0.1);

    // Step 3: Balance Check Performance Test (multiple rapid queries)
    group('3. Balance Check Performance', () => {
      const numChecks = randomIntBetween(2, 5);

      for (let i = 0; i < numChecks; i++) {
        const startTime = Date.now();

        const response = http.get(
          `${baseUrl}/api/v1/me/wallets/${festivalId}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: 'balance_check', operation: 'balance' },
          }
        );

        const duration = Date.now() - startTime;

        const passed = check(response, {
          'balance retrieved': (r) => r.status === 200,
          'balance check < 50ms': () => duration < 50,
          'balance check < 100ms': () => duration < 100,
        });

        balanceCheckLatency.add(duration);
        balanceCheckP50.add(duration);
        balanceCheckP95.add(duration);
        balanceCheckP99.add(duration);
        balanceCheckCount.add(1);
        balanceCheckSuccessRate.add(passed);

        if (passed && response.json('data.balance') !== undefined) {
          currentBalance = response.json('data.balance');
        }

        errorRate.add(!passed);
        successRate.add(passed);

        sleep(0.05);
      }
    });

    sleep(0.2);

    // Step 4: Top-up Test
    const needsTopUp = currentBalance < 5000 || Math.random() < 0.3;
    if (needsTopUp) {
      group('4. Wallet Top-up', () => {
        const topUpAmount = randomItem([2000, 5000, 10000, 20000, 50000]); // 20-500 EUR
        const startTime = Date.now();

        const topUpPayload = JSON.stringify({
          amount: topUpAmount,
          paymentMethod: randomItem(['card', 'cash']),
          cardToken: `tok_test_${Date.now()}_${userIndex}`,
          reference: `topup_${Date.now()}`,
        });

        const response = http.post(
          `${baseUrl}/api/v1/wallets/${walletId}/topup`,
          topUpPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            tags: { name: 'topup', operation: 'topup' },
          }
        );

        const duration = Date.now() - startTime;

        const passed = check(response, {
          'topup successful': (r) => r.status === 200 || r.status === 201,
          'topup < 200ms': () => duration < 200,
          'topup < 300ms': () => duration < 300,
          'topup < 500ms': () => duration < 500,
        });

        topUpLatency.add(duration);
        topUpP50.add(duration);
        topUpP95.add(duration);
        topUpP99.add(duration);
        topUpCount.add(1);
        topUpSuccessRate.add(passed);

        if (passed) {
          const newBalance = response.json('data.newBalance') || response.json('data.balance');
          if (newBalance !== undefined) {
            currentBalance = newBalance;
          } else {
            currentBalance += topUpAmount;
          }
          totalVolume.add(topUpAmount);
        } else {
          topUpFailures.add(1);
        }

        errorRate.add(!passed);
        successRate.add(passed);
      });

      sleep(0.3);
    }

    // Step 5: Payment Transaction Tests (main throughput test)
    const numPayments = randomIntBetween(1, 5);

    for (let i = 0; i < numPayments; i++) {
      const vendor = randomItem(vendors);
      const baseAmount = vendor.avgTransaction;
      const variance = randomIntBetween(-baseAmount * 0.3, baseAmount * 0.5);
      const paymentAmount = Math.max(100, Math.round(baseAmount + variance));

      // Skip if insufficient balance
      if (currentBalance < paymentAmount) {
        break;
      }

      group(`5. Payment ${i + 1}`, () => {
        const startTime = Date.now();

        const paymentPayload = JSON.stringify({
          walletId: walletId,
          vendorId: vendor.id,
          amount: paymentAmount,
          items: [
            {
              name: `${vendor.name} Purchase`,
              quantity: randomIntBetween(1, 3),
              unitPrice: Math.round(paymentAmount / randomIntBetween(1, 3)),
            },
          ],
          reference: `pay_${Date.now()}_${i}`,
          metadata: {
            stand: vendor.name,
            category: vendor.category,
          },
        });

        const response = http.post(
          `${baseUrl}/api/v1/payments`,
          paymentPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            tags: {
              name: 'payment',
              operation: 'payment',
              vendor_category: vendor.category,
            },
          }
        );

        const duration = Date.now() - startTime;

        const passed = check(response, {
          'payment successful': (r) => r.status === 200 || r.status === 201,
          'payment < 100ms': () => duration < 100,
          'payment < 150ms': () => duration < 150,
          'payment < 200ms': () => duration < 200,
        });

        paymentLatency.add(duration);
        paymentP50.add(duration);
        paymentP95.add(duration);
        paymentP99.add(duration);
        paymentCount.add(1);
        paymentThroughput.add(1);
        paymentSuccessRate.add(passed);

        if (passed) {
          const newBalance = response.json('data.newBalance') || response.json('data.balance');
          if (newBalance !== undefined) {
            currentBalance = newBalance;
          } else {
            currentBalance -= paymentAmount;
          }
          totalVolume.add(paymentAmount);
        } else {
          paymentFailures.add(1);

          // Check for specific failure reasons
          if (response.status === 400) {
            const errorCode = response.json('code');
            if (errorCode === 'INSUFFICIENT_BALANCE') {
              // Expected, not a system error
            }
          }
        }

        errorRate.add(!passed);
        successRate.add(passed);
      });

      // Realistic delay between payments
      sleep(randomIntBetween(1, 3));
    }

    // Step 6: Transaction History Query
    group('6. Transaction History', () => {
      const startTime = Date.now();

      const response = http.get(
        `${baseUrl}/api/v1/me/wallets/${festivalId}/transactions?limit=20&page=1`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'tx_history', operation: 'history' },
        }
      );

      const duration = Date.now() - startTime;
      txHistoryLatency.add(duration);

      const passed = check(response, {
        'history retrieved': (r) => r.status === 200,
        'history has data': (r) => r.json('data') !== undefined,
        'history < 200ms': () => duration < 200,
      });

      errorRate.add(!passed);
      successRate.add(passed);
    });

    sleep(0.2);

    // Step 7: Final Balance Verification
    group('7. Final Balance Check', () => {
      const startTime = Date.now();

      const response = http.get(
        `${baseUrl}/api/v1/me/wallets/${festivalId}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'final_balance', operation: 'balance' },
        }
      );

      const duration = Date.now() - startTime;
      balanceCheckLatency.add(duration);

      const passed = check(response, {
        'final balance retrieved': (r) => r.status === 200,
      });

      errorRate.add(!passed);
      successRate.add(passed);
    });

    // Decrement active wallets gauge
    activeWallets.add(-1);
  });

  // Think time between iterations
  sleep(randomIntBetween(2, 8));
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nWallet Load Test completed in ${duration.toFixed(2)} seconds`);
  console.log('='.repeat(60));
  console.log('Key Metrics:');
  console.log('- Check topup_latency for top-up performance (target: p99 < 500ms)');
  console.log('- Check payment_latency for payment throughput (target: p99 < 200ms)');
  console.log('- Check balance_check_latency for query performance (target: p99 < 100ms)');
  console.log('- Check payment_throughput for transactions per second');
  console.log('- Check total_volume_cents for total transaction volume');
  console.log('='.repeat(60));
}

// Helper function to generate QR code for wallet
export function generateWalletQR(walletId, timestamp) {
  return `WALLET:${walletId}:${timestamp}:${Math.random().toString(36).substring(7)}`;
}
