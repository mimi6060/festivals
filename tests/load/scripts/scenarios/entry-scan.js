import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Entry Scan Scenario
 *
 * Simulates entry gate operations:
 * 1. Staff login
 * 2. Scan QR code
 * 3. Validate ticket
 * 4. Record entry
 * 5. Handle re-entries and exits
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const scanSuccessRate = new Rate('scan_success');
const scanLatency = new Trend('scan_latency');
const validationLatency = new Trend('validation_latency');
const validScans = new Counter('valid_scans');
const invalidScans = new Counter('invalid_scans');
const duplicateScans = new Counter('duplicate_scans');
const reEntries = new Counter('re_entries');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test data - Staff accounts
const staffUsers = new SharedArray('staff', function () {
  return Array.from({ length: 20 }, (_, i) => ({
    email: `staff_scanner_${i}@test.festivals.app`,
    password: 'StaffScan123!',
    gateId: `gate_${(i % 5) + 1}`,
  }));
});

// Simulated ticket QR codes
const ticketQRCodes = new SharedArray('tickets', function () {
  return Array.from({ length: 1000 }, (_, i) => ({
    qrCode: `FEST:ticket_${i}:${Date.now() - i * 1000}`,
    ticketId: `ticket_${i}`,
    status: i % 10 === 0 ? 'used' : 'valid', // 10% already used
    type: randomItem(['general', 'vip', 'backstage']),
  }));
});

export const options = {
  scenarios: {
    entry_scan: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // Gates opening
        { duration: '3m', target: 20 },   // Peak entry
        { duration: '5m', target: 20 },   // Sustained entry
        { duration: '2m', target: 10 },   // Entry slowing
        { duration: '1m', target: 5 },    // Late entries
        { duration: '30s', target: 0 },   // Gates closing
      ],
      gracefulRampDown: '10s',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<200'],
    http_req_failed: ['rate<0.01'],
    scan_success: ['rate>0.85'], // Account for already used tickets
    scan_latency: ['p(95)<100'],
    validation_latency: ['p(95)<50'],
  },

  tags: {
    test_type: 'scenario',
    scenario: 'entry_scan',
  },
};

export function setup() {
  console.log('Starting entry scan scenario');

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('API not available');
  }

  return { baseUrl: BASE_URL };
}

export default function (data) {
  const baseUrl = data.baseUrl;
  const staffIndex = __VU % staffUsers.length;
  const staff = staffUsers[staffIndex];

  let accessToken = null;

  group('Entry Scan Flow', () => {

    // Step 1: Staff login
    group('1. Staff Authentication', () => {
      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: staff.email, password: staff.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'staff_login' },
        }
      );

      const passed = check(response, {
        'staff login successful': (r) => r.status === 200,
        'has access token': (r) => r.json('data.accessToken') !== undefined,
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

    // Simulate scanning multiple tickets per staff session
    const scansPerSession = randomIntBetween(5, 20);

    for (let i = 0; i < scansPerSession; i++) {
      const ticket = ticketQRCodes[randomIntBetween(0, ticketQRCodes.length - 1)];
      const isReEntry = Math.random() < 0.15; // 15% re-entries

      // Step 2: Scan QR code
      group('2. Scan QR Code', () => {
        const scanStartTime = Date.now();

        const scanPayload = JSON.stringify({
          qrCode: ticket.qrCode,
          gateId: staff.gateId,
          scanType: isReEntry ? 're-entry' : 'entry',
          timestamp: new Date().toISOString(),
        });

        const response = http.post(`${baseUrl}/api/v1/tickets/scan`, scanPayload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'scan_ticket' },
        });

        const scanDuration = Date.now() - scanStartTime;
        scanLatency.add(scanDuration);

        const passed = check(response, {
          'scan processed': (r) => r.status === 200 || r.status === 400 || r.status === 409,
          'scan time < 100ms': () => scanDuration < 100,
        });

        // Handle different scan results
        if (response.status === 200) {
          const result = response.json('data');
          if (result && result.valid) {
            validScans.add(1);
            scanSuccessRate.add(true);
          } else {
            invalidScans.add(1);
            scanSuccessRate.add(false);
          }
        } else if (response.status === 409) {
          // Already scanned
          duplicateScans.add(1);
          scanSuccessRate.add(false);
        } else if (response.status === 400) {
          invalidScans.add(1);
          scanSuccessRate.add(false);
        }

        if (isReEntry && response.status === 200) {
          reEntries.add(1);
        }

        errorRate.add(!passed);
        successRate.add(passed);
      });

      // Step 3: Validate ticket details (for suspicious tickets)
      if (Math.random() < 0.1) { // 10% additional validation
        group('3. Additional Validation', () => {
          const validationStart = Date.now();

          const response = http.get(
            `${baseUrl}/api/v1/tickets/${ticket.ticketId}/validate`,
            {
              headers: { 'Authorization': `Bearer ${accessToken}` },
              tags: { name: 'validate_ticket' },
            }
          );

          validationLatency.add(Date.now() - validationStart);

          const passed = check(response, {
            'validation response': (r) => r.status === 200 || r.status === 404,
          });

          errorRate.add(!passed);
          successRate.add(passed);
        });
      }

      // Step 4: Record entry (automatic with scan, but check status)
      if (Math.random() < 0.2) { // 20% check entry log
        group('4. Check Entry Log', () => {
          const response = http.get(
            `${baseUrl}/api/v1/entries/gate/${staff.gateId}?limit=10`,
            {
              headers: { 'Authorization': `Bearer ${accessToken}` },
              tags: { name: 'entry_log' },
            }
          );

          const passed = check(response, {
            'entry log retrieved': (r) => r.status === 200,
          });

          errorRate.add(!passed);
          successRate.add(passed);
        });
      }

      // Time between scans (simulates queue movement)
      sleep(randomIntBetween(1, 5) / 10); // 0.1 - 0.5 seconds
    }

    // Step 5: Check gate statistics (end of shift)
    if (Math.random() < 0.1) { // 10% check stats
      group('5. Gate Statistics', () => {
        const response = http.get(
          `${baseUrl}/api/v1/entries/stats?gateId=${staff.gateId}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: 'gate_stats' },
          }
        );

        const passed = check(response, {
          'stats retrieved': (r) => r.status === 200,
        });

        errorRate.add(!passed);
        successRate.add(passed);
      });
    }
  });

  // Brief pause between staff sessions
  sleep(randomIntBetween(2, 5));
}

export function teardown(data) {
  console.log('Entry scan scenario completed');
  console.log('Review valid_scans, invalid_scans, duplicate_scans, and re_entries counters');
}
