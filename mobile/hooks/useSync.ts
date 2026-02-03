/**
 * useSync Hook - E4-S12
 *
 * React hook for components to trigger and monitor sync operations.
 * Integrates with the SyncEngine and provides auto-sync on app foreground.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSyncStore, SyncStatus, SyncProgress } from '@/stores/syncStore';
import { useNetworkStore } from '@/stores/networkStore';
import { SyncEngine, SyncResult, SyncOptions, SyncState as EngineSyncState } from '@/lib/sync/engine';
import { SyncManager } from '@/lib/sync/manager';
import { logger } from '@/lib/logger';

// Hook options
export interface UseSyncOptions {
  /**
   * Enable auto-sync when app comes to foreground
   */
  autoSyncOnForeground?: boolean;

  /**
   * Enable auto-sync when network becomes available
   */
  autoSyncOnOnline?: boolean;

  /**
   * Minimum interval between auto-syncs (ms)
   */
  minSyncInterval?: number;

  /**
   * Callback when sync completes
   */
  onSyncComplete?: (result: SyncResult) => void;

  /**
   * Callback when sync fails
   */
  onSyncError?: (error: Error) => void;

  /**
   * Callback when network status changes
   */
  onNetworkChange?: (isOnline: boolean) => void;
}

// Hook return type
export interface UseSyncReturn {
  // State
  syncStatus: SyncStatus;
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  syncProgress: SyncProgress | null;
  syncErrors: Array<{ id: string; message: string }>;

  // Actions
  sync: (options?: SyncOptions) => Promise<SyncResult>;
  forceSync: () => Promise<SyncResult>;
  cancelSync: () => void;
  clearErrors: () => void;

  // Engine state
  engineState: EngineSyncState;
}

// Default options
const DEFAULT_OPTIONS: UseSyncOptions = {
  autoSyncOnForeground: true,
  autoSyncOnOnline: true,
  minSyncInterval: 30000, // 30 seconds
};

/**
 * Main sync hook for components
 *
 * Provides sync status monitoring and manual sync triggers.
 * Automatically syncs when app comes to foreground or network is restored.
 */
export function useSync(options: UseSyncOptions = {}): UseSyncReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get stores
  const {
    syncStatus,
    isSyncing,
    isOnline,
    lastSyncTime,
    pendingTransactions,
    syncProgress,
    syncErrors,
    startSync,
    cancelSync: storeCancelSync,
    clearSyncErrors,
    setSyncStatus,
    setSyncError,
    setLastSyncTime,
    setSyncProgress,
    setIsOnline,
  } = useSyncStore();

  const { isOnline: networkIsOnline } = useNetworkStore();

  // Local state
  const [engineState, setEngineState] = useState<EngineSyncState>('IDLE');

  // Refs
  const lastSyncTimeRef = useRef<number>(0);
  const syncEngineRef = useRef<SyncEngine | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Initialize sync engine
  useEffect(() => {
    const engine = SyncEngine.getInstance();
    syncEngineRef.current = engine;

    // Initialize engine
    engine.initialize().catch((err) => logger.sync.error('Failed to initialize sync engine:', err));

    // Listen for engine events
    const unsubOnline = engine.addEventListener('NETWORK_ONLINE', () => {
      setIsOnline(true);
      opts.onNetworkChange?.(true);
    });

    const unsubOffline = engine.addEventListener('NETWORK_OFFLINE', () => {
      setIsOnline(false);
      opts.onNetworkChange?.(false);
    });

    const unsubCompleted = engine.addEventListener('SYNC_COMPLETED', (_, data) => {
      opts.onSyncComplete?.(data as SyncResult);
    });

    const unsubFailed = engine.addEventListener('SYNC_FAILED', (_, data) => {
      const errorData = data as { error: string };
      opts.onSyncError?.(new Error(errorData.error));
    });

    return () => {
      unsubOnline();
      unsubOffline();
      unsubCompleted();
      unsubFailed();
    };
  }, [opts.onNetworkChange, opts.onSyncComplete, opts.onSyncError]);

  // Sync network status from networkStore
  useEffect(() => {
    setIsOnline(networkIsOnline);
  }, [networkIsOnline, setIsOnline]);

  // Handle app state changes for auto-sync on foreground
  useEffect(() => {
    if (!opts.autoSyncOnForeground) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground
        const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
        if (timeSinceLastSync >= opts.minSyncInterval!) {
          sync({ priority: 'NORMAL' }).catch((err) => logger.sync.error('Foreground sync failed:', err));
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [opts.autoSyncOnForeground, opts.minSyncInterval]);

  // Auto-sync when coming online
  useEffect(() => {
    if (!opts.autoSyncOnOnline) return;

    if (isOnline && pendingTransactions.length > 0) {
      const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
      if (timeSinceLastSync >= opts.minSyncInterval!) {
        // Delay to ensure network is stable
        const timeoutId = setTimeout(() => {
          sync({ priority: 'HIGH' }).catch((err) => logger.sync.error('Online sync failed:', err));
        }, 1000);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [isOnline, pendingTransactions.length, opts.autoSyncOnOnline, opts.minSyncInterval]);

  /**
   * Perform sync
   */
  const sync = useCallback(async (syncOptions: SyncOptions = {}): Promise<SyncResult> => {
    const engine = syncEngineRef.current;
    if (!engine) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        duration: 0,
        syncedEntities: { transactions: 0, wallets: 0, products: 0, stands: 0 },
        errors: [{
          code: 'ENGINE_NOT_INITIALIZED',
          message: 'Sync engine not initialized',
          recoverable: false,
          timestamp: new Date().toISOString(),
        }],
        conflicts: [],
      };
    }

    // Update store state
    startSync();
    setEngineState('SYNCING');

    // Add progress listener
    const manager = SyncManager.getInstance();
    const removeProgressListener = manager.addProgressListener((progress) => {
      setSyncProgress({
        currentStrategy: progress.currentStrategy,
        currentIndex: progress.currentIndex,
        totalStrategies: progress.totalStrategies,
        progress: progress.progress,
      });
    });

    try {
      const result = await engine.sync(syncOptions);

      // Update store with result
      lastSyncTimeRef.current = Date.now();
      setLastSyncTime(new Date().toISOString());
      setSyncStatus(result.success ? 'success' : 'error');
      setEngineState(engine.getState());

      if (!result.success && result.errors.length > 0) {
        setSyncError(result.errors[0].message);
      } else {
        setSyncError(null);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSyncStatus('error');
      setSyncError(errorMessage);
      setEngineState('ERROR');

      return {
        success: false,
        timestamp: new Date().toISOString(),
        duration: 0,
        syncedEntities: { transactions: 0, wallets: 0, products: 0, stands: 0 },
        errors: [{
          code: 'SYNC_ERROR',
          message: errorMessage,
          recoverable: true,
          timestamp: new Date().toISOString(),
        }],
        conflicts: [],
      };

    } finally {
      removeProgressListener();
      setSyncProgress(null);

      // Update status to idle if not in error
      if (useSyncStore.getState().syncStatus !== 'error') {
        setSyncStatus('idle');
      }
    }
  }, [startSync, setLastSyncTime, setSyncStatus, setSyncError, setSyncProgress]);

  /**
   * Force sync (bypasses throttling)
   */
  const forceSync = useCallback(async (): Promise<SyncResult> => {
    lastSyncTimeRef.current = 0; // Reset throttle
    return sync({ force: true });
  }, [sync]);

  /**
   * Cancel ongoing sync
   */
  const cancelSync = useCallback(() => {
    const engine = syncEngineRef.current;
    if (engine) {
      engine.cancelSync();
    }
    storeCancelSync();
    setEngineState('IDLE');
  }, [storeCancelSync]);

  /**
   * Clear sync errors
   */
  const clearErrors = useCallback(() => {
    clearSyncErrors();
    setSyncError(null);
  }, [clearSyncErrors, setSyncError]);

  return {
    // State
    syncStatus,
    isSyncing,
    isOnline,
    lastSyncTime,
    pendingCount: pendingTransactions.length,
    syncProgress,
    syncErrors: syncErrors.map(e => ({ id: e.id, message: e.message })),

    // Actions
    sync,
    forceSync,
    cancelSync,
    clearErrors,

    // Engine state
    engineState,
  };
}

/**
 * Lightweight hook for just sync status
 *
 * Use this when you only need to display sync status
 * without triggering syncs.
 */
export function useSyncStatus() {
  const {
    syncStatus,
    isSyncing,
    isOnline,
    lastSyncTime,
    pendingTransactions,
    syncProgress,
    syncErrors,
  } = useSyncStore();

  return {
    status: syncStatus,
    isSyncing,
    isOnline,
    lastSyncTime,
    pendingCount: pendingTransactions.length,
    progress: syncProgress,
    hasErrors: syncErrors.length > 0,
    errorCount: syncErrors.length,
  };
}

/**
 * Hook for sync progress tracking
 *
 * Use this when you need detailed progress information
 * for displaying sync progress UI.
 */
export function useSyncProgress() {
  const { syncProgress, isSyncing } = useSyncStore();

  return {
    isActive: isSyncing,
    progress: syncProgress?.progress ?? 0,
    currentStrategy: syncProgress?.currentStrategy ?? null,
    currentIndex: syncProgress?.currentIndex ?? 0,
    totalStrategies: syncProgress?.totalStrategies ?? 0,
  };
}

/**
 * Hook for pending transactions
 *
 * Use this when you need to display pending transaction count
 * or details.
 */
export function usePendingTransactions() {
  const { pendingTransactions, pendingCounts } = useSyncStore();

  return {
    transactions: pendingTransactions,
    count: pendingTransactions.length,
    totalPending: Object.values(pendingCounts).reduce((sum, count) => sum + count, 0),
    pendingByType: pendingCounts,
  };
}

/**
 * Hook for auto-sync initialization
 *
 * Use this at the app root to initialize the sync engine
 * and enable auto-sync functionality.
 */
export function useSyncInitialization() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);

  useEffect(() => {
    const engine = SyncEngine.getInstance({
      autoSyncOnOnline: true,
      autoSyncOnForeground: true,
      minSyncInterval: 30000,
    });

    engine
      .initialize()
      .then(() => {
        setIsInitialized(true);
        logger.sync.info('Sync engine initialized');
      })
      .catch((error) => {
        setInitError(error);
        logger.sync.error('Failed to initialize sync engine:', error);
      });

    return () => {
      engine.shutdown();
    };
  }, []);

  return {
    isInitialized,
    initError,
  };
}

export default useSync;
