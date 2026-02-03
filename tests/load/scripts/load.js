import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

/**
 * Load Test - Standard load testing
 *
 * Purpose: Verify system performance under normal expected load
 * - Ramps up to 100 virtual users
 * - 10 minutes total duration
 * - Mixed operations simulating real traffic
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const apiLatency = new Trend('api_latency');
const loginLatency = new Trend('login_latency');
const festivalLatency = new Trend('festival_latency');
const ticketLatency = new Trend('ticket_latency');
const requestCount = new Counter('requests');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test users (in real scenario, load from file or generate)
const testUsers = new SharedArray('users', function () {
  return Array.from({ length: 100 }, (_, i) => ({
    email: `loadtest_user_${i}@test.festivals.app`,
    password: 'LoadTest123!',
  }));
});

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 50 },   // Ramp down to 50 users
    { duration: '1m', target: 0 },    // Ramp down to 0 users
  ],

  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.001'],
    errors: ['rate<0.01'],
    success: ['rate>0.99'],
    login_latency: ['p(95)<300'],
    festival_latency: ['p(95)<150'],
    ticket_latency: ['p(95)<200'],
  },

  tags: {
    test_type: 'load',
  },
};

export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);

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

  // Simulate user session
  group('User Session', () => {

    // Login
    group('Login', () => {
      const loginPayload = JSON.stringify({
        email: user.email,
        password: user.password,
      });

      const loginParams = {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'login' },
      };

      const response = http.post(`${baseUrl}/api/v1/auth/login`, loginPayload, loginParams);
      requestCount.add(1);
      loginLatency.add(response.timings.duration);

      const passed = check(response, {
        'login status is 200': (r) => r.status === 200,
        'login has token': (r) => r.json('data.accessToken') !== undefined,
      });

      errorRate.add(!passed);
      successRate.add(passed);

      if (passed) {
        accessToken = response.json('data.accessToken');
      }
    });

    sleep(1);

    // Browse festivals
    group('Browse Festivals', () => {
      const response = http.get(`${baseUrl}/api/v1/festivals?page=1&limit=20`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
        tags: { name: 'list_festivals' },
      });

      requestCount.add(1);
      festivalLatency.add(response.timings.duration);

      const passed = check(response, {
        'festivals status is 200': (r) => r.status === 200,
        'festivals has data': (r) => r.json('data') !== undefined,
        'festivals response time < 200ms': (r) => r.timings.duration < 200,
      });

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    sleep(0.5);

    // View festival details
    group('View Festival Details', () => {
      const festivalId = Math.floor(Math.random() * 5) + 1;
      const response = http.get(`${baseUrl}/api/v1/festivals/${festivalId}`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
        tags: { name: 'get_festival' },
      });

      requestCount.add(1);
      festivalLatency.add(response.timings.duration);

      const passed = check(response, {
        'festival detail status is 200 or 404': (r) => r.status === 200 || r.status === 404,
        'festival detail response time < 200ms': (r) => r.timings.duration < 200,
      });

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    sleep(0.5);

    // View lineup
    group('View Lineup', () => {
      const festivalId = Math.floor(Math.random() * 5) + 1;
      const response = http.get(`${baseUrl}/api/v1/festivals/${festivalId}/lineup`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
        tags: { name: 'get_lineup' },
      });

      requestCount.add(1);

      const passed = check(response, {
        'lineup status is 200 or 404': (r) => r.status === 200 || r.status === 404,
        'lineup response time < 250ms': (r) => r.timings.duration < 250,
      });

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    sleep(0.5);

    // View tickets (authenticated)
    if (accessToken) {
      group('View My Tickets', () => {
        const response = http.get(`${baseUrl}/api/v1/tickets/my`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'my_tickets' },
        });

        requestCount.add(1);
        ticketLatency.add(response.timings.duration);

        const passed = check(response, {
          'my tickets status is 200': (r) => r.status === 200,
          'my tickets response time < 200ms': (r) => r.timings.duration < 200,
        });

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);
      });

      sleep(0.5);

      // View wallet balance
      group('View Wallet', () => {
        const response = http.get(`${baseUrl}/api/v1/wallet/balance`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'wallet_balance' },
        });

        requestCount.add(1);

        const passed = check(response, {
          'wallet status is 200': (r) => r.status === 200,
          'wallet has balance': (r) => r.json('data.balance') !== undefined,
          'wallet response time < 100ms': (r) => r.timings.duration < 100,
        });

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);
      });

      sleep(0.5);

      // View profile
      group('View Profile', () => {
        const response = http.get(`${baseUrl}/api/v1/users/me`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'profile' },
        });

        requestCount.add(1);

        const passed = check(response, {
          'profile status is 200': (r) => r.status === 200,
          'profile has data': (r) => r.json('data') !== undefined,
        });

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);
      });
    }

    sleep(1);
  });

  // Think time between iterations
  sleep(Math.random() * 2 + 1);
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(2)}s`);
}
