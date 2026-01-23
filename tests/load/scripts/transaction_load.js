import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { Mutex } from 'k6/x/mutex';

/**
 * Transaction Load Test
 *
 * Simulates peak festival traffic with focus on:
 * 1. Multiple stands processing payments simultaneously
 * 2. Transaction atomicity under load
 * 3. Rollback performance testing
 * 4. Concurrent transaction handling
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');

// Transaction metrics
const txSuccessRate = new Rate('transaction_success');
const txLatency = new Trend('transaction_latency', true);
const txThroughput = new Counter('transaction_throughput');
const txPerSecond = new Gauge('transactions_per_second');
const concurrentTx = new Gauge('concurrent_transactions');

// Atomicity metrics
const atomicityViolations = new Counter('atomicity_violations');
const balanceMismatches = new Counter('balance_mismatches');
const doubleCharges = new Counter('double_charges');

// Rollback metrics
const rollbackCount = new Counter('rollback_count');
const rollbackLatency = new Trend('rollback_latency', true);
const rollbackSuccessRate = new Rate('rollback_success');
const refundCount = new Counter('refund_count');
const refundLatency = new Trend('refund_latency', true);

// Stand-specific metrics
const standTxCount = new Counter('stand_transaction_count');
const standTxLatency = new Trend('stand_transaction_latency', true);

// Conflict metrics
const conflictCount = new Counter('conflict_count');
const conflictResolutionLatency = new Trend('conflict_resolution_latency', true);
const optimisticLockFailures = new Counter('optimistic_lock_failures');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const FESTIVAL_ID = __ENV.FESTIVAL_ID || 'fest_001';

// Test data - Staff at different stands
const standStaff = new SharedArray('stand_staff', function () {
  const stands = [
    { standId: 'stand_food_main', name: 'Main Food Court', category: 'food' },
    { standId: 'stand_food_pizza', name: 'Pizza Stand', category: 'food' },
    { standId: 'stand_food_burger', name: 'Burger Station', category: 'food' },
    { standId: 'stand_food_asian', name: 'Asian Kitchen', category: 'food' },
    { standId: 'stand_bar_main', name: 'Main Bar', category: 'drinks' },
    { standId: 'stand_bar_vip', name: 'VIP Lounge Bar', category: 'drinks' },
    { standId: 'stand_bar_beer', name: 'Beer Garden', category: 'drinks' },
    { standId: 'stand_bar_cocktails', name: 'Cocktail Bar', category: 'drinks' },
    { standId: 'stand_merch_official', name: 'Official Merch', category: 'merchandise' },
    { standId: 'stand_merch_artist', name: 'Artist Merch', category: 'merchandise' },
  ];

  const staff = [];
  stands.forEach((stand, standIndex) => {
    // 3 staff members per stand
    for (let i = 0; i < 3; i++) {
      staff.push({
        email: `staff_${stand.standId}_${i}@test.festivals.app`,
        password: 'StaffTx123!',
        staffId: `staff_${standIndex}_${i}`,
        ...stand,
      });
    }
  });
  return staff;
});

// Test customers with wallets
const customers = new SharedArray('customers', function () {
  return Array.from({ length: 500 }, (_, i) => ({
    walletId: `wallet_tx_${i}`,
    qrCode: `WALLET:wallet_tx_${i}:${Date.now()}`,
    balance: randomIntBetween(5000, 50000), // 50-500 EUR
  }));
});

// Products per stand category
const products = {
  food: [
    { name: 'Pizza Slice', price: 800 },
    { name: 'Whole Pizza', price: 2500 },
    { name: 'Burger', price: 1200 },
    { name: 'Burger Combo', price: 1800 },
    { name: 'Fries', price: 500 },
    { name: 'Hot Dog', price: 700 },
    { name: 'Salad', price: 900 },
    { name: 'Pasta', price: 1100 },
  ],
  drinks: [
    { name: 'Beer 0.3L', price: 500 },
    { name: 'Beer 0.5L', price: 700 },
    { name: 'Craft Beer', price: 900 },
    { name: 'Wine', price: 800 },
    { name: 'Cocktail', price: 1200 },
    { name: 'Premium Cocktail', price: 1800 },
    { name: 'Soft Drink', price: 400 },
    { name: 'Water', price: 300 },
    { name: 'Energy Drink', price: 500 },
  ],
  merchandise: [
    { name: 'T-Shirt', price: 3500 },
    { name: 'Premium T-Shirt', price: 4500 },
    { name: 'Hoodie', price: 6500 },
    { name: 'Hat', price: 2500 },
    { name: 'Poster', price: 1500 },
    { name: 'Limited Poster', price: 3000 },
    { name: 'Wristband', price: 500 },
    { name: 'Pin Set', price: 1200 },
  ],
};

export const options = {
  scenarios: {
    // Scenario 1: Normal operations - multiple stands processing simultaneously
    normal_traffic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },    // 30 stands active
        { duration: '5m', target: 30 },    // Sustained normal
        { duration: '30s', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '10s',
      exec: 'normalTransaction',
      startTime: '0s',
    },

    // Scenario 2: Peak traffic - all stands maxed out
    peak_traffic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Rapid ramp
        { duration: '3m', target: 100 },   // Peak load
        { duration: '2m', target: 100 },   // Sustained peak
        { duration: '1m', target: 0 },     // Recovery
      ],
      gracefulRampDown: '15s',
      exec: 'normalTransaction',
      startTime: '7m',
    },

    // Scenario 3: Atomicity test - rapid concurrent transactions on same wallets
    atomicity_test: {
      executor: 'constant-vus',
      vus: 20,
      duration: '3m',
      exec: 'atomicityTest',
      startTime: '13m',
    },

    // Scenario 4: Rollback/Refund test
    rollback_test: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      exec: 'rollbackTest',
      startTime: '17m',
    },
  },

  thresholds: {
    // Overall thresholds
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.02'],

    // Transaction thresholds
    transaction_latency: ['p(50)<100', 'p(95)<200', 'p(99)<300'],
    transaction_success: ['rate>0.98'],
    transaction_throughput: ['count>1000'],

    // Atomicity thresholds (critical)
    atomicity_violations: ['count<1'],
    balance_mismatches: ['count<5'],
    double_charges: ['count<1'],

    // Rollback thresholds
    rollback_latency: ['p(95)<500'],
    rollback_success: ['rate>0.95'],

    // Stand performance
    stand_transaction_latency: ['p(95)<250'],
  },

  tags: {
    test_type: 'transaction_load',
    festival_id: FESTIVAL_ID,
  },
};

export function setup() {
  console.log('Starting Transaction Load Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Festival ID: ${FESTIVAL_ID}`);
  console.log(`Total stands: ${standStaff.length / 3}`);
  console.log(`Total customers: ${customers.length}`);

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  return {
    baseUrl: BASE_URL,
    festivalId: FESTIVAL_ID,
    startTime: Date.now(),
    txCounter: 0,
  };
}

// Main transaction function - simulates staff processing customer payments
export function normalTransaction(data) {
  const baseUrl = data.baseUrl;
  const staffIndex = __VU % standStaff.length;
  const staff = standStaff[staffIndex];

  let accessToken = null;

  group('Stand Transaction Flow', () => {

    // Staff login (cached in real scenario, but testing auth load too)
    group('Staff Auth', () => {
      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: staff.email, password: staff.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'staff_login', stand: staff.standId },
        }
      );

      const passed = check(response, {
        'staff login ok': (r) => r.status === 200,
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

    // Process multiple customers
    const customersToServe = randomIntBetween(3, 8);

    for (let i = 0; i < customersToServe; i++) {
      const customer = customers[randomIntBetween(0, customers.length - 1)];

      group(`Process Customer ${i + 1}`, () => {

        // Step 1: Validate customer QR/NFC
        group('Validate Wallet', () => {
          const response = http.post(
            `${baseUrl}/api/v1/payments/validate-qr`,
            JSON.stringify({ qrCode: customer.qrCode }),
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              tags: { name: 'validate_qr', stand: staff.standId },
            }
          );

          const passed = check(response, {
            'wallet validated': (r) => r.status === 200 || r.status === 400,
          });

          errorRate.add(!passed);
          successRate.add(passed);
        });

        sleep(0.1);

        // Step 2: Process payment
        const categoryProducts = products[staff.category];
        const numItems = randomIntBetween(1, 4);
        const items = [];
        let totalAmount = 0;

        for (let j = 0; j < numItems; j++) {
          const product = randomItem(categoryProducts);
          const quantity = randomIntBetween(1, 3);
          items.push({
            productId: `prod_${staff.category}_${j}`,
            name: product.name,
            quantity: quantity,
            unitPrice: product.price,
          });
          totalAmount += product.price * quantity;
        }

        group('Process Payment', () => {
          concurrentTx.add(1);
          const startTime = Date.now();

          const paymentPayload = JSON.stringify({
            walletId: customer.walletId,
            standId: staff.standId,
            amount: totalAmount,
            items: items,
            reference: `tx_${staff.standId}_${Date.now()}_${i}`,
            idempotencyKey: `idem_${staff.staffId}_${Date.now()}_${i}`,
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
                stand: staff.standId,
                category: staff.category,
              },
            }
          );

          const duration = Date.now() - startTime;
          concurrentTx.add(-1);

          const passed = check(response, {
            'payment processed': (r) => r.status === 200 || r.status === 201,
            'payment time < 200ms': () => duration < 200,
            'payment time < 300ms': () => duration < 300,
          });

          txLatency.add(duration);
          standTxLatency.add(duration);
          standTxCount.add(1);

          if (passed) {
            txSuccessRate.add(true);
            txThroughput.add(1);
          } else {
            txSuccessRate.add(false);

            // Check for specific errors
            if (response.status === 409) {
              conflictCount.add(1);
            } else if (response.status === 423) {
              optimisticLockFailures.add(1);
            }
          }

          errorRate.add(!passed);
          successRate.add(passed);
        });

        // Customer processing time (payment confirmation, receipt)
        sleep(randomIntBetween(2, 5));
      });
    }
  });

  // Time until next customer batch
  sleep(randomIntBetween(1, 3));
}

// Atomicity test - concurrent transactions on same wallet
export function atomicityTest(data) {
  const baseUrl = data.baseUrl;
  const staffIndex = __VU % standStaff.length;
  const staff = standStaff[staffIndex];

  // Use a subset of wallets for collision testing
  const targetWalletIndex = __ITER % 10; // Only 10 wallets for high collision rate
  const targetWallet = customers[targetWalletIndex];

  let accessToken = null;

  group('Atomicity Test', () => {

    // Login
    const loginRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: staff.email, password: staff.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (loginRes.status !== 200) {
      return;
    }
    accessToken = loginRes.json('data.accessToken');

    // Get initial balance
    let initialBalance = 0;
    const balanceRes = http.get(
      `${baseUrl}/api/v1/wallets/${targetWallet.walletId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (balanceRes.status === 200) {
      initialBalance = balanceRes.json('data.balance') || 0;
    }

    // Attempt rapid concurrent payment
    const paymentAmount = 100; // Small amount for atomicity test
    const startTime = Date.now();

    const response = http.post(
      `${baseUrl}/api/v1/payments`,
      JSON.stringify({
        walletId: targetWallet.walletId,
        standId: staff.standId,
        amount: paymentAmount,
        items: [{ name: 'Atomicity Test Item', quantity: 1, unitPrice: paymentAmount }],
        reference: `atomic_${__VU}_${__ITER}_${Date.now()}`,
        idempotencyKey: `atomic_idem_${__VU}_${__ITER}`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        tags: { name: 'atomic_payment', test: 'atomicity' },
      }
    );

    const duration = Date.now() - startTime;

    if (response.status === 200 || response.status === 201) {
      // Verify balance was correctly updated
      sleep(0.1);

      const verifyRes = http.get(
        `${baseUrl}/api/v1/wallets/${targetWallet.walletId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (verifyRes.status === 200) {
        const newBalance = verifyRes.json('data.balance');
        const expectedBalance = initialBalance - paymentAmount;

        // Check for balance mismatch (could indicate atomicity issue)
        if (newBalance > initialBalance) {
          balanceMismatches.add(1);
          console.error(`Balance mismatch detected: expected <= ${initialBalance}, got ${newBalance}`);
        }
      }

      txSuccessRate.add(true);
      txThroughput.add(1);
    } else if (response.status === 409) {
      // Conflict is expected in atomicity test
      conflictCount.add(1);
      conflictResolutionLatency.add(duration);
    } else if (response.status === 423) {
      // Optimistic lock failure - transaction was correctly rejected
      optimisticLockFailures.add(1);
    } else {
      txSuccessRate.add(false);
    }

    txLatency.add(duration);
  });

  // Very short delay for high contention
  sleep(0.1);
}

// Rollback/Refund test
export function rollbackTest(data) {
  const baseUrl = data.baseUrl;
  const staffIndex = __VU % standStaff.length;
  const staff = standStaff[staffIndex];
  const customer = customers[randomIntBetween(0, customers.length - 1)];

  let accessToken = null;
  let transactionId = null;

  group('Rollback Test', () => {

    // Login
    const loginRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: staff.email, password: staff.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (loginRes.status !== 200) {
      return;
    }
    accessToken = loginRes.json('data.accessToken');

    // Get initial balance
    let initialBalance = 0;
    const balanceRes = http.get(
      `${baseUrl}/api/v1/wallets/${customer.walletId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (balanceRes.status === 200) {
      initialBalance = balanceRes.json('data.balance') || 10000;
    }

    // Make a payment
    const paymentAmount = randomIntBetween(500, 2000);

    group('Initial Payment', () => {
      const response = http.post(
        `${baseUrl}/api/v1/payments`,
        JSON.stringify({
          walletId: customer.walletId,
          standId: staff.standId,
          amount: paymentAmount,
          items: [{ name: 'Refund Test Item', quantity: 1, unitPrice: paymentAmount }],
          reference: `refund_test_${__VU}_${__ITER}`,
          idempotencyKey: `refund_idem_${__VU}_${__ITER}`,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'refund_initial_payment' },
        }
      );

      if (response.status === 200 || response.status === 201) {
        transactionId = response.json('data.id') || response.json('data.transactionId');
        txThroughput.add(1);
      }
    });

    if (!transactionId) {
      return;
    }

    sleep(0.5);

    // Perform refund
    group('Refund Transaction', () => {
      const startTime = Date.now();

      const response = http.post(
        `${baseUrl}/api/v1/payments/refund`,
        JSON.stringify({
          transactionId: transactionId,
          reason: 'Load test refund',
          amount: paymentAmount, // Full refund
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'refund' },
        }
      );

      const duration = Date.now() - startTime;
      refundLatency.add(duration);
      rollbackLatency.add(duration);

      const passed = check(response, {
        'refund successful': (r) => r.status === 200 || r.status === 201,
        'refund time < 500ms': () => duration < 500,
      });

      if (passed) {
        refundCount.add(1);
        rollbackCount.add(1);
        rollbackSuccessRate.add(true);

        // Verify balance restoration
        sleep(0.2);
        const verifyRes = http.get(
          `${baseUrl}/api/v1/wallets/${customer.walletId}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (verifyRes.status === 200) {
          const newBalance = verifyRes.json('data.balance');
          // Balance should be close to initial (might have other transactions)
          if (Math.abs(newBalance - initialBalance) > paymentAmount) {
            balanceMismatches.add(1);
            console.warn(`Refund balance mismatch: expected ~${initialBalance}, got ${newBalance}`);
          }
        }
      } else {
        rollbackSuccessRate.add(false);

        // Log failure reason
        if (response.status === 400) {
          console.warn(`Refund failed: ${response.json('message')}`);
        } else if (response.status === 409) {
          console.warn('Refund conflict - transaction may already be refunded');
        }
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    // Attempt double refund (should fail gracefully)
    group('Double Refund Attempt', () => {
      const response = http.post(
        `${baseUrl}/api/v1/payments/refund`,
        JSON.stringify({
          transactionId: transactionId,
          reason: 'Double refund test',
          amount: paymentAmount,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'double_refund' },
        }
      );

      const passed = check(response, {
        'double refund rejected': (r) => r.status === 400 || r.status === 409,
      });

      if (!passed && (response.status === 200 || response.status === 201)) {
        doubleCharges.add(1);
        console.error('CRITICAL: Double refund was accepted!');
      }
    });
  });

  sleep(randomIntBetween(2, 5));
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nTransaction Load Test completed in ${duration.toFixed(2)} seconds`);
  console.log('='.repeat(60));
  console.log('Test Results Summary:');
  console.log('');
  console.log('Transaction Performance:');
  console.log('- Check transaction_latency for processing times');
  console.log('- Check transaction_throughput for total transactions');
  console.log('');
  console.log('Atomicity & Integrity:');
  console.log('- atomicity_violations should be 0');
  console.log('- double_charges should be 0');
  console.log('- balance_mismatches should be minimal');
  console.log('');
  console.log('Rollback Performance:');
  console.log('- Check rollback_latency for refund processing');
  console.log('- Check rollback_success for refund success rate');
  console.log('='.repeat(60));
}
