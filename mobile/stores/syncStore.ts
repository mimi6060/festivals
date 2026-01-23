import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Sync status types - expanded for sync engine
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success' | 'offline';

// Sync error interface
export interface SyncErrorInfo {
  id: string;
  code: string;
  message: string;
  entityType?: string;
  entityId?: string;
  recoverable: boolean;
  timestamp: string;
}

export interface PendingTransaction {
  id: string;
  type: 'PURCHASE' | 'PAYMENT' | 'REFUND' | 'CANCEL';
  amount: number;
  walletId: string;
  userId: string;
  standId?: string;
  standName?: string;
  description?: string;
  idempotencyKey: string;
  offlineSignature: string;
  createdAt: string;
  retryCount: number;
  lastRetryAt?: string;
  error?: string;
}

// Sync progress tracking
export interface SyncProgress {
  currentStrategy: string;
  currentIndex: number;
  totalStrategies: number;
  progress: number; // 0-100
}

interface SyncState {
  // State
  pendingTransactions: PendingTransaction[];
  lastSyncTime: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  syncErrors: SyncErrorInfo[];
  isSyncing: boolean;
  isOnline: boolean;

  // Progress tracking
  syncProgress: SyncProgress | null;

  // Pending counts by entity type
  pendingCounts: {
    transactions: number;
    wallets: number;
    products: number;
    stands: number;
  };

  // Actions
  addPendingTransaction: (transaction: Omit<PendingTransaction, 'retryCount'>) => void;
  removePendingTransaction: (id: string) => void;
  updatePendingTransaction: (id: string, updates: Partial<PendingTransaction>) => void;
  syncPendingTransactions: () => Promise<SyncResult>;
  clearSynced: () => void;
  clearAllPending: () => void;
  setLastSyncTime: (time: string) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncError: (error: string | null) => void;
  getPendingCount: () => number;
  getOldestPending: () => PendingTransaction | null;

  // New actions for sync engine
  setIsOnline: (isOnline: boolean) => void;
  setSyncProgress: (progress: SyncProgress | null) => void;
  addSyncError: (error: SyncErrorInfo) => void;
  clearSyncErrors: () => void;
  setPendingCounts: (counts: Partial<SyncState['pendingCounts']>) => void;
  startSync: () => void;
  cancelSync: () => void;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ id: string; error: string }>;
}

// Maximum retry attempts before marking as failed
const MAX_RETRY_COUNT = 3;

// Minimum time between retries (in ms)
const RETRY_DELAY_MS = 5000;

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      // Initial State
      pendingTransactions: [],
      lastSyncTime: null,
      syncStatus: 'idle',
      syncError: null,
      syncErrors: [],
      isSyncing: false,
      isOnline: true,
      syncProgress: null,
      pendingCounts: {
        transactions: 0,
        wallets: 0,
        products: 0,
        stands: 0,
      },

      // Actions
      addPendingTransaction: (transaction) =>
        set((state) => ({
          pendingTransactions: [
            ...state.pendingTransactions,
            { ...transaction, retryCount: 0 },
          ],
        })),

      removePendingTransaction: (id) =>
        set((state) => ({
          pendingTransactions: state.pendingTransactions.filter((tx) => tx.id !== id),
        })),

      updatePendingTransaction: (id, updates) =>
        set((state) => ({
          pendingTransactions: state.pendingTransactions.map((tx) =>
            tx.id === id ? { ...tx, ...updates } : tx
          ),
        })),

      syncPendingTransactions: async (): Promise<SyncResult> => {
        const { pendingTransactions, updatePendingTransaction, removePendingTransaction } = get();

        if (pendingTransactions.length === 0) {
          set({ syncStatus: 'success', lastSyncTime: new Date().toISOString() });
          return { success: true, syncedCount: 0, failedCount: 0, errors: [] };
        }

        set({ isSyncing: true, syncStatus: 'syncing', syncError: null });

        const errors: Array<{ id: string; error: string }> = [];
        let syncedCount = 0;
        let failedCount = 0;

        // Process transactions in order (oldest first)
        const sortedTransactions = [...pendingTransactions].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (const transaction of sortedTransactions) {
          // Check if enough time has passed since last retry
          if (transaction.lastRetryAt) {
            const timeSinceLastRetry = Date.now() - new Date(transaction.lastRetryAt).getTime();
            if (timeSinceLastRetry < RETRY_DELAY_MS) {
              continue; // Skip this transaction, not enough time passed
            }
          }

          // Check max retries
          if (transaction.retryCount >= MAX_RETRY_COUNT) {
            failedCount++;
            errors.push({ id: transaction.id, error: 'Max retry attempts exceeded' });
            continue;
          }

          try {
            // In a real implementation, this would be an API call:
            // await api.post('/transactions/sync', {
            //   id: transaction.id,
            //   type: transaction.type,
            //   amount: transaction.amount,
            //   walletId: transaction.walletId,
            //   standId: transaction.standId,
            //   description: transaction.description,
            //   idempotencyKey: transaction.idempotencyKey,
            //   offlineSignature: transaction.offlineSignature,
            //   createdAt: transaction.createdAt,
            // });

            // Simulate API call with random success/failure
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Simulate 90% success rate
            const isSuccess = Math.random() > 0.1;

            if (!isSuccess) {
              throw new Error('Server returned error');
            }

            // Transaction synced successfully
            removePendingTransaction(transaction.id);
            syncedCount++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Update retry count and last retry time
            updatePendingTransaction(transaction.id, {
              retryCount: transaction.retryCount + 1,
              lastRetryAt: new Date().toISOString(),
              error: errorMessage,
            });

            errors.push({ id: transaction.id, error: errorMessage });
            failedCount++;
          }
        }

        const success = failedCount === 0;
        const syncStatus: SyncStatus = success ? 'success' : 'error';
        const syncError = errors.length > 0 ? `${failedCount} transaction(s) failed to sync` : null;

        set({
          isSyncing: false,
          syncStatus,
          syncError,
          lastSyncTime: new Date().toISOString(),
        });

        return { success, syncedCount, failedCount, errors };
      },

      clearSynced: () =>
        set((state) => ({
          pendingTransactions: state.pendingTransactions.filter(
            (tx) => tx.retryCount < MAX_RETRY_COUNT
          ),
        })),

      clearAllPending: () =>
        set({
          pendingTransactions: [],
          syncError: null,
          syncStatus: 'idle',
        }),

      setLastSyncTime: (time) => set({ lastSyncTime: time }),

      setSyncStatus: (status) => set({ syncStatus: status }),

      setSyncError: (error) => set({ syncError: error }),

      getPendingCount: () => get().pendingTransactions.length,

      getOldestPending: () => {
        const { pendingTransactions } = get();
        if (pendingTransactions.length === 0) return null;

        return pendingTransactions.reduce((oldest, tx) =>
          new Date(tx.createdAt) < new Date(oldest.createdAt) ? tx : oldest
        );
      },

      // New actions for sync engine
      setIsOnline: (isOnline) =>
        set({
          isOnline,
          syncStatus: isOnline ? get().syncStatus : 'offline',
        }),

      setSyncProgress: (syncProgress) => set({ syncProgress }),

      addSyncError: (error) =>
        set((state) => ({
          syncErrors: [error, ...state.syncErrors].slice(0, 50), // Keep last 50 errors
        })),

      clearSyncErrors: () => set({ syncErrors: [] }),

      setPendingCounts: (counts) =>
        set((state) => ({
          pendingCounts: { ...state.pendingCounts, ...counts },
        })),

      startSync: () =>
        set({
          isSyncing: true,
          syncStatus: 'syncing',
          syncError: null,
        }),

      cancelSync: () =>
        set({
          isSyncing: false,
          syncStatus: 'idle',
          syncProgress: null,
        }),
    }),
    {
      name: 'sync-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pendingTransactions: state.pendingTransactions,
        lastSyncTime: state.lastSyncTime,
        syncErrors: state.syncErrors.slice(0, 10), // Only persist last 10 errors
      }),
    }
  )
);

// Helper to check if there are pending transactions that need sync
export const hasPendingSync = (): boolean => {
  return useSyncStore.getState().pendingTransactions.length > 0;
};

// Helper to get pending count
export const getPendingSyncCount = (): number => {
  return useSyncStore.getState().pendingTransactions.length;
};

// Helper to get total pending count across all entity types
export const getTotalPendingCount = (): number => {
  const { pendingCounts } = useSyncStore.getState();
  return (
    pendingCounts.transactions +
    pendingCounts.wallets +
    pendingCounts.products +
    pendingCounts.stands
  );
};

// Helper to check if sync is needed
export const needsSync = (): boolean => {
  const state = useSyncStore.getState();
  return state.pendingTransactions.length > 0 || getTotalPendingCount() > 0;
};

// Helper to get sync state summary
export const getSyncStateSummary = () => {
  const state = useSyncStore.getState();
  return {
    status: state.syncStatus,
    isOnline: state.isOnline,
    isSyncing: state.isSyncing,
    pendingCount: state.pendingTransactions.length,
    lastSyncTime: state.lastSyncTime,
    hasErrors: state.syncErrors.length > 0,
    errorCount: state.syncErrors.length,
  };
};
