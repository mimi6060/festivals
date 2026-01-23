import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Sync Load Test
 *
 * Simulates device synchronization scenarios:
 * 1. Many devices syncing simultaneously
 * 2. Sync queue throughput testing
 * 3. Conflict resolution under load
 * 4. Offline data sync patterns
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');

// Sync metrics
const syncSuccessRate = new Rate('sync_success');
const syncLatency = new Trend('sync_latency', true);
const syncThroughput = new Counter('sync_throughput');
const syncQueueDepth = new Gauge('sync_queue_depth');
const syncBatchSize = new Trend('sync_batch_size');

// Conflict metrics
const conflictCount = new Counter('conflict_count');
const conflictResolutionTime = new Trend('conflict_resolution_time', true);
const conflictResolutionSuccess = new Rate('conflict_resolution_success');
const mergeConflicts = new Counter('merge_conflicts');
const overwrites = new Counter('overwrites');

// Delta sync metrics
const deltaSyncLatency = new Trend('delta_sync_latency', true);
const fullSyncLatency = new Trend('full_sync_latency', true);
const deltaSyncSize = new Trend('delta_sync_size');

// Queue metrics
const queuePushLatency = new Trend('queue_push_latency', true);
const queueProcessLatency = new Trend('queue_process_latency', true);
const queueBacklog = new Counter('queue_backlog');

// Device metrics
const activeDevices = new Gauge('active_devices');
const deviceSyncFrequency = new Trend('device_sync_frequency');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const FESTIVAL_ID = __ENV.FESTIVAL_ID || 'fest_001';

// Simulated devices (mobile apps, POS terminals, etc.)
const devices = new SharedArray('devices', function () {
  const deviceTypes = ['mobile_ios', 'mobile_android', 'pos_terminal', 'tablet', 'kiosk'];
  return Array.from({ length: 500 }, (_, i) => ({
    deviceId: `device_${i}`,
    deviceType: deviceTypes[i % deviceTypes.length],
    userId: `user_sync_${i}`,
    email: `synctest_user_${i}@test.festivals.app`,
    password: 'SyncTest123!',
    lastSyncTimestamp: Date.now() - randomIntBetween(60000, 3600000), // 1min to 1hr ago
    offlineChanges: randomIntBetween(0, 20),
  }));
});

// Sync data types
const syncDataTypes = [
  'wallet_balance',
  'transactions',
  'tickets',
  'favorites',
  'preferences',
  'notifications',
  'lineup_changes',
  'map_updates',
];

export const options = {
  scenarios: {
    // Scenario 1: Normal sync pattern - devices syncing periodically
    normal_sync: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },   // 100 devices online
        { duration: '5m', target: 100 },   // Sustained
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      exec: 'normalSync',
      startTime: '0s',
    },

    // Scenario 2: Mass sync - festival start scenario
    mass_sync: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 500 },  // All devices come online
        { duration: '3m', target: 500 },   // All syncing
        { duration: '1m', target: 200 },   // Settle down
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
      exec: 'massSync',
      startTime: '7m',
    },

    // Scenario 3: Conflict resolution - concurrent updates
    conflict_test: {
      executor: 'constant-vus',
      vus: 50,
      duration: '3m',
      exec: 'conflictTest',
      startTime: '12m',
    },

    // Scenario 4: Queue throughput - offline sync queue processing
    queue_throughput: {
      executor: 'constant-arrival-rate',
      rate: 100,  // 100 sync requests per second
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'queueTest',
      startTime: '16m',
    },

    // Scenario 5: Delta sync performance
    delta_sync: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 200 },
        { duration: '3m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      exec: 'deltaSyncTest',
      startTime: '20m',
    },
  },

  thresholds: {
    // Sync performance
    sync_latency: ['p(50)<200', 'p(95)<500', 'p(99)<1000'],
    sync_success: ['rate>0.98'],

    // Delta sync (should be faster)
    delta_sync_latency: ['p(50)<100', 'p(95)<300', 'p(99)<500'],

    // Conflict resolution
    conflict_resolution_time: ['p(95)<1000'],
    conflict_resolution_success: ['rate>0.95'],

    // Queue performance
    queue_push_latency: ['p(95)<100'],
    queue_process_latency: ['p(95)<500'],
  },

  tags: {
    test_type: 'sync_load',
    festival_id: FESTIVAL_ID,
  },
};

export function setup() {
  console.log('Starting Sync Load Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Festival ID: ${FESTIVAL_ID}`);
  console.log(`Simulated devices: ${devices.length}`);

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  return {
    baseUrl: BASE_URL,
    festivalId: FESTIVAL_ID,
    startTime: Date.now(),
  };
}

// Normal sync pattern
export function normalSync(data) {
  const baseUrl = data.baseUrl;
  const festivalId = data.festivalId;
  const deviceIndex = __VU % devices.length;
  const device = devices[deviceIndex];

  let accessToken = null;

  group('Normal Sync Flow', () => {
    activeDevices.add(1);

    // Authenticate device
    group('Device Auth', () => {
      const response = http.post(
        `${baseUrl}/api/v1/auth/login`,
        JSON.stringify({
          email: device.email,
          password: device.password,
          deviceId: device.deviceId,
          deviceType: device.deviceType,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'device_auth', device_type: device.deviceType },
        }
      );

      if (response.status === 200) {
        accessToken = response.json('data.accessToken');
      }
    });

    if (!accessToken) {
      activeDevices.add(-1);
      return;
    }

    // Perform sync
    group('Data Sync', () => {
      const syncStartTime = Date.now();

      // Request sync with last known timestamp
      const syncPayload = JSON.stringify({
        deviceId: device.deviceId,
        lastSyncTimestamp: device.lastSyncTimestamp,
        requestedData: syncDataTypes,
        clientVersion: '1.0.0',
      });

      const response = http.post(
        `${baseUrl}/api/v1/sync`,
        syncPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Device-ID': device.deviceId,
          },
          tags: { name: 'sync', device_type: device.deviceType },
        }
      );

      const syncDuration = Date.now() - syncStartTime;
      syncLatency.add(syncDuration);

      const passed = check(response, {
        'sync successful': (r) => r.status === 200,
        'sync time < 500ms': () => syncDuration < 500,
        'has sync data': (r) => r.json('data') !== undefined,
      });

      if (passed) {
        syncSuccessRate.add(true);
        syncThroughput.add(1);

        // Track sync batch size
        const responseData = response.json('data');
        if (responseData && responseData.changes) {
          syncBatchSize.add(responseData.changes.length || 0);
        }
      } else {
        syncSuccessRate.add(false);
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    // Push local changes if any
    if (device.offlineChanges > 0) {
      group('Push Changes', () => {
        const changes = generateOfflineChanges(device, randomIntBetween(1, 5));
        const pushStartTime = Date.now();

        const response = http.post(
          `${baseUrl}/api/v1/sync/push`,
          JSON.stringify({
            deviceId: device.deviceId,
            changes: changes,
            timestamp: Date.now(),
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
              'X-Device-ID': device.deviceId,
            },
            tags: { name: 'sync_push', device_type: device.deviceType },
          }
        );

        queuePushLatency.add(Date.now() - pushStartTime);

        const passed = check(response, {
          'push successful': (r) => r.status === 200 || r.status === 201,
        });

        if (response.json('conflicts')) {
          conflictCount.add(response.json('conflicts').length);
        }

        errorRate.add(!passed);
        successRate.add(passed);
      });
    }

    activeDevices.add(-1);
  });

  // Simulate periodic sync (every 30-60 seconds in real scenario)
  sleep(randomIntBetween(5, 15));
}

// Mass sync - all devices syncing at once
export function massSync(data) {
  const baseUrl = data.baseUrl;
  const festivalId = data.festivalId;
  const deviceIndex = __VU % devices.length;
  const device = devices[deviceIndex];

  let accessToken = null;

  group('Mass Sync Flow', () => {
    activeDevices.add(1);

    // Quick auth
    const authRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: device.email, password: device.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (authRes.status !== 200) {
      activeDevices.add(-1);
      return;
    }
    accessToken = authRes.json('data.accessToken');

    // Full sync request (simulating app launch)
    group('Full Sync', () => {
      const syncStartTime = Date.now();

      const response = http.post(
        `${baseUrl}/api/v1/sync/full`,
        JSON.stringify({
          deviceId: device.deviceId,
          festivalId: festivalId,
          includeAll: true,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Device-ID': device.deviceId,
          },
          tags: { name: 'full_sync', scenario: 'mass' },
        }
      );

      const syncDuration = Date.now() - syncStartTime;
      fullSyncLatency.add(syncDuration);
      syncLatency.add(syncDuration);

      const passed = check(response, {
        'full sync successful': (r) => r.status === 200,
        'full sync time < 2s': () => syncDuration < 2000,
      });

      if (passed) {
        syncSuccessRate.add(true);
        syncThroughput.add(1);
      } else {
        syncSuccessRate.add(false);
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    activeDevices.add(-1);
  });

  // Short delay - mass sync scenario
  sleep(randomIntBetween(1, 3));
}

// Conflict resolution test
export function conflictTest(data) {
  const baseUrl = data.baseUrl;
  const festivalId = data.festivalId;

  // Use a small set of shared resources for conflict generation
  const sharedResourceIndex = __VU % 10; // 10 shared resources
  const device = devices[__VU % devices.length];

  let accessToken = null;

  group('Conflict Test', () => {

    // Auth
    const authRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: device.email, password: device.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (authRes.status !== 200) return;
    accessToken = authRes.json('data.accessToken');

    // Get current state of shared resource
    let currentVersion = 0;
    group('Get Resource', () => {
      const response = http.get(
        `${baseUrl}/api/v1/sync/resource/shared_${sharedResourceIndex}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          tags: { name: 'get_resource', test: 'conflict' },
        }
      );

      if (response.status === 200) {
        currentVersion = response.json('data.version') || 0;
      }
    });

    sleep(0.05);

    // Attempt concurrent update
    group('Update Resource', () => {
      const updateStartTime = Date.now();

      const response = http.put(
        `${baseUrl}/api/v1/sync/resource/shared_${sharedResourceIndex}`,
        JSON.stringify({
          deviceId: device.deviceId,
          version: currentVersion,
          data: {
            value: `update_${__VU}_${__ITER}_${Date.now()}`,
            timestamp: Date.now(),
          },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Device-ID': device.deviceId,
          },
          tags: { name: 'update_resource', test: 'conflict' },
        }
      );

      const updateDuration = Date.now() - updateStartTime;

      if (response.status === 200 || response.status === 201) {
        // Update successful
        successRate.add(true);
        conflictResolutionSuccess.add(true);
      } else if (response.status === 409) {
        // Conflict detected
        conflictCount.add(1);

        // Attempt conflict resolution
        group('Resolve Conflict', () => {
          const resolutionStart = Date.now();

          const conflictData = response.json('data');
          const serverVersion = conflictData?.serverVersion || currentVersion + 1;

          // Merge strategy: accept server version and reapply change
          const mergeResponse = http.post(
            `${baseUrl}/api/v1/sync/resolve`,
            JSON.stringify({
              deviceId: device.deviceId,
              resourceId: `shared_${sharedResourceIndex}`,
              serverVersion: serverVersion,
              clientData: {
                value: `merged_${__VU}_${__ITER}_${Date.now()}`,
                timestamp: Date.now(),
              },
              strategy: 'merge', // or 'client_wins', 'server_wins'
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              tags: { name: 'resolve_conflict', test: 'conflict' },
            }
          );

          const resolutionDuration = Date.now() - resolutionStart;
          conflictResolutionTime.add(resolutionDuration);

          const resolved = check(mergeResponse, {
            'conflict resolved': (r) => r.status === 200 || r.status === 201,
          });

          if (resolved) {
            mergeConflicts.add(1);
            conflictResolutionSuccess.add(true);
          } else {
            conflictResolutionSuccess.add(false);
          }
        });
      } else {
        errorRate.add(true);
        conflictResolutionSuccess.add(false);
      }
    });
  });

  // Very short delay for conflict generation
  sleep(0.1);
}

// Queue throughput test
export function queueTest(data) {
  const baseUrl = data.baseUrl;
  const device = devices[__VU % devices.length];

  let accessToken = null;

  group('Queue Throughput Test', () => {

    // Quick auth
    const authRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: device.email, password: device.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (authRes.status !== 200) return;
    accessToken = authRes.json('data.accessToken');

    // Push to sync queue
    group('Queue Push', () => {
      const queueStartTime = Date.now();

      const changes = generateOfflineChanges(device, randomIntBetween(5, 20));

      const response = http.post(
        `${baseUrl}/api/v1/sync/queue`,
        JSON.stringify({
          deviceId: device.deviceId,
          changes: changes,
          priority: randomItem(['high', 'normal', 'low']),
          timestamp: Date.now(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Device-ID': device.deviceId,
          },
          tags: { name: 'queue_push' },
        }
      );

      const queueDuration = Date.now() - queueStartTime;
      queuePushLatency.add(queueDuration);

      const passed = check(response, {
        'queued successfully': (r) => r.status === 200 || r.status === 201 || r.status === 202,
        'queue time < 100ms': () => queueDuration < 100,
      });

      if (passed) {
        syncThroughput.add(1);

        // Track queue depth if provided
        const queueInfo = response.json('data.queueInfo');
        if (queueInfo && queueInfo.depth !== undefined) {
          syncQueueDepth.add(queueInfo.depth);
        }
      } else {
        queueBacklog.add(1);
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });

    // Check queue status
    if (Math.random() < 0.2) {
      group('Queue Status', () => {
        const response = http.get(
          `${baseUrl}/api/v1/sync/queue/status?deviceId=${device.deviceId}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            tags: { name: 'queue_status' },
          }
        );

        if (response.status === 200) {
          const status = response.json('data');
          if (status && status.pending !== undefined) {
            syncQueueDepth.add(status.pending);
          }
        }
      });
    }
  });

  // No sleep - testing throughput
}

// Delta sync performance test
export function deltaSyncTest(data) {
  const baseUrl = data.baseUrl;
  const festivalId = data.festivalId;
  const device = devices[__VU % devices.length];

  let accessToken = null;

  group('Delta Sync Test', () => {

    // Auth
    const authRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: device.email, password: device.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (authRes.status !== 200) return;
    accessToken = authRes.json('data.accessToken');

    // Delta sync with varying timestamps
    const timestamps = [
      Date.now() - 60000,      // 1 minute ago
      Date.now() - 300000,     // 5 minutes ago
      Date.now() - 900000,     // 15 minutes ago
      Date.now() - 3600000,    // 1 hour ago
    ];

    const sinceTimetamp = randomItem(timestamps);

    group('Delta Sync', () => {
      const syncStartTime = Date.now();

      const response = http.get(
        `${baseUrl}/api/v1/sync/delta?since=${sinceTimetamp}&deviceId=${device.deviceId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Device-ID': device.deviceId,
          },
          tags: { name: 'delta_sync' },
        }
      );

      const syncDuration = Date.now() - syncStartTime;
      deltaSyncLatency.add(syncDuration);
      syncLatency.add(syncDuration);

      const passed = check(response, {
        'delta sync successful': (r) => r.status === 200,
        'delta sync time < 300ms': () => syncDuration < 300,
      });

      if (passed) {
        syncSuccessRate.add(true);
        syncThroughput.add(1);

        // Track delta size
        const changes = response.json('data.changes');
        if (changes) {
          deltaSyncSize.add(changes.length || 0);
        }
      } else {
        syncSuccessRate.add(false);
      }

      errorRate.add(!passed);
      successRate.add(passed);
    });
  });

  sleep(randomIntBetween(2, 5));
}

// Helper function to generate offline changes
function generateOfflineChanges(device, count) {
  const changeTypes = [
    'favorite_added',
    'favorite_removed',
    'preference_updated',
    'notification_read',
    'schedule_updated',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `change_${device.deviceId}_${Date.now()}_${i}`,
    type: randomItem(changeTypes),
    timestamp: Date.now() - randomIntBetween(0, 3600000),
    data: {
      deviceId: device.deviceId,
      value: `value_${i}`,
    },
  }));
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;

  console.log('\n' + '='.repeat(70));
  console.log('SYNC LOAD TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log('');
  console.log('Sync Performance:');
  console.log('- Check sync_latency for overall sync performance');
  console.log('- Check delta_sync_latency vs full_sync_latency');
  console.log('- Check sync_throughput for total syncs processed');
  console.log('');
  console.log('Conflict Handling:');
  console.log('- Check conflict_count for conflicts detected');
  console.log('- Check conflict_resolution_time for resolution speed');
  console.log('- Check conflict_resolution_success for success rate');
  console.log('');
  console.log('Queue Performance:');
  console.log('- Check queue_push_latency for queue write speed');
  console.log('- Check sync_queue_depth for queue backlog');
  console.log('='.repeat(70));
}
