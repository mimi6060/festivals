import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ScanMode = 'entry' | 'exit';
export type ScanResultType = 'success' | 'error' | 'already_used' | 'invalid' | 'expired';

export interface ScannedTicket {
  id: string;
  ticketCode: string;
  holderName: string;
  ticketType: string;
  ticketTypeName: string;
  eventName: string;
  validFrom: string;
  validUntil: string;
}

export interface ScanResult {
  id: string;
  ticketCode: string;
  holderName: string;
  ticketType: string;
  ticketTypeName: string;
  resultType: ScanResultType;
  scanMode: ScanMode;
  message: string;
  entryCount?: number;
  scannedAt: string;
}

export interface TodayStats {
  entries: number;
  exits: number;
  currentlyInside: number;
  totalScans: number;
  successfulScans: number;
  failedScans: number;
}

interface TicketScanState {
  // Current mode
  scanMode: ScanMode;

  // Recent scans log
  recentScans: ScanResult[];

  // Today's statistics
  todayStats: TodayStats;

  // Last scan result (for result screen)
  lastScanResult: ScanResult | null;

  // Loading state
  isScanning: boolean;

  // Actions
  setScanMode: (mode: ScanMode) => void;
  scanTicket: (ticketCode: string) => Promise<ScanResult>;
  clearLastScanResult: () => void;
  clearRecentScans: () => void;
  resetTodayStats: () => void;
}

// Mock database of valid tickets for demonstration
const mockValidTickets: Record<string, ScannedTicket> = {
  'GRIF-WKD-2026-001': {
    id: 'ticket-001',
    ticketCode: 'GRIF-WKD-2026-001',
    holderName: 'Jean Dupont',
    ticketType: 'WEEKEND_PASS',
    ticketTypeName: 'Pass Weekend',
    eventName: 'Festival des Griffons 2026',
    validFrom: '2026-07-15T08:00:00Z',
    validUntil: '2026-07-17T23:59:59Z',
  },
  'GRIF-CMP-2026-002': {
    id: 'ticket-002',
    ticketCode: 'GRIF-CMP-2026-002',
    holderName: 'Jean Dupont',
    ticketType: 'CAMPING',
    ticketTypeName: 'Pass Camping',
    eventName: 'Festival des Griffons 2026',
    validFrom: '2026-07-14T14:00:00Z',
    validUntil: '2026-07-18T12:00:00Z',
  },
  'GRIF-VIP-2026-003': {
    id: 'ticket-003',
    ticketCode: 'GRIF-VIP-2026-003',
    holderName: 'Marie Martin',
    ticketType: 'VIP',
    ticketTypeName: 'VIP Access',
    eventName: 'Festival des Griffons 2026',
    validFrom: '2026-07-15T08:00:00Z',
    validUntil: '2026-07-17T23:59:59Z',
  },
  'GRIF-DAY-2026-004': {
    id: 'ticket-004',
    ticketCode: 'GRIF-DAY-2026-004',
    holderName: 'Pierre Bernard',
    ticketType: 'DAY_PASS',
    ticketTypeName: 'Pass Journee',
    eventName: 'Festival des Griffons 2026',
    validFrom: '2026-07-15T08:00:00Z',
    validUntil: '2026-07-15T23:59:59Z',
  },
};

// Track which tickets are currently "inside" (for re-entry simulation)
const ticketsInside: Set<string> = new Set();
const ticketEntryCount: Record<string, number> = {};

export const useTicketScanStore = create<TicketScanState>()(
  persist(
    (set, get) => ({
      scanMode: 'entry',
      recentScans: [],
      todayStats: {
        entries: 0,
        exits: 0,
        currentlyInside: 0,
        totalScans: 0,
        successfulScans: 0,
        failedScans: 0,
      },
      lastScanResult: null,
      isScanning: false,

      setScanMode: (mode) => set({ scanMode: mode }),

      scanTicket: async (ticketCode: string): Promise<ScanResult> => {
        const state = get();
        set({ isScanning: true });

        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        const normalizedCode = ticketCode.toUpperCase().trim();
        const ticket = mockValidTickets[normalizedCode];
        const now = new Date().toISOString();

        let result: ScanResult;

        if (!ticket) {
          // Invalid ticket
          result = {
            id: `scan-${Date.now()}`,
            ticketCode: normalizedCode,
            holderName: 'Inconnu',
            ticketType: 'UNKNOWN',
            ticketTypeName: 'Inconnu',
            resultType: 'invalid',
            scanMode: state.scanMode,
            message: 'Billet non reconnu',
            scannedAt: now,
          };

          set((s) => ({
            isScanning: false,
            lastScanResult: result,
            recentScans: [result, ...s.recentScans].slice(0, 50),
            todayStats: {
              ...s.todayStats,
              totalScans: s.todayStats.totalScans + 1,
              failedScans: s.todayStats.failedScans + 1,
            },
          }));

          return result;
        }

        // Check validity period
        const validFrom = new Date(ticket.validFrom);
        const validUntil = new Date(ticket.validUntil);
        const currentDate = new Date();

        if (currentDate < validFrom || currentDate > validUntil) {
          result = {
            id: `scan-${Date.now()}`,
            ticketCode: normalizedCode,
            holderName: ticket.holderName,
            ticketType: ticket.ticketType,
            ticketTypeName: ticket.ticketTypeName,
            resultType: 'expired',
            scanMode: state.scanMode,
            message: currentDate < validFrom
              ? 'Billet pas encore valide'
              : 'Billet expire',
            scannedAt: now,
          };

          set((s) => ({
            isScanning: false,
            lastScanResult: result,
            recentScans: [result, ...s.recentScans].slice(0, 50),
            todayStats: {
              ...s.todayStats,
              totalScans: s.todayStats.totalScans + 1,
              failedScans: s.todayStats.failedScans + 1,
            },
          }));

          return result;
        }

        if (state.scanMode === 'entry') {
          // Entry mode
          if (ticketsInside.has(normalizedCode)) {
            result = {
              id: `scan-${Date.now()}`,
              ticketCode: normalizedCode,
              holderName: ticket.holderName,
              ticketType: ticket.ticketType,
              ticketTypeName: ticket.ticketTypeName,
              resultType: 'already_used',
              scanMode: state.scanMode,
              message: 'Deja a l\'interieur',
              entryCount: ticketEntryCount[normalizedCode] || 1,
              scannedAt: now,
            };

            set((s) => ({
              isScanning: false,
              lastScanResult: result,
              recentScans: [result, ...s.recentScans].slice(0, 50),
              todayStats: {
                ...s.todayStats,
                totalScans: s.todayStats.totalScans + 1,
                failedScans: s.todayStats.failedScans + 1,
              },
            }));

            return result;
          }

          // Successful entry
          ticketsInside.add(normalizedCode);
          ticketEntryCount[normalizedCode] = (ticketEntryCount[normalizedCode] || 0) + 1;

          result = {
            id: `scan-${Date.now()}`,
            ticketCode: normalizedCode,
            holderName: ticket.holderName,
            ticketType: ticket.ticketType,
            ticketTypeName: ticket.ticketTypeName,
            resultType: 'success',
            scanMode: state.scanMode,
            message: ticketEntryCount[normalizedCode] > 1
              ? `Re-entree #${ticketEntryCount[normalizedCode]}`
              : 'Entree validee',
            entryCount: ticketEntryCount[normalizedCode],
            scannedAt: now,
          };

          set((s) => ({
            isScanning: false,
            lastScanResult: result,
            recentScans: [result, ...s.recentScans].slice(0, 50),
            todayStats: {
              ...s.todayStats,
              entries: s.todayStats.entries + 1,
              currentlyInside: s.todayStats.currentlyInside + 1,
              totalScans: s.todayStats.totalScans + 1,
              successfulScans: s.todayStats.successfulScans + 1,
            },
          }));

          return result;
        } else {
          // Exit mode
          if (!ticketsInside.has(normalizedCode)) {
            result = {
              id: `scan-${Date.now()}`,
              ticketCode: normalizedCode,
              holderName: ticket.holderName,
              ticketType: ticket.ticketType,
              ticketTypeName: ticket.ticketTypeName,
              resultType: 'error',
              scanMode: state.scanMode,
              message: 'Pas enregistre comme present',
              scannedAt: now,
            };

            set((s) => ({
              isScanning: false,
              lastScanResult: result,
              recentScans: [result, ...s.recentScans].slice(0, 50),
              todayStats: {
                ...s.todayStats,
                totalScans: s.todayStats.totalScans + 1,
                failedScans: s.todayStats.failedScans + 1,
              },
            }));

            return result;
          }

          // Successful exit
          ticketsInside.delete(normalizedCode);

          result = {
            id: `scan-${Date.now()}`,
            ticketCode: normalizedCode,
            holderName: ticket.holderName,
            ticketType: ticket.ticketType,
            ticketTypeName: ticket.ticketTypeName,
            resultType: 'success',
            scanMode: state.scanMode,
            message: 'Sortie enregistree',
            scannedAt: now,
          };

          set((s) => ({
            isScanning: false,
            lastScanResult: result,
            recentScans: [result, ...s.recentScans].slice(0, 50),
            todayStats: {
              ...s.todayStats,
              exits: s.todayStats.exits + 1,
              currentlyInside: Math.max(0, s.todayStats.currentlyInside - 1),
              totalScans: s.todayStats.totalScans + 1,
              successfulScans: s.todayStats.successfulScans + 1,
            },
          }));

          return result;
        }
      },

      clearLastScanResult: () => set({ lastScanResult: null }),

      clearRecentScans: () => set({ recentScans: [] }),

      resetTodayStats: () =>
        set({
          todayStats: {
            entries: 0,
            exits: 0,
            currentlyInside: 0,
            totalScans: 0,
            successfulScans: 0,
            failedScans: 0,
          },
        }),
    }),
    {
      name: 'ticket-scan-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        scanMode: state.scanMode,
        recentScans: state.recentScans,
        todayStats: state.todayStats,
      }),
    }
  )
);
