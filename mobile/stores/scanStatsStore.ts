import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScanResult, ScanResultType } from './ticketScanStore';

export interface HourlyScanData {
  hour: number; // 0-23
  valid: number;
  invalid: number;
  total: number;
}

export interface InvalidReasonBreakdown {
  reason: ScanResultType;
  count: number;
  label: string;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
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

export interface ScanStatsState {
  // Current day stats
  currentDate: string;
  totalToday: number;
  validToday: number;
  invalidToday: number;
  hourlyData: HourlyScanData[];
  invalidReasons: InvalidReasonBreakdown[];
  peakHour: number;
  peakHourScans: number;
  firstScanTime: string | null;
  lastScanTime: string | null;

  // Recent scans (last 20)
  recentScans: ScanResult[];

  // Historical data (last 7 days)
  historicalStats: DailyStats[];

  // Sync state
  lastSyncedAt: string | null;
  pendingSyncs: number;
  isSyncing: boolean;

  // Actions
  recordScan: (scan: ScanResult) => void;
  resetDailyStats: () => void;
  checkAndResetIfNewDay: () => void;
  syncStats: () => Promise<void>;
  loadStatsFromServer: () => Promise<void>;
  getValidPercentage: () => number;
  getPeakHours: () => { hour: number; scans: number }[];
  getInvalidReasonsBreakdown: () => InvalidReasonBreakdown[];
}

const INVALID_REASON_LABELS: Record<ScanResultType, string> = {
  success: 'Valide',
  error: 'Erreur systeme',
  already_used: 'Deja utilise',
  invalid: 'Code invalide',
  expired: 'Expire',
};

const createEmptyHourlyData = (): HourlyScanData[] => {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    valid: 0,
    invalid: 0,
    total: 0,
  }));
};

const createEmptyInvalidReasons = (): InvalidReasonBreakdown[] => {
  return [
    { reason: 'invalid', count: 0, label: INVALID_REASON_LABELS.invalid },
    { reason: 'already_used', count: 0, label: INVALID_REASON_LABELS.already_used },
    { reason: 'expired', count: 0, label: INVALID_REASON_LABELS.expired },
    { reason: 'error', count: 0, label: INVALID_REASON_LABELS.error },
  ];
};

const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getHourFromDate = (dateString: string): number => {
  return new Date(dateString).getHours();
};

export const useScanStatsStore = create<ScanStatsState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentDate: getTodayDateString(),
      totalToday: 0,
      validToday: 0,
      invalidToday: 0,
      hourlyData: createEmptyHourlyData(),
      invalidReasons: createEmptyInvalidReasons(),
      peakHour: 0,
      peakHourScans: 0,
      firstScanTime: null,
      lastScanTime: null,
      recentScans: [],
      historicalStats: [],
      lastSyncedAt: null,
      pendingSyncs: 0,
      isSyncing: false,

      recordScan: (scan: ScanResult) => {
        const state = get();

        // Check if we need to reset for a new day
        const today = getTodayDateString();
        if (state.currentDate !== today) {
          // Archive current day stats before resetting
          const currentDayStats: DailyStats = {
            date: state.currentDate,
            totalScans: state.totalToday,
            validScans: state.validToday,
            invalidScans: state.invalidToday,
            validPercentage: state.totalToday > 0
              ? Math.round((state.validToday / state.totalToday) * 100)
              : 0,
            hourlyData: state.hourlyData,
            invalidReasons: state.invalidReasons,
            peakHour: state.peakHour,
            peakHourScans: state.peakHourScans,
            firstScanTime: state.firstScanTime,
            lastScanTime: state.lastScanTime,
          };

          set({
            currentDate: today,
            totalToday: 0,
            validToday: 0,
            invalidToday: 0,
            hourlyData: createEmptyHourlyData(),
            invalidReasons: createEmptyInvalidReasons(),
            peakHour: 0,
            peakHourScans: 0,
            firstScanTime: null,
            lastScanTime: null,
            historicalStats: [currentDayStats, ...state.historicalStats].slice(0, 7),
          });
        }

        const hour = getHourFromDate(scan.scannedAt);
        const isValid = scan.resultType === 'success';

        set((s) => {
          // Update hourly data
          const newHourlyData = [...s.hourlyData];
          newHourlyData[hour] = {
            ...newHourlyData[hour],
            valid: newHourlyData[hour].valid + (isValid ? 1 : 0),
            invalid: newHourlyData[hour].invalid + (isValid ? 0 : 1),
            total: newHourlyData[hour].total + 1,
          };

          // Find peak hour
          let newPeakHour = s.peakHour;
          let newPeakHourScans = s.peakHourScans;
          if (newHourlyData[hour].total > newPeakHourScans) {
            newPeakHour = hour;
            newPeakHourScans = newHourlyData[hour].total;
          }

          // Update invalid reasons if not valid
          const newInvalidReasons = [...s.invalidReasons];
          if (!isValid) {
            const reasonIndex = newInvalidReasons.findIndex(
              (r) => r.reason === scan.resultType
            );
            if (reasonIndex !== -1) {
              newInvalidReasons[reasonIndex] = {
                ...newInvalidReasons[reasonIndex],
                count: newInvalidReasons[reasonIndex].count + 1,
              };
            }
          }

          // Update recent scans (keep last 20)
          const newRecentScans = [scan, ...s.recentScans].slice(0, 20);

          return {
            totalToday: s.totalToday + 1,
            validToday: s.validToday + (isValid ? 1 : 0),
            invalidToday: s.invalidToday + (isValid ? 0 : 1),
            hourlyData: newHourlyData,
            invalidReasons: newInvalidReasons,
            peakHour: newPeakHour,
            peakHourScans: newPeakHourScans,
            firstScanTime: s.firstScanTime ?? scan.scannedAt,
            lastScanTime: scan.scannedAt,
            recentScans: newRecentScans,
            pendingSyncs: s.pendingSyncs + 1,
          };
        });
      },

      resetDailyStats: () => {
        const state = get();

        // Archive current day stats before resetting
        if (state.totalToday > 0) {
          const currentDayStats: DailyStats = {
            date: state.currentDate,
            totalScans: state.totalToday,
            validScans: state.validToday,
            invalidScans: state.invalidToday,
            validPercentage: state.totalToday > 0
              ? Math.round((state.validToday / state.totalToday) * 100)
              : 0,
            hourlyData: state.hourlyData,
            invalidReasons: state.invalidReasons,
            peakHour: state.peakHour,
            peakHourScans: state.peakHourScans,
            firstScanTime: state.firstScanTime,
            lastScanTime: state.lastScanTime,
          };

          set({
            historicalStats: [currentDayStats, ...state.historicalStats].slice(0, 7),
          });
        }

        set({
          currentDate: getTodayDateString(),
          totalToday: 0,
          validToday: 0,
          invalidToday: 0,
          hourlyData: createEmptyHourlyData(),
          invalidReasons: createEmptyInvalidReasons(),
          peakHour: 0,
          peakHourScans: 0,
          firstScanTime: null,
          lastScanTime: null,
          recentScans: [],
        });
      },

      checkAndResetIfNewDay: () => {
        const state = get();
        const today = getTodayDateString();

        if (state.currentDate !== today) {
          // Archive and reset
          if (state.totalToday > 0) {
            const currentDayStats: DailyStats = {
              date: state.currentDate,
              totalScans: state.totalToday,
              validScans: state.validToday,
              invalidScans: state.invalidToday,
              validPercentage: state.totalToday > 0
                ? Math.round((state.validToday / state.totalToday) * 100)
                : 0,
              hourlyData: state.hourlyData,
              invalidReasons: state.invalidReasons,
              peakHour: state.peakHour,
              peakHourScans: state.peakHourScans,
              firstScanTime: state.firstScanTime,
              lastScanTime: state.lastScanTime,
            };

            set({
              historicalStats: [currentDayStats, ...state.historicalStats].slice(0, 7),
            });
          }

          set({
            currentDate: today,
            totalToday: 0,
            validToday: 0,
            invalidToday: 0,
            hourlyData: createEmptyHourlyData(),
            invalidReasons: createEmptyInvalidReasons(),
            peakHour: 0,
            peakHourScans: 0,
            firstScanTime: null,
            lastScanTime: null,
          });
        }
      },

      syncStats: async () => {
        const state = get();
        if (state.isSyncing || state.pendingSyncs === 0) return;

        set({ isSyncing: true });

        try {
          // Simulate API call - in real implementation:
          // await api.post('/scanner/stats/sync', {
          //   date: state.currentDate,
          //   totalScans: state.totalToday,
          //   validScans: state.validToday,
          //   invalidScans: state.invalidToday,
          //   hourlyData: state.hourlyData,
          //   invalidReasons: state.invalidReasons,
          // });

          await new Promise((resolve) => setTimeout(resolve, 500));

          set({
            lastSyncedAt: new Date().toISOString(),
            pendingSyncs: 0,
            isSyncing: false,
          });
        } catch (error) {
          console.error('Failed to sync stats:', error);
          set({ isSyncing: false });
          throw error;
        }
      },

      loadStatsFromServer: async () => {
        set({ isSyncing: true });

        try {
          // Simulate API call - in real implementation:
          // const response = await api.get('/scanner/stats/today');
          // set({ ...response.data, isSyncing: false });

          await new Promise((resolve) => setTimeout(resolve, 500));

          // For now, just mark as loaded
          set({ isSyncing: false });
        } catch (error) {
          console.error('Failed to load stats:', error);
          set({ isSyncing: false });
          throw error;
        }
      },

      getValidPercentage: () => {
        const state = get();
        if (state.totalToday === 0) return 0;
        return Math.round((state.validToday / state.totalToday) * 100);
      },

      getPeakHours: () => {
        const state = get();
        return state.hourlyData
          .filter((h) => h.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 3)
          .map((h) => ({ hour: h.hour, scans: h.total }));
      },

      getInvalidReasonsBreakdown: () => {
        const state = get();
        return state.invalidReasons
          .filter((r) => r.count > 0)
          .sort((a, b) => b.count - a.count);
      },
    }),
    {
      name: 'scan-stats-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentDate: state.currentDate,
        totalToday: state.totalToday,
        validToday: state.validToday,
        invalidToday: state.invalidToday,
        hourlyData: state.hourlyData,
        invalidReasons: state.invalidReasons,
        peakHour: state.peakHour,
        peakHourScans: state.peakHourScans,
        firstScanTime: state.firstScanTime,
        lastScanTime: state.lastScanTime,
        recentScans: state.recentScans,
        historicalStats: state.historicalStats,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
