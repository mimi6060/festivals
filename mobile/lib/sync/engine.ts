/**
 * Main Sync Engine - E4-S12
 *
 * Core synchronization engine that coordinates all sync operations
 * between the mobile app and backend server.
 *
 * This is a CRITICAL component for offline-first functionality.
 */

import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { SyncManager } from './manager';
import { ConflictResolver, ConflictResolutionStrategy } from './conflict';

// Sync states
export type SyncState = 'IDLE' | 'SYNCING' | 'ERROR' | 'OFFLINE';

// Sync priority levels
export type SyncPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

// Sync event types
export type SyncEvent =
  | 'SYNC_STARTED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED'
  | 'SYNC_CANCELLED'
  | 'NETWORK_ONLINE'
  | 'NETWORK_OFFLINE'
  | 'CONFLICT_DETECTED'
  | 'CONFLICT_RESOLVED';

// Sync result
export interface SyncResult {
  success: boolean;
  timestamp: string;
  duration: number;
  syncedEntities: {
    transactions: number;
    wallets: number;
    products: number;
    stands: number;
  };
  errors: SyncError[];
  conflicts: ConflictRecord[];
}

// Sync error
export interface SyncError {
  code: string;
  message: string;
  entityType?: string;
  entityId?: string;
  recoverable: boolean;
  timestamp: string;
}

// Conflict record
export interface ConflictRecord {
  entityType: string;
  entityId: string;
  localVersion: unknown;
  serverVersion: unknown;
  resolution: ConflictResolutionStrategy;
  resolvedAt: string;
}

// Sync options
export interface SyncOptions {
  /**
   * Force sync even if recently synced
   */
  force?: boolean;

  /**
   * Only sync specific entity types
   */
  entityTypes?: ('transactions' | 'wallets' | 'products' | 'stands')[];

  /**
   * Priority level for this sync
   */
  priority?: SyncPriority;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

// Engine configuration
export interface SyncEngineConfig {
  /**
   * Auto-sync when coming online
   */
  autoSyncOnOnline: boolean;

  /**
   * Auto-sync when app comes to foreground
   */
  autoSyncOnForeground: boolean;

  /**
   * Minimum interval between auto-syncs in milliseconds
   */
  minSyncInterval: number;

  /**
   * Sync timeout in milliseconds
   */
  syncTimeout: number;

  /**
   * Maximum retry attempts for failed syncs
   */
  maxRetryAttempts: number;

  /**
   * Delay between retries in milliseconds
   */
  retryDelay: number;
}

// Default configuration
const DEFAULT_CONFIG: SyncEngineConfig = {
  autoSyncOnOnline: true,
  autoSyncOnForeground: true,
  minSyncInterval: 30000, // 30 seconds
  syncTimeout: 60000, // 1 minute
  maxRetryAttempts: 3,
  retryDelay: 5000, // 5 seconds
};

// Event listener type
type SyncEventListener = (event: SyncEvent, data?: unknown) => void;

/**
 * Main SyncEngine class
 *
 * Singleton that manages all synchronization between the app and server.
 * Handles network state changes, conflict resolution, and error recovery.
 */
export class SyncEngine {
  private static instance: SyncEngine | null = null;

  private state: SyncState = 'IDLE';
  private config: SyncEngineConfig;
  private isInitialized: boolean = false;
  private lastSyncTime: number = 0;
  private currentSyncPromise: Promise<SyncResult> | null = null;
  private retryCount: number = 0;

  // Dependencies
  private syncManager: SyncManager;
  private conflictResolver: ConflictResolver;

  // Subscriptions
  private netInfoSubscription: NetInfoSubscription | null = null;
  private appStateSubscription: { remove: () => void } | null = null;

  // Event listeners
  private eventListeners: Map<SyncEvent, Set<SyncEventListener>> = new Map();

  // Sync history
  private syncHistory: SyncResult[] = [];
  private maxHistoryLength: number = 10;

  private constructor(config: Partial<SyncEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.syncManager = SyncManager.getInstance();
    this.conflictResolver = new ConflictResolver();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(config?: Partial<SyncEngineConfig>): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine(config);
    }
    return SyncEngine.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    if (SyncEngine.instance) {
      SyncEngine.instance.shutdown();
      SyncEngine.instance = null;
    }
  }

  /**
   * Initialize the sync engine
   * Call this on app start
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[SyncEngine] Already initialized');
      return;
    }

    console.log('[SyncEngine] Initializing...');

    // Set up network listener
    this.netInfoSubscription = NetInfo.addEventListener(this.handleNetworkChange.bind(this));

    // Set up app state listener
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));

    // Check initial network state
    const networkState = await NetInfo.fetch();
    this.updateNetworkState(networkState);

    // Initialize sync manager
    await this.syncManager.initialize();

    this.isInitialized = true;
    console.log('[SyncEngine] Initialized successfully');
  }

  /**
   * Shutdown the sync engine
   * Call this on app cleanup
   */
  public shutdown(): void {
    console.log('[SyncEngine] Shutting down...');

    // Cancel any ongoing sync
    this.cancelSync();

    // Remove listeners
    if (this.netInfoSubscription) {
      this.netInfoSubscription();
      this.netInfoSubscription = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // Clear event listeners
    this.eventListeners.clear();

    this.isInitialized = false;
    console.log('[SyncEngine] Shutdown complete');
  }

  /**
   * Get current sync state
   */
  public getState(): SyncState {
    return this.state;
  }

  /**
   * Get last sync timestamp
   */
  public getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  /**
   * Get sync history
   */
  public getSyncHistory(): SyncResult[] {
    return [...this.syncHistory];
  }

  /**
   * Check if sync is in progress
   */
  public isSyncing(): boolean {
    return this.state === 'SYNCING';
  }

  /**
   * Check if we're online
   */
  public isOnline(): boolean {
    return this.state !== 'OFFLINE';
  }

  /**
   * Manual sync trigger
   */
  public async sync(options: SyncOptions = {}): Promise<SyncResult> {
    // If already syncing, return the current sync promise
    if (this.currentSyncPromise && !options.force) {
      console.log('[SyncEngine] Sync already in progress, waiting for completion...');
      return this.currentSyncPromise;
    }

    // Check if we're offline
    if (this.state === 'OFFLINE') {
      return this.createErrorResult('Network unavailable', 'NETWORK_OFFLINE');
    }

    // Check minimum sync interval
    if (!options.force && this.shouldThrottle()) {
      console.log('[SyncEngine] Sync throttled, using cached data');
      return this.createThrottledResult();
    }

    // Start sync
    this.currentSyncPromise = this.performSync(options);

    try {
      const result = await this.currentSyncPromise;
      return result;
    } finally {
      this.currentSyncPromise = null;
    }
  }

  /**
   * Cancel ongoing sync
   */
  public cancelSync(): void {
    if (this.state !== 'SYNCING') {
      return;
    }

    console.log('[SyncEngine] Cancelling sync...');
    this.syncManager.cancel();
    this.setState('IDLE');
    this.emitEvent('SYNC_CANCELLED');
  }

  /**
   * Add event listener
   */
  public addEventListener(event: SyncEvent, listener: SyncEventListener): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(listener);
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<SyncEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // =====================
  // Private Methods
  // =====================

  private async performSync(options: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();

    console.log('[SyncEngine] Starting sync...', { options });
    this.setState('SYNCING');
    this.emitEvent('SYNC_STARTED', { options });

    try {
      // Create timeout promise
      const timeoutMs = options.timeout || this.config.syncTimeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Sync timeout')), timeoutMs);
      });

      // Perform sync with timeout
      const syncPromise = this.executeSyncStrategies(options);
      const result = await Promise.race([syncPromise, timeoutPromise]);

      // Update state
      this.lastSyncTime = Date.now();
      this.retryCount = 0;
      this.setState('IDLE');

      // Add to history
      this.addToHistory(result);

      this.emitEvent('SYNC_COMPLETED', result);
      console.log('[SyncEngine] Sync completed', {
        duration: result.duration,
        synced: result.syncedEntities
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SyncEngine] Sync failed:', errorMessage);

      // Handle retry
      if (this.retryCount < this.config.maxRetryAttempts) {
        this.retryCount++;
        console.log(`[SyncEngine] Retrying sync (attempt ${this.retryCount}/${this.config.maxRetryAttempts})`);

        await this.delay(this.config.retryDelay);
        return this.performSync(options);
      }

      // Max retries exceeded
      this.setState('ERROR');
      const errorResult = this.createErrorResult(errorMessage, 'SYNC_FAILED');
      this.addToHistory(errorResult);
      this.emitEvent('SYNC_FAILED', { error: errorMessage });

      return errorResult;
    }
  }

  private async executeSyncStrategies(options: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    const conflicts: ConflictRecord[] = [];
    const syncedEntities = {
      transactions: 0,
      wallets: 0,
      products: 0,
      stands: 0,
    };

    const entityTypes = options.entityTypes || ['transactions', 'wallets', 'products', 'stands'];

    // 1. CRITICAL: Push local transactions first
    if (entityTypes.includes('transactions')) {
      try {
        const txResult = await this.syncManager.syncTransactions();
        syncedEntities.transactions = txResult.syncedCount;
        errors.push(...txResult.errors);
      } catch (error) {
        errors.push({
          code: 'TRANSACTION_SYNC_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          entityType: 'transactions',
          recoverable: true,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 2. HIGH: Pull wallet balance after pushing transactions
    if (entityTypes.includes('wallets')) {
      try {
        const walletResult = await this.syncManager.syncWallets();
        syncedEntities.wallets = walletResult.syncedCount;

        // Handle wallet conflicts (server wins)
        for (const conflict of walletResult.conflicts) {
          const resolution = this.conflictResolver.resolve(conflict, 'server_wins');
          conflicts.push({
            entityType: 'wallets',
            entityId: conflict.entityId,
            localVersion: conflict.localVersion,
            serverVersion: conflict.serverVersion,
            resolution: 'server_wins',
            resolvedAt: new Date().toISOString(),
          });
          this.emitEvent('CONFLICT_RESOLVED', resolution);
        }

        errors.push(...walletResult.errors);
      } catch (error) {
        errors.push({
          code: 'WALLET_SYNC_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          entityType: 'wallets',
          recoverable: true,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 3. NORMAL: Pull product catalog
    if (entityTypes.includes('products')) {
      try {
        const productResult = await this.syncManager.syncProducts();
        syncedEntities.products = productResult.syncedCount;
        errors.push(...productResult.errors);
      } catch (error) {
        errors.push({
          code: 'PRODUCT_SYNC_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          entityType: 'products',
          recoverable: true,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 4. NORMAL: Pull stand information
    if (entityTypes.includes('stands')) {
      try {
        const standResult = await this.syncManager.syncStands();
        syncedEntities.stands = standResult.syncedCount;
        errors.push(...standResult.errors);
      } catch (error) {
        errors.push({
          code: 'STAND_SYNC_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          entityType: 'stands',
          recoverable: true,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const duration = Date.now() - startTime;
    const hasErrors = errors.some(e => !e.recoverable);

    return {
      success: !hasErrors,
      timestamp: new Date().toISOString(),
      duration,
      syncedEntities,
      errors,
      conflicts,
    };
  }

  private handleNetworkChange(state: NetInfoState): void {
    this.updateNetworkState(state);
  }

  private updateNetworkState(state: NetInfoState): void {
    const wasOffline = this.state === 'OFFLINE';
    const isOnline = state.isConnected && state.isInternetReachable !== false;

    if (isOnline) {
      if (wasOffline) {
        console.log('[SyncEngine] Network restored');
        this.setState('IDLE');
        this.emitEvent('NETWORK_ONLINE');

        // Auto-sync when coming online
        if (this.config.autoSyncOnOnline) {
          // Delay to ensure network is stable
          setTimeout(() => {
            this.sync({ priority: 'HIGH' }).catch(console.error);
          }, 1000);
        }
      }
    } else {
      if (!wasOffline) {
        console.log('[SyncEngine] Network lost');
        this.setState('OFFLINE');
        this.emitEvent('NETWORK_OFFLINE');
      }
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active' && this.config.autoSyncOnForeground) {
      console.log('[SyncEngine] App came to foreground');

      // Sync if we haven't synced recently
      if (!this.shouldThrottle()) {
        this.sync({ priority: 'NORMAL' }).catch(console.error);
      }
    }
  }

  private shouldThrottle(): boolean {
    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    return timeSinceLastSync < this.config.minSyncInterval;
  }

  private setState(newState: SyncState): void {
    if (this.state !== newState) {
      console.log(`[SyncEngine] State: ${this.state} -> ${newState}`);
      this.state = newState;
    }
  }

  private emitEvent(event: SyncEvent, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event, data);
        } catch (error) {
          console.error(`[SyncEngine] Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  private addToHistory(result: SyncResult): void {
    this.syncHistory.unshift(result);
    if (this.syncHistory.length > this.maxHistoryLength) {
      this.syncHistory.pop();
    }
  }

  private createErrorResult(message: string, code: string): SyncResult {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      duration: 0,
      syncedEntities: {
        transactions: 0,
        wallets: 0,
        products: 0,
        stands: 0,
      },
      errors: [{
        code,
        message,
        recoverable: false,
        timestamp: new Date().toISOString(),
      }],
      conflicts: [],
    };
  }

  private createThrottledResult(): SyncResult {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      duration: 0,
      syncedEntities: {
        transactions: 0,
        wallets: 0,
        products: 0,
        stands: 0,
      },
      errors: [],
      conflicts: [],
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton getter for convenience
export const getSyncEngine = (config?: Partial<SyncEngineConfig>): SyncEngine => {
  return SyncEngine.getInstance(config);
};
