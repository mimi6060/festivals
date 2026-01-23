import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type QRType = 'ticket' | 'wallet' | 'stand' | 'unknown';

export interface ScanEntry {
  id: string;
  rawData: string;
  qrType: QRType;
  resourceId: string | null;
  displayName: string;
  description: string;
  timestamp: string;
  successful: boolean;
}

interface ScanState {
  // Scan history
  scanHistory: ScanEntry[];
  maxHistorySize: number;

  // Current scan state
  lastScan: ScanEntry | null;
  isProcessing: boolean;

  // Actions
  addScan: (entry: Omit<ScanEntry, 'id' | 'timestamp'>) => ScanEntry;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
  setLastScan: (scan: ScanEntry | null) => void;
  setIsProcessing: (processing: boolean) => void;
}

/**
 * Parse QR code data and determine its type
 * Expected formats:
 * - ticket:UUID -> Navigate to ticket validation
 * - wallet:UUID -> Navigate to payment
 * - stand:UUID -> Navigate to stand info
 * - JSON with type field
 * - Unknown format
 */
export function parseQRCode(data: string): {
  qrType: QRType;
  resourceId: string | null;
  displayName: string;
  description: string;
} {
  // Check for prefixed formats (e.g., ticket:uuid, wallet:uuid, stand:uuid)
  const prefixMatch = data.match(/^(ticket|wallet|stand):(.+)$/i);
  if (prefixMatch) {
    const [, type, id] = prefixMatch;
    const qrType = type.toLowerCase() as QRType;
    return {
      qrType,
      resourceId: id,
      displayName: getDisplayNameForType(qrType),
      description: `${getDisplayNameForType(qrType)} ID: ${id.slice(0, 8)}...`,
    };
  }

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(data);

    if (parsed.type && ['ticket', 'wallet', 'stand'].includes(parsed.type.toLowerCase())) {
      const qrType = parsed.type.toLowerCase() as QRType;
      const resourceId = parsed.id || parsed.uuid || parsed.resourceId || null;
      return {
        qrType,
        resourceId,
        displayName: parsed.name || getDisplayNameForType(qrType),
        description: parsed.description || `${getDisplayNameForType(qrType)}`,
      };
    }

    // Check for ticket-specific fields
    if (parsed.ticketCode || parsed.ticketId) {
      return {
        qrType: 'ticket',
        resourceId: parsed.ticketId || parsed.ticketCode,
        displayName: parsed.holderName || 'Billet',
        description: parsed.ticketTypeName || parsed.eventName || 'Billet festival',
      };
    }

    // Check for wallet-specific fields
    if (parsed.walletId || parsed.token) {
      return {
        qrType: 'wallet',
        resourceId: parsed.walletId || parsed.token,
        displayName: parsed.name || 'Wallet',
        description: 'Paiement cashless',
      };
    }

    // Check for stand-specific fields
    if (parsed.standId || parsed.standName) {
      return {
        qrType: 'stand',
        resourceId: parsed.standId,
        displayName: parsed.standName || 'Stand',
        description: parsed.category || 'Info stand',
      };
    }
  } catch {
    // Not JSON, continue with other checks
  }

  // Check for UUID-like patterns
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(data)) {
    return {
      qrType: 'unknown',
      resourceId: data,
      displayName: 'Code QR',
      description: `ID: ${data.slice(0, 8)}...`,
    };
  }

  return {
    qrType: 'unknown',
    resourceId: null,
    displayName: 'Code QR',
    description: data.length > 30 ? `${data.slice(0, 30)}...` : data,
  };
}

function getDisplayNameForType(type: QRType): string {
  switch (type) {
    case 'ticket':
      return 'Billet';
    case 'wallet':
      return 'Wallet';
    case 'stand':
      return 'Stand';
    default:
      return 'Inconnu';
  }
}

export function getRouteForQRType(
  qrType: QRType,
  resourceId: string | null
): { route: string; params?: Record<string, string> } | null {
  if (!resourceId) return null;

  switch (qrType) {
    case 'ticket':
      return { route: '/ticket/[id]', params: { id: resourceId } };
    case 'wallet':
      return { route: '/(staff)/payment/confirm', params: { walletId: resourceId } };
    case 'stand':
      return { route: '/(tabs)/map', params: { standId: resourceId } };
    default:
      return null;
  }
}

export const useScanStore = create<ScanState>()(
  persist(
    (set, get) => ({
      scanHistory: [],
      maxHistorySize: 100,
      lastScan: null,
      isProcessing: false,

      addScan: (entry) => {
        const newScan: ScanEntry = {
          ...entry,
          id: `scan-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          scanHistory: [newScan, ...state.scanHistory].slice(0, state.maxHistorySize),
          lastScan: newScan,
        }));

        return newScan;
      },

      clearHistory: () => set({ scanHistory: [] }),

      removeFromHistory: (id) =>
        set((state) => ({
          scanHistory: state.scanHistory.filter((scan) => scan.id !== id),
        })),

      setLastScan: (scan) => set({ lastScan: scan }),

      setIsProcessing: (processing) => set({ isProcessing: processing }),
    }),
    {
      name: 'scan-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        scanHistory: state.scanHistory,
      }),
    }
  )
);
