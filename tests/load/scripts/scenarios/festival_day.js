import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Festival Day Simulation
 *
 * Simulates a complete festival day pattern from gates opening to closing:
 * - 10:00 - Gates open, initial rush
 * - 12:00 - Lunch peak
 * - 14:00 - Afternoon lull
 * - 18:00 - Dinner peak
 * - 20:00 - Main stage performances
 * - 23:00 - Late night
 * - 02:00 - Festival closes
 *
 * Realistic user behavior patterns for a full day.
 */

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');

// Activity metrics
const entryScans = new Counter('entry_scans');
const walletTopups = new Counter('wallet_topups');
const foodPurchases = new Counter('food_purchases');
const drinkPurchases = new Counter('drink_purchases');
const merchPurchases = new Counter('merch_purchases');
const lineupViews = new Counter('lineup_views');
const mapViews = new Counter('map_views');
const favoriteActions = new Counter('favorite_actions');

// Performance metrics
const avgResponseTime = new Trend('avg_response_time', true);
const peakResponseTime = new Trend('peak_response_time', true);

// Business metrics
const totalRevenue = new Counter('total_revenue_cents');
const uniqueActiveUsers = new Gauge('unique_active_users');
const concurrentTransactions = new Gauge('concurrent_transactions');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const FESTIVAL_ID = __ENV.FESTIVAL_ID || 'fest_001';

// Time compression: 1 minute real time = 1 hour festival time
// Full test runs ~16 minutes for a 16-hour festival day
const TIME_COMPRESSION = 60;

// Test attendees
const attendees = new SharedArray('attendees', function () {
  return Array.from({ length: 2000 }, (_, i) => ({
    email: `festday_user_${i}@test.festivals.app`,
    password: 'FestDay123!',
    ticketId: `ticket_day_${i}`,
    walletId: `wallet_day_${i}`,
    qrCode: `FEST:ticket_day_${i}:${Date.now()}`,
    // User personas
    persona: getPersona(i),
    arrivalHour: getArrivalHour(i),
    departureHour: getDepartureHour(i),
  }));
});

// Staff members
const staff = new SharedArray('staff', function () {
  return Array.from({ length: 50 }, (_, i) => ({
    email: `festday_staff_${i}@test.festivals.app`,
    password: 'StaffDay123!',
    staffId: `staff_day_${i}`,
    role: i < 20 ? 'entry' : i < 40 ? 'vendor' : 'support',
    standId: `stand_${i % 10}`,
  }));
});

// Vendor stands
const stands = new SharedArray('stands', function () {
  return [
    { id: 'stand_0', name: 'Main Food Court', type: 'food', peakHours: [12, 13, 18, 19] },
    { id: 'stand_1', name: 'Pizza Stand', type: 'food', peakHours: [12, 13, 19, 20] },
    { id: 'stand_2', name: 'Burger Station', type: 'food', peakHours: [13, 14, 18, 19] },
    { id: 'stand_3', name: 'Main Bar', type: 'drinks', peakHours: [16, 17, 21, 22, 23] },
    { id: 'stand_4', name: 'Beer Garden', type: 'drinks', peakHours: [14, 15, 20, 21, 22] },
    { id: 'stand_5', name: 'Cocktail Bar', type: 'drinks', peakHours: [18, 19, 22, 23, 0] },
    { id: 'stand_6', name: 'Official Merch', type: 'merch', peakHours: [11, 12, 15, 16, 21] },
    { id: 'stand_7', name: 'Artist Merch', type: 'merch', peakHours: [21, 22, 23] },
    { id: 'stand_8', name: 'Water Station', type: 'drinks', peakHours: [14, 15, 20, 21] },
    { id: 'stand_9', name: 'Late Night Food', type: 'food', peakHours: [23, 0, 1] },
  ];
});

// Festival day schedule (hours are in compressed time)
const festivalSchedule = {
  gatesOpen: 10,
  lunchStart: 12,
  lunchEnd: 14,
  afternoonLull: 14,
  dinnerStart: 18,
  dinnerEnd: 20,
  mainStageStart: 20,
  lateNight: 23,
  gatesClose: 2, // 2 AM next day
};

// Get user persona based on index
function getPersona(index) {
  const personas = [
    { name: 'early_bird', spendLevel: 'medium', activityLevel: 'high' },
    { name: 'music_fan', spendLevel: 'low', activityLevel: 'very_high' },
    { name: 'foodie', spendLevel: 'high', activityLevel: 'medium' },
    { name: 'party_goer', spendLevel: 'very_high', activityLevel: 'high' },
    { name: 'casual', spendLevel: 'medium', activityLevel: 'low' },
  ];
  return personas[index % personas.length];
}

function getArrivalHour(index) {
  // Distribution of arrival times
  const arrivals = [10, 10, 10, 11, 11, 12, 12, 13, 14, 15, 16, 17, 18];
  return arrivals[index % arrivals.length];
}

function getDepartureHour(index) {
  // Distribution of departure times (24+ for past midnight)
  const departures = [22, 23, 24, 25, 26, 26, 25, 24, 23, 22, 21, 20, 26];
  return departures[index % departures.length];
}

// Calculate simulated festival hour from elapsed test time
function getFestivalHour(startTime) {
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const elapsedFestivalHours = (elapsedSeconds / 60); // 1 min = 1 hour
  let festivalHour = 10 + elapsedFestivalHours; // Start at 10 AM
  if (festivalHour >= 24) festivalHour -= 24;
  return Math.floor(festivalHour);
}

export const options = {
  scenarios: {
    // Main attendee scenario - follows daily pattern
    attendees: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Gates opening (10:00) - 1 min
        { duration: '1m', target: 200 },

        // Morning build-up (11:00) - 1 min
        { duration: '1m', target: 400 },

        // Lunch rush (12:00-14:00) - 2 min
        { duration: '2m', target: 800 },

        // Afternoon lull (14:00-17:00) - 3 min
        { duration: '3m', target: 500 },

        // Dinner rush (18:00-20:00) - 2 min
        { duration: '2m', target: 900 },

        // Main stage performances (20:00-23:00) - 3 min
        { duration: '3m', target: 1000 },

        // Late night (23:00-01:00) - 2 min
        { duration: '2m', target: 600 },

        // Wind down (01:00-02:00) - 1 min
        { duration: '1m', target: 100 },

        // Closing - 1 min
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'attendeeSimulation',
    },

    // Entry staff scenario
    entry_staff: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // Gates opening
        { duration: '2m', target: 15 },   // Rush hour
        { duration: '8m', target: 10 },   // Normal operations
        { duration: '4m', target: 5 },    // Late entries
        { duration: '1m', target: 0 },    // Closing
      ],
      gracefulRampDown: '10s',
      exec: 'entryStaffSimulation',
    },

    // Vendor staff scenario
    vendor_staff: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '2m', target: 30 },   // Lunch
        { duration: '3m', target: 25 },   // Afternoon
        { duration: '2m', target: 35 },   // Dinner
        { duration: '3m', target: 30 },   // Evening
        { duration: '3m', target: 20 },   // Late night
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '10s',
      exec: 'vendorStaffSimulation',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.02'],
    errors: ['rate<0.02'],
    success: ['rate>0.98'],

    // Business metrics
    entry_scans: ['count>500'],
    wallet_topups: ['count>200'],
  },

  tags: {
    test_type: 'festival_day',
    festival_id: FESTIVAL_ID,
  },
};

export function setup() {
  console.log('='.repeat(60));
  console.log('FESTIVAL DAY SIMULATION');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Festival ID: ${FESTIVAL_ID}`);
  console.log(`Attendees: ${attendees.length}`);
  console.log(`Staff: ${staff.length}`);
  console.log(`Time compression: 1 min real = 1 hour festival`);
  console.log('='.repeat(60));

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

// Main attendee simulation
export function attendeeSimulation(data) {
  const baseUrl = data.baseUrl;
  const festivalId = data.festivalId;
  const festivalHour = getFestivalHour(data.startTime);

  const attendeeIndex = __VU % attendees.length;
  const attendee = attendees[attendeeIndex];

  // Check if attendee should be active at this hour
  const normalizedHour = festivalHour >= 10 ? festivalHour : festivalHour + 24;
  const normalizedArrival = attendee.arrivalHour;
  const normalizedDeparture = attendee.departureHour >= 10 ? attendee.departureHour : attendee.departureHour + 24;

  if (normalizedHour < normalizedArrival || normalizedHour > normalizedDeparture) {
    sleep(1);
    return;
  }

  let accessToken = null;

  group('Attendee Activity', () => {
    uniqueActiveUsers.add(1);

    // Login
    const loginRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: attendee.email, password: attendee.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (loginRes.status !== 200) {
      uniqueActiveUsers.add(-1);
      return;
    }
    accessToken = loginRes.json('data.accessToken');

    // Determine activity based on time and persona
    const activity = determineActivity(festivalHour, attendee.persona);

    switch (activity) {
      case 'check_lineup':
        performLineupCheck(baseUrl, festivalId, accessToken);
        lineupViews.add(1);
        break;

      case 'view_map':
        performMapView(baseUrl, festivalId, accessToken);
        mapViews.add(1);
        break;

      case 'topup_wallet':
        const topupAmount = performWalletTopup(baseUrl, festivalId, accessToken, attendee);
        if (topupAmount > 0) {
          walletTopups.add(1);
          totalRevenue.add(topupAmount);
        }
        break;

      case 'buy_food':
        const foodAmount = performPurchase(baseUrl, accessToken, attendee, 'food');
        if (foodAmount > 0) {
          foodPurchases.add(1);
          totalRevenue.add(foodAmount);
        }
        break;

      case 'buy_drinks':
        const drinkAmount = performPurchase(baseUrl, accessToken, attendee, 'drinks');
        if (drinkAmount > 0) {
          drinkPurchases.add(1);
          totalRevenue.add(drinkAmount);
        }
        break;

      case 'buy_merch':
        const merchAmount = performPurchase(baseUrl, accessToken, attendee, 'merch');
        if (merchAmount > 0) {
          merchPurchases.add(1);
          totalRevenue.add(merchAmount);
        }
        break;

      case 'add_favorite':
        performFavoriteAction(baseUrl, festivalId, accessToken);
        favoriteActions.add(1);
        break;

      case 'browse':
      default:
        performBrowsing(baseUrl, festivalId, accessToken);
        break;
    }

    uniqueActiveUsers.add(-1);
  });

  // Think time varies by persona
  const baseThinkTime = attendee.persona.activityLevel === 'very_high' ? 2 :
                        attendee.persona.activityLevel === 'high' ? 3 :
                        attendee.persona.activityLevel === 'medium' ? 5 : 8;

  sleep(randomIntBetween(baseThinkTime, baseThinkTime * 2));
}

// Entry staff simulation
export function entryStaffSimulation(data) {
  const baseUrl = data.baseUrl;
  const festivalHour = getFestivalHour(data.startTime);

  // Entry staff mainly active during gates open
  if (festivalHour < 10 || festivalHour > 20) {
    sleep(2);
    return;
  }

  const staffMember = staff.filter(s => s.role === 'entry')[__VU % 20];
  if (!staffMember) return;

  let accessToken = null;

  group('Entry Staff Operations', () => {

    // Staff login
    const loginRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: staffMember.email, password: staffMember.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (loginRes.status !== 200) return;
    accessToken = loginRes.json('data.accessToken');

    // Process entry scans
    const scansPerBatch = festivalHour >= 10 && festivalHour <= 12 ?
      randomIntBetween(5, 15) : randomIntBetween(1, 5);

    for (let i = 0; i < scansPerBatch; i++) {
      const attendee = attendees[randomIntBetween(0, attendees.length - 1)];

      const scanRes = http.post(
        `${baseUrl}/api/v1/tickets/scan`,
        JSON.stringify({
          qrCode: attendee.qrCode,
          gateId: `gate_${__VU % 5}`,
          scanType: 'entry',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'entry_scan' },
        }
      );

      const passed = check(scanRes, {
        'scan processed': (r) => r.status === 200 || r.status === 400 || r.status === 409,
      });

      if (scanRes.status === 200) {
        entryScans.add(1);
      }

      avgResponseTime.add(scanRes.timings.duration);
      errorRate.add(!passed);
      successRate.add(passed);

      sleep(randomIntBetween(1, 3) / 10);
    }
  });

  sleep(randomIntBetween(1, 3));
}

// Vendor staff simulation
export function vendorStaffSimulation(data) {
  const baseUrl = data.baseUrl;
  const festivalHour = getFestivalHour(data.startTime);

  const staffIndex = __VU % 30;
  const staffMember = staff.filter(s => s.role === 'vendor')[staffIndex];
  if (!staffMember) return;

  const stand = stands.find(s => s.id === staffMember.standId) || stands[0];

  // Check if this stand is in peak hours
  const isPeakHour = stand.peakHours.includes(festivalHour);

  let accessToken = null;

  group('Vendor Operations', () => {

    // Staff login
    const loginRes = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({ email: staffMember.email, password: staffMember.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (loginRes.status !== 200) return;
    accessToken = loginRes.json('data.accessToken');

    // Process sales
    const salesPerBatch = isPeakHour ? randomIntBetween(3, 8) : randomIntBetween(1, 3);

    for (let i = 0; i < salesPerBatch; i++) {
      concurrentTransactions.add(1);

      const customer = attendees[randomIntBetween(0, attendees.length - 1)];
      const amount = getProductAmount(stand.type);

      const paymentRes = http.post(
        `${baseUrl}/api/v1/payments`,
        JSON.stringify({
          walletId: customer.walletId,
          standId: stand.id,
          amount: amount,
          items: [{ name: `${stand.name} Item`, quantity: 1, unitPrice: amount }],
          reference: `sale_${stand.id}_${Date.now()}`,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          tags: { name: 'vendor_sale', stand_type: stand.type },
        }
      );

      concurrentTransactions.add(-1);

      const passed = check(paymentRes, {
        'payment processed': (r) => r.status === 200 || r.status === 201 || r.status === 400,
      });

      if (paymentRes.status === 200 || paymentRes.status === 201) {
        totalRevenue.add(amount);
        if (stand.type === 'food') foodPurchases.add(1);
        else if (stand.type === 'drinks') drinkPurchases.add(1);
        else if (stand.type === 'merch') merchPurchases.add(1);
      }

      avgResponseTime.add(paymentRes.timings.duration);
      errorRate.add(!passed);
      successRate.add(passed);

      // Time between customers
      sleep(randomIntBetween(2, isPeakHour ? 5 : 10));
    }
  });

  sleep(randomIntBetween(1, 3));
}

// Helper functions
function determineActivity(hour, persona) {
  const activities = [];

  // Always possible
  activities.push('check_lineup', 'view_map', 'browse');

  // Time-based activities
  if (hour >= 10 && hour <= 14) {
    activities.push('topup_wallet', 'topup_wallet');
  }

  if ((hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 20)) {
    activities.push('buy_food', 'buy_food', 'buy_food');
  }

  if (hour >= 14) {
    activities.push('buy_drinks', 'buy_drinks');
  }

  if (hour >= 21) {
    activities.push('buy_drinks', 'buy_drinks', 'buy_drinks');
  }

  if (hour >= 15 && hour <= 22) {
    activities.push('buy_merch');
  }

  activities.push('add_favorite');

  // Persona-based weighting
  if (persona.name === 'foodie') {
    activities.push('buy_food', 'buy_food');
  } else if (persona.name === 'party_goer') {
    activities.push('buy_drinks', 'buy_drinks', 'buy_drinks');
  } else if (persona.name === 'music_fan') {
    activities.push('check_lineup', 'check_lineup', 'add_favorite');
  }

  return randomItem(activities);
}

function performLineupCheck(baseUrl, festivalId, accessToken) {
  const response = http.get(
    `${baseUrl}/api/v1/festivals/${festivalId}/lineup`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      tags: { name: 'lineup_check' },
    }
  );
  avgResponseTime.add(response.timings.duration);
  return check(response, { 'lineup loaded': (r) => r.status === 200 });
}

function performMapView(baseUrl, festivalId, accessToken) {
  const response = http.get(
    `${baseUrl}/api/v1/festivals/${festivalId}/map`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      tags: { name: 'map_view' },
    }
  );
  avgResponseTime.add(response.timings.duration);
  return check(response, { 'map loaded': (r) => r.status === 200 });
}

function performWalletTopup(baseUrl, festivalId, accessToken, attendee) {
  const amounts = [2000, 5000, 10000, 20000];
  const amount = randomItem(amounts);

  const response = http.post(
    `${baseUrl}/api/v1/wallets/${attendee.walletId}/topup`,
    JSON.stringify({
      amount: amount,
      paymentMethod: 'card',
      cardToken: `tok_${Date.now()}`,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      tags: { name: 'wallet_topup' },
    }
  );

  avgResponseTime.add(response.timings.duration);
  return response.status === 200 ? amount : 0;
}

function performPurchase(baseUrl, accessToken, attendee, type) {
  const amount = getProductAmount(type);
  const stand = stands.filter(s => s.type === type)[0];

  const response = http.post(
    `${baseUrl}/api/v1/payments`,
    JSON.stringify({
      walletId: attendee.walletId,
      standId: stand.id,
      amount: amount,
      items: [{ name: `${type} purchase`, quantity: 1, unitPrice: amount }],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      tags: { name: `${type}_purchase` },
    }
  );

  avgResponseTime.add(response.timings.duration);
  return (response.status === 200 || response.status === 201) ? amount : 0;
}

function performFavoriteAction(baseUrl, festivalId, accessToken) {
  const artistId = `artist_${randomIntBetween(1, 50)}`;
  const response = http.post(
    `${baseUrl}/api/v1/festivals/${festivalId}/lineup/${artistId}/favorite`,
    null,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      tags: { name: 'favorite_artist' },
    }
  );
  avgResponseTime.add(response.timings.duration);
}

function performBrowsing(baseUrl, festivalId, accessToken) {
  const endpoints = [
    `/api/v1/festivals/${festivalId}`,
    `/api/v1/festivals/${festivalId}/artists`,
    `/api/v1/notifications`,
    `/api/v1/me/profile`,
  ];

  const endpoint = randomItem(endpoints);
  const response = http.get(`${baseUrl}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
    tags: { name: 'browsing' },
  });
  avgResponseTime.add(response.timings.duration);
}

function getProductAmount(type) {
  const amounts = {
    food: [800, 1000, 1200, 1500, 1800, 2000],
    drinks: [400, 500, 700, 900, 1200, 1500],
    merch: [1500, 2500, 3500, 4500, 6500],
  };
  return randomItem(amounts[type] || amounts.food);
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;

  console.log('\n' + '='.repeat(70));
  console.log('FESTIVAL DAY SIMULATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total Duration: ${(duration / 60).toFixed(1)} minutes`);
  console.log(`Simulated Hours: ~${(duration / 60).toFixed(0)} festival hours`);
  console.log('');
  console.log('Activity Summary:');
  console.log('- Check entry_scans for gate operations');
  console.log('- Check wallet_topups for recharge activity');
  console.log('- Check food_purchases, drink_purchases, merch_purchases');
  console.log('- Check total_revenue_cents for total transaction volume');
  console.log('');
  console.log('Performance:');
  console.log('- Check avg_response_time for overall API performance');
  console.log('- Check concurrent_transactions for peak load handling');
  console.log('='.repeat(70));
}
