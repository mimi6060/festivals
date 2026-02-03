import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Entry Rush Simulation
 *
 * Simulates the entry gate rush when a festival opens:
 * - Mass ticket scanning at multiple gates
 * - NFC wristband activation
 * - Initial wallet setup
 * - First-time app sync
 *
 * Critical test for entry infrastructure capacity.
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');

// Scan metrics
const scanSuccessRate = new Rate('scan_success');
const scanLatency = new Trend('scan_latency', true);
const scanP50 = new Trend('scan_p50', true);
const scanP95 = new Trend('scan_p95', true);
const scanP99 = new Trend('scan_p99', true);
const totalScans = new Counter('total_scans');
const validScans = new Counter('valid_scans');
const invalidScans = new Counter('invalid_scans');
const duplicateScans = new Counter('duplicate_scans');

// Gate metrics
const gateLoad = new Gauge('gate_load');
const gateThroughput = new Counter('gate_throughput');
const gateAvgLatency = new Trend('gate_avg_latency', true);
const gateQueueLength = new Gauge('gate_queue_length');

// Wristband metrics
const wristbandActivations = new Counter('wristband_activations');
const wristbandActivationLatency = new Trend('wristband_activation_latency', true);
const wristbandFailures = new Counter('wristband_failures');

// Wallet metrics
const walletCreations = new Counter('wallet_creations');
const walletCreationLatency = new Trend('wallet_creation_latency', true);
const initialTopups = new Counter('initial_topups');

// Sync metrics
const initialSyncs = new Counter('initial_syncs');
const syncLatency = new Trend('sync_latency', true);

// Throughput metrics
const attendeesPerMinute = new Gauge('attendees_per_minute');
const peakGateThroughput = new Gauge('peak_gate_throughput');
const totalEntered = new Counter('total_entered');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const FESTIVAL_ID = __ENV.FESTIVAL_ID || 'fest_001';
const NUM_GATES = parseInt(__ENV.NUM_GATES) || 5;
const EXPECTED_CAPACITY = parseInt(__ENV.EXPECTED_CAPACITY) || 10000;

// Attendees with tickets
const attendees = new SharedArray('attendees', function () {
  return Array.from({ length: 5000 }, (_, i) => ({
    email: `entry_attendee_${i}@test.festivals.app`,
    password: 'Entry123!',
    ticketId: `ticket_entry_${i}`,
    ticketType: randomItem(['general', 'vip', 'backstage', 'camping']),
    qrCode: `FEST:ticket_entry_${i}:${Date.now() - i}`,
    nfcTag: `NFC:${i.toString(16).padStart(8, '0')}`,
    hasWristband: Math.random() > 0.3, // 70% pre-registered
    walletId: `wallet_entry_${i}`,
    // Simulate arrival distribution (most arrive at gates open)
    arrivalWave: i < 2000 ? 'early' : i < 4000 ? 'main' : 'late',
  }));
});

// Entry gate staff
const gateStaff = new SharedArray('gate_staff', function () {
  const staffList = [];

  // Multiple staff per gate
  for (let gate = 0; gate < NUM_GATES; gate++) {
    for (let pos = 0; pos < 4; pos++) {
      staffList.push({
        email: `gate_${gate}_staff_${pos}@test.festivals.app`,
        password: 'GateStaff123!',
        staffId: `gate_staff_${gate}_${pos}`,
        gateId: `gate_${gate}`,
        gateName: `Gate ${String.fromCharCode(65 + gate)}`, // Gate A, B, C, etc.
        position: pos,
      });
    }
  }
  return staffList;
});

export const options = {
  scenarios: {
    // Early birds - arrive before gates open
    early_arrivals: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },  // Early queue forming
        { duration: '30s', target: 100 },  // Waiting
      ],
      gracefulRampDown: '10s',
      exec: 'earlyArrival',
      startTime: '0s',
    },

    // Main rush - gates open
    main_rush: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '30s', target: 500 },   // Gates open - initial surge
        { duration: '1m', target: 1000 },   // Maximum rush
        { duration: '2m', target: 1000 },   // Sustained maximum
        { duration: '1m', target: 800 },    // Slight decrease
        { duration: '2m', target: 500 },    // Settling down
        { duration: '1m', target: 200 },    // Tail end
        { duration: '30s', target: 50 },    // Stragglers
      ],
      gracefulRampDown: '30s',
      exec: 'mainEntry',
      startTime: '1m',
    },

    // Gate staff operations
    gate_operations: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: NUM_GATES * 4 },  // All positions staffed
        { duration: '7m', target: NUM_GATES * 4 },   // Sustained operations
        { duration: '30s', target: NUM_GATES * 2 },  // Reduce as rush slows
      ],
      gracefulRampDown: '10s',
      exec: 'gateOperations',
      startTime: '30s',
    },

    // Wristband activation stations
    wristband_activation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '5m', target: 30 },
        { duration: '2m', target: 15 },
      ],
      gracefulRampDown: '10s',
      exec: 'wristbandActivation',
      startTime: '1m',
    },

    // App sync - first time app users
    app_sync: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 50 },
      ],
      gracefulRampDown: '10s',
      exec: 'initialAppSync',
      startTime: '1m',
    },
  },

  thresholds: {
    // Critical: scan latency must be fast
    scan_latency: ['p(50)<50', 'p(95)<100', 'p(99)<200'],
    scan_success: ['rate>0.98'],

    // Gate throughput
    gate_throughput: ['count>3000'],
    gate_avg_latency: ['p(95)<150'],

    // Wristband activation
    wristband_activation_latency: ['p(95)<500'],

    // Overall
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.02'],
  },

  tags: {
    test_type: 'entry_rush',
    festival_id: FESTIVAL_ID,
    num_gates: String(NUM_GATES),
  },
};

export function setup() {
  console.log('='.repeat(60));
  console.log('ENTRY RUSH SIMULATION');
  console.log('='.repeat(60));
  console.log(`Festival ID: ${FESTIVAL_ID}`);
  console.log(`Number of Gates: ${NUM_GATES}`);
  console.log(`Expected Capacity: ${EXPECTED_CAPACITY}`);
  console.log(`Attendees in test: ${attendees.length}`);
  console.log(`Gate staff: ${gateStaff.length}`);
  console.log('='.repeat(60));

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  return {
    baseUrl: BASE_URL,
    festivalId: FESTIVAL_ID,
    startTime: Date.now(),
    gatesOpenTime: Date.now() + 60000, // Gates open after 1 minute
  };
}

// Early arrival - attendees checking in before gates open
export function earlyArrival(data) {
  const baseUrl = data.baseUrl;
  const festivalId = data.festivalId;
  const attendeeIndex = __VU % attendees.filter(a => a.arrivalWave === 'early').length;
  const attendee = attendees.filter(a => a.arrivalWave === 'early')[attendeeIndex];

  if (!attendee) return;

  group('Early Arrival Check-in', () => {

    // App login
    const authRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: attendee.email, password: attendee.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (authRes.status !== 200) return;
    const accessToken = authRes.json('data.accessToken');

    // Check ticket status
    group('Verify Ticket', () => {
      const response = http.get(
        `${baseUrl}/api/v1/me/tickets/${attendee.ticketId}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'verify_ticket', phase: 'early' },
        }
      );

      check(response, {
        'ticket verified': (r) => r.status === 200,
        'ticket is valid': (r) => r.json('data.status') === 'valid',
      });
    });

    // View festival info while waiting
    group('View Festival Info', () => {
      http.get(`${baseUrl}/api/v1/festivals/${festivalId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'festival_info', phase: 'early' },
      });

      http.get(`${baseUrl}/api/v1/festivals/${festivalId}/map`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'map_view', phase: 'early' },
      });
    });

    // Setup wallet while waiting
    if (!attendee.hasWristband) {
      group('Pre-register Wallet', () => {
        const walletStartTime = Date.now();

        const response = http.post(
          `${baseUrl}/api/v1/me/wallets/${festivalId}`,
          null,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: 'create_wallet', phase: 'early' },
          }
        );

        walletCreationLatency.add(Date.now() - walletStartTime);

        if (response.status === 200 || response.status === 201) {
          walletCreations.add(1);
        }
      });
    }
  });

  // Waiting in queue
  sleep(randomIntBetween(5, 15));
}

// Main entry rush
export function mainEntry(data) {
  const baseUrl = data.baseUrl;
  const festivalId = data.festivalId;
  const attendeeIndex = __VU % attendees.length;
  const attendee = attendees[attendeeIndex];

  let accessToken = null;

  group('Main Entry Flow', () => {

    // Quick app auth (many check their phones in queue)
    if (Math.random() > 0.3) {
      const authRes = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({ email: attendee.email, password: attendee.password }),
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (authRes.status === 200) {
        accessToken = authRes.json('data.accessToken');
      }
    }

    // Select gate (distribute load)
    const gateIndex = __VU % NUM_GATES;
    const gateId = `gate_${gateIndex}`;

    // Submit QR for scanning (mobile ticket presentation)
    group('Present Ticket', () => {
      gateLoad.add(1);
      gateQueueLength.add(1);

      const scanStartTime = Date.now();

      // Simulate ticket presentation - this would be scanned by staff
      const response = http.post(
        `${baseUrl}/api/v1/tickets/validate`,
        JSON.stringify({
          qrCode: attendee.qrCode,
          ticketId: attendee.ticketId,
          gateId: gateId,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          tags: { name: 'ticket_validate', gate: gateId },
        }
      );

      const scanDuration = Date.now() - scanStartTime;

      gateLoad.add(-1);
      gateQueueLength.add(-1);

      // Track scan metrics
      scanLatency.add(scanDuration);
      scanP50.add(scanDuration);
      scanP95.add(scanDuration);
      scanP99.add(scanDuration);
      gateAvgLatency.add(scanDuration);
      totalScans.add(1);

      const passed = check(response, {
        'ticket validated': (r) => r.status === 200,
        'scan time < 100ms': () => scanDuration < 100,
        'scan time < 200ms': () => scanDuration < 200,
      });

      if (passed) {
        validScans.add(1);
        scanSuccessRate.add(true);
        gateThroughput.add(1);
        totalEntered.add(1);
      } else if (response.status === 409) {
        duplicateScans.add(1);
        scanSuccessRate.add(false);
      } else {
        invalidScans.add(1);
        scanSuccessRate.add(false);
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    // Post-entry actions
    if (accessToken) {
      // Quick sync after entry
      if (Math.random() > 0.5) {
        group('Post-Entry Sync', () => {
          const syncStart = Date.now();

          http.get(
            `${baseUrl}/api/v1/sync?since=${Date.now() - 3600000}`,
            {
              headers: { 'Authorization': `Bearer ${accessToken}` },
              tags: { name: 'post_entry_sync' },
            }
          );

          syncLatency.add(Date.now() - syncStart);
          initialSyncs.add(1);
        });
      }

      // Check wallet balance
      group('Check Wallet', () => {
        http.get(
          `${baseUrl}/api/v1/me/wallets/${festivalId}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: 'check_wallet', phase: 'entry' },
          }
        );
      });
    }
  });

  // Brief delay between entries (queue movement)
  sleep(randomIntBetween(1, 5));
}

// Gate staff operations
export function gateOperations(data) {
  const baseUrl = data.baseUrl;
  const staffIndex = __VU % gateStaff.length;
  const staffMember = gateStaff[staffIndex];

  let accessToken = null;

  group('Gate Staff Operations', () => {

    // Staff login
    const authRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: staffMember.email, password: staffMember.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (authRes.status !== 200) return;
    accessToken = authRes.json('data.accessToken');

    // Process scans at this position
    const scansPerBatch = randomIntBetween(5, 15);

    for (let i = 0; i < scansPerBatch; i++) {
      const attendee = attendees[randomIntBetween(0, attendees.length - 1)];

      group(`Scan ${i + 1}`, () => {
        const scanStartTime = Date.now();

        const response = http.post(
          `${baseUrl}/api/v1/tickets/scan`,
          JSON.stringify({
            qrCode: attendee.qrCode,
            gateId: staffMember.gateId,
            staffId: staffMember.staffId,
            scanType: 'entry',
            timestamp: new Date().toISOString(),
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            tags: {
              name: 'staff_scan',
              gate: staffMember.gateId,
              position: String(staffMember.position),
            },
          }
        );

        const scanDuration = Date.now() - scanStartTime;
        scanLatency.add(scanDuration);
        gateAvgLatency.add(scanDuration);
        totalScans.add(1);

        const passed = check(response, {
          'scan processed': (r) => r.status === 200 || r.status === 400 || r.status === 409,
          'scan fast': () => scanDuration < 100,
        });

        if (response.status === 200) {
          validScans.add(1);
          gateThroughput.add(1);
          totalEntered.add(1);
          scanSuccessRate.add(true);
        } else if (response.status === 409) {
          duplicateScans.add(1);
          scanSuccessRate.add(false);
        } else {
          invalidScans.add(1);
          scanSuccessRate.add(false);
        }

        errorRate.add(!passed);
        successRate.add(passed);
      });

      // Time between scans (scan, verify, wave through)
      sleep(randomIntBetween(2, 8) / 10);
    }

    // Periodic stats check
    if (Math.random() < 0.1) {
      group('Gate Stats', () => {
        http.get(
          `${baseUrl}/api/v1/entries/stats?gateId=${staffMember.gateId}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: 'gate_stats' },
          }
        );
      });
    }
  });

  sleep(randomIntBetween(1, 3));
}

// Wristband activation stations
export function wristbandActivation(data) {
  const baseUrl = data.baseUrl;
  const festivalId = data.festivalId;

  // Find attendees without wristbands
  const needsWristband = attendees.filter(a => !a.hasWristband);
  const attendee = needsWristband[__VU % needsWristband.length];

  if (!attendee) return;

  group('Wristband Activation', () => {

    // Attendee auth at kiosk
    const authRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: attendee.email, password: attendee.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (authRes.status !== 200) return;
    const accessToken = authRes.json('data.accessToken');

    // Activate NFC wristband
    group('Activate Wristband', () => {
      const activationStart = Date.now();

      const response = http.post(
        `${baseUrl}/api/v1/nfc/activate`,
        JSON.stringify({
          nfcTag: attendee.nfcTag,
          ticketId: attendee.ticketId,
          walletId: attendee.walletId,
          festivalId: festivalId,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'wristband_activate' },
        }
      );

      const activationDuration = Date.now() - activationStart;
      wristbandActivationLatency.add(activationDuration);

      const passed = check(response, {
        'wristband activated': (r) => r.status === 200 || r.status === 201,
        'activation < 500ms': () => activationDuration < 500,
      });

      if (passed) {
        wristbandActivations.add(1);
      } else {
        wristbandFailures.add(1);
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    // Link to wallet
    group('Link Wallet', () => {
      const walletStart = Date.now();

      const walletRes = http.post(
        `${baseUrl}/api/v1/me/wallets/${festivalId}/link-nfc`,
        JSON.stringify({ nfcTag: attendee.nfcTag }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'link_nfc' },
        }
      );

      walletCreationLatency.add(Date.now() - walletStart);

      if (walletRes.status === 200 || walletRes.status === 201) {
        walletCreations.add(1);
      }
    });

    // Optional initial top-up
    if (Math.random() > 0.5) {
      group('Initial Topup', () => {
        const amount = randomItem([2000, 5000, 10000, 20000]);

        const topupRes = http.post(
          `${baseUrl}/api/v1/wallets/${attendee.walletId}/topup`,
          JSON.stringify({
            amount: amount,
            paymentMethod: 'card',
            cardToken: `tok_init_${Date.now()}`,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            tags: { name: 'initial_topup' },
          }
        );

        if (topupRes.status === 200) {
          initialTopups.add(1);
        }
      });
    }
  });

  // Activation takes some time
  sleep(randomIntBetween(10, 30));
}

// Initial app sync for first-time users
export function initialAppSync(data) {
  const baseUrl = data.baseUrl;
  const festivalId = data.festivalId;
  const attendee = attendees[__VU % attendees.length];

  group('Initial App Sync', () => {

    // Login
    const authRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: attendee.email, password: attendee.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (authRes.status !== 200) return;
    const accessToken = authRes.json('data.accessToken');

    // Full initial sync
    group('Full Sync', () => {
      const syncStart = Date.now();

      const response = http.post(
        `${baseUrl}/api/v1/sync/full`,
        JSON.stringify({
          deviceId: `device_${__VU}_${Date.now()}`,
          festivalId: festivalId,
          includeAll: true,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'initial_full_sync' },
        }
      );

      syncLatency.add(Date.now() - syncStart);
      initialSyncs.add(1);

      check(response, {
        'sync successful': (r) => r.status === 200,
      });
    });

    // Download lineup
    group('Download Lineup', () => {
      http.get(`${baseUrl}/api/v1/festivals/${festivalId}/lineup`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'download_lineup' },
      });
    });

    // Download map
    group('Download Map', () => {
      http.get(`${baseUrl}/api/v1/festivals/${festivalId}/map`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'download_map' },
      });
    });

    // Get notifications
    group('Get Notifications', () => {
      http.get(`${baseUrl}/api/v1/notifications`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        tags: { name: 'get_notifications' },
      });
    });
  });

  sleep(randomIntBetween(3, 10));
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  const avgThroughput = totalEntered / (duration / 60);

  console.log('\n' + '='.repeat(70));
  console.log('ENTRY RUSH SIMULATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`Duration: ${(duration / 60).toFixed(1)} minutes`);
  console.log(`Number of Gates: ${NUM_GATES}`);
  console.log('');
  console.log('Gate Performance:');
  console.log('- Check scan_latency (p50, p95, p99) for scan speed');
  console.log('- Check scan_success for scan accuracy (target: >98%)');
  console.log('- Check gate_throughput for entries processed');
  console.log('');
  console.log('Entry Statistics:');
  console.log('- Check total_entered for total successful entries');
  console.log('- Check valid_scans vs invalid_scans vs duplicate_scans');
  console.log('- Check attendees_per_minute for throughput');
  console.log('');
  console.log('Wristband Operations:');
  console.log('- Check wristband_activations for activations');
  console.log('- Check wristband_activation_latency for speed');
  console.log('');
  console.log('Capacity Validation:');
  console.log(`- Target capacity: ${EXPECTED_CAPACITY}`);
  console.log(`- Average throughput: ${avgThroughput.toFixed(0)} attendees/min`);
  console.log(`- Projected time to full capacity: ${(EXPECTED_CAPACITY / avgThroughput).toFixed(0)} minutes`);
  console.log('='.repeat(70));
}
