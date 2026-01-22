/**
 * Mock API Helpers for E2E Tests
 *
 * Provides utilities for mocking API responses and network conditions
 */

import { device } from 'detox';

// ============================================================================
// Types
// ============================================================================

export interface MockResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  delay?: number;
}

export interface NetworkCondition {
  downloadSpeed?: number; // bytes per second
  uploadSpeed?: number; // bytes per second
  latency?: number; // milliseconds
}

// ============================================================================
// API Mock Functions
// ============================================================================

/**
 * Mock successful API response
 */
export function mockSuccess<T>(data: T, delay: number = 0): MockResponse {
  return {
    status: 200,
    body: { success: true, data },
    delay,
  };
}

/**
 * Mock API error response
 */
export function mockError(
  message: string,
  status: number = 500,
  code?: string
): MockResponse {
  return {
    status,
    body: {
      success: false,
      error: {
        message,
        code: code || `E${status}`,
      },
    },
  };
}

/**
 * Mock 401 Unauthorized response
 */
export function mockUnauthorized(): MockResponse {
  return mockError('Session expirée', 401, 'UNAUTHORIZED');
}

/**
 * Mock 403 Forbidden response
 */
export function mockForbidden(): MockResponse {
  return mockError('Accès refusé', 403, 'FORBIDDEN');
}

/**
 * Mock 404 Not Found response
 */
export function mockNotFound(resource: string = 'Resource'): MockResponse {
  return mockError(`${resource} non trouvé`, 404, 'NOT_FOUND');
}

/**
 * Mock 422 Validation Error response
 */
export function mockValidationError(
  errors: Record<string, string[]>
): MockResponse {
  return {
    status: 422,
    body: {
      success: false,
      error: {
        message: 'Erreur de validation',
        code: 'VALIDATION_ERROR',
        details: errors,
      },
    },
  };
}

/**
 * Mock 429 Rate Limit response
 */
export function mockRateLimit(retryAfter: number = 60): MockResponse {
  return {
    status: 429,
    body: {
      success: false,
      error: {
        message: 'Trop de requêtes',
        code: 'RATE_LIMIT',
        retryAfter,
      },
    },
    headers: {
      'Retry-After': retryAfter.toString(),
    },
  };
}

/**
 * Mock 503 Service Unavailable response
 */
export function mockServiceUnavailable(): MockResponse {
  return mockError('Service temporairement indisponible', 503, 'SERVICE_UNAVAILABLE');
}

// ============================================================================
// Network Simulation
// ============================================================================

/**
 * Simulate offline mode
 */
export async function goOffline(): Promise<void> {
  await device.setURLBlacklist(['.*']);
}

/**
 * Restore network connection
 */
export async function goOnline(): Promise<void> {
  await device.setURLBlacklist([]);
}

/**
 * Block specific URLs
 */
export async function blockUrls(patterns: string[]): Promise<void> {
  await device.setURLBlacklist(patterns);
}

/**
 * Allow only specific URLs
 */
export async function allowOnlyUrls(allowedPatterns: string[]): Promise<void> {
  // Block everything except allowed patterns
  // Note: Detox blacklist is simpler, so we just set what to block
  console.warn('allowOnlyUrls is not fully supported; using blockUrls instead');
}

/**
 * Simulate slow network
 */
export async function simulateSlowNetwork(): Promise<void> {
  // Detox doesn't have native network throttling
  // This is a placeholder for documentation
  console.log('Network throttling: Simulating slow network (manual delays required)');
}

/**
 * Reset network conditions
 */
export async function resetNetwork(): Promise<void> {
  await device.setURLBlacklist([]);
}

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Generate mock wallet data
 */
export function mockWalletData(balance: number = 150): unknown {
  return {
    id: 'wallet-123',
    balance,
    currency: 'Griffons',
    eurEquivalent: balance * 1.0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Generate mock transaction
 */
export function mockTransaction(
  type: 'payment' | 'topup' | 'refund' = 'payment',
  amount: number = 10
): unknown {
  return {
    id: `txn-${Date.now()}`,
    type,
    amount: type === 'payment' ? -amount : amount,
    currency: 'Griffons',
    status: 'completed',
    timestamp: new Date().toISOString(),
    description: type === 'payment' ? 'Achat au stand' : 'Rechargement',
    standName: type === 'payment' ? 'Bar Central' : undefined,
  };
}

/**
 * Generate mock transactions list
 */
export function mockTransactionsList(count: number = 10): unknown[] {
  const transactions = [];
  const types: Array<'payment' | 'topup' | 'refund'> = ['payment', 'payment', 'topup', 'refund'];

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    transactions.push(mockTransaction(type, Math.floor(Math.random() * 50) + 5));
  }

  return transactions;
}

/**
 * Generate mock ticket
 */
export function mockTicket(type: 'standard' | 'vip' | 'weekend' = 'standard'): unknown {
  const ticketTypes = {
    standard: { name: 'Pass Jour', price: 45 },
    vip: { name: 'Pass VIP', price: 120 },
    weekend: { name: 'Pass Weekend', price: 80 },
  };

  const ticket = ticketTypes[type];

  return {
    id: `ticket-${Date.now()}`,
    code: `TKT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    type,
    name: ticket.name,
    eventName: 'Festival des Musiques 2024',
    eventDate: '2024-07-15',
    purchaseDate: new Date().toISOString(),
    status: 'active',
    qrCode: 'mock-qr-data',
    holderName: 'Test User',
    transferable: type !== 'vip',
  };
}

/**
 * Generate mock tickets list
 */
export function mockTicketsList(count: number = 3): unknown[] {
  const types: Array<'standard' | 'vip' | 'weekend'> = ['standard', 'vip', 'weekend'];
  return Array.from({ length: count }, (_, i) =>
    mockTicket(types[i % types.length])
  );
}

/**
 * Generate mock artist
 */
export function mockArtist(name: string = 'Test Artist'): unknown {
  return {
    id: `artist-${Date.now()}`,
    name,
    genre: 'Rock',
    image: 'https://example.com/artist.jpg',
    description: 'Lorem ipsum dolor sit amet',
    country: 'France',
    socialLinks: {
      spotify: 'https://spotify.com/artist',
      instagram: 'https://instagram.com/artist',
    },
  };
}

/**
 * Generate mock program slot
 */
export function mockProgramSlot(
  artistName: string = 'Test Artist',
  stageName: string = 'Main Stage'
): unknown {
  return {
    id: `slot-${Date.now()}`,
    artist: mockArtist(artistName),
    stage: stageName,
    startTime: '2024-07-15T20:00:00Z',
    endTime: '2024-07-15T21:30:00Z',
    day: 'Samedi',
    isFavorite: false,
  };
}

/**
 * Generate mock festival map point
 */
export function mockMapPoint(
  type: 'stage' | 'food' | 'bar' | 'toilet' | 'exit' | 'info' = 'stage',
  name: string = 'Point'
): unknown {
  return {
    id: `point-${Date.now()}`,
    type,
    name,
    latitude: 48.8566 + Math.random() * 0.01,
    longitude: 2.3522 + Math.random() * 0.01,
    description: `${name} - ${type}`,
    icon: type,
    isAccessible: true,
  };
}

// ============================================================================
// Mock Server Simulation
// ============================================================================

/**
 * Create a mock API handler (for documentation/reference)
 * Note: Actual implementation would require a mock server
 */
export function createMockApiHandler(
  endpoint: string,
  response: MockResponse
): { endpoint: string; response: MockResponse } {
  return { endpoint, response };
}

/**
 * Setup mock server responses (documentation)
 */
export function setupMockServer(): void {
  console.log('Mock server setup - implement with actual mock server library');
}

// ============================================================================
// Fixture Data Injection
// ============================================================================

/**
 * Inject mock data into app via launch arguments
 */
export async function launchWithMockData(mockData: Record<string, unknown>): Promise<void> {
  await device.launchApp({
    newInstance: true,
    launchArgs: {
      mockData: JSON.stringify(mockData),
    },
  });
}

/**
 * Reset app with clean mock data
 */
export async function resetWithMockData(mockData: Record<string, unknown>): Promise<void> {
  await device.launchApp({
    newInstance: true,
    delete: true,
    launchArgs: {
      mockData: JSON.stringify(mockData),
    },
  });
}

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Setup for wallet with specific balance
 */
export function setupWalletScenario(balance: number): Record<string, unknown> {
  return {
    wallet: mockWalletData(balance),
    transactions: mockTransactionsList(5),
  };
}

/**
 * Setup for empty wallet scenario
 */
export function setupEmptyWalletScenario(): Record<string, unknown> {
  return {
    wallet: mockWalletData(0),
    transactions: [],
  };
}

/**
 * Setup for tickets scenario
 */
export function setupTicketsScenario(count: number = 2): Record<string, unknown> {
  return {
    tickets: mockTicketsList(count),
  };
}

/**
 * Setup for no tickets scenario
 */
export function setupNoTicketsScenario(): Record<string, unknown> {
  return {
    tickets: [],
  };
}

/**
 * Setup for staff member scenario
 */
export function setupStaffScenario(): Record<string, unknown> {
  return {
    user: {
      id: 'staff-123',
      role: 'staff',
      name: 'Staff Member',
      permissions: ['scan_tickets', 'process_payments'],
    },
    stand: {
      id: 'stand-123',
      name: 'Bar Central',
      type: 'bar',
    },
  };
}
