import { apiClient, ENDPOINTS, API_URL } from '@/config/api';
import { DailyStats, HourlyScanData, InvalidReasonBreakdown } from '@/stores/scanStatsStore';
import { ScanResult } from '@/stores/ticketScanStore';

// API Types
export interface ScanStatsResponse {
  date: string;
  totalScans: number;
  validScans: number;
  invalidScans: number;
  validPercentage: number;
  hourlyData: HourlyScanData[];
  invalidReasons: InvalidReasonBreakdown[];
  peakHour: number;
  peakHourScans: number;
  firstScanTime: string | null;
  lastScanTime: string | null;
}

export interface ScanStatsSyncRequest {
  date: string;
  scannerId: string;
  totalScans: number;
  validScans: number;
  invalidScans: number;
  hourlyData: HourlyScanData[];
  invalidReasons: InvalidReasonBreakdown[];
  recentScans: ScanResult[];
}

export interface ScanStatsSyncResponse {
  success: boolean;
  syncedAt: string;
  serverTotalScans: number;
}

export interface ScannerLeaderboardEntry {
  scannerId: string;
  scannerName: string;
  totalScans: number;
  validPercentage: number;
  rank: number;
}

export interface AggregatedStatsResponse {
  festivalId: string;
  date: string;
  totalScansAllScanners: number;
  totalValidScans: number;
  totalInvalidScans: number;
  currentlyInside: number;
  peakOccupancy: number;
  peakOccupancyTime: string;
  leaderboard: ScannerLeaderboardEntry[];
}

// Extended endpoints for scanner stats
export const SCANNER_STATS_ENDPOINTS = {
  TODAY_STATS: (festivalId: string) => `/festivals/${festivalId}/scanner/stats/today`,
  SYNC_STATS: (festivalId: string) => `/festivals/${festivalId}/scanner/stats/sync`,
  HISTORICAL_STATS: (festivalId: string, days: number) =>
    `/festivals/${festivalId}/scanner/stats/history?days=${days}`,
  AGGREGATED_STATS: (festivalId: string) => `/festivals/${festivalId}/scanner/stats/aggregated`,
  LEADERBOARD: (festivalId: string) => `/festivals/${festivalId}/scanner/stats/leaderboard`,
};

// Mock delay for simulating API calls
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data generator for development
const generateMockStats = (date: string): ScanStatsResponse => {
  const hourlyData: HourlyScanData[] = Array.from({ length: 24 }, (_, i) => {
    // Simulate realistic festival hours (10am - 2am)
    const isActiveHour = (i >= 10 && i <= 23) || i <= 2;
    const baseScans = isActiveHour ? Math.floor(Math.random() * 50 + 10) : Math.floor(Math.random() * 5);
    const validScans = Math.floor(baseScans * (0.85 + Math.random() * 0.15));
    return {
      hour: i,
      valid: validScans,
      invalid: baseScans - validScans,
      total: baseScans,
    };
  });

  const totalScans = hourlyData.reduce((sum, h) => sum + h.total, 0);
  const validScans = hourlyData.reduce((sum, h) => sum + h.valid, 0);

  const peakHourData = hourlyData.reduce((peak, h) =>
    h.total > peak.total ? h : peak, hourlyData[0]
  );

  return {
    date,
    totalScans,
    validScans,
    invalidScans: totalScans - validScans,
    validPercentage: Math.round((validScans / totalScans) * 100),
    hourlyData,
    invalidReasons: [
      { reason: 'invalid', count: Math.floor(Math.random() * 20 + 5), label: 'Code invalide' },
      { reason: 'already_used', count: Math.floor(Math.random() * 15 + 3), label: 'Deja utilise' },
      { reason: 'expired', count: Math.floor(Math.random() * 10 + 2), label: 'Expire' },
      { reason: 'error', count: Math.floor(Math.random() * 5 + 1), label: 'Erreur systeme' },
    ],
    peakHour: peakHourData.hour,
    peakHourScans: peakHourData.total,
    firstScanTime: `${date}T10:15:00Z`,
    lastScanTime: `${date}T23:45:00Z`,
  };
};

/**
 * Fetch today's scan statistics from the server
 */
export async function fetchTodayStats(festivalId: string): Promise<ScanStatsResponse> {
  try {
    // In production:
    // return await apiClient.get<ScanStatsResponse>(SCANNER_STATS_ENDPOINTS.TODAY_STATS(festivalId));

    // Mock implementation
    await mockDelay(500);
    const today = new Date().toISOString().split('T')[0];
    return generateMockStats(today);
  } catch (error) {
    console.error('Error fetching today stats:', error);
    throw error;
  }
}

/**
 * Sync local scan statistics with the server
 */
export async function syncScanStats(
  festivalId: string,
  request: ScanStatsSyncRequest
): Promise<ScanStatsSyncResponse> {
  try {
    // In production:
    // return await apiClient.post<ScanStatsSyncResponse>(
    //   SCANNER_STATS_ENDPOINTS.SYNC_STATS(festivalId),
    //   request
    // );

    // Mock implementation
    await mockDelay(300);
    return {
      success: true,
      syncedAt: new Date().toISOString(),
      serverTotalScans: request.totalScans,
    };
  } catch (error) {
    console.error('Error syncing stats:', error);
    throw error;
  }
}

/**
 * Fetch historical statistics for the past N days
 */
export async function fetchHistoricalStats(
  festivalId: string,
  days: number = 7
): Promise<DailyStats[]> {
  try {
    // In production:
    // return await apiClient.get<DailyStats[]>(
    //   SCANNER_STATS_ENDPOINTS.HISTORICAL_STATS(festivalId, days)
    // );

    // Mock implementation
    await mockDelay(700);

    const stats: DailyStats[] = [];
    const today = new Date();

    for (let i = 1; i <= days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const mockStats = generateMockStats(dateStr);

      stats.push({
        date: dateStr,
        totalScans: mockStats.totalScans,
        validScans: mockStats.validScans,
        invalidScans: mockStats.invalidScans,
        validPercentage: mockStats.validPercentage,
        hourlyData: mockStats.hourlyData,
        invalidReasons: mockStats.invalidReasons,
        peakHour: mockStats.peakHour,
        peakHourScans: mockStats.peakHourScans,
        firstScanTime: mockStats.firstScanTime,
        lastScanTime: mockStats.lastScanTime,
      });
    }

    return stats;
  } catch (error) {
    console.error('Error fetching historical stats:', error);
    throw error;
  }
}

/**
 * Fetch aggregated statistics across all scanners
 */
export async function fetchAggregatedStats(
  festivalId: string
): Promise<AggregatedStatsResponse> {
  try {
    // In production:
    // return await apiClient.get<AggregatedStatsResponse>(
    //   SCANNER_STATS_ENDPOINTS.AGGREGATED_STATS(festivalId)
    // );

    // Mock implementation
    await mockDelay(500);

    const today = new Date().toISOString().split('T')[0];
    return {
      festivalId,
      date: today,
      totalScansAllScanners: Math.floor(Math.random() * 5000 + 1000),
      totalValidScans: Math.floor(Math.random() * 4500 + 900),
      totalInvalidScans: Math.floor(Math.random() * 500 + 100),
      currentlyInside: Math.floor(Math.random() * 3000 + 500),
      peakOccupancy: Math.floor(Math.random() * 4000 + 1000),
      peakOccupancyTime: `${today}T20:30:00Z`,
      leaderboard: [
        { scannerId: 'scanner-1', scannerName: 'Entree Principale', totalScans: 1250, validPercentage: 96, rank: 1 },
        { scannerId: 'scanner-2', scannerName: 'Entree VIP', totalScans: 890, validPercentage: 98, rank: 2 },
        { scannerId: 'scanner-3', scannerName: 'Entree Camping', totalScans: 720, validPercentage: 94, rank: 3 },
        { scannerId: 'scanner-4', scannerName: 'Entree Sud', totalScans: 650, validPercentage: 95, rank: 4 },
        { scannerId: 'scanner-5', scannerName: 'Entree Est', totalScans: 480, validPercentage: 97, rank: 5 },
      ],
    };
  } catch (error) {
    console.error('Error fetching aggregated stats:', error);
    throw error;
  }
}

/**
 * Push a single scan result to the server (for real-time tracking)
 */
export async function pushScanResult(
  festivalId: string,
  scan: ScanResult
): Promise<{ success: boolean }> {
  try {
    // In production:
    // return await apiClient.post<{ success: boolean }>(
    //   `${SCANNER_STATS_ENDPOINTS.TODAY_STATS(festivalId)}/push`,
    //   scan
    // );

    // Mock implementation - just return success
    return { success: true };
  } catch (error) {
    // Don't throw - queue for later sync
    console.warn('Failed to push scan result, will sync later:', error);
    return { success: false };
  }
}

/**
 * Get scanner performance metrics
 */
export async function getPerformanceMetrics(
  festivalId: string,
  scannerId: string
): Promise<{
  averageScansPerHour: number;
  validPercentage: number;
  peakPerformanceHour: number;
  comparisonToAverage: number; // percentage above/below average
}> {
  try {
    // Mock implementation
    await mockDelay(300);

    return {
      averageScansPerHour: Math.floor(Math.random() * 50 + 30),
      validPercentage: Math.floor(Math.random() * 10 + 90),
      peakPerformanceHour: Math.floor(Math.random() * 14 + 10), // 10am - midnight
      comparisonToAverage: Math.floor(Math.random() * 40 - 20), // -20% to +20%
    };
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    throw error;
  }
}
