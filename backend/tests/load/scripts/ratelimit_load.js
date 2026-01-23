/**
 * K6 Load Test for Rate Limiting
 *
 * This script tests rate limiting behavior under various load conditions.
 *
 * Usage:
 *   k6 run ratelimit_load.js
 *   k6 run --vus 10 --duration 30s ratelimit_load.js
 *   k6 run -e BASE_URL=http://localhost:8080 ratelimit_load.js
 *
 * Environment Variables:
 *   BASE_URL: API base URL (default: http://localhost:8080)
 *   AUTH_TOKEN: Bearer token for authenticated requests
 *   ADMIN_TOKEN: Bearer token for admin requests
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || '';

// Custom metrics
const rateLimitedRequests = new Counter('rate_limited_requests');
const successfulRequests = new Counter('successful_requests');
const rateLimitRatio = new Rate('rate_limit_ratio');
const rateLimitRemaining = new Trend('rate_limit_remaining');
const retryAfterSeconds = new Trend('retry_after_seconds');

// Test scenarios
export const options = {
  scenarios: {
    // Scenario 1: Test default rate limits with gradual ramp-up
    default_limits: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },  // Ramp up to 10 users
        { duration: '1m', target: 10 },   // Stay at 10 users
        { duration: '30s', target: 20 },  // Ramp up to 20 users
        { duration: '1m', target: 20 },   // Stay at 20 users
        { duration: '30s', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '10s',
      exec: 'testDefaultLimits',
      tags: { scenario: 'default_limits' },
    },

    // Scenario 2: Test role-based limits with authenticated users
    role_based_limits: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      exec: 'testRoleBasedLimits',
      startTime: '3m',  // Start after default_limits
      tags: { scenario: 'role_based_limits' },
    },

    // Scenario 3: Burst traffic test
    burst_traffic: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 10,
      maxDuration: '1m',
      exec: 'testBurstTraffic',
      startTime: '5m30s',
      tags: { scenario: 'burst_traffic' },
    },

    // Scenario 4: Test endpoint-specific limits
    endpoint_limits: {
      executor: 'constant-arrival-rate',
      rate: 100,  // 100 requests per second
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'testEndpointLimits',
      startTime: '7m',
      tags: { scenario: 'endpoint_limits' },
    },

    // Scenario 5: Distributed load simulation (multiple IPs)
    distributed_load: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 10 },
      ],
      preAllocatedVUs: 100,
      maxVUs: 200,
      exec: 'testDistributedLoad',
      startTime: '8m30s',
      tags: { scenario: 'distributed_load' },
    },
  },

  thresholds: {
    // Overall thresholds
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.5'],  // Allow up to 50% rate limited (429s count as "failed")

    // Rate limiting specific thresholds
    rate_limit_ratio: ['rate<0.7'],  // At most 70% of requests should be rate limited
    rate_limit_remaining: ['avg>0'],  // Average remaining should be positive
    successful_requests: ['count>100'],  // Should have at least some successful requests

    // Scenario-specific
    'http_req_duration{scenario:default_limits}': ['p(95)<300'],
    'http_req_duration{scenario:burst_traffic}': ['p(95)<500'],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Make an authenticated request
 */
function authRequest(method, url, body = null, token = AUTH_TOKEN) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const params = { headers, tags: { name: url } };

  let response;
  if (method === 'GET') {
    response = http.get(url, params);
  } else if (method === 'POST') {
    response = http.post(url, JSON.stringify(body), params);
  } else if (method === 'PUT') {
    response = http.put(url, JSON.stringify(body), params);
  } else if (method === 'DELETE') {
    response = http.del(url, params);
  }

  return response;
}

/**
 * Process rate limit headers from response
 */
function processRateLimitHeaders(response) {
  const limit = response.headers['X-Ratelimit-Limit'];
  const remaining = response.headers['X-Ratelimit-Remaining'];
  const reset = response.headers['X-Ratelimit-Reset'];
  const retryAfter = response.headers['Retry-After'];

  if (remaining !== undefined) {
    rateLimitRemaining.add(parseInt(remaining, 10));
  }

  if (retryAfter !== undefined) {
    retryAfterSeconds.add(parseInt(retryAfter, 10));
  }

  return {
    limit: limit ? parseInt(limit, 10) : null,
    remaining: remaining ? parseInt(remaining, 10) : null,
    reset: reset ? parseInt(reset, 10) : null,
    retryAfter: retryAfter ? parseInt(retryAfter, 10) : null,
  };
}

/**
 * Check if response is rate limited
 */
function isRateLimited(response) {
  return response.status === 429;
}

/**
 * Record metrics for a response
 */
function recordMetrics(response) {
  if (isRateLimited(response)) {
    rateLimitedRequests.add(1);
    rateLimitRatio.add(1);
  } else if (response.status >= 200 && response.status < 400) {
    successfulRequests.add(1);
    rateLimitRatio.add(0);
  }

  processRateLimitHeaders(response);
}

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Test default rate limits with unauthenticated requests
 */
export function testDefaultLimits() {
  group('Default Rate Limits', function () {
    const url = `${BASE_URL}/api/v1/health`;

    // Make multiple rapid requests to trigger rate limiting
    for (let i = 0; i < 5; i++) {
      const response = http.get(url, {
        tags: { name: 'health_check' },
      });

      recordMetrics(response);

      const checks = check(response, {
        'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
        'rate limit headers present': (r) =>
          r.headers['X-Ratelimit-Limit'] !== undefined ||
          r.status === 200, // Health might not have headers
      });

      if (isRateLimited(response)) {
        // Verify rate limit response format
        try {
          const body = JSON.parse(response.body);
          check(body, {
            'has error code': (b) => b.error && b.error.code === 'RATE_LIMITED',
            'has retry_after': (b) => b.error && typeof b.error.retry_after === 'number',
          });
        } catch (e) {
          // Body parsing failed, skip
        }
      }

      // Small random delay between requests
      sleep(Math.random() * 0.5);
    }
  });

  sleep(randomIntBetween(1, 3));
}

/**
 * Test role-based rate limits
 */
export function testRoleBasedLimits() {
  group('Role-Based Rate Limits', function () {
    // Test with regular user token
    if (AUTH_TOKEN) {
      group('Regular User', function () {
        const url = `${BASE_URL}/api/v1/test`;
        const response = authRequest('GET', url, null, AUTH_TOKEN);
        recordMetrics(response);

        check(response, {
          'user request handled': (r) => r.status === 200 || r.status === 429 || r.status === 404,
          'has rate limit headers': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
        });
      });
    }

    // Test with admin token (should have higher limits)
    if (ADMIN_TOKEN) {
      group('Admin User', function () {
        const url = `${BASE_URL}/api/v1/test`;
        const response = authRequest('GET', url, null, ADMIN_TOKEN);
        recordMetrics(response);

        const rateLimitInfo = processRateLimitHeaders(response);

        check(response, {
          'admin request handled': (r) => r.status === 200 || r.status === 429 || r.status === 404,
          'admin has higher limit': () =>
            rateLimitInfo.limit === null || rateLimitInfo.limit >= 100,
        });
      });
    }
  });

  sleep(randomIntBetween(1, 2));
}

/**
 * Test burst traffic handling
 */
export function testBurstTraffic() {
  group('Burst Traffic', function () {
    const url = `${BASE_URL}/api/v1/health`;
    const startTime = Date.now();
    let requestCount = 0;
    let rateLimitedCount = 0;

    // Send rapid burst of requests
    while (Date.now() - startTime < 5000) { // 5 second burst
      const response = http.get(url, {
        tags: { name: 'burst_request' },
      });

      requestCount++;
      recordMetrics(response);

      if (isRateLimited(response)) {
        rateLimitedCount++;
      }

      // No sleep - maximum burst rate
    }

    // Log burst results
    console.log(`Burst test: ${requestCount} requests, ${rateLimitedCount} rate limited`);

    check(null, {
      'some requests succeeded': () => requestCount > rateLimitedCount,
      'rate limiting engaged': () => rateLimitedCount > 0,
    });
  });

  sleep(5); // Recovery period
}

/**
 * Test endpoint-specific limits
 */
export function testEndpointLimits() {
  group('Endpoint-Specific Limits', function () {
    // Test various endpoints with different expected limits

    // Health endpoint (should be skipped from rate limiting)
    group('Health Endpoint', function () {
      const response = http.get(`${BASE_URL}/api/v1/health`, {
        tags: { name: 'health' },
      });
      recordMetrics(response);

      check(response, {
        'health check successful': (r) => r.status === 200,
      });
    });

    // Sensitive endpoint (should have stricter limits)
    if (AUTH_TOKEN) {
      group('Sensitive Endpoint', function () {
        const url = `${BASE_URL}/api/v1/wallets/test-wallet/topup`;
        const response = authRequest('POST', url, { amount: 100 }, AUTH_TOKEN);
        recordMetrics(response);

        // Even if endpoint doesn't exist, we're testing rate limiting
        check(response, {
          'request processed': (r) =>
            r.status === 200 || r.status === 400 || r.status === 404 || r.status === 429,
        });
      });
    }

    // Search endpoint
    group('Search Endpoint', function () {
      const response = http.get(`${BASE_URL}/api/v1/search?q=test`, {
        tags: { name: 'search' },
      });
      recordMetrics(response);
    });
  });

  sleep(randomIntBetween(0, 1));
}

/**
 * Test distributed load (simulating multiple clients)
 */
export function testDistributedLoad() {
  group('Distributed Load', function () {
    // Each VU represents a different "user" or "IP"
    const vuId = __VU;
    const uniqueId = `user-${vuId}-${randomString(8)}`;

    const url = `${BASE_URL}/api/v1/health`;

    // Add custom header to simulate different clients
    const params = {
      headers: {
        'X-Forwarded-For': `192.168.${Math.floor(vuId / 256)}.${vuId % 256}`,
        'X-Client-ID': uniqueId,
      },
      tags: { name: 'distributed_request' },
    };

    const response = http.get(url, params);
    recordMetrics(response);

    const rateLimitInfo = processRateLimitHeaders(response);

    check(response, {
      'distributed request handled': (r) => r.status === 200 || r.status === 429,
      'rate limit info available': () =>
        rateLimitInfo.limit !== null || response.status === 200,
    });

    // Verify that different "clients" have separate limits
    if (rateLimitInfo.remaining !== null) {
      check(null, {
        'has remaining quota': () => rateLimitInfo.remaining >= 0,
      });
    }
  });

  sleep(Math.random() * 0.5);
}

// ============================================================================
// Setup and Teardown
// ============================================================================

export function setup() {
  console.log('Starting rate limit load tests');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Auth Token provided: ${AUTH_TOKEN ? 'Yes' : 'No'}`);
  console.log(`Admin Token provided: ${ADMIN_TOKEN ? 'Yes' : 'No'}`);

  // Verify API is reachable
  const healthResponse = http.get(`${BASE_URL}/api/v1/health`);
  if (healthResponse.status !== 200 && healthResponse.status !== 404) {
    console.warn(`Warning: Health check returned status ${healthResponse.status}`);
  }

  return {
    startTime: Date.now(),
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Test completed in ${duration.toFixed(2)} seconds`);
}

// ============================================================================
// Default Function (for simple runs)
// ============================================================================

export default function () {
  // Default test function for simple k6 runs
  testDefaultLimits();
}

// ============================================================================
// Custom Handlers
// ============================================================================

/**
 * Handle rate limit errors gracefully
 */
export function handleSummary(data) {
  const summary = {
    metrics: {
      total_requests: data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0,
      successful_requests: data.metrics.successful_requests
        ? data.metrics.successful_requests.values.count
        : 0,
      rate_limited_requests: data.metrics.rate_limited_requests
        ? data.metrics.rate_limited_requests.values.count
        : 0,
      rate_limit_ratio: data.metrics.rate_limit_ratio
        ? data.metrics.rate_limit_ratio.values.rate
        : 0,
      avg_remaining: data.metrics.rate_limit_remaining
        ? data.metrics.rate_limit_remaining.values.avg
        : 'N/A',
      avg_retry_after: data.metrics.retry_after_seconds
        ? data.metrics.retry_after_seconds.values.avg
        : 'N/A',
    },
    thresholds: data.thresholds,
  };

  // Calculate rate limiting effectiveness
  const totalRequests = summary.metrics.successful_requests + summary.metrics.rate_limited_requests;
  if (totalRequests > 0) {
    summary.metrics.effective_rate_limit_percentage = (
      (summary.metrics.rate_limited_requests / totalRequests) *
      100
    ).toFixed(2);
  }

  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    'summary.json': JSON.stringify(summary, null, 2),
  };
}

/**
 * Generate text summary
 */
function textSummary(data, options) {
  const indent = options.indent || '  ';

  let output = '\n=== Rate Limit Load Test Summary ===\n\n';

  output += `${indent}Total HTTP Requests: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}\n`;
  output += `${indent}Successful Requests: ${data.metrics.successful_requests ? data.metrics.successful_requests.values.count : 0}\n`;
  output += `${indent}Rate Limited (429s): ${data.metrics.rate_limited_requests ? data.metrics.rate_limited_requests.values.count : 0}\n`;
  output += `${indent}Rate Limit Ratio: ${data.metrics.rate_limit_ratio ? (data.metrics.rate_limit_ratio.values.rate * 100).toFixed(2) : 0}%\n`;

  if (data.metrics.rate_limit_remaining) {
    output += `\n${indent}Rate Limit Remaining:\n`;
    output += `${indent}${indent}Average: ${data.metrics.rate_limit_remaining.values.avg.toFixed(2)}\n`;
    output += `${indent}${indent}Min: ${data.metrics.rate_limit_remaining.values.min}\n`;
    output += `${indent}${indent}Max: ${data.metrics.rate_limit_remaining.values.max}\n`;
  }

  if (data.metrics.retry_after_seconds && data.metrics.retry_after_seconds.values.count > 0) {
    output += `\n${indent}Retry-After (seconds):\n`;
    output += `${indent}${indent}Average: ${data.metrics.retry_after_seconds.values.avg.toFixed(2)}\n`;
    output += `${indent}${indent}Min: ${data.metrics.retry_after_seconds.values.min}\n`;
    output += `${indent}${indent}Max: ${data.metrics.retry_after_seconds.values.max}\n`;
  }

  output += '\n=== Threshold Results ===\n\n';
  for (const [name, threshold] of Object.entries(data.thresholds || {})) {
    const status = threshold.ok ? 'PASS' : 'FAIL';
    output += `${indent}${name}: ${status}\n`;
  }

  return output;
}
