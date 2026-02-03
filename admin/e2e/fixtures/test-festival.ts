/**
 * Test festival fixtures for E2E tests
 * Pre-configured festival data with various states
 */

export interface TestFestival {
  id: string;
  name: string;
  slug: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  timezone: string;
  currencyName: string;
  exchangeRate: number;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TestStand {
  id: string;
  festivalId: string;
  name: string;
  description: string;
  category: 'BAR' | 'FOOD' | 'MERCHANDISE' | 'RECHARGE' | 'INFO' | 'MEDICAL' | 'SECURITY';
  isActive: boolean;
  location: {
    lat: number;
    lng: number;
    zone: string;
  };
  settings: {
    acceptsOnlyTokens: boolean;
    requiresPin: boolean;
    allowsNegativeBalance: boolean;
    maxTransactionAmount: number | null;
  };
}

export interface TestTicketType {
  id: string;
  festivalId: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  sold: number;
  checkedIn: number;
  status: 'DRAFT' | 'ON_SALE' | 'SOLD_OUT' | 'CLOSED';
  validFrom: string;
  validUntil: string;
  benefits: string[];
  settings: {
    allowReentry: boolean;
    initialTopUpAmount: number;
    transferable: boolean;
    transferDeadline: string;
    maxTransfers: number;
    requiresId: boolean;
  };
}

/**
 * Primary test festival - Active state
 */
export const activeFestival: TestFestival = {
  id: 'test-festival-001',
  name: 'Summer Fest 2026',
  slug: 'summer-fest-2026',
  description: 'The biggest summer music festival in Belgium with over 100 artists across 5 stages.',
  startDate: '2026-06-15',
  endDate: '2026-06-17',
  location: 'Brussels, Belgium',
  timezone: 'Europe/Brussels',
  currencyName: 'Griffons',
  exchangeRate: 0.1,
  status: 'ACTIVE',
  settings: {
    allowRefunds: true,
    refundDeadline: '2026-06-14T23:59:59Z',
    minTopUpAmount: 10,
    maxTopUpAmount: 500,
    topUpBonusThreshold: 50,
    topUpBonusPercent: 10,
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-15T10:30:00Z',
};

/**
 * Draft festival for setup tests
 */
export const draftFestival: TestFestival = {
  id: 'test-festival-002',
  name: 'Winter Music Festival',
  slug: 'winter-music-festival',
  description: 'A cozy winter festival featuring acoustic performances.',
  startDate: '2026-12-20',
  endDate: '2026-12-22',
  location: 'Bruges, Belgium',
  timezone: 'Europe/Brussels',
  currencyName: 'Snowflakes',
  exchangeRate: 0.25,
  status: 'DRAFT',
  settings: {},
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

/**
 * Completed festival for historical data tests
 */
export const completedFestival: TestFestival = {
  id: 'test-festival-003',
  name: 'Spring Beats 2025',
  slug: 'spring-beats-2025',
  description: 'An amazing spring festival that already took place.',
  startDate: '2025-04-10',
  endDate: '2025-04-12',
  location: 'Antwerp, Belgium',
  timezone: 'Europe/Brussels',
  currencyName: 'Beats',
  exchangeRate: 0.2,
  status: 'COMPLETED',
  settings: {
    allowRefunds: false,
  },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-04-15T00:00:00Z',
};

/**
 * Test stands for the active festival
 */
export const testStands: TestStand[] = [
  {
    id: 'test-stand-001',
    festivalId: 'test-festival-001',
    name: 'Main Bar',
    description: 'Central bar with a wide selection of drinks',
    category: 'BAR',
    isActive: true,
    location: { lat: 50.8503, lng: 4.3517, zone: 'Main Stage Area' },
    settings: {
      acceptsOnlyTokens: true,
      requiresPin: false,
      allowsNegativeBalance: false,
      maxTransactionAmount: null,
    },
  },
  {
    id: 'test-stand-002',
    festivalId: 'test-festival-001',
    name: 'Food Court - Burgers',
    description: 'Best burgers at the festival',
    category: 'FOOD',
    isActive: true,
    location: { lat: 50.8505, lng: 4.3520, zone: 'Food Village' },
    settings: {
      acceptsOnlyTokens: true,
      requiresPin: false,
      allowsNegativeBalance: false,
      maxTransactionAmount: null,
    },
  },
  {
    id: 'test-stand-003',
    festivalId: 'test-festival-001',
    name: 'Merch Shop',
    description: 'Official festival merchandise',
    category: 'MERCHANDISE',
    isActive: true,
    location: { lat: 50.8500, lng: 4.3510, zone: 'Entrance' },
    settings: {
      acceptsOnlyTokens: true,
      requiresPin: false,
      allowsNegativeBalance: false,
      maxTransactionAmount: 200,
    },
  },
  {
    id: 'test-stand-004',
    festivalId: 'test-festival-001',
    name: 'Top-Up Point 1',
    description: 'Add credits to your wristband',
    category: 'RECHARGE',
    isActive: true,
    location: { lat: 50.8502, lng: 4.3515, zone: 'Entrance' },
    settings: {
      acceptsOnlyTokens: false,
      requiresPin: false,
      allowsNegativeBalance: false,
      maxTransactionAmount: 500,
    },
  },
  {
    id: 'test-stand-005',
    festivalId: 'test-festival-001',
    name: 'Info Point',
    description: 'Festival information and help',
    category: 'INFO',
    isActive: true,
    location: { lat: 50.8501, lng: 4.3512, zone: 'Entrance' },
    settings: {
      acceptsOnlyTokens: false,
      requiresPin: false,
      allowsNegativeBalance: false,
      maxTransactionAmount: null,
    },
  },
];

/**
 * Test ticket types for the active festival
 */
export const testTicketTypes: TestTicketType[] = [
  {
    id: 'test-ticket-001',
    festivalId: 'test-festival-001',
    name: 'Day Pass - Friday',
    description: 'Access to the festival on Friday only',
    price: 65,
    quantity: 5000,
    sold: 3500,
    checkedIn: 0,
    status: 'ON_SALE',
    validFrom: '2026-06-15T12:00:00Z',
    validUntil: '2026-06-16T04:00:00Z',
    benefits: ['Festival access', 'Welcome drink'],
    settings: {
      allowReentry: true,
      initialTopUpAmount: 10,
      transferable: true,
      transferDeadline: '2026-06-14T23:59:59Z',
      maxTransfers: 2,
      requiresId: false,
    },
  },
  {
    id: 'test-ticket-002',
    festivalId: 'test-festival-001',
    name: 'Day Pass - Saturday',
    description: 'Access to the festival on Saturday only',
    price: 75,
    quantity: 5000,
    sold: 4200,
    checkedIn: 0,
    status: 'ON_SALE',
    validFrom: '2026-06-16T12:00:00Z',
    validUntil: '2026-06-17T04:00:00Z',
    benefits: ['Festival access', 'Welcome drink'],
    settings: {
      allowReentry: true,
      initialTopUpAmount: 10,
      transferable: true,
      transferDeadline: '2026-06-15T23:59:59Z',
      maxTransfers: 2,
      requiresId: false,
    },
  },
  {
    id: 'test-ticket-003',
    festivalId: 'test-festival-001',
    name: 'Weekend Pass',
    description: 'Full access for the entire weekend',
    price: 150,
    quantity: 3000,
    sold: 2800,
    checkedIn: 0,
    status: 'ON_SALE',
    validFrom: '2026-06-15T12:00:00Z',
    validUntil: '2026-06-17T04:00:00Z',
    benefits: ['Full festival access', 'Welcome drink', 'Festival t-shirt', 'Priority entry'],
    settings: {
      allowReentry: true,
      initialTopUpAmount: 20,
      transferable: true,
      transferDeadline: '2026-06-14T23:59:59Z',
      maxTransfers: 1,
      requiresId: true,
    },
  },
  {
    id: 'test-ticket-004',
    festivalId: 'test-festival-001',
    name: 'VIP Pass',
    description: 'Ultimate festival experience with exclusive access',
    price: 350,
    quantity: 500,
    sold: 450,
    checkedIn: 0,
    status: 'ON_SALE',
    validFrom: '2026-06-15T10:00:00Z',
    validUntil: '2026-06-17T06:00:00Z',
    benefits: [
      'Full festival access',
      'VIP lounge access',
      'Free drinks',
      'Meet & greet with artists',
      'Festival merchandise pack',
      'Dedicated parking',
    ],
    settings: {
      allowReentry: true,
      initialTopUpAmount: 50,
      transferable: false,
      transferDeadline: '',
      maxTransfers: 0,
      requiresId: true,
    },
  },
];

/**
 * Test wallet data
 */
export interface TestWallet {
  id: string;
  userId: string;
  festivalId: string;
  balance: number;
  currency: string;
  nfcLinked: boolean;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
}

export const testWallets: TestWallet[] = [
  {
    id: 'test-wallet-001',
    userId: 'test-attendee-001',
    festivalId: 'test-festival-001',
    balance: 45.50,
    currency: 'EUR',
    nfcLinked: true,
    status: 'ACTIVE',
  },
  {
    id: 'test-wallet-002',
    userId: 'test-attendee-002',
    festivalId: 'test-festival-001',
    balance: 78.20,
    currency: 'EUR',
    nfcLinked: true,
    status: 'ACTIVE',
  },
];

/**
 * All test festivals grouped
 */
export const testFestivals = {
  active: activeFestival,
  draft: draftFestival,
  completed: completedFestival,
};

export type FestivalType = keyof typeof testFestivals;
