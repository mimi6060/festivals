import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

/**
 * Soak Test - Endurance testing
 *
 * Purpose: Find memory leaks and degradation over time
 * - 50 virtual users sustained
 * - 2 hours duration
 * - Monitors for performance degradation
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const apiLatency = new Trend('api_latency');
const memoryLeakIndicator = new Trend('memory_leak_indicator');
const degradationCounter = new Counter('degradation_events');
const hourlyLatency = {
  hour1: new Trend('latency_hour_1'),
  hour2: new Trend('latency_hour_2'),
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test users
const testUsers = new SharedArray('users', function () {
  return Array.from({ length: 50 }, (_, i) => ({
    email: `soaktest_user_${i}@test.festivals.app`,
    password: 'SoakTest123!',
  }));
});

export const options = {
  stages: [
    { duration: '5m', target: 50 },    // Ramp up
    { duration: '110m', target: 50 },  // Sustain for ~2 hours
    { duration: '5m', target: 0 },     // Ramp down
  ],

  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.001'],
    errors: ['rate<0.01'],
    success: ['rate>0.99'],
    degradation_events: ['count<100'],
  },

  tags: {
    test_type: 'soak',
  },
};

// Track baseline latency for degradation detection
let baselineLatency = null;
let testStartTime = null;

export function setup() {
  console.log(`Starting soak test against ${BASE_URL}`);
  console.log('This test will run for approximately 2 hours');

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  // Establish baseline
  const baselineChecks = [];
  for (let i = 0; i < 10; i++) {
    const response = http.get(`${BASE_URL}/api/v1/festivals?limit=10`);
    baselineChecks.push(response.timings.duration);
  }

  const baseline = baselineChecks.reduce((a, b) => a + b, 0) / baselineChecks.length;
  console.log(`Baseline latency established: ${baseline.toFixed(2)}ms`);

  return {
    baseUrl: BASE_URL,
    startTime: Date.now(),
    baselineLatency: baseline,
  };
}

export default function (data) {
  const baseUrl = data.baseUrl;
  const userIndex = __VU % testUsers.length;
  const user = testUsers[userIndex];
  let accessToken = null;

  const elapsedHours = (Date.now() - data.startTime) / (1000 * 60 * 60);
  const currentHour = Math.floor(elapsedHours) + 1;

  group('Soak Test Operations', () => {

    // Login
    group('Login', () => {
      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'login' },
        }
      );

      const passed = check(response, {
        'login successful': (r) => r.status === 200,
        'login has token': (r) => r.json('data.accessToken') !== undefined,
      });

      if (passed) {
        accessToken = response.json('data.accessToken');
      }

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);

      // Track hourly latency
      if (currentHour === 1) {
        hourlyLatency.hour1.add(response.timings.duration);
      } else {
        hourlyLatency.hour2.add(response.timings.duration);
      }

      // Check for degradation
      if (response.timings.duration > data.baselineLatency * 2) {
        degradationCounter.add(1);
        memoryLeakIndicator.add(response.timings.duration / data.baselineLatency);
      }
    });

    sleep(1);

    // Browse festivals
    group('Browse Festivals', () => {
      const page = Math.floor(Math.random() * 5) + 1;
      const response = http.get(`${baseUrl}/api/v1/festivals?page=${page}&limit=20`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
        tags: { name: 'list_festivals' },
      });

      const passed = check(response, {
        'festivals status is 200': (r) => r.status === 200,
        'festivals has data': (r) => r.json('data') !== undefined,
      });

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);

      if (currentHour === 1) {
        hourlyLatency.hour1.add(response.timings.duration);
      } else {
        hourlyLatency.hour2.add(response.timings.duration);
      }

      if (response.timings.duration > data.baselineLatency * 2) {
        degradationCounter.add(1);
      }
    });

    sleep(0.5);

    // View festival details
    group('Festival Details', () => {
      const festivalId = Math.floor(Math.random() * 5) + 1;
      const response = http.get(`${baseUrl}/api/v1/festivals/${festivalId}`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
        tags: { name: 'get_festival' },
      });

      const passed = check(response, {
        'festival detail ok': (r) => r.status === 200 || r.status === 404,
      });

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    sleep(0.5);

    // View lineup
    group('Lineup', () => {
      const festivalId = Math.floor(Math.random() * 5) + 1;
      const response = http.get(`${baseUrl}/api/v1/festivals/${festivalId}/lineup`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
        tags: { name: 'get_lineup' },
      });

      const passed = check(response, {
        'lineup ok': (r) => r.status === 200 || r.status === 404,
      });

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    sleep(0.5);

    // Authenticated operations
    if (accessToken) {
      // Wallet balance
      group('Wallet Balance', () => {
        const response = http.get(`${baseUrl}/api/v1/wallet/balance`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'wallet_balance' },
        });

        const passed = check(response, {
          'wallet status is 200': (r) => r.status === 200,
          'wallet has balance': (r) => r.json('data.balance') !== undefined,
        });

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);

        if (response.timings.duration > data.baselineLatency * 2) {
          degradationCounter.add(1);
        }
      });

      sleep(0.5);

      // My tickets
      group('My Tickets', () => {
        const response = http.get(`${baseUrl}/api/v1/tickets/my`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'my_tickets' },
        });

        const passed = check(response, {
          'tickets status is 200': (r) => r.status === 200,
        });

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);
      });

      sleep(0.5);

      // Transaction history
      group('Transaction History', () => {
        const response = http.get(`${baseUrl}/api/v1/wallet/transactions?limit=20`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'transactions' },
        });

        const passed = check(response, {
          'transactions ok': (r) => r.status === 200,
        });

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);
      });

      sleep(0.5);

      // Profile
      group('Profile', () => {
        const response = http.get(`${baseUrl}/api/v1/users/me`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'profile' },
        });

        const passed = check(response, {
          'profile ok': (r) => r.status === 200,
        });

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);
      });
    }

    sleep(1);
  });

  // Longer think time for soak test
  sleep(Math.random() * 3 + 2);
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`Soak test completed after ${duration.toFixed(2)} minutes`);
  console.log('Compare latency_hour_1 vs latency_hour_2 for degradation analysis');
  console.log('Check degradation_events counter for performance issues over time');
}
