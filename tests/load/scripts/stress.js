import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

/**
 * Stress Test - Push system to its limits
 *
 * Purpose: Find the breaking point and maximum capacity
 * - Ramps up to 500 virtual users
 * - 15 minutes total duration
 * - Aggressive load pattern
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const apiLatency = new Trend('api_latency');
const breachCount = new Counter('threshold_breaches');
const requestCount = new Counter('total_requests');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test users
const testUsers = new SharedArray('users', function () {
  return Array.from({ length: 500 }, (_, i) => ({
    email: `stresstest_user_${i}@test.festivals.app`,
    password: 'StressTest123!',
  }));
});

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Warm up
    { duration: '2m', target: 100 },   // Ramp to 100
    { duration: '2m', target: 200 },   // Ramp to 200
    { duration: '2m', target: 300 },   // Ramp to 300
    { duration: '2m', target: 400 },   // Ramp to 400
    { duration: '2m', target: 500 },   // Maximum load
    { duration: '2m', target: 500 },   // Sustain maximum
    { duration: '2m', target: 0 },     // Ramp down
  ],

  thresholds: {
    // More lenient thresholds for stress test
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.1'],
    success: ['rate>0.9'],
  },

  tags: {
    test_type: 'stress',
  },
};

export function setup() {
  console.log(`Starting stress test against ${BASE_URL}`);
  console.log('WARNING: This test will push the system to its limits');

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  return {
    baseUrl: BASE_URL,
    startTime: Date.now(),
  };
}

export default function (data) {
  const baseUrl = data.baseUrl;
  const userIndex = __VU % testUsers.length;
  const user = testUsers[userIndex];
  let accessToken = null;

  // Perform rapid requests to stress the system
  group('Stress Operations', () => {

    // Health check (should always be fast)
    group('Health', () => {
      const response = http.get(`${baseUrl}/health`, {
        tags: { name: 'health' },
      });

      requestCount.add(1);

      const passed = check(response, {
        'health is ok': (r) => r.status === 200,
      });

      if (response.timings.duration > 100) {
        breachCount.add(1);
      }

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    // Quick login attempt
    group('Login', () => {
      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'login' },
        }
      );

      requestCount.add(1);

      const passed = check(response, {
        'login successful or rate limited': (r) => r.status === 200 || r.status === 429,
      });

      if (response.status === 200) {
        accessToken = response.json('data.accessToken');
      }

      if (response.timings.duration > 300) {
        breachCount.add(1);
      }

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    sleep(0.1);

    // Rapid festival listing
    group('List Festivals', () => {
      const page = Math.floor(Math.random() * 10) + 1;
      const response = http.get(`${baseUrl}/api/v1/festivals?page=${page}&limit=20`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
        tags: { name: 'list_festivals' },
      });

      requestCount.add(1);

      const passed = check(response, {
        'festivals ok or rate limited': (r) => r.status === 200 || r.status === 429,
      });

      if (response.timings.duration > 200) {
        breachCount.add(1);
      }

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    sleep(0.1);

    // Multiple festival detail requests
    for (let i = 0; i < 3; i++) {
      group('Festival Detail', () => {
        const festivalId = Math.floor(Math.random() * 10) + 1;
        const response = http.get(`${baseUrl}/api/v1/festivals/${festivalId}`, {
          headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
          tags: { name: 'get_festival' },
        });

        requestCount.add(1);

        const passed = check(response, {
          'festival detail ok': (r) => r.status === 200 || r.status === 404 || r.status === 429,
        });

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);
      });

      sleep(0.05);
    }

    // Search stress
    group('Search', () => {
      const queries = ['music', 'rock', 'jazz', 'electronic', 'summer'];
      const query = queries[Math.floor(Math.random() * queries.length)];

      const response = http.get(`${baseUrl}/api/v1/search?q=${query}&limit=20`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
        tags: { name: 'search' },
      });

      requestCount.add(1);

      const passed = check(response, {
        'search ok or rate limited': (r) => r.status === 200 || r.status === 429,
      });

      if (response.timings.duration > 300) {
        breachCount.add(1);
      }

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    sleep(0.1);

    // Authenticated operations
    if (accessToken) {
      // Rapid wallet checks
      group('Wallet Operations', () => {
        const response = http.get(`${baseUrl}/api/v1/wallet/balance`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'wallet_balance' },
        });

        requestCount.add(1);

        const passed = check(response, {
          'wallet ok': (r) => r.status === 200 || r.status === 429,
        });

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);
      });

      sleep(0.1);

      // Ticket listing
      group('Ticket Operations', () => {
        const response = http.get(`${baseUrl}/api/v1/tickets/my`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'my_tickets' },
        });

        requestCount.add(1);

        const passed = check(response, {
          'tickets ok': (r) => r.status === 200 || r.status === 429,
        });

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);
      });
    }

    sleep(0.1);
  });

  // Minimal think time for stress
  sleep(Math.random() * 0.5);
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Stress test completed in ${duration.toFixed(2)}s`);
  console.log('Review metrics for system breaking points');
}
