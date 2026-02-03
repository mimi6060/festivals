import { check, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

/**
 * Common check helpers and custom metrics for k6 load tests
 */

// Custom metrics
export const errorRate = new Rate('custom_error_rate');
export const successRate = new Rate('custom_success_rate');
export const apiLatency = new Trend('custom_api_latency');
export const authErrors = new Counter('custom_auth_errors');
export const businessErrors = new Counter('custom_business_errors');
export const timeouts = new Counter('custom_timeouts');

/**
 * Standard HTTP response checks
 */
export function checkResponse(response, name, expectedStatus = 200) {
  const passed = check(response, {
    [`${name} status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${name} response time < 500ms`]: (r) => r.timings.duration < 500,
    [`${name} has body`]: (r) => r.body && r.body.length > 0,
  });

  // Track custom metrics
  errorRate.add(!passed);
  successRate.add(passed);
  apiLatency.add(response.timings.duration);

  if (!passed) {
    console.error(`${name} failed: ${response.status} - ${response.body?.substring(0, 200)}`);
  }

  return passed;
}

/**
 * Check JSON response structure
 */
export function checkJsonResponse(response, name, expectedStatus = 200) {
  const passed = check(response, {
    [`${name} status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${name} is valid JSON`]: (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        return false;
      }
    },
    [`${name} has success field`]: (r) => r.json('success') !== undefined,
  });

  errorRate.add(!passed);
  successRate.add(passed);
  apiLatency.add(response.timings.duration);

  return passed;
}

/**
 * Check API response with data
 */
export function checkApiResponse(response, name, checks = {}) {
  const baseChecks = {
    [`${name} status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name} response time < 500ms`]: (r) => r.timings.duration < 500,
    [`${name} has data`]: (r) => r.json('data') !== undefined,
  };

  const allChecks = { ...baseChecks, ...checks };
  const passed = check(response, allChecks);

  errorRate.add(!passed);
  successRate.add(passed);
  apiLatency.add(response.timings.duration);

  return passed;
}

/**
 * Check for authentication errors
 */
export function checkAuth(response, name) {
  const isAuthError = response.status === 401 || response.status === 403;

  if (isAuthError) {
    authErrors.add(1);
    console.error(`Authentication error on ${name}: ${response.status}`);
  }

  return !isAuthError;
}

/**
 * Check for business logic errors (4xx except auth)
 */
export function checkBusinessLogic(response, name) {
  const isBusinessError = response.status >= 400 &&
                          response.status < 500 &&
                          response.status !== 401 &&
                          response.status !== 403;

  if (isBusinessError) {
    businessErrors.add(1);
    console.warn(`Business error on ${name}: ${response.status} - ${response.body?.substring(0, 100)}`);
  }

  return !isBusinessError;
}

/**
 * Check for timeout
 */
export function checkTimeout(response, name, maxDuration = 10000) {
  const isTimeout = response.timings.duration >= maxDuration || response.status === 0;

  if (isTimeout) {
    timeouts.add(1);
    console.error(`Timeout on ${name}: ${response.timings.duration}ms`);
  }

  return !isTimeout;
}

/**
 * Comprehensive response check
 */
export function fullCheck(response, name, expectedStatus = 200) {
  return group(`Check ${name}`, () => {
    const statusOk = checkResponse(response, name, expectedStatus);
    const authOk = checkAuth(response, name);
    const businessOk = checkBusinessLogic(response, name);
    const timeoutOk = checkTimeout(response, name);

    return statusOk && authOk && businessOk && timeoutOk;
  });
}

/**
 * Check list response
 */
export function checkListResponse(response, name) {
  const passed = check(response, {
    [`${name} status is 200`]: (r) => r.status === 200,
    [`${name} data is array`]: (r) => Array.isArray(r.json('data')),
    [`${name} has pagination`]: (r) => r.json('pagination') !== undefined,
    [`${name} has total count`]: (r) => r.json('pagination.total') !== undefined,
  });

  errorRate.add(!passed);
  successRate.add(passed);
  apiLatency.add(response.timings.duration);

  return passed;
}

/**
 * Check created response
 */
export function checkCreatedResponse(response, name) {
  const passed = check(response, {
    [`${name} status is 201`]: (r) => r.status === 201,
    [`${name} has data`]: (r) => r.json('data') !== undefined,
    [`${name} has id`]: (r) => r.json('data.id') !== undefined,
  });

  errorRate.add(!passed);
  successRate.add(passed);
  apiLatency.add(response.timings.duration);

  return passed;
}

/**
 * Check deleted response
 */
export function checkDeletedResponse(response, name) {
  const passed = check(response, {
    [`${name} status is 204 or 200`]: (r) => r.status === 204 || r.status === 200,
  });

  errorRate.add(!passed);
  successRate.add(passed);

  return passed;
}

/**
 * Performance thresholds check
 */
export function checkPerformance(response, name, thresholds = {}) {
  const defaults = {
    p50: 100,
    p95: 200,
    p99: 500,
  };

  const limits = { ...defaults, ...thresholds };
  const duration = response.timings.duration;

  return check(response, {
    [`${name} under p50 (${limits.p50}ms)`]: () => duration < limits.p50,
    [`${name} under p95 (${limits.p95}ms)`]: () => duration < limits.p95,
    [`${name} under p99 (${limits.p99}ms)`]: () => duration < limits.p99,
  });
}

/**
 * Assert response meets SLA
 */
export function assertSLA(response, name, sla = { maxDuration: 500, minStatus: 200, maxStatus: 299 }) {
  const passed = check(response, {
    [`${name} meets SLA duration (${sla.maxDuration}ms)`]: (r) => r.timings.duration <= sla.maxDuration,
    [`${name} meets SLA status (${sla.minStatus}-${sla.maxStatus})`]: (r) =>
      r.status >= sla.minStatus && r.status <= sla.maxStatus,
  });

  if (!passed) {
    console.warn(`SLA violation on ${name}: ${response.timings.duration}ms, status ${response.status}`);
  }

  return passed;
}
