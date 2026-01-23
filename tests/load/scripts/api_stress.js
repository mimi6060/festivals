import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * API Stress Test
 *
 * Comprehensive stress testing for the festivals API:
 * 1. Test all API endpoints under stress
 * 2. Test rate limiting effectiveness
 * 3. Test graceful degradation
 * 4. Test recovery after overload
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');

// Response time metrics per endpoint category
const authLatency = new Trend('auth_latency', true);
const festivalLatency = new Trend('festival_latency', true);
const walletLatency = new Trend('wallet_latency', true);
const ticketLatency = new Trend('ticket_latency', true);
const searchLatency = new Trend('search_latency', true);
const lineupLatency = new Trend('lineup_latency', true);

// Rate limiting metrics
const rateLimitHits = new Counter('rate_limit_hits');
const rateLimitBypass = new Counter('rate_limit_bypass');
const rateLimitRecoveryTime = new Trend('rate_limit_recovery_time', true);

// Degradation metrics
const degradedResponses = new Counter('degraded_responses');
const timeouts = new Counter('timeouts');
const serverErrors = new Counter('server_errors');
const clientErrors = new Counter('client_errors');

// Recovery metrics
const recoveryTime = new Trend('recovery_time', true);
const preOverloadLatency = new Gauge('pre_overload_latency');
const postOverloadLatency = new Gauge('post_overload_latency');

// Throughput metrics
const requestsPerSecond = new Gauge('requests_per_second');
const totalRequests = new Counter('total_requests');
const successfulRequests = new Counter('successful_requests');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const STRESS_LEVEL = __ENV.STRESS_LEVEL || 'medium'; // low, medium, high, extreme

// Test users
const testUsers = new SharedArray('users', function () {
  return Array.from({ length: 500 }, (_, i) => ({
    email: `stressapi_user_${i}@test.festivals.app`,
    password: 'StressApi123!',
    userId: `user_stress_${i}`,
  }));
});

// API Endpoints to test
const endpoints = {
  public: [
    { path: '/api/v1/festivals', method: 'GET', name: 'list_festivals' },
    { path: '/api/v1/festivals?page=1&limit=20', method: 'GET', name: 'list_festivals_paginated' },
    { path: '/api/v1/festivals/fest_001', method: 'GET', name: 'get_festival' },
    { path: '/api/v1/festivals/fest_001/lineup', method: 'GET', name: 'get_lineup' },
    { path: '/api/v1/festivals/fest_001/artists', method: 'GET', name: 'get_artists' },
    { path: '/api/v1/search?q=music', method: 'GET', name: 'search' },
    { path: '/health', method: 'GET', name: 'health' },
  ],
  authenticated: [
    { path: '/api/v1/me/profile', method: 'GET', name: 'get_profile' },
    { path: '/api/v1/me/wallets', method: 'GET', name: 'get_wallets' },
    { path: '/api/v1/me/tickets', method: 'GET', name: 'get_tickets' },
    { path: '/api/v1/me/orders', method: 'GET', name: 'get_orders' },
    { path: '/api/v1/notifications', method: 'GET', name: 'get_notifications' },
  ],
};

// Stress level configurations
const stressLevels = {
  low: {
    maxVUs: 200,
    rampUpTime: '2m',
    sustainTime: '5m',
    rampDownTime: '1m',
  },
  medium: {
    maxVUs: 500,
    rampUpTime: '3m',
    sustainTime: '5m',
    rampDownTime: '2m',
  },
  high: {
    maxVUs: 1000,
    rampUpTime: '3m',
    sustainTime: '5m',
    rampDownTime: '2m',
  },
  extreme: {
    maxVUs: 2000,
    rampUpTime: '2m',
    sustainTime: '3m',
    rampDownTime: '2m',
  },
};

const config = stressLevels[STRESS_LEVEL] || stressLevels.medium;

export const options = {
  scenarios: {
    // Scenario 1: Gradual stress increase
    gradual_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },                    // Baseline
        { duration: config.rampUpTime, target: config.maxVUs },  // Ramp to max
        { duration: config.sustainTime, target: config.maxVUs }, // Sustain max
        { duration: config.rampDownTime, target: 0 },      // Recovery
      ],
      gracefulRampDown: '30s',
      exec: 'stressTest',
      startTime: '0s',
    },

    // Scenario 2: Rate limit testing
    rate_limit_test: {
      executor: 'constant-arrival-rate',
      rate: 200,  // 200 requests per second
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      exec: 'rateLimitTest',
      startTime: '15m',
    },

    // Scenario 3: Spike test for graceful degradation
    spike_degradation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },    // Normal
        { duration: '10s', target: 1500 },  // Sudden spike
        { duration: '1m', target: 1500 },   // Sustain spike
        { duration: '10s', target: 50 },    // Drop back
        { duration: '2m', target: 50 },     // Recovery period
      ],
      gracefulRampDown: '10s',
      exec: 'degradationTest',
      startTime: '19m',
    },

    // Scenario 4: Recovery test
    recovery_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },    // Pre-overload baseline
        { duration: '30s', target: 2000 },  // Overload
        { duration: '1m', target: 2000 },   // Sustained overload
        { duration: '30s', target: 100 },   // Return to baseline
        { duration: '3m', target: 100 },    // Recovery monitoring
      ],
      gracefulRampDown: '30s',
      exec: 'recoveryTest',
      startTime: '24m',
    },
  },

  thresholds: {
    // General thresholds (lenient for stress test)
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.1'],  // Allow up to 10% failures under stress

    // Rate limiting
    rate_limit_hits: ['count>0'],  // Expect some rate limiting

    // Degradation
    server_errors: ['rate<0.05'],  // Less than 5% 5xx errors

    // Recovery
    recovery_time: ['p(95)<60000'],  // Recovery within 60s
  },

  tags: {
    test_type: 'api_stress',
    stress_level: STRESS_LEVEL,
  },
};

export function setup() {
  console.log('Starting API Stress Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Stress Level: ${STRESS_LEVEL}`);
  console.log(`Max VUs: ${config.maxVUs}`);

  // Initial health check
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    fail(`API health check failed: ${healthCheck.status}`);
  }

  // Record baseline latency
  const baselineStart = Date.now();
  const baselineResponses = [];

  for (let i = 0; i < 10; i++) {
    const res = http.get(`${BASE_URL}/api/v1/festivals`);
    baselineResponses.push(res.timings.duration);
    sleep(0.1);
  }

  const avgBaseline = baselineResponses.reduce((a, b) => a + b, 0) / baselineResponses.length;

  console.log(`Baseline latency: ${avgBaseline.toFixed(2)}ms`);

  return {
    baseUrl: BASE_URL,
    startTime: Date.now(),
    baselineLatency: avgBaseline,
    phase: 'normal',
  };
}

// Main stress test function
export function stressTest(data) {
  const baseUrl = data.baseUrl;
  const userIndex = __VU % testUsers.length;
  const user = testUsers[userIndex];

  let accessToken = null;

  group('API Stress Test', () => {

    // Test public endpoints
    group('Public Endpoints', () => {
      const endpoint = randomItem(endpoints.public);
      const startTime = Date.now();

      const response = http.request(endpoint.method, `${baseUrl}${endpoint.path}`, null, {
        tags: { name: endpoint.name, category: 'public' },
        timeout: '30s',
      });

      const duration = Date.now() - startTime;
      totalRequests.add(1);

      const passed = processResponse(response, endpoint.name, duration);

      if (endpoint.name.includes('festival')) {
        festivalLatency.add(duration);
      } else if (endpoint.name.includes('search')) {
        searchLatency.add(duration);
      } else if (endpoint.name.includes('lineup') || endpoint.name.includes('artist')) {
        lineupLatency.add(duration);
      }
    });

    sleep(0.1);

    // Attempt login (testing auth under load)
    group('Authentication', () => {
      const startTime = Date.now();

      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'login', category: 'auth' },
          timeout: '30s',
        }
      );

      const duration = Date.now() - startTime;
      authLatency.add(duration);
      totalRequests.add(1);

      if (response.status === 200) {
        accessToken = response.json('data.accessToken');
        successfulRequests.add(1);
      } else {
        processResponse(response, 'login', duration);
      }
    });

    sleep(0.1);

    // Test authenticated endpoints
    if (accessToken) {
      group('Authenticated Endpoints', () => {
        const endpoint = randomItem(endpoints.authenticated);
        const startTime = Date.now();

        const response = http.request(
          endpoint.method,
          `${baseUrl}${endpoint.path}`,
          null,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: endpoint.name, category: 'authenticated' },
            timeout: '30s',
          }
        );

        const duration = Date.now() - startTime;
        totalRequests.add(1);

        processResponse(response, endpoint.name, duration);

        if (endpoint.name.includes('wallet')) {
          walletLatency.add(duration);
        } else if (endpoint.name.includes('ticket')) {
          ticketLatency.add(duration);
        }
      });
    }

    // Multiple rapid requests to stress the system
    group('Rapid Fire Requests', () => {
      const numRequests = randomIntBetween(3, 8);

      for (let i = 0; i < numRequests; i++) {
        const endpoint = randomItem(endpoints.public);

        const response = http.request(endpoint.method, `${baseUrl}${endpoint.path}`, null, {
          tags: { name: `rapid_${endpoint.name}`, category: 'rapid' },
          timeout: '10s',
        });

        totalRequests.add(1);
        processResponse(response, `rapid_${endpoint.name}`, response.timings.duration);

        // Minimal delay
        sleep(0.02);
      }
    });
  });

  // Minimal think time under stress
  sleep(randomIntBetween(1, 3) / 10);
}

// Rate limit testing
export function rateLimitTest(data) {
  const baseUrl = data.baseUrl;
  const userIndex = __VU % testUsers.length;
  const user = testUsers[userIndex];

  group('Rate Limit Test', () => {

    // Rapid login attempts (should trigger rate limit)
    group('Auth Rate Limit', () => {
      const startTime = Date.now();

      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'rate_limit_login', category: 'rate_limit' },
        }
      );

      totalRequests.add(1);

      if (response.status === 429) {
        rateLimitHits.add(1);

        // Check for Retry-After header
        const retryAfter = response.headers['Retry-After'];
        if (retryAfter) {
          rateLimitRecoveryTime.add(parseInt(retryAfter) * 1000);
        }

        const passed = check(response, {
          'rate limit response has retry info': (r) =>
            r.headers['Retry-After'] !== undefined ||
            r.json('retryAfter') !== undefined,
        });
      } else if (response.status === 200) {
        // Successfully bypassed rate limit
        rateLimitBypass.add(1);
      }
    });

    // Rapid API calls
    group('API Rate Limit', () => {
      for (let i = 0; i < 10; i++) {
        const response = http.get(`${baseUrl}/api/v1/festivals`, {
          tags: { name: 'rate_limit_festivals', category: 'rate_limit' },
        });

        totalRequests.add(1);

        if (response.status === 429) {
          rateLimitHits.add(1);
          break; // Rate limited
        }
      }
    });

    // Search rate limit (typically more restrictive)
    group('Search Rate Limit', () => {
      const queries = ['rock', 'jazz', 'electronic', 'hip hop', 'indie', 'metal', 'pop'];

      for (let i = 0; i < queries.length; i++) {
        const response = http.get(
          `${baseUrl}/api/v1/search?q=${queries[i]}`,
          { tags: { name: 'rate_limit_search', category: 'rate_limit' } }
        );

        totalRequests.add(1);

        if (response.status === 429) {
          rateLimitHits.add(1);
          break;
        }

        sleep(0.05);
      }
    });
  });

  // No sleep - testing rate limits
}

// Graceful degradation test
export function degradationTest(data) {
  const baseUrl = data.baseUrl;

  group('Degradation Test', () => {

    // Test critical endpoints during spike
    const criticalEndpoints = [
      '/api/v1/payments/validate-qr',
      '/api/v1/me/wallets',
      '/health',
    ];

    for (const path of criticalEndpoints) {
      const startTime = Date.now();

      const response = http.get(`${baseUrl}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: `degradation_${path.split('/').pop()}`, category: 'degradation' },
        timeout: '30s',
      });

      const duration = Date.now() - startTime;
      totalRequests.add(1);

      // Check for graceful degradation indicators
      if (response.status === 503) {
        degradedResponses.add(1);

        // Check if degradation is graceful (proper error response)
        check(response, {
          'degraded response has message': (r) => r.json('message') !== undefined,
          'degraded response has retry hint': (r) =>
            r.headers['Retry-After'] !== undefined ||
            r.json('retryAfter') !== undefined,
        });
      } else if (response.status === 0 || duration >= 30000) {
        timeouts.add(1);
      } else if (response.status >= 500) {
        serverErrors.add(1);
      } else if (response.status >= 200 && response.status < 300) {
        // System handling load gracefully
        successfulRequests.add(1);
      }

      sleep(0.05);
    }

    // Heavy endpoints during spike
    group('Heavy Operations', () => {
      const response = http.get(
        `${baseUrl}/api/v1/festivals?page=1&limit=100`,
        {
          tags: { name: 'degradation_heavy', category: 'degradation' },
          timeout: '30s',
        }
      );

      totalRequests.add(1);

      if (response.status === 200) {
        const responseTime = response.timings.duration;
        if (responseTime > 5000) {
          degradedResponses.add(1);  // Slow but working
        }
      } else if (response.status === 503 || response.status === 504) {
        degradedResponses.add(1);
      }
    });
  });

  sleep(0.1);
}

// Recovery test
export function recoveryTest(data) {
  const baseUrl = data.baseUrl;
  const baselineLatency = data.baselineLatency;

  group('Recovery Test', () => {

    // Continuously monitor latency
    const startTime = Date.now();

    const response = http.get(`${baseUrl}/api/v1/festivals`, {
      tags: { name: 'recovery_monitor', category: 'recovery' },
      timeout: '30s',
    });

    const duration = response.timings.duration;
    totalRequests.add(1);

    // Track latency trend
    if (__VU <= 100) {
      // Baseline phase or recovery phase
      const latencyRatio = duration / baselineLatency;

      if (latencyRatio > 5) {
        // Still degraded (5x baseline)
        postOverloadLatency.add(duration);
      } else if (latencyRatio < 2) {
        // Recovered (within 2x baseline)
        recoveryTime.add(Date.now() - startTime);
      }
    } else {
      // Overload phase
      preOverloadLatency.add(duration);
    }

    // Health endpoint should always respond
    group('Health During Recovery', () => {
      const healthRes = http.get(`${baseUrl}/health`, {
        tags: { name: 'recovery_health', category: 'recovery' },
        timeout: '10s',
      });

      totalRequests.add(1);

      check(healthRes, {
        'health responds during recovery': (r) => r.status === 200,
        'health time < 1s': (r) => r.timings.duration < 1000,
      });
    });
  });

  sleep(0.2);
}

// Helper function to process response and track metrics
function processResponse(response, endpointName, duration) {
  let passed = false;

  if (response.status === 0 || duration >= 30000) {
    timeouts.add(1);
    errorRate.add(true);
  } else if (response.status === 429) {
    rateLimitHits.add(1);
    // Rate limiting is expected, not an error
    passed = true;
  } else if (response.status >= 500) {
    serverErrors.add(1);
    errorRate.add(true);
  } else if (response.status >= 400 && response.status < 500) {
    clientErrors.add(1);
    // Client errors might be expected (auth required, not found, etc.)
    passed = response.status === 401 || response.status === 404;
    errorRate.add(!passed);
  } else if (response.status >= 200 && response.status < 300) {
    passed = true;
    successfulRequests.add(1);
    successRate.add(true);
    errorRate.add(false);
  }

  return passed;
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;

  console.log('\n' + '='.repeat(70));
  console.log('API STRESS TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log(`Stress Level: ${STRESS_LEVEL}`);
  console.log(`Baseline Latency: ${data.baselineLatency.toFixed(2)}ms`);
  console.log('');
  console.log('Key Observations:');
  console.log('');
  console.log('1. Rate Limiting:');
  console.log('   - Check rate_limit_hits for rate limiter effectiveness');
  console.log('   - Check rate_limit_bypass for rate limiter gaps');
  console.log('');
  console.log('2. Graceful Degradation:');
  console.log('   - Check degraded_responses for 503 handling');
  console.log('   - Check server_errors (should be < 5%)');
  console.log('   - Check timeouts for connection issues');
  console.log('');
  console.log('3. Recovery:');
  console.log('   - Check recovery_time for system recovery speed');
  console.log('   - Compare pre_overload_latency vs post_overload_latency');
  console.log('');
  console.log('4. Endpoint Performance Under Stress:');
  console.log('   - auth_latency: Authentication performance');
  console.log('   - wallet_latency: Critical payment path');
  console.log('   - festival_latency: Main content delivery');
  console.log('='.repeat(70));
}
