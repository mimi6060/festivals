import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * Smoke Test - Quick validation test
 *
 * Purpose: Verify the system works under minimal load
 * - 10 virtual users
 * - 1 minute duration
 * - Basic functionality checks
 */

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  vus: 10,
  duration: '1m',

  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },

  tags: {
    test_type: 'smoke',
  },
};

export function setup() {
  console.log(`Starting smoke test against ${BASE_URL}`);

  // Verify API is reachable
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  console.log('API health check passed');
  return { baseUrl: BASE_URL };
}

export default function (data) {
  const baseUrl = data.baseUrl;

  // Test 1: Health endpoint
  group('Health Check', () => {
    const response = http.get(`${baseUrl}/health`);
    const passed = check(response, {
      'health status is 200': (r) => r.status === 200,
      'health response time < 100ms': (r) => r.timings.duration < 100,
    });
    errorRate.add(!passed);
    apiLatency.add(response.timings.duration);
  });

  sleep(0.5);

  // Test 2: API version/info
  group('API Info', () => {
    const response = http.get(`${baseUrl}/api/v1/info`);
    const passed = check(response, {
      'info status is 200': (r) => r.status === 200,
      'info has version': (r) => r.json('version') !== undefined,
    });
    errorRate.add(!passed);
    apiLatency.add(response.timings.duration);
  });

  sleep(0.5);

  // Test 3: List festivals (public endpoint)
  group('List Festivals', () => {
    const response = http.get(`${baseUrl}/api/v1/festivals?limit=10`);
    const passed = check(response, {
      'festivals status is 200': (r) => r.status === 200,
      'festivals response time < 200ms': (r) => r.timings.duration < 200,
      'festivals has data': (r) => r.json('data') !== undefined,
    });
    errorRate.add(!passed);
    apiLatency.add(response.timings.duration);
  });

  sleep(0.5);

  // Test 4: Get single festival
  group('Get Festival', () => {
    const response = http.get(`${baseUrl}/api/v1/festivals/1`);
    const passed = check(response, {
      'festival status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'festival response time < 200ms': (r) => r.timings.duration < 200,
    });
    errorRate.add(!passed);
    apiLatency.add(response.timings.duration);
  });

  sleep(0.5);

  // Test 5: Search endpoint
  group('Search', () => {
    const response = http.get(`${baseUrl}/api/v1/search?q=music&limit=5`);
    const passed = check(response, {
      'search status is 200': (r) => r.status === 200,
      'search response time < 300ms': (r) => r.timings.duration < 300,
    });
    errorRate.add(!passed);
    apiLatency.add(response.timings.duration);
  });

  sleep(1);
}

export function teardown(data) {
  console.log('Smoke test completed');
}
