import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Peak Hour Simulation
 *
 * Simulates the most demanding periods during a festival:
 * - Meal times (lunch 12:00-14:00, dinner 18:00-20:00)
 * - Maximum concurrent users at food/drink stands
 * - Payment system under maximum load
 * - Queue management stress
 *
 * This test represents the worst-case scenario the system must handle.
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');

// Transaction metrics
const txSuccessRate = new Rate('tx_success');
const txLatency = new Trend('tx_latency', true);
const txThroughputPerSec = new Gauge('tx_per_second');
const totalTransactions = new Counter('total_transactions');
const failedTransactions = new Counter('failed_transactions');

// Queue metrics
const queueWaitTime = new Trend('queue_wait_time', true);
const queueLength = new Gauge('queue_length');
const queueTimeouts = new Counter('queue_timeouts');

// Payment metrics
const paymentP50 = new Trend('payment_p50', true);
const paymentP95 = new Trend('payment_p95', true);
const paymentP99 = new Trend('payment_p99', true);
const insufficientFunds = new Counter('insufficient_funds');
const walletFrozen = new Counter('wallet_frozen');

// Stand metrics
const standLoad = new Gauge('stand_load');
const standTxCount = new Counter('stand_tx_count');
const standAvgLatency = new Trend('stand_avg_latency', true);

// Peak metrics
const peakConcurrentUsers = new Gauge('peak_concurrent_users');
const peakTxPerSecond = new Gauge('peak_tx_per_second');
const sustainedLoadDuration = new Counter('sustained_load_duration_seconds');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const FESTIVAL_ID = __ENV.FESTIVAL_ID || 'fest_001';
const PEAK_TYPE = __ENV.PEAK_TYPE || 'dinner'; // lunch, dinner, or custom

// Peak configurations
const peakConfigs = {
  lunch: {
    maxUsers: 800,
    standDistribution: { food: 0.6, drinks: 0.3, merch: 0.1 },
    avgOrderSize: 2,
    rushDuration: '5m',
  },
  dinner: {
    maxUsers: 1000,
    standDistribution: { food: 0.5, drinks: 0.4, merch: 0.1 },
    avgOrderSize: 3,
    rushDuration: '5m',
  },
  custom: {
    maxUsers: 1200,
    standDistribution: { food: 0.3, drinks: 0.5, merch: 0.2 },
    avgOrderSize: 2,
    rushDuration: '7m',
  },
};

const peakConfig = peakConfigs[PEAK_TYPE] || peakConfigs.dinner;

// Test attendees for peak hour
const attendees = new SharedArray('attendees', function () {
  return Array.from({ length: 1500 }, (_, i) => ({
    email: `peakhour_user_${i}@test.festivals.app`,
    password: 'PeakHour123!',
    walletId: `wallet_peak_${i}`,
    balance: randomIntBetween(2000, 10000), // Pre-loaded wallets
  }));
});

// Vendor staff for peak operations
const vendorStaff = new SharedArray('vendor_staff', function () {
  const staffList = [];

  // Food stands (more staff during peak)
  for (let i = 0; i < 30; i++) {
    staffList.push({
      email: `peak_food_staff_${i}@test.festivals.app`,
      password: 'PeakStaff123!',
      standId: `stand_food_${i % 6}`,
      standName: `Food Stand ${i % 6 + 1}`,
      category: 'food',
    });
  }

  // Drink stands
  for (let i = 0; i < 25; i++) {
    staffList.push({
      email: `peak_drink_staff_${i}@test.festivals.app`,
      password: 'PeakStaff123!',
      standId: `stand_drink_${i % 5}`,
      standName: `Drink Stand ${i % 5 + 1}`,
      category: 'drinks',
    });
  }

  // Merch stands (fewer staff)
  for (let i = 0; i < 10; i++) {
    staffList.push({
      email: `peak_merch_staff_${i}@test.festivals.app`,
      password: 'PeakStaff123!',
      standId: `stand_merch_${i % 2}`,
      standName: `Merch Stand ${i % 2 + 1}`,
      category: 'merch',
    });
  }

  return staffList;
});

// Products for peak hours
const products = {
  food: [
    { name: 'Fast Burger', price: 1200, prepTime: 30 },
    { name: 'Hot Dog', price: 700, prepTime: 15 },
    { name: 'Pizza Slice', price: 800, prepTime: 20 },
    { name: 'Fries', price: 500, prepTime: 10 },
    { name: 'Combo Meal', price: 1800, prepTime: 45 },
    { name: 'Wrap', price: 1000, prepTime: 25 },
  ],
  drinks: [
    { name: 'Beer', price: 600, prepTime: 5 },
    { name: 'Craft Beer', price: 900, prepTime: 10 },
    { name: 'Wine', price: 800, prepTime: 5 },
    { name: 'Cocktail', price: 1200, prepTime: 30 },
    { name: 'Soft Drink', price: 400, prepTime: 3 },
    { name: 'Water', price: 300, prepTime: 2 },
  ],
  merch: [
    { name: 'T-Shirt', price: 3500, prepTime: 20 },
    { name: 'Hat', price: 2500, prepTime: 10 },
    { name: 'Poster', price: 1500, prepTime: 5 },
  ],
};

export const options = {
  scenarios: {
    // Pre-peak warmup
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 200 },
      ],
      gracefulRampDown: '10s',
      exec: 'customerFlow',
      startTime: '0s',
    },

    // Customer rush - main peak scenario
    customer_rush: {
      executor: 'ramping-vus',
      startVUs: 200,
      stages: [
        { duration: '1m', target: peakConfig.maxUsers / 2 },    // Initial surge
        { duration: '1m', target: peakConfig.maxUsers },        // Peak
        { duration: peakConfig.rushDuration, target: peakConfig.maxUsers }, // Sustained peak
        { duration: '2m', target: peakConfig.maxUsers / 2 },    // Decline
        { duration: '1m', target: 100 },                        // Wind down
      ],
      gracefulRampDown: '30s',
      exec: 'customerFlow',
      startTime: '1m',
    },

    // Vendor operations (POS terminals)
    vendor_operations: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '1m', target: 50 },
        { duration: peakConfig.rushDuration, target: 65 },  // All registers active
        { duration: '2m', target: 50 },
        { duration: '1m', target: 20 },
      ],
      gracefulRampDown: '15s',
      exec: 'vendorOperations',
      startTime: '0s',
    },

    // Constant arrival rate stress test
    constant_pressure: {
      executor: 'constant-arrival-rate',
      rate: 50,  // 50 transactions per second target
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 300,
      exec: 'transactionPressure',
      startTime: '3m',
    },
  },

  thresholds: {
    // Critical payment thresholds for peak hours
    payment_p50: ['p(50)<100'],
    payment_p95: ['p(50)<200'],
    payment_p99: ['p(50)<500'],

    // Transaction success rate
    tx_success: ['rate>0.95'],
    tx_latency: ['p(95)<300', 'p(99)<500'],

    // Queue management
    queue_wait_time: ['p(95)<5000'],  // 5 second max queue wait
    queue_timeouts: ['count<50'],

    // Overall performance
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],
  },

  tags: {
    test_type: 'peak_hour',
    peak_type: PEAK_TYPE,
    festival_id: FESTIVAL_ID,
  },
};

export function setup() {
  console.log('='.repeat(60));
  console.log('PEAK HOUR SIMULATION');
  console.log('='.repeat(60));
  console.log(`Peak Type: ${PEAK_TYPE}`);
  console.log(`Max Users: ${peakConfig.maxUsers}`);
  console.log(`Rush Duration: ${peakConfig.rushDuration}`);
  console.log(`Stand Distribution:`);
  console.log(`  - Food: ${peakConfig.standDistribution.food * 100}%`);
  console.log(`  - Drinks: ${peakConfig.standDistribution.drinks * 100}%`);
  console.log(`  - Merch: ${peakConfig.standDistribution.merch * 100}%`);
  console.log('='.repeat(60));

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  return {
    baseUrl: BASE_URL,
    festivalId: FESTIVAL_ID,
    startTime: Date.now(),
    peakConfig: peakConfig,
    txStartTime: Date.now(),
    txCount: 0,
  };
}

// Customer flow simulation
export function customerFlow(data) {
  const baseUrl = data.baseUrl;
  const attendeeIndex = __VU % attendees.length;
  const attendee = attendees[attendeeIndex];

  let accessToken = null;

  group('Peak Hour Customer Flow', () => {
    peakConcurrentUsers.add(1);

    // Quick auth
    const authRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: attendee.email, password: attendee.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (authRes.status !== 200) {
      peakConcurrentUsers.add(-1);
      return;
    }
    accessToken = authRes.json('data.accessToken');

    // Determine what to buy based on peak distribution
    const category = selectCategory(data.peakConfig.standDistribution);

    // Check wallet balance first
    group('Check Balance', () => {
      const balanceRes = http.get(
        `${baseUrl}/api/v1/me/wallets/${data.festivalId}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'check_balance' },
        }
      );

      if (balanceRes.status === 200) {
        const balance = balanceRes.json('data.balance') || 0;
        if (balance < 500) {
          // Need to top up
          performQuickTopup(baseUrl, data.festivalId, accessToken, attendee);
        }
      }
    });

    // Simulate queue wait time
    const simulatedQueueWait = randomIntBetween(10, 60) * 100; // 1-6 seconds
    queueWaitTime.add(simulatedQueueWait);

    // Make purchase
    group('Make Purchase', () => {
      const categoryProducts = products[category];
      const numItems = randomIntBetween(1, data.peakConfig.avgOrderSize);
      const items = [];
      let totalAmount = 0;

      for (let i = 0; i < numItems; i++) {
        const product = randomItem(categoryProducts);
        items.push({
          name: product.name,
          quantity: 1,
          unitPrice: product.price,
        });
        totalAmount += product.price;
      }

      const stand = getStandForCategory(category);
      standLoad.add(1);
      const paymentStart = Date.now();

      const paymentRes = http.post(
        `${baseUrl}/api/v1/payments`,
        JSON.stringify({
          walletId: attendee.walletId,
          standId: stand.id,
          amount: totalAmount,
          items: items,
          reference: `peak_${stand.id}_${Date.now()}`,
          idempotencyKey: `peak_idem_${__VU}_${__ITER}`,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: {
            name: 'peak_payment',
            category: category,
            stand: stand.id,
          },
        }
      );

      const paymentDuration = Date.now() - paymentStart;
      standLoad.add(-1);

      // Track payment latency percentiles
      paymentP50.add(paymentDuration);
      paymentP95.add(paymentDuration);
      paymentP99.add(paymentDuration);
      txLatency.add(paymentDuration);
      standAvgLatency.add(paymentDuration);

      const passed = check(paymentRes, {
        'payment successful': (r) => r.status === 200 || r.status === 201,
        'payment < 200ms': () => paymentDuration < 200,
        'payment < 500ms': () => paymentDuration < 500,
      });

      totalTransactions.add(1);
      standTxCount.add(1);

      if (passed) {
        txSuccessRate.add(true);
      } else {
        txSuccessRate.add(false);
        failedTransactions.add(1);

        // Track specific failure reasons
        if (paymentRes.status === 400) {
          const errorCode = paymentRes.json('code');
          if (errorCode === 'INSUFFICIENT_BALANCE') {
            insufficientFunds.add(1);
          } else if (errorCode === 'WALLET_FROZEN') {
            walletFrozen.add(1);
          }
        } else if (paymentRes.status === 408 || paymentRes.status === 504) {
          queueTimeouts.add(1);
        }
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    peakConcurrentUsers.add(-1);
  });

  // Minimal think time during peak
  sleep(randomIntBetween(1, 3));
}

// Vendor POS operations
export function vendorOperations(data) {
  const baseUrl = data.baseUrl;
  const staffIndex = __VU % vendorStaff.length;
  const staffMember = vendorStaff[staffIndex];

  let accessToken = null;

  group('Vendor POS Operations', () => {

    // Staff auth
    const authRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: staffMember.email, password: staffMember.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (authRes.status !== 200) return;
    accessToken = authRes.json('data.accessToken');

    // Process customers at this stand
    const customersInQueue = randomIntBetween(3, 10);

    for (let i = 0; i < customersInQueue; i++) {
      const customer = attendees[randomIntBetween(0, attendees.length - 1)];
      const categoryProducts = products[staffMember.category];

      // Build order
      const numItems = randomIntBetween(1, 3);
      const items = [];
      let totalAmount = 0;

      for (let j = 0; j < numItems; j++) {
        const product = randomItem(categoryProducts);
        items.push({
          name: product.name,
          quantity: 1,
          unitPrice: product.price,
        });
        totalAmount += product.price;
      }

      group(`Process Customer ${i + 1}`, () => {
        queueLength.add(customersInQueue - i);
        const startTime = Date.now();

        // Validate customer QR/NFC
        const validateRes = http.post(
          `${baseUrl}/api/v1/payments/validate-qr`,
          JSON.stringify({ qrCode: `WALLET:${customer.walletId}:${Date.now()}` }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            tags: { name: 'validate_customer' },
          }
        );

        // Process payment
        const paymentRes = http.post(
          `${baseUrl}/api/v1/payments`,
          JSON.stringify({
            walletId: customer.walletId,
            standId: staffMember.standId,
            amount: totalAmount,
            items: items,
            reference: `vendor_${staffMember.standId}_${Date.now()}`,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            tags: {
              name: 'vendor_payment',
              stand: staffMember.standId,
              category: staffMember.category,
            },
          }
        );

        const duration = Date.now() - startTime;
        txLatency.add(duration);
        standAvgLatency.add(duration);
        standTxCount.add(1);
        totalTransactions.add(1);

        const passed = (paymentRes.status === 200 || paymentRes.status === 201);
        if (passed) {
          txSuccessRate.add(true);
        } else {
          txSuccessRate.add(false);
          failedTransactions.add(1);
        }

        errorRate.add(!passed);
        successRate.add(passed);
      });

      // Time to process order (simulated prep time)
      sleep(randomIntBetween(2, 8));
    }
  });

  // Brief pause before next batch
  sleep(randomIntBetween(1, 3));
}

// Constant transaction pressure
export function transactionPressure(data) {
  const baseUrl = data.baseUrl;
  const attendee = attendees[randomIntBetween(0, attendees.length - 1)];
  const category = selectCategory(data.peakConfig.standDistribution);

  // Quick auth using cached token concept
  const authRes = http.post(
    `${baseUrl}/api/v1/auth/login`,
    JSON.stringify({ email: attendee.email, password: attendee.password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (authRes.status !== 200) return;
  const accessToken = authRes.json('data.accessToken');

  // Execute transaction
  const product = randomItem(products[category]);
  const stand = getStandForCategory(category);

  const startTime = Date.now();

  const response = http.post(
    `${baseUrl}/api/v1/payments`,
    JSON.stringify({
      walletId: attendee.walletId,
      standId: stand.id,
      amount: product.price,
      items: [{ name: product.name, quantity: 1, unitPrice: product.price }],
      reference: `pressure_${Date.now()}`,
      idempotencyKey: `pressure_${__VU}_${__ITER}`,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      tags: { name: 'pressure_payment', category: category },
    }
  );

  const duration = Date.now() - startTime;
  txLatency.add(duration);
  paymentP50.add(duration);
  paymentP95.add(duration);
  paymentP99.add(duration);
  totalTransactions.add(1);

  // Track TPS
  const elapsed = (Date.now() - data.txStartTime) / 1000;
  if (elapsed > 0) {
    txThroughputPerSec.add(totalTransactions / elapsed);
  }

  const passed = (response.status === 200 || response.status === 201);
  txSuccessRate.add(passed);
  if (!passed) failedTransactions.add(1);

  errorRate.add(!passed);
  successRate.add(passed);

  // No sleep - constant pressure
}

// Helper functions
function selectCategory(distribution) {
  const rand = Math.random();
  let cumulative = 0;

  for (const [category, weight] of Object.entries(distribution)) {
    cumulative += weight;
    if (rand < cumulative) {
      return category;
    }
  }
  return 'food';
}

function getStandForCategory(category) {
  const stands = {
    food: [
      { id: 'stand_food_0', name: 'Main Food' },
      { id: 'stand_food_1', name: 'Pizza' },
      { id: 'stand_food_2', name: 'Burgers' },
      { id: 'stand_food_3', name: 'Fast Food' },
      { id: 'stand_food_4', name: 'Wraps' },
      { id: 'stand_food_5', name: 'Snacks' },
    ],
    drinks: [
      { id: 'stand_drink_0', name: 'Main Bar' },
      { id: 'stand_drink_1', name: 'Beer Tent' },
      { id: 'stand_drink_2', name: 'Cocktails' },
      { id: 'stand_drink_3', name: 'Wine Bar' },
      { id: 'stand_drink_4', name: 'Soft Drinks' },
    ],
    merch: [
      { id: 'stand_merch_0', name: 'Official Merch' },
      { id: 'stand_merch_1', name: 'Artist Merch' },
    ],
  };

  return randomItem(stands[category] || stands.food);
}

function performQuickTopup(baseUrl, festivalId, accessToken, attendee) {
  const amount = randomItem([2000, 5000, 10000]);

  http.post(
    `${baseUrl}/api/v1/wallets/${attendee.walletId}/topup`,
    JSON.stringify({
      amount: amount,
      paymentMethod: 'card',
      cardToken: `tok_peak_${Date.now()}`,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      tags: { name: 'quick_topup' },
    }
  );
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  const avgTPS = totalTransactions / duration;

  console.log('\n' + '='.repeat(70));
  console.log('PEAK HOUR SIMULATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`Duration: ${(duration / 60).toFixed(1)} minutes`);
  console.log(`Peak Type: ${PEAK_TYPE}`);
  console.log('');
  console.log('Performance Results:');
  console.log('- Check payment_p50, payment_p95, payment_p99 for latency distribution');
  console.log('- Check tx_success for transaction success rate (target: >95%)');
  console.log('- Check tx_latency for overall transaction timing');
  console.log('');
  console.log('Capacity Results:');
  console.log('- Check peak_concurrent_users for max simultaneous users');
  console.log('- Check tx_per_second for throughput');
  console.log('- Check total_transactions for volume');
  console.log('');
  console.log('Queue Management:');
  console.log('- Check queue_wait_time for customer queue experience');
  console.log('- Check queue_timeouts for queue failures');
  console.log('');
  console.log('Failure Analysis:');
  console.log('- Check insufficient_funds for balance issues');
  console.log('- Check failed_transactions for overall failures');
  console.log('='.repeat(70));
}
