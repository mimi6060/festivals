/**
 * Sync Strategies - E4-S12
 *
 * Individual sync strategies for different entity types.
 * Each strategy knows how to push/pull its specific data type.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, ENDPOINTS } from '@/config/api';
import { useWalletStore, Transaction, QRPayload } from '@/stores/walletStore';
import { useSyncStore, PendingTransaction } from '@/stores/syncStore';
import { useStaffStore, Product, Stand } from '@/stores/staffStore';
import { SyncError } from './engine';
import { ConflictData } from './conflict';

// Strategy result interface
export interface StrategyResult {
  success: boolean;
  syncedCount: number;
  errors: SyncError[];
  conflicts: ConflictData[];
}

// Base sync strategy interface
export interface SyncStrategy {
  /**
   * Name of this strategy
   */
  readonly name: string;

  /**
   * Priority (lower = higher priority)
   */
  readonly priority: number;

  /**
   * Execute the sync strategy
   */
  execute(): Promise<StrategyResult>;

  /**
   * Check if this strategy has pending changes
   */
  hasPendingChanges(): Promise<boolean>;

  /**
   * Get count of pending items
   */
  getPendingCount(): Promise<number>;
}

// Storage keys
const STORAGE_KEYS = {
  PRODUCTS_CACHE: '@sync_products_cache',
  PRODUCTS_LAST_SYNC: '@sync_products_last',
  STANDS_CACHE: '@sync_stands_cache',
  STANDS_LAST_SYNC: '@sync_stands_last',
  WALLET_LAST_SYNC: '@sync_wallet_last',
};

/**
 * Transaction Sync Strategy
 *
 * CRITICAL: Handles pushing pending offline transactions to the server.
 * This is the highest priority sync strategy as it handles payments.
 *
 * Direction: Push (local -> server)
 * Conflict resolution: Server validates, client accepts
 */
export class TransactionSyncStrategy implements SyncStrategy {
  readonly name = 'TransactionSync';
  readonly priority = 1; // Highest priority

  async execute(): Promise<StrategyResult> {
    const errors: SyncError[] = [];
    const conflicts: ConflictData[] = [];
    let syncedCount = 0;

    const syncStore = useSyncStore.getState();
    const walletStore = useWalletStore.getState();
    const pendingTransactions = syncStore.pendingTransactions;

    if (pendingTransactions.length === 0) {
      return { success: true, syncedCount: 0, errors: [], conflicts: [] };
    }

    console.log(`[TransactionSync] Syncing ${pendingTransactions.length} transactions`);

    // Sort by creation time (oldest first)
    const sortedTransactions = [...pendingTransactions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const transaction of sortedTransactions) {
      try {
        // Skip if max retries exceeded
        if (transaction.retryCount >= 3) {
          errors.push({
            code: 'MAX_RETRIES_EXCEEDED',
            message: `Transaction ${transaction.id} exceeded max retry attempts`,
            entityType: 'transaction',
            entityId: transaction.id,
            recoverable: false,
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        // Push to server
        const result = await this.pushTransaction(transaction);

        if (result.success) {
          // Remove from pending
          syncStore.removePendingTransaction(transaction.id);

          // Mark as synced in wallet store
          walletStore.markTransactionSynced(transaction.id);

          syncedCount++;
          console.log(`[TransactionSync] Transaction ${transaction.id} synced successfully`);
        } else if (result.conflict) {
          // Handle conflict
          conflicts.push({
            entityType: 'transaction',
            entityId: transaction.id,
            localVersion: transaction,
            serverVersion: result.serverData,
            localTimestamp: transaction.createdAt,
            serverTimestamp: result.serverData?.createdAt,
          });

          // For transactions, we generally accept server's decision
          // Remove from pending as it's been processed
          syncStore.removePendingTransaction(transaction.id);
          syncedCount++;
        } else {
          // Retry later
          syncStore.updatePendingTransaction(transaction.id, {
            retryCount: transaction.retryCount + 1,
            lastRetryAt: new Date().toISOString(),
            error: result.error,
          });

          errors.push({
            code: 'SYNC_ERROR',
            message: result.error || 'Unknown error',
            entityType: 'transaction',
            entityId: transaction.id,
            recoverable: true,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          code: 'UNEXPECTED_ERROR',
          message: errorMessage,
          entityType: 'transaction',
          entityId: transaction.id,
          recoverable: true,
          timestamp: new Date().toISOString(),
        });

        syncStore.updatePendingTransaction(transaction.id, {
          retryCount: transaction.retryCount + 1,
          lastRetryAt: new Date().toISOString(),
          error: errorMessage,
        });
      }
    }

    const success = errors.filter(e => !e.recoverable).length === 0;
    return { success, syncedCount, errors, conflicts };
  }

  async hasPendingChanges(): Promise<boolean> {
    const { pendingTransactions } = useSyncStore.getState();
    return pendingTransactions.length > 0;
  }

  async getPendingCount(): Promise<number> {
    const { pendingTransactions } = useSyncStore.getState();
    return pendingTransactions.length;
  }

  private async pushTransaction(
    transaction: PendingTransaction
  ): Promise<{ success: boolean; conflict?: boolean; serverData?: unknown; error?: string }> {
    try {
      // In production, this would be an actual API call:
      // const response = await apiClient.post('/transactions/sync', {
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

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));

      // Simulate success (90% success rate)
      if (Math.random() > 0.1) {
        return { success: true };
      }

      // Simulate occasional failure
      return {
        success: false,
        error: 'Server temporarily unavailable',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }
}

/**
 * Wallet Sync Strategy
 *
 * HIGH PRIORITY: Syncs wallet balance and QR code.
 * Should run after transactions are synced to get accurate balance.
 *
 * Direction: Pull (server -> local)
 * Conflict resolution: Server wins
 */
export class WalletSyncStrategy implements SyncStrategy {
  readonly name = 'WalletSync';
  readonly priority = 2;

  async execute(): Promise<StrategyResult> {
    const errors: SyncError[] = [];
    const conflicts: ConflictData[] = [];
    let syncedCount = 0;

    const walletStore = useWalletStore.getState();

    try {
      console.log('[WalletSync] Fetching wallet balance');

      // Fetch balance from server
      const serverBalance = await this.fetchBalance();

      // Check for conflict
      const localBalance = walletStore.balance;
      if (serverBalance !== localBalance) {
        conflicts.push({
          entityType: 'wallet',
          entityId: 'current',
          localVersion: { balance: localBalance },
          serverVersion: { balance: serverBalance },
          localTimestamp: await this.getLastSyncTime(),
          serverTimestamp: new Date().toISOString(),
        });

        // Server wins for wallet balance
        walletStore.setBalance(serverBalance);
        console.log(`[WalletSync] Balance conflict resolved: ${localBalance} -> ${serverBalance}`);
      }

      syncedCount++;

      // Refresh QR code
      await walletStore.refreshQRIfNeeded();
      syncedCount++;

      // Update last sync time
      await this.setLastSyncTime();

      console.log('[WalletSync] Wallet synced successfully');
      return { success: true, syncedCount, errors, conflicts };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({
        code: 'WALLET_FETCH_ERROR',
        message: errorMessage,
        entityType: 'wallet',
        recoverable: true,
        timestamp: new Date().toISOString(),
      });

      return { success: false, syncedCount, errors, conflicts };
    }
  }

  async hasPendingChanges(): Promise<boolean> {
    // Wallet sync is pull-only, so check if we need to refresh
    const lastSync = await this.getLastSyncTime();
    if (!lastSync) return true;

    const timeSinceSync = Date.now() - new Date(lastSync).getTime();
    return timeSinceSync > 60000; // Consider stale after 1 minute
  }

  async getPendingCount(): Promise<number> {
    return (await this.hasPendingChanges()) ? 1 : 0;
  }

  private async fetchBalance(): Promise<number> {
    // In production:
    // const response = await apiClient.get<{ balance: number }>('/wallet');
    // return response.balance;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 200));
    return useWalletStore.getState().balance;
  }

  private async getLastSyncTime(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.WALLET_LAST_SYNC);
  }

  private async setLastSyncTime(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.WALLET_LAST_SYNC, new Date().toISOString());
  }
}

/**
 * Product Sync Strategy
 *
 * NORMAL PRIORITY: Syncs product catalog from server.
 * Updates local product list for staff ordering screens.
 *
 * Direction: Pull (server -> local)
 * Conflict resolution: Server wins (catalog is server-authoritative)
 */
export class ProductSyncStrategy implements SyncStrategy {
  readonly name = 'ProductSync';
  readonly priority = 3;

  async execute(): Promise<StrategyResult> {
    const errors: SyncError[] = [];
    const conflicts: ConflictData[] = [];
    let syncedCount = 0;

    const staffStore = useStaffStore.getState();

    try {
      console.log('[ProductSync] Fetching product catalog');

      // Check if we need to sync (using ETag or last-modified)
      const needsSync = await this.needsSync();
      if (!needsSync) {
        console.log('[ProductSync] Products are up to date');
        return { success: true, syncedCount: 0, errors, conflicts };
      }

      // Fetch products from server
      const products = await this.fetchProducts();

      if (products.length > 0) {
        // Update local store
        staffStore.setProducts(products);

        // Cache for offline use
        await this.cacheProducts(products);

        syncedCount = products.length;
        console.log(`[ProductSync] Synced ${products.length} products`);
      }

      // Update last sync time
      await this.setLastSyncTime();

      return { success: true, syncedCount, errors, conflicts };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({
        code: 'PRODUCT_FETCH_ERROR',
        message: errorMessage,
        entityType: 'product',
        recoverable: true,
        timestamp: new Date().toISOString(),
      });

      // Try to load from cache
      try {
        const cachedProducts = await this.loadCachedProducts();
        if (cachedProducts.length > 0) {
          staffStore.setProducts(cachedProducts);
          console.log(`[ProductSync] Loaded ${cachedProducts.length} products from cache`);
        }
      } catch (cacheError) {
        console.error('[ProductSync] Failed to load cached products:', cacheError);
      }

      return { success: false, syncedCount, errors, conflicts };
    }
  }

  async hasPendingChanges(): Promise<boolean> {
    return this.needsSync();
  }

  async getPendingCount(): Promise<number> {
    return (await this.needsSync()) ? 1 : 0;
  }

  private async needsSync(): Promise<boolean> {
    const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS_LAST_SYNC);
    if (!lastSync) return true;

    const timeSinceSync = Date.now() - new Date(lastSync).getTime();
    return timeSinceSync > 5 * 60 * 1000; // Sync every 5 minutes
  }

  private async fetchProducts(): Promise<Product[]> {
    // In production:
    // const response = await apiClient.get<Product[]>('/products');
    // return response;

    // Simulate API call - return current products
    await new Promise(resolve => setTimeout(resolve, 300));

    // Return mock product data
    return [
      { id: 'p1', name: 'Biere', price: 5, category: 'DRINK', available: true },
      { id: 'p2', name: 'Cocktail', price: 8, category: 'DRINK', available: true },
      { id: 'p3', name: 'Soft', price: 3, category: 'DRINK', available: true },
      { id: 'p4', name: 'Eau', price: 2, category: 'DRINK', available: true },
      { id: 'p5', name: 'Shot', price: 4, category: 'DRINK', available: true },
      { id: 'p6', name: 'Vin', price: 6, category: 'DRINK', available: true },
    ];
  }

  private async cacheProducts(products: Product[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS_CACHE, JSON.stringify(products));
  }

  private async loadCachedProducts(): Promise<Product[]> {
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS_CACHE);
    if (!cached) return [];
    return JSON.parse(cached);
  }

  private async setLastSyncTime(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS_LAST_SYNC, new Date().toISOString());
  }
}

/**
 * Stand Sync Strategy
 *
 * NORMAL PRIORITY: Syncs stand information from server.
 * Updates stand details for staff and customer screens.
 *
 * Direction: Pull (server -> local)
 * Conflict resolution: Server wins
 */
export class StandSyncStrategy implements SyncStrategy {
  readonly name = 'StandSync';
  readonly priority = 4;

  async execute(): Promise<StrategyResult> {
    const errors: SyncError[] = [];
    const conflicts: ConflictData[] = [];
    let syncedCount = 0;

    const staffStore = useStaffStore.getState();

    try {
      console.log('[StandSync] Fetching stand information');

      // Check if we need to sync
      const needsSync = await this.needsSync();
      if (!needsSync) {
        console.log('[StandSync] Stands are up to date');
        return { success: true, syncedCount: 0, errors, conflicts };
      }

      // Fetch stands from server
      const stands = await this.fetchStands();

      if (stands.length > 0) {
        // Cache for offline use
        await this.cacheStands(stands);

        // Update current stand if it matches
        const currentStand = staffStore.currentStand;
        if (currentStand) {
          const updatedStand = stands.find(s => s.id === currentStand.id);
          if (updatedStand) {
            staffStore.setCurrentStand(updatedStand);
          }
        }

        syncedCount = stands.length;
        console.log(`[StandSync] Synced ${stands.length} stands`);
      }

      // Update last sync time
      await this.setLastSyncTime();

      return { success: true, syncedCount, errors, conflicts };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({
        code: 'STAND_FETCH_ERROR',
        message: errorMessage,
        entityType: 'stand',
        recoverable: true,
        timestamp: new Date().toISOString(),
      });

      return { success: false, syncedCount, errors, conflicts };
    }
  }

  async hasPendingChanges(): Promise<boolean> {
    return this.needsSync();
  }

  async getPendingCount(): Promise<number> {
    return (await this.needsSync()) ? 1 : 0;
  }

  private async needsSync(): Promise<boolean> {
    const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.STANDS_LAST_SYNC);
    if (!lastSync) return true;

    const timeSinceSync = Date.now() - new Date(lastSync).getTime();
    return timeSinceSync > 10 * 60 * 1000; // Sync every 10 minutes
  }

  private async fetchStands(): Promise<Stand[]> {
    // In production:
    // const response = await apiClient.get<Stand[]>('/stands');
    // return response;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 250));

    // Return mock stand data
    return [
      {
        id: 'stand-1',
        name: 'Bar Main Stage',
        category: 'BAR',
        products: [
          { id: 'p1', name: 'Biere', price: 5, category: 'DRINK', available: true },
          { id: 'p2', name: 'Cocktail', price: 8, category: 'DRINK', available: true },
        ],
      },
      {
        id: 'stand-2',
        name: 'Food Court',
        category: 'FOOD',
        products: [
          { id: 'f1', name: 'Hot Dog', price: 8, category: 'FOOD', available: true },
          { id: 'f2', name: 'Burger', price: 12, category: 'FOOD', available: true },
        ],
      },
    ];
  }

  private async cacheStands(stands: Stand[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.STANDS_CACHE, JSON.stringify(stands));
  }

  private async loadCachedStands(): Promise<Stand[]> {
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.STANDS_CACHE);
    if (!cached) return [];
    return JSON.parse(cached);
  }

  private async setLastSyncTime(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.STANDS_LAST_SYNC, new Date().toISOString());
  }
}

// Export all strategies
export const createSyncStrategies = (): SyncStrategy[] => {
  return [
    new TransactionSyncStrategy(),
    new WalletSyncStrategy(),
    new ProductSyncStrategy(),
    new StandSyncStrategy(),
  ].sort((a, b) => a.priority - b.priority);
};
