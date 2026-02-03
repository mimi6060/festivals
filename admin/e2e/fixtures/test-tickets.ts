/**
 * Test ticket fixtures for E2E tests
 * Contains different ticket types and configurations
 */

export interface TestTicketType {
  id: string;
  festivalId: string;
  name: string;
  description: string;
  price: number;
  priceDisplay: string;
  quantity: number;
  quantitySold: number;
  available: number;
  validFrom: string;
  validUntil: string;
  benefits: string[];
  settings: {
    allowReentry: boolean;
    includesTopUp: boolean;
    topUpAmount: number;
    requiresId: boolean;
    transferAllowed: boolean;
    maxTransfers: number;
  };
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'SOLD_OUT' | 'EXPIRED';
}

/**
 * Standard 3-day pass
 */
export const pass3Days: TestTicketType = {
  id: 'test-ticket-001',
  festivalId: 'test-festival-001',
  name: 'Pass 3 Jours',
  description: 'Acces complet aux 3 jours du festival',
  price: 18900,
  priceDisplay: '189,00 EUR',
  quantity: 5000,
  quantitySold: 0,
  available: 5000,
  validFrom: '2026-07-15T00:00:00Z',
  validUntil: '2026-07-17T23:59:59Z',
  benefits: [
    'Acces aux 3 scenes',
    'Acces aux 3 jours complets',
    'Bracelet cashless inclus',
  ],
  settings: {
    allowReentry: true,
    includesTopUp: false,
    topUpAmount: 0,
    requiresId: false,
    transferAllowed: true,
    maxTransfers: 1,
  },
  status: 'ACTIVE',
};

/**
 * VIP 3-day pass
 */
export const passVip: TestTicketType = {
  id: 'test-ticket-002',
  festivalId: 'test-festival-001',
  name: 'Pass VIP 3 Jours',
  description: 'Experience premium avec acces exclusifs',
  price: 34900,
  priceDisplay: '349,00 EUR',
  quantity: 500,
  quantitySold: 0,
  available: 500,
  validFrom: '2026-07-15T00:00:00Z',
  validUntil: '2026-07-17T23:59:59Z',
  benefits: [
    'Acces aux 3 scenes',
    'Zone VIP avec bar prive',
    'Viewing deck privilegie',
    'Fast lane entree',
    '20 EUR de credit offert',
  ],
  settings: {
    allowReentry: true,
    includesTopUp: true,
    topUpAmount: 2000,
    requiresId: true,
    transferAllowed: true,
    maxTransfers: 2,
  },
  status: 'ACTIVE',
};

/**
 * Friday day pass
 */
export const passFriday: TestTicketType = {
  id: 'test-ticket-003',
  festivalId: 'test-festival-001',
  name: 'Pass Vendredi',
  description: 'Acces au festival le vendredi uniquement',
  price: 7500,
  priceDisplay: '75,00 EUR',
  quantity: 2000,
  quantitySold: 0,
  available: 2000,
  validFrom: '2026-07-15T00:00:00Z',
  validUntil: '2026-07-15T23:59:59Z',
  benefits: [
    'Acces aux 3 scenes',
    'Vendredi uniquement',
    'Bracelet cashless inclus',
  ],
  settings: {
    allowReentry: true,
    includesTopUp: false,
    topUpAmount: 0,
    requiresId: false,
    transferAllowed: true,
    maxTransfers: 1,
  },
  status: 'ACTIVE',
};

/**
 * Saturday day pass (sold out)
 */
export const passSaturday: TestTicketType = {
  id: 'test-ticket-004',
  festivalId: 'test-festival-001',
  name: 'Pass Samedi',
  description: 'Acces au festival le samedi uniquement',
  price: 7500,
  priceDisplay: '75,00 EUR',
  quantity: 2000,
  quantitySold: 2000,
  available: 0,
  validFrom: '2026-07-16T00:00:00Z',
  validUntil: '2026-07-16T23:59:59Z',
  benefits: [
    'Acces aux 3 scenes',
    'Samedi uniquement',
    'Bracelet cashless inclus',
  ],
  settings: {
    allowReentry: true,
    includesTopUp: false,
    topUpAmount: 0,
    requiresId: false,
    transferAllowed: true,
    maxTransfers: 1,
  },
  status: 'SOLD_OUT',
};

/**
 * Sunday day pass
 */
export const passSunday: TestTicketType = {
  id: 'test-ticket-005',
  festivalId: 'test-festival-001',
  name: 'Pass Dimanche',
  description: 'Acces au festival le dimanche uniquement',
  price: 7500,
  priceDisplay: '75,00 EUR',
  quantity: 2000,
  quantitySold: 500,
  available: 1500,
  validFrom: '2026-07-17T00:00:00Z',
  validUntil: '2026-07-17T23:59:59Z',
  benefits: [
    'Acces aux 3 scenes',
    'Dimanche uniquement',
    'Bracelet cashless inclus',
  ],
  settings: {
    allowReentry: true,
    includesTopUp: false,
    topUpAmount: 0,
    requiresId: false,
    transferAllowed: true,
    maxTransfers: 1,
  },
  status: 'ACTIVE',
};

/**
 * Draft ticket type (not yet published)
 */
export const draftTicket: TestTicketType = {
  id: 'test-ticket-006',
  festivalId: 'test-festival-001',
  name: 'Early Bird Pass',
  description: 'Special early bird pricing',
  price: 14900,
  priceDisplay: '149,00 EUR',
  quantity: 1000,
  quantitySold: 0,
  available: 1000,
  validFrom: '2026-07-15T00:00:00Z',
  validUntil: '2026-07-17T23:59:59Z',
  benefits: [
    'Acces aux 3 scenes',
    'Prix reduit',
  ],
  settings: {
    allowReentry: true,
    includesTopUp: false,
    topUpAmount: 0,
    requiresId: false,
    transferAllowed: false,
    maxTransfers: 0,
  },
  status: 'DRAFT',
};

/**
 * All test tickets grouped
 */
export const testTickets = {
  pass3Days,
  passVip,
  passFriday,
  passSaturday,
  passSunday,
  draftTicket,
};

/**
 * Active tickets only (for public display)
 */
export const activeTickets = [pass3Days, passVip, passFriday, passSaturday, passSunday];

/**
 * Available tickets only (active and not sold out)
 */
export const availableTickets = [pass3Days, passVip, passFriday, passSunday];

export type TicketType = keyof typeof testTickets;
