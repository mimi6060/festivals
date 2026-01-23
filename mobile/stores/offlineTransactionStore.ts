/**
 * Offline Transaction Store
 * Manages offline transaction state, cached wallet balances, and sync status
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OfflineTransaction,
  OfflineTransactionInput,
  OfflineTransactionItem,
  createOfflineTransaction,
  getPendingOfflineTransactions,
  getPendingTransactionCount,
  markTransactionSynced,
  updateTransactionSyncError,
  getOfflineTransactionSummary,
  OfflineTransactionSummary,
  clearSyncedTransactions,
  CachedWallet,
  cacheWallet,
  getCachedWallet,
  updateCachedWalletBalance,
  validateQROffline,
  QRValidationResult,
} from '@/lib/offline';

export type OfflineSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface OfflineTransactionState {
  // State
  pendingTransactions: OfflineTransaction[];
  pendingCount: number;
  lastTransaction: OfflineTransaction | null;
  syncStatus: OfflineSyncStatus;
  syncError: string | null;
  lastSyncTime: string | null;
  cachedWalletBalances: Record<string, number>; // walletId -> effective balance
  summary: OfflineTransactionSummary | null;

  // Loading states
  isProcessing: boolean;
  isSyncing: boolean;
  isLoadingSummary: boolean;

  // Actions
  loadPendingTransactions: () => Promise<void>;
  processOfflinePayment: (
    input: OfflineTransactionInput,
    cachedBalance: number
  ) => Promise<{ success: boolean; transaction?: OfflineTransaction; error?: string }>;
  validateAndCacheQR: (
    qrData: string,
    amount: number
  ) => Promise<QRValidationResult>;
  updateCachedBalance: (walletId: string, newBalance: number) => void;
  getCachedBalance: (walletId: string) => number | null;
  syncPendingTransactions: () => Promise<{
    success: boolean;
    syncedCount: number;
    failedCount: number;
  }>;
  markSynced: (transactionId: string) => Promise<void>;
  clearSynced: () => Promise<void>;
  loadSummary: () => Promise<void>;
  reset: () => void;
}

export const useOfflineTransactionStore = create<OfflineTransactionState>()(
  persist(
    (set, get) => ({
      // Initial State
      pendingTransactions: [],
      pendingCount: 0,
      lastTransaction: null,
      syncStatus: 'idle',
      syncError: null,
      lastSyncTime: null,
      cachedWalletBalances: {},
      summary: null,
      isProcessing: false,
      isSyncing: false,
      isLoadingSummary: false,

      // Actions
      loadPendingTransactions: async () => {
        try {
          const transactions = await getPendingOfflineTransactions();
          const count = await getPendingTransactionCount();
          set({
            pendingTransactions: transactions,
            pendingCount: count,
          });
        } catch (error) {
          console.error('Failed to load pending transactions:', error);
        }
      },

      processOfflinePayment: async (input, cachedBalance) => {
        set({ isProcessing: true });

        try {
          const result = await createOfflineTransaction(input, cachedBalance);

          if (result.success && result.transaction) {
            // Update local state
            set((state) => {
              const newBalances = { ...state.cachedWalletBalances };
              newBalances[input.walletId] = result.transaction!.balanceAfter;

              return {
                pendingTransactions: [result.transaction!, ...state.pendingTransactions],
                pendingCount: state.pendingCount + 1,
                lastTransaction: result.transaction!,
                cachedWalletBalances: newBalances,
                isProcessing: false,
              };
            });

            // Update cached wallet in persistent storage
            const wallet = await getCachedWallet(input.walletId);
            if (wallet) {
              await updateCachedWalletBalance(input.walletId, result.transaction.balanceAfter);
            }

            return { success: true, transaction: result.transaction };
          }

          set({ isProcessing: false });
          return { success: false, error: result.error };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          set({ isProcessing: false });
          return { success: false, error: errorMessage };
        }
      },

      validateAndCacheQR: async (qrData, amount) => {
        const result = await validateQROffline(qrData, amount);

        if (result.valid && result.walletId && result.effectiveBalance !== undefined) {
          // Update cached balance
          set((state) => ({
            cachedWalletBalances: {
              ...state.cachedWalletBalances,
              [result.walletId!]: result.effectiveBalance!,
            },
          }));
        }

        return result;
      },

      updateCachedBalance: (walletId, newBalance) => {
        set((state) => ({
          cachedWalletBalances: {
            ...state.cachedWalletBalances,
            [walletId]: newBalance,
          },
        }));
      },

      getCachedBalance: (walletId) => {
        const { cachedWalletBalances } = get();
        return cachedWalletBalances[walletId] ?? null;
      },

      syncPendingTransactions: async () => {
        const { pendingTransactions } = get();

        if (pendingTransactions.length === 0) {
          set({
            syncStatus: 'success',
            lastSyncTime: new Date().toISOString(),
          });
          return { success: true, syncedCount: 0, failedCount: 0 };
        }

        set({ isSyncing: true, syncStatus: 'syncing', syncError: null });

        let syncedCount = 0;
        let failedCount = 0;

        // Sort by creation time (oldest first)
        const sortedTransactions = [...pendingTransactions].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (const transaction of sortedTransactions) {
          try {
            // In a real implementation, this would be an API call:
            // await api.post('/transactions/sync', {
            //   id: transaction.id,
            //   receiptId: transaction.receiptId,
            //   type: transaction.type,
            //   amount: transaction.amount,
            //   walletId: transaction.walletId,
            //   userId: transaction.userId,
            //   standId: transaction.standId,
            //   items: transaction.items,
            //   idempotencyKey: transaction.idempotencyKey,
            //   signature: transaction.signature,
            //   deviceId: transaction.deviceId,
            //   createdAt: transaction.createdAt,
            // });

            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 300));

            // Simulate 95% success rate
            const isSuccess = Math.random() > 0.05;

            if (!isSuccess) {
              throw new Error('Server sync failed');
            }

            // Mark as synced
            await markTransactionSynced(transaction.id);
            syncedCount++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await updateTransactionSyncError(transaction.id, errorMessage);
            failedCount++;
          }
        }

        // Reload pending transactions
        const updatedTransactions = await getPendingOfflineTransactions();
        const updatedCount = await getPendingTransactionCount();

        const success = failedCount === 0;
        set({
          pendingTransactions: updatedTransactions,
          pendingCount: updatedCount,
          isSyncing: false,
          syncStatus: success ? 'success' : 'error',
          syncError: success ? null : `${failedCount} transaction(s) failed to sync`,
          lastSyncTime: new Date().toISOString(),
        });

        return { success, syncedCount, failedCount };
      },

      markSynced: async (transactionId) => {
        await markTransactionSynced(transactionId);

        set((state) => ({
          pendingTransactions: state.pendingTransactions.filter(
            (t) => t.id !== transactionId
          ),
          pendingCount: Math.max(0, state.pendingCount - 1),
        }));
      },

      clearSynced: async () => {
        await clearSyncedTransactions();
        await get().loadPendingTransactions();
      },

      loadSummary: async () => {
        set({ isLoadingSummary: true });
        try {
          const summary = await getOfflineTransactionSummary();
          set({ summary, isLoadingSummary: false });
        } catch (error) {
          console.error('Failed to load summary:', error);
          set({ isLoadingSummary: false });
        }
      },

      reset: () => {
        set({
          pendingTransactions: [],
          pendingCount: 0,
          lastTransaction: null,
          syncStatus: 'idle',
          syncError: null,
          cachedWalletBalances: {},
          summary: null,
          isProcessing: false,
          isSyncing: false,
        });
      },
    }),
    {
      name: 'offline-transaction-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        cachedWalletBalances: state.cachedWalletBalances,
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
);

// Helper hooks
export const usePendingTransactionCount = () => {
  return useOfflineTransactionStore((state) => state.pendingCount);
};

export const useIsOfflineProcessing = () => {
  return useOfflineTransactionStore((state) => state.isProcessing);
};

export const useOfflineSyncStatus = () => {
  return useOfflineTransactionStore((state) => ({
    status: state.syncStatus,
    error: state.syncError,
    isSyncing: state.isSyncing,
    lastSyncTime: state.lastSyncTime,
  }));
};
