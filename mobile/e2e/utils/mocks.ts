/**
 * API Mocking Utilities for E2E Tests
 *
 * Provides utilities for mocking API responses, network conditions, and QR code scanning.
 */

import { device } from 'detox';

// ==========================================================================
// Types
// ==========================================================================

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

export interface MockWalletData {
  id: string;
  balance: number;
  currency: string;
  eurEquivalent: number;
  lastUpdated: string;
}

export interface MockTransaction {
  id: string;
  type: 'payment' | 'topup' | 'refund';
  amount: number;
  currency: string;
  status: string;
  timestamp: string;
  description: string;
  standName?: string;
}

export interface MockTicket {
  id: string;
  code: string;
  type: string;
  name: string;
  eventName: string;
  eventDate: string;
  purchaseDate: string;
  status: string;
  qrCode: string;
  holderName: string;
  transferable: boolean;
}

// ==========================================================================
// Network Simulation
// ==========================================================================

/**
 * Simulate offline mode by blocking all URLs
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
 * Reset all network conditions
 */
export async function resetNetwork(): Promise<void> {
  await device.setURLBlacklist([]);
}

/**
 * Block only API calls (allow other traffic)
 */
export async function blockApiCalls(apiBaseUrl: string = 'api.'): Promise<void> {
  await device.setURLBlacklist([`.*${apiBaseUrl}.*`]);
}

/**
 * Simulate slow network (note: limited Detox support)
 */
export async function simulateSlowNetwork(): Promise<void> {
  // Detox doesn't have native network throttling
  // This is a placeholder - actual implementation would require custom mock server
  console.log('[Mock] Simulating slow network');
}

// ==========================================================================
// QR Code Scanning Simulation
// ==========================================================================

/**
 * Simulate scanning a QR code
 * @param qrCode The QR code data to simulate
 */
export async function simulateQRScan(qrCode: string): Promise<void> {
  await device.launchApp({
    newInstance: false,
    launchArgs: {
      mockQRCode: qrCode,
    },
  });
  // Small delay to allow app to process the mock
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Simulate scanning a payment QR code
 * @param userId User ID embedded in QR
 * @param token Payment token
 */
export async function simulatePaymentQRScan(
  userId: string = 'USER123',
  token: string = 'TOKEN456'
): Promise<void> {
  const qrCode = `PAY-${userId}-${token}`;
  await simulateQRScan(qrCode);
}

/**
 * Simulate scanning a ticket QR code
 * @param ticketCode Ticket code to simulate
 */
export async function simulateTicketScan(ticketCode: string): Promise<void> {
  await device.launchApp({
    newInstance: false,
    launchArgs: {
      mockTicketQR: ticketCode,
    },
  });
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Simulate scanning an invalid QR code
 */
export async function simulateInvalidQRScan(): Promise<void> {
  await simulateQRScan('INVALID-QR-CODE');
}

// ==========================================================================
// Mock Response Generators
// ==========================================================================

/**
 * Create a successful mock response
 */
export function mockSuccess<T>(data: T, delay: number = 0): MockResponse {
  return {
    status: 200,
    body: { success: true, data },
    delay,
  };
}

/**
 * Create an error mock response
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
 * Create a 401 Unauthorized mock response
 */
export function mockUnauthorized(): MockResponse {
  return mockError('Session expiree', 401, 'UNAUTHORIZED');
}

/**
 * Create a 403 Forbidden mock response
 */
export function mockForbidden(): MockResponse {
  return mockError('Acces refuse', 403, 'FORBIDDEN');
}

/**
 * Create a 404 Not Found mock response
 */
export function mockNotFound(resource: string = 'Resource'): MockResponse {
  return mockError(`${resource} non trouve`, 404, 'NOT_FOUND');
}

/**
 * Create a 422 Validation Error mock response
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
 * Create a 429 Rate Limit mock response
 */
export function mockRateLimit(retryAfter: number = 60): MockResponse {
  return {
    status: 429,
    body: {
      success: false,
      error: {
        message: 'Trop de requetes',
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
 * Create a 503 Service Unavailable mock response
 */
export function mockServiceUnavailable(): MockResponse {
  return mockError('Service temporairement indisponible', 503, 'SERVICE_UNAVAILABLE');
}

// ==========================================================================
// Mock Data Generators
// ==========================================================================

/**
 * Generate mock wallet data
 */
export function mockWalletData(balance: number = 150): MockWalletData {
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
): MockTransaction {
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
export function mockTransactionsList(count: number = 10): MockTransaction[] {
  const transactions: MockTransaction[] = [];
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
export function mockTicket(type: 'standard' | 'vip' | 'weekend' = 'standard'): MockTicket {
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
export function mockTicketsList(count: number = 3): MockTicket[] {
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

// ==========================================================================
// Mock Scenario Setup
// ==========================================================================

/**
 * Setup wallet with specific balance
 */
export function setupWalletScenario(balance: number): Record<string, unknown> {
  return {
    wallet: mockWalletData(balance),
    transactions: mockTransactionsList(5),
  };
}

/**
 * Setup empty wallet scenario
 */
export function setupEmptyWalletScenario(): Record<string, unknown> {
  return {
    wallet: mockWalletData(0),
    transactions: [],
  };
}

/**
 * Setup tickets scenario
 */
export function setupTicketsScenario(count: number = 2): Record<string, unknown> {
  return {
    tickets: mockTicketsList(count),
  };
}

/**
 * Setup no tickets scenario
 */
export function setupNoTicketsScenario(): Record<string, unknown> {
  return {
    tickets: [],
  };
}

/**
 * Setup staff member scenario
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

// ==========================================================================
// App Launch with Mock Data
// ==========================================================================

/**
 * Launch app with mock data
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

/**
 * Launch app in offline mode with cached data
 */
export async function launchOfflineWithCache(cachedData: Record<string, unknown>): Promise<void> {
  await device.launchApp({
    newInstance: true,
    launchArgs: {
      mockData: JSON.stringify(cachedData),
      forceOffline: 'true',
    },
  });
  await goOffline();
}

// ==========================================================================
// Biometric Simulation
// ==========================================================================

/**
 * Simulate successful Face ID
 */
export async function matchFaceId(): Promise<void> {
  if (device.getPlatform() === 'ios') {
    await device.matchFace();
  }
}

/**
 * Simulate failed Face ID
 */
export async function unmatchFaceId(): Promise<void> {
  if (device.getPlatform() === 'ios') {
    await device.unmatchFace();
  }
}

/**
 * Simulate successful fingerprint
 */
export async function matchFingerprint(): Promise<void> {
  if (device.getPlatform() === 'android') {
    await device.matchFinger();
  }
}

/**
 * Simulate failed fingerprint
 */
export async function unmatchFingerprint(): Promise<void> {
  if (device.getPlatform() === 'android') {
    await device.unmatchFinger();
  }
}

/**
 * Simulate successful biometric (platform-agnostic)
 */
export async function matchBiometric(): Promise<void> {
  if (device.getPlatform() === 'ios') {
    await device.matchFace();
  } else {
    await device.matchFinger();
  }
}

/**
 * Simulate failed biometric (platform-agnostic)
 */
export async function unmatchBiometric(): Promise<void> {
  if (device.getPlatform() === 'ios') {
    await device.unmatchFace();
  } else {
    await device.unmatchFinger();
  }
}

// ==========================================================================
// Location Simulation
// ==========================================================================

/**
 * Set mock location
 */
export async function setMockLocation(
  latitude: number,
  longitude: number
): Promise<void> {
  await device.setLocation(latitude, longitude);
}

/**
 * Set location to festival venue
 */
export async function setFestivalLocation(): Promise<void> {
  // Example coordinates for festival venue
  await setMockLocation(48.8566, 2.3522);
}

/**
 * Set location outside festival
 */
export async function setLocationOutsideFestival(): Promise<void> {
  // Coordinates far from festival
  await setMockLocation(48.9000, 2.4000);
}

// ==========================================================================
// Status Bar Simulation
// ==========================================================================

/**
 * Set status bar to show ideal conditions
 */
export async function setIdealStatusBar(): Promise<void> {
  if (device.getPlatform() === 'ios') {
    await device.setStatusBar({
      time: '12:00',
      dataNetwork: 'wifi',
      wifiMode: 'active',
      wifiBars: 3,
      cellularMode: 'active',
      cellularBars: 4,
      batteryState: 'charged',
      batteryLevel: 100,
    });
  }
}

/**
 * Set status bar to show low battery
 */
export async function setLowBatteryStatusBar(): Promise<void> {
  if (device.getPlatform() === 'ios') {
    await device.setStatusBar({
      batteryState: 'unplugged',
      batteryLevel: 10,
    });
  }
}

/**
 * Set status bar to show no network
 */
export async function setNoNetworkStatusBar(): Promise<void> {
  if (device.getPlatform() === 'ios') {
    await device.setStatusBar({
      dataNetwork: 'none',
      wifiMode: 'notSearching',
      wifiBars: 0,
      cellularMode: 'notSearching',
      cellularBars: 0,
    });
  }
}
