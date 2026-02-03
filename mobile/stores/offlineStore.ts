/**
 * Offline Store - Zustand Store Connected to SQLite
 *
 * This store manages offline-first functionality by:
 * - Loading cached data from SQLite on app start
 * - Saving pending transactions to SQLite
 * - Tracking sync status
 * - Providing offline data access
 */

import { create } from 'zustand';
import {
  initializeDatabase,
  closeDatabase,
  getDatabaseStats,
  clearAllCachedData,
  // Pending transactions
  createPendingTransaction,
  getAllPendingTransactions,
  getPendingTransactionsByWallet,
  markTransactionSynced,
  updateTransactionRetry,
  deletePendingTransaction,
  deleteSyncedTransactions,
  getPendingTransactionCount,
  // Cached wallets
  upsertCachedWallet,
  getCachedWallet,
  getCachedWalletByUser,
  updateWalletBalance,
  deleteCachedWallet,
  // Cached products
  upsertCachedProduct,
  upsertCachedProducts,
  getCachedProduct,
  getCachedProductsByStand,
  getAvailableProductsByStand,
  deleteCachedProduct,
  // Cached stands
  upsertCachedStand,
  upsertCachedStands,
  getCachedStand,
  getCachedStandsByFestival,
  getCachedStandsByType,
  getOpenStands,
  deleteCachedStand,
  // Sync queue
  createSyncQueueItem,
  getPendingSyncItems,
  completeSyncQueueItem,
  failSyncQueueItem,
  deleteCompletedSyncItems,
  getSyncQueueCount,
  // Cached transactions
  createCachedTransaction,
  batchInsertCachedTransactions,
  getCachedTransactionsByWallet,
  // Types
  CreatePendingTransactionInput,
  UpsertCachedWalletInput,
  UpsertCachedProductInput,
  UpsertCachedStandInput,
  CreateSyncQueueItemInput,
  CreateCachedTransactionInput,
} from '@/lib/db/database';
import {
  PendingTransaction,
  CachedWallet,
  CachedProduct,
  CachedStand,
  SyncQueueItem,
  CachedTransaction,
  StandType,
  ProductItem,
} from '@/lib/db/schema';
import { generateOfflineSignature } from '@/lib/offlineTransaction';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// Types
// ============================================

export type OfflineSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface DatabaseStats {
  pendingTransactions: number;
  cachedWallets: number;
  cachedProducts: number;
  cachedStands: number;
  syncQueuePending: number;
  syncQueueFailed: number;
  cachedTransactions: number;
}

export interface OfflineState {
  // Database state
  isInitialized: boolean;
  isInitializing: boolean;
  initError: string | null;

  // Sync state
  syncStatus: OfflineSyncStatus;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  syncError: string | null;

  // Cached data (in-memory for quick access)
  pendingTransactions: PendingTransaction[];
  currentWallet: CachedWallet | null;
  cachedStands: CachedStand[];
  cachedProducts: Map<string, CachedProduct[]>; // standId -> products

  // Stats
  stats: DatabaseStats | null;

  // Actions
  initialize: () => Promise<void>;
  cleanup: () => Promise<void>;
  refreshStats: () => Promise<void>;

  // Pending transaction actions
  addPendingTransaction: (input: {
    walletId: string;
    userId: string;
    amount: number;
    type: 'PURCHASE' | 'PAYMENT' | 'REFUND' | 'CANCEL';
    standId?: string;
    standName?: string;
    description?: string;
    productItems?: ProductItem[];
  }) => Promise<PendingTransaction>;
  loadPendingTransactions: () => Promise<void>;
  removePendingTransaction: (id: string) => Promise<void>;
  markTransactionAsSynced: (id: string) => Promise<void>;
  incrementTransactionRetry: (id: string, error?: string) => Promise<void>;
  clearSyncedTransactions: () => Promise<number>;

  // Wallet actions
  cacheWallet: (input: UpsertCachedWalletInput) => Promise<CachedWallet>;
  loadCachedWallet: (walletId: string) => Promise<CachedWallet | null>;
  loadCachedWalletByUser: (userId: string) => Promise<CachedWallet | null>;
  updateCachedWalletBalance: (walletId: string, newBalance: number) => Promise<void>;
  clearCachedWallet: (walletId: string) => Promise<void>;

  // Stand actions
  cacheStands: (stands: UpsertCachedStandInput[]) => Promise<void>;
  loadCachedStands: (festivalId: string) => Promise<CachedStand[]>;
  loadCachedStandsByType: (festivalId: string, type: StandType) => Promise<CachedStand[]>;
  loadOpenStands: (festivalId: string) => Promise<CachedStand[]>;
  getCachedStandById: (standId: string) => Promise<CachedStand | null>;

  // Product actions
  cacheProducts: (products: UpsertCachedProductInput[]) => Promise<void>;
  loadCachedProducts: (standId: string) => Promise<CachedProduct[]>;
  loadAvailableProducts: (standId: string) => Promise<CachedProduct[]>;
  getCachedProductById: (productId: string) => Promise<CachedProduct | null>;

  // Sync queue actions
  addToSyncQueue: (input: CreateSyncQueueItemInput) => Promise<SyncQueueItem>;
  getPendingSyncQueueItems: (limit?: number) => Promise<SyncQueueItem[]>;
  markSyncItemComplete: (id: string) => Promise<void>;
  markSyncItemFailed: (id: string, error: string) => Promise<void>;
  cleanupCompletedSyncItems: () => Promise<number>;

  // Transaction history actions
  cacheTransaction: (input: CreateCachedTransactionInput) => Promise<CachedTransaction>;
  cacheTransactions: (transactions: CreateCachedTransactionInput[]) => Promise<void>;
  loadCachedTransactions: (walletId: string, limit?: number, offset?: number) => Promise<CachedTransaction[]>;

  // Sync actions
  setSyncStatus: (status: OfflineSyncStatus) => void;
  setSyncError: (error: string | null) => void;
  setLastSyncTime: (time: Date) => void;

  // Clear all data (for logout)
  clearAllData: () => Promise<void>;
}

// ============================================
// Device ID Helper
// ============================================

const getDeviceId = async (): Promise<string> => {
  const storedId = await AsyncStorage.getItem('@device_id');
  if (storedId) {
    return storedId;
  }

  const newId = Crypto.randomUUID();
  await AsyncStorage.setItem('@device_id', newId);
  return newId;
};

// ============================================
// Store Implementation
// ============================================

export const useOfflineStore = create<OfflineState>((set, get) => ({
  // Initial state
  isInitialized: false,
  isInitializing: false,
  initError: null,

  syncStatus: 'idle',
  lastSyncTime: null,
  isSyncing: false,
  syncError: null,

  pendingTransactions: [],
  currentWallet: null,
  cachedStands: [],
  cachedProducts: new Map(),

  stats: null,

  // ============================================
  // Database Initialization
  // ============================================

  initialize: async () => {
    const { isInitialized, isInitializing } = get();

    if (isInitialized || isInitializing) {
      return;
    }

    set({ isInitializing: true, initError: null });

    try {
      console.log('[OfflineStore] Initializing database...');
      await initializeDatabase();

      // Load pending transactions into memory
      const pendingTx = await getAllPendingTransactions();

      // Get initial stats
      const stats = await getDatabaseStats();

      set({
        isInitialized: true,
        isInitializing: false,
        pendingTransactions: pendingTx,
        stats,
      });

      console.log('[OfflineStore] Database initialized successfully');
      console.log(`[OfflineStore] Loaded ${pendingTx.length} pending transactions`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OfflineStore] Failed to initialize database:', errorMessage);

      set({
        isInitializing: false,
        initError: errorMessage,
      });

      throw error;
    }
  },

  cleanup: async () => {
    try {
      await closeDatabase();
      set({
        isInitialized: false,
        pendingTransactions: [],
        currentWallet: null,
        cachedStands: [],
        cachedProducts: new Map(),
        stats: null,
      });
      console.log('[OfflineStore] Cleanup completed');
    } catch (error) {
      console.error('[OfflineStore] Cleanup failed:', error);
    }
  },

  refreshStats: async () => {
    try {
      const stats = await getDatabaseStats();
      set({ stats });
    } catch (error) {
      console.error('[OfflineStore] Failed to refresh stats:', error);
    }
  },

  // ============================================
  // Pending Transaction Actions
  // ============================================

  addPendingTransaction: async (input) => {
    const deviceId = await getDeviceId();
    const idempotencyKey = `offline_${Date.now().toString(36)}_${Crypto.randomUUID().split('-')[0]}`;
    const createdAt = new Date().toISOString();

    // Generate signature
    const signature = await generateOfflineSignature({
      id: Crypto.randomUUID(), // Temporary ID for signature
      type: input.type,
      amount: input.amount,
      walletId: input.walletId,
      userId: input.userId,
      idempotencyKey,
      createdAt,
      deviceId,
    });

    const dbInput: CreatePendingTransactionInput = {
      walletId: input.walletId,
      userId: input.userId,
      amount: input.amount,
      type: input.type,
      standId: input.standId,
      standName: input.standName,
      description: input.description,
      productItems: input.productItems,
      idempotencyKey,
      offlineSignature: signature,
      deviceId,
    };

    const transaction = await createPendingTransaction(dbInput);

    set((state) => ({
      pendingTransactions: [...state.pendingTransactions, transaction],
    }));

    // Update stats
    get().refreshStats();

    console.log(`[OfflineStore] Added pending transaction: ${transaction.id}`);
    return transaction;
  },

  loadPendingTransactions: async () => {
    try {
      const transactions = await getAllPendingTransactions();
      set({ pendingTransactions: transactions });
      console.log(`[OfflineStore] Loaded ${transactions.length} pending transactions`);
    } catch (error) {
      console.error('[OfflineStore] Failed to load pending transactions:', error);
    }
  },

  removePendingTransaction: async (id) => {
    await deletePendingTransaction(id);
    set((state) => ({
      pendingTransactions: state.pendingTransactions.filter((tx) => tx.id !== id),
    }));
    get().refreshStats();
    console.log(`[OfflineStore] Removed pending transaction: ${id}`);
  },

  markTransactionAsSynced: async (id) => {
    await markTransactionSynced(id);
    set((state) => ({
      pendingTransactions: state.pendingTransactions.filter((tx) => tx.id !== id),
    }));
    get().refreshStats();
    console.log(`[OfflineStore] Marked transaction as synced: ${id}`);
  },

  incrementTransactionRetry: async (id, error) => {
    await updateTransactionRetry(id, error);
    set((state) => ({
      pendingTransactions: state.pendingTransactions.map((tx) =>
        tx.id === id
          ? {
              ...tx,
              retryCount: tx.retryCount + 1,
              lastRetryAt: new Date(),
              error: error ?? tx.error,
            }
          : tx
      ),
    }));
    console.log(`[OfflineStore] Updated retry count for transaction: ${id}`);
  },

  clearSyncedTransactions: async () => {
    const count = await deleteSyncedTransactions();
    get().refreshStats();
    console.log(`[OfflineStore] Cleared ${count} synced transactions`);
    return count;
  },

  // ============================================
  // Wallet Actions
  // ============================================

  cacheWallet: async (input) => {
    const wallet = await upsertCachedWallet(input);
    set({ currentWallet: wallet });
    get().refreshStats();
    console.log(`[OfflineStore] Cached wallet: ${wallet.id}`);
    return wallet;
  },

  loadCachedWallet: async (walletId) => {
    const wallet = await getCachedWallet(walletId);
    if (wallet) {
      set({ currentWallet: wallet });
    }
    return wallet;
  },

  loadCachedWalletByUser: async (userId) => {
    const wallet = await getCachedWalletByUser(userId);
    if (wallet) {
      set({ currentWallet: wallet });
    }
    return wallet;
  },

  updateCachedWalletBalance: async (walletId, newBalance) => {
    await updateWalletBalance(walletId, newBalance);
    set((state) => ({
      currentWallet: state.currentWallet?.id === walletId
        ? { ...state.currentWallet, balance: newBalance, updatedAt: new Date() }
        : state.currentWallet,
    }));
    console.log(`[OfflineStore] Updated wallet balance: ${walletId} -> ${newBalance}`);
  },

  clearCachedWallet: async (walletId) => {
    await deleteCachedWallet(walletId);
    set((state) => ({
      currentWallet: state.currentWallet?.id === walletId ? null : state.currentWallet,
    }));
    get().refreshStats();
    console.log(`[OfflineStore] Cleared cached wallet: ${walletId}`);
  },

  // ============================================
  // Stand Actions
  // ============================================

  cacheStands: async (stands) => {
    await upsertCachedStands(stands);
    get().refreshStats();
    console.log(`[OfflineStore] Cached ${stands.length} stands`);
  },

  loadCachedStands: async (festivalId) => {
    const stands = await getCachedStandsByFestival(festivalId);
    set({ cachedStands: stands });
    return stands;
  },

  loadCachedStandsByType: async (festivalId, type) => {
    const stands = await getCachedStandsByType(festivalId, type);
    return stands;
  },

  loadOpenStands: async (festivalId) => {
    const stands = await getOpenStands(festivalId);
    return stands;
  },

  getCachedStandById: async (standId) => {
    return await getCachedStand(standId);
  },

  // ============================================
  // Product Actions
  // ============================================

  cacheProducts: async (products) => {
    await upsertCachedProducts(products);
    get().refreshStats();
    console.log(`[OfflineStore] Cached ${products.length} products`);
  },

  loadCachedProducts: async (standId) => {
    const products = await getCachedProductsByStand(standId);
    set((state) => {
      const newMap = new Map(state.cachedProducts);
      newMap.set(standId, products);
      return { cachedProducts: newMap };
    });
    return products;
  },

  loadAvailableProducts: async (standId) => {
    const products = await getAvailableProductsByStand(standId);
    return products;
  },

  getCachedProductById: async (productId) => {
    return await getCachedProduct(productId);
  },

  // ============================================
  // Sync Queue Actions
  // ============================================

  addToSyncQueue: async (input) => {
    const item = await createSyncQueueItem(input);
    get().refreshStats();
    console.log(`[OfflineStore] Added to sync queue: ${item.id}`);
    return item;
  },

  getPendingSyncQueueItems: async (limit = 10) => {
    return await getPendingSyncItems(limit);
  },

  markSyncItemComplete: async (id) => {
    await completeSyncQueueItem(id);
    get().refreshStats();
    console.log(`[OfflineStore] Sync item completed: ${id}`);
  },

  markSyncItemFailed: async (id, error) => {
    await failSyncQueueItem(id, error);
    get().refreshStats();
    console.log(`[OfflineStore] Sync item failed: ${id}`);
  },

  cleanupCompletedSyncItems: async () => {
    const count = await deleteCompletedSyncItems();
    get().refreshStats();
    console.log(`[OfflineStore] Cleaned up ${count} completed sync items`);
    return count;
  },

  // ============================================
  // Transaction History Actions
  // ============================================

  cacheTransaction: async (input) => {
    const transaction = await createCachedTransaction(input);
    get().refreshStats();
    return transaction;
  },

  cacheTransactions: async (transactions) => {
    await batchInsertCachedTransactions(transactions);
    get().refreshStats();
    console.log(`[OfflineStore] Cached ${transactions.length} transactions`);
  },

  loadCachedTransactions: async (walletId, limit = 50, offset = 0) => {
    return await getCachedTransactionsByWallet(walletId, limit, offset);
  },

  // ============================================
  // Sync Status Actions
  // ============================================

  setSyncStatus: (status) => {
    set({ syncStatus: status, isSyncing: status === 'syncing' });
  },

  setSyncError: (error) => {
    set({ syncError: error });
  },

  setLastSyncTime: (time) => {
    set({ lastSyncTime: time });
  },

  // ============================================
  // Clear All Data
  // ============================================

  clearAllData: async () => {
    try {
      await clearAllCachedData();
      set({
        pendingTransactions: [],
        currentWallet: null,
        cachedStands: [],
        cachedProducts: new Map(),
        stats: null,
        lastSyncTime: null,
        syncStatus: 'idle',
        syncError: null,
      });
      await get().refreshStats();
      console.log('[OfflineStore] All data cleared');
    } catch (error) {
      console.error('[OfflineStore] Failed to clear all data:', error);
      throw error;
    }
  },
}));

// ============================================
// Selector Hooks
// ============================================

/**
 * Get pending transaction count
 */
export const usePendingTransactionCount = () =>
  useOfflineStore((state) => state.pendingTransactions.length);

/**
 * Get current cached wallet
 */
export const useCachedWallet = () =>
  useOfflineStore((state) => state.currentWallet);

/**
 * Get cached products for a stand
 */
export const useCachedProductsForStand = (standId: string) =>
  useOfflineStore((state) => state.cachedProducts.get(standId) ?? []);

/**
 * Get sync status
 */
export const useSyncStatus = () =>
  useOfflineStore((state) => ({
    status: state.syncStatus,
    isSyncing: state.isSyncing,
    error: state.syncError,
    lastSyncTime: state.lastSyncTime,
  }));

/**
 * Get database stats
 */
export const useOfflineStats = () =>
  useOfflineStore((state) => state.stats);

/**
 * Check if store is ready
 */
export const useOfflineStoreReady = () =>
  useOfflineStore((state) => state.isInitialized && !state.initError);

// ============================================
// Utility Functions
// ============================================

/**
 * Initialize the offline store (call on app start)
 */
export async function initializeOfflineStore(): Promise<void> {
  const store = useOfflineStore.getState();
  await store.initialize();
}

/**
 * Check if there are pending items to sync
 */
export function hasPendingSync(): boolean {
  const state = useOfflineStore.getState();
  return state.pendingTransactions.length > 0;
}

/**
 * Get pending sync count
 */
export function getPendingSyncCount(): number {
  const state = useOfflineStore.getState();
  return state.pendingTransactions.length;
}
