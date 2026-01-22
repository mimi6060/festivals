import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Data generators for k6 load tests
 */

// Festival IDs for testing (replace with actual IDs from your test data)
const FESTIVAL_IDS = [
  'fest_001', 'fest_002', 'fest_003', 'fest_004', 'fest_005',
];

// Ticket type IDs
const TICKET_TYPE_IDS = [
  'tt_general', 'tt_vip', 'tt_backstage', 'tt_camping', 'tt_day_pass',
];

// Vendor IDs for wallet payments
const VENDOR_IDS = [
  'vendor_001', 'vendor_002', 'vendor_003', 'vendor_004', 'vendor_005',
  'vendor_006', 'vendor_007', 'vendor_008', 'vendor_009', 'vendor_010',
];

// Product categories
const PRODUCT_CATEGORIES = [
  'food', 'drinks', 'merchandise', 'services',
];

/**
 * Generate random festival ID
 */
export function randomFestivalId() {
  return randomItem(FESTIVAL_IDS);
}

/**
 * Generate random ticket type ID
 */
export function randomTicketTypeId() {
  return randomItem(TICKET_TYPE_IDS);
}

/**
 * Generate random vendor ID
 */
export function randomVendorId() {
  return randomItem(VENDOR_IDS);
}

/**
 * Generate random product category
 */
export function randomProductCategory() {
  return randomItem(PRODUCT_CATEGORIES);
}

/**
 * Generate ticket purchase data
 */
export function generateTicketPurchaseData(festivalId, ticketTypeId, quantity = 1) {
  return {
    festivalId: festivalId || randomFestivalId(),
    ticketTypeId: ticketTypeId || randomTicketTypeId(),
    quantity: quantity,
    attendees: Array.from({ length: quantity }, (_, i) => ({
      firstName: `Attendee${i + 1}`,
      lastName: `LoadTest`,
      email: `attendee${i + 1}_${Date.now()}@test.festivals.app`,
    })),
  };
}

/**
 * Generate wallet top-up data
 */
export function generateTopUpData(amount) {
  return {
    amount: amount || randomIntBetween(10, 200) * 100, // Amount in cents
    paymentMethod: 'card',
    cardToken: `tok_test_${Date.now()}`,
  };
}

/**
 * Generate wallet payment data
 */
export function generatePaymentData(vendorId, amount) {
  return {
    vendorId: vendorId || randomVendorId(),
    amount: amount || randomIntBetween(5, 50) * 100, // Amount in cents
    items: [
      {
        name: `Test Item ${Date.now()}`,
        quantity: randomIntBetween(1, 3),
        unitPrice: randomIntBetween(3, 15) * 100,
      },
    ],
    nfcTag: `nfc_${Date.now()}`,
  };
}

/**
 * Generate QR code for entry scan
 */
export function generateQRCode(ticketId) {
  const timestamp = Date.now();
  return `FEST:${ticketId || `ticket_${timestamp}`}:${timestamp}`;
}

/**
 * Generate NFC tag data
 */
export function generateNFCTag(userId) {
  return {
    tagId: `nfc_${userId || Date.now()}`,
    timestamp: Date.now(),
  };
}

/**
 * Generate random user profile update data
 */
export function generateProfileUpdateData() {
  return {
    firstName: `Updated${randomIntBetween(1, 1000)}`,
    lastName: `User${randomIntBetween(1, 1000)}`,
    phone: `+1555${String(randomIntBetween(1000000, 9999999))}`,
    preferences: {
      notifications: randomItem([true, false]),
      newsletter: randomItem([true, false]),
      language: randomItem(['en', 'fr', 'es', 'de']),
    },
  };
}

/**
 * Generate random search query
 */
export function generateSearchQuery() {
  const queries = [
    'rock', 'jazz', 'electronic', 'hip hop', 'indie',
    'festival', 'summer', 'music', 'live', 'concert',
  ];
  return randomItem(queries);
}

/**
 * Generate random date range for festival search
 */
export function generateDateRange() {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + randomIntBetween(1, 30));

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + randomIntBetween(1, 90));

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Generate pagination parameters
 */
export function generatePaginationParams() {
  return {
    page: randomIntBetween(1, 10),
    limit: randomItem([10, 20, 50]),
    sortBy: randomItem(['createdAt', 'name', 'date', 'popularity']),
    sortOrder: randomItem(['asc', 'desc']),
  };
}

/**
 * Generate support ticket data
 */
export function generateSupportTicketData() {
  const subjects = [
    'Payment issue',
    'Ticket not received',
    'Refund request',
    'App not working',
    'General inquiry',
  ];

  return {
    subject: randomItem(subjects),
    message: `This is a load test support ticket created at ${new Date().toISOString()}`,
    category: randomItem(['technical', 'billing', 'general', 'feedback']),
    priority: randomItem(['low', 'medium', 'high']),
  };
}

/**
 * User behavior weights for mixed scenario
 */
export const BEHAVIOR_WEIGHTS = {
  browseFestivals: 30,      // 30% of users browse festivals
  viewLineup: 20,           // 20% view lineup
  purchaseTicket: 15,       // 15% purchase tickets
  walletTopUp: 10,          // 10% top up wallet
  walletPayment: 15,        // 15% make payments
  viewProfile: 5,           // 5% view profile
  searchContent: 5,         // 5% search
};

/**
 * Select action based on weights
 */
export function selectWeightedAction(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = randomIntBetween(1, total);

  for (const [action, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) {
      return action;
    }
  }

  return Object.keys(weights)[0];
}
