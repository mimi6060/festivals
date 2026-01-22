import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

/**
 * Spike Test - Test sudden traffic spikes
 *
 * Purpose: Verify system handles sudden traffic bursts
 * - Rapid spike from 0 to 1000 users
 * - Quick drop back to 0
 * - Tests auto-scaling and recovery
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const apiLatency = new Trend('api_latency');
const spikeErrors = new Counter('spike_errors');
const recoveryTime = new Trend('recovery_time');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test users
const testUsers = new SharedArray('users', function () {
  return Array.from({ length: 1000 }, (_, i) => ({
    email: `spiketest_user_${i}@test.festivals.app`,
    password: 'SpikeTest123!',
  }));
});

export const options = {
  stages: [
    { duration: '30s', target: 10 },    // Baseline
    { duration: '30s', target: 10 },    // Hold baseline
    { duration: '10s', target: 500 },   // SPIKE UP!
    { duration: '30s', target: 1000 },  // Rapid increase to max
    { duration: '1m', target: 1000 },   // Hold at peak
    { duration: '10s', target: 500 },   // Start decrease
    { duration: '30s', target: 10 },    // SPIKE DOWN
    { duration: '1m', target: 10 },     // Recovery observation
    { duration: '30s', target: 0 },     // Wind down
  ],

  thresholds: {
    // Very lenient during spike
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.1'],
    errors: ['rate<0.15'],
  },

  tags: {
    test_type: 'spike',
  },
};

export function setup() {
  console.log(`Starting spike test against ${BASE_URL}`);
  console.log('This test simulates sudden traffic spikes');

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  return {
    baseUrl: BASE_URL,
    startTime: Date.now(),
    baselineLatency: null,
  };
}

export default function (data) {
  const baseUrl = data.baseUrl;
  const userIndex = __VU % testUsers.length;
  const user = testUsers[userIndex];
  let accessToken = null;

  const iterationStart = Date.now();

  group('Spike Test Operations', () => {

    // Quick health check
    group('Health', () => {
      const response = http.get(`${baseUrl}/health`, {
        tags: { name: 'health' },
        timeout: '10s',
      });

      const passed = check(response, {
        'health responds': (r) => r.status === 200 || r.status === 503,
      });

      if (!passed || response.status === 503) {
        spikeErrors.add(1);
      }

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    // Fast login
    group('Auth', () => {
      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'login' },
          timeout: '15s',
        }
      );

      const passed = check(response, {
        'login responds': (r) => r.status === 200 || r.status === 429 || r.status === 503,
      });

      if (response.status === 200) {
        accessToken = response.json('data.accessToken');
      } else if (response.status === 503) {
        spikeErrors.add(1);
      }

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    sleep(0.1);

    // Critical path: Festival browsing
    group('Festival Browse', () => {
      const response = http.get(`${baseUrl}/api/v1/festivals?limit=10`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
        tags: { name: 'list_festivals' },
        timeout: '10s',
      });

      const passed = check(response, {
        'festivals responds': (r) => r.status === 200 || r.status === 429 || r.status === 503,
      });

      if (response.status === 503) {
        spikeErrors.add(1);
      }

      errorRate.add(!passed);
      successRate.add(passed);
      apiLatency.add(response.timings.duration);
    });

    sleep(0.1);

    // Critical path: Ticket operations
    if (accessToken) {
      group('Ticket Check', () => {
        const response = http.get(`${baseUrl}/api/v1/tickets/my`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'my_tickets' },
          timeout: '10s',
        });

        const passed = check(response, {
          'tickets responds': (r) => r.status === 200 || r.status === 429 || r.status === 503,
        });

        if (response.status === 503) {
          spikeErrors.add(1);
        }

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);
      });

      sleep(0.1);

      // Critical path: Wallet
      group('Wallet Check', () => {
        const response = http.get(`${baseUrl}/api/v1/wallet/balance`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'wallet_balance' },
          timeout: '10s',
        });

        const passed = check(response, {
          'wallet responds': (r) => r.status === 200 || r.status === 429 || r.status === 503,
        });

        if (response.status === 503) {
          spikeErrors.add(1);
        }

        errorRate.add(!passed);
        successRate.add(passed);
        apiLatency.add(response.timings.duration);
      });
    }

    sleep(0.1);
  });

  // Track iteration time for recovery metrics
  const iterationTime = Date.now() - iterationStart;
  recoveryTime.add(iterationTime);

  // Very short think time during spike
  sleep(Math.random() * 0.2);
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Spike test completed in ${duration.toFixed(2)}s`);
  console.log('Review spike_errors counter to assess system resilience');
}
