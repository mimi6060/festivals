/**
 * useSyncQueue Hook
 *
 * React hook to access sync queue status, pending operations,
 * failed items, and manual retry triggers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNetworkStore } from '@/stores/networkStore';

import {
  SyncQueue,
  getSyncQueue,
  initializeSyncQueue,
  QueueStats,
  QueueEventType,
  SyncOperationInput,
} from '@/lib/sync/queue';

import {
  SyncOperationBase,
  SyncOperationType,
  SyncOperationStatus,
} from '@/lib/sync/operations';

// ============================================
// Types
// ============================================

/**
 * Sync queue state returned by the hook
 */
export interface SyncQueueState {
  /** Whether the queue is initialized */
  isInitialized: boolean;
  /** Whether the queue is currently processing */
  isProcessing: boolean;
  /** Whether an operation is currently being synced */
  isSyncing: boolean;
  /** Total number of pending operations */
  pendingCount: number;
  /** Number of failed operations */
  failedCount: number;
  /** Total number of operations in queue */
  totalCount: number;
  /** List of failed operations */
  failedItems: SyncOperationBase[];
  /** Queue statistics */
  stats: QueueStats | null;
  /** Last error that occurred */
  lastError: string | null;
  /** Whether the device is online */
  isOnline: boolean;
}

/**
 * Actions available from the hook
 */
export interface SyncQueueActions {
  /** Initializes the sync queue */
  initialize: () => Promise<void>;
  /** Adds an operation to the queue */
  addOperation: (input: SyncOperationInput) => Promise<SyncOperationBase>;
  /** Starts queue processing */
  startProcessing: () => Promise<void>;
  /** Stops queue processing */
  stopProcessing: () => void;
  /** Retries a specific failed operation */
  retryOperation: (id: string) => Promise<void>;
  /** Retries all failed operations */
  retryAllFailed: () => Promise<number>;
  /** Gets pending operations */
  getPendingOperations: () => Promise<SyncOperationBase[]>;
  /** Gets failed operations */
  getFailedOperations: () => Promise<SyncOperationBase[]>;
  /** Removes an operation from the queue */
  removeOperation: (id: string) => Promise<void>;
  /** Clears completed operations */
  clearCompleted: () => Promise<number>;
  /** Clears all operations */
  clearAll: () => Promise<void>;
  /** Refreshes the queue stats */
  refreshStats: () => Promise<void>;
  /** Forces a sync attempt for pending operations */
  forceSync: () => Promise<void>;
}

/**
 * Return type of useSyncQueue hook
 */
export type UseSyncQueueReturn = SyncQueueState & SyncQueueActions;

/**
 * Options for the useSyncQueue hook
 */
export interface UseSyncQueueOptions {
  /** Auto-initialize on mount (default: true) */
  autoInitialize?: boolean;
  /** Auto-start processing when online (default: true) */
  autoProcess?: boolean;
  /** Refresh interval for stats in ms (default: 5000) */
  refreshInterval?: number;
  /** Callback when an operation completes */
  onOperationComplete?: (operation: SyncOperationBase) => void;
  /** Callback when an operation fails */
  onOperationFailed?: (operation: SyncOperationBase) => void;
  /** Callback when queue becomes empty */
  onQueueEmpty?: () => void;
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook to access and manage the sync queue
 */
export function useSyncQueue(
  options: UseSyncQueueOptions = {}
): UseSyncQueueReturn {
  const {
    autoInitialize = true,
    autoProcess = true,
    refreshInterval = 5000,
    onOperationComplete,
    onOperationFailed,
    onQueueEmpty,
  } = options;

  // Network state
  const { isOnline } = useNetworkStore();

  // Queue instance ref
  const queueRef = useRef<SyncQueue | null>(null);

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [failedItems, setFailedItems] = useState<SyncOperationBase[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  /**
   * Refreshes queue statistics
   */
  const refreshStats = useCallback(async () => {
    if (!queueRef.current?.initialized) return;

    try {
      const newStats = await queueRef.current.getStats();
      setStats(newStats);
      setPendingCount(newStats.pendingCount);
      setFailedCount(newStats.failedCount);
      setTotalCount(newStats.totalCount);
    } catch (error) {
      console.error('Failed to refresh queue stats:', error);
    }
  }, []);

  /**
   * Refreshes failed items list
   */
  const refreshFailedItems = useCallback(async () => {
    if (!queueRef.current?.initialized) return;

    try {
      const failed = await queueRef.current.getFailedOperations();
      setFailedItems(failed);
    } catch (error) {
      console.error('Failed to refresh failed items:', error);
    }
  }, []);

  /**
   * Initializes the sync queue
   */
  const initialize = useCallback(async () => {
    if (isInitialized) return;

    try {
      const queue = await initializeSyncQueue();
      queueRef.current = queue;
      setIsInitialized(true);
      setLastError(null);

      // Initial stats refresh
      await refreshStats();
      await refreshFailedItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize queue';
      setLastError(message);
      console.error('Failed to initialize sync queue:', error);
      throw error;
    }
  }, [isInitialized, refreshStats, refreshFailedItems]);

  /**
   * Adds an operation to the queue
   */
  const addOperation = useCallback(
    async (input: SyncOperationInput): Promise<SyncOperationBase> => {
      if (!queueRef.current?.initialized) {
        throw new Error('Queue not initialized');
      }

      const operation = await queueRef.current.addOperation(input);
      await refreshStats();
      return operation;
    },
    [refreshStats]
  );

  /**
   * Starts queue processing
   */
  const startProcessing = useCallback(async () => {
    if (!queueRef.current?.initialized) {
      throw new Error('Queue not initialized');
    }

    await queueRef.current.startProcessing();
    setIsProcessing(true);
  }, []);

  /**
   * Stops queue processing
   */
  const stopProcessing = useCallback(() => {
    if (!queueRef.current) return;

    queueRef.current.stopProcessing();
    setIsProcessing(false);
  }, []);

  /**
   * Retries a specific failed operation
   */
  const retryOperation = useCallback(
    async (id: string) => {
      if (!queueRef.current?.initialized) {
        throw new Error('Queue not initialized');
      }

      await queueRef.current.retryOperation(id);
      await refreshStats();
      await refreshFailedItems();
    },
    [refreshStats, refreshFailedItems]
  );

  /**
   * Retries all failed operations
   */
  const retryAllFailed = useCallback(async (): Promise<number> => {
    if (!queueRef.current?.initialized) {
      throw new Error('Queue not initialized');
    }

    const count = await queueRef.current.retryAllFailed();
    await refreshStats();
    await refreshFailedItems();
    return count;
  }, [refreshStats, refreshFailedItems]);

  /**
   * Gets pending operations
   */
  const getPendingOperations = useCallback(async (): Promise<SyncOperationBase[]> => {
    if (!queueRef.current?.initialized) {
      return [];
    }

    return queueRef.current.getPendingOperations(100);
  }, []);

  /**
   * Gets failed operations
   */
  const getFailedOperations = useCallback(async (): Promise<SyncOperationBase[]> => {
    if (!queueRef.current?.initialized) {
      return [];
    }

    return queueRef.current.getFailedOperations();
  }, []);

  /**
   * Removes an operation from the queue
   */
  const removeOperation = useCallback(
    async (id: string) => {
      if (!queueRef.current?.initialized) {
        throw new Error('Queue not initialized');
      }

      await queueRef.current.removeOperation(id);
      await refreshStats();
      await refreshFailedItems();
    },
    [refreshStats, refreshFailedItems]
  );

  /**
   * Clears completed operations
   */
  const clearCompleted = useCallback(async (): Promise<number> => {
    if (!queueRef.current?.initialized) {
      return 0;
    }

    const count = await queueRef.current.cleanupCompleted();
    await refreshStats();
    return count;
  }, [refreshStats]);

  /**
   * Clears all operations
   */
  const clearAll = useCallback(async () => {
    if (!queueRef.current?.initialized) {
      return;
    }

    await queueRef.current.clearAll();
    await refreshStats();
    await refreshFailedItems();
  }, [refreshStats, refreshFailedItems]);

  /**
   * Forces a sync attempt
   */
  const forceSync = useCallback(async () => {
    if (!queueRef.current?.initialized || !isOnline) {
      return;
    }

    // Process one batch immediately
    await queueRef.current.processBatch();
    await refreshStats();
    await refreshFailedItems();
  }, [isOnline, refreshStats, refreshFailedItems]);

  /**
   * Handle queue events
   */
  const handleQueueEvent = useCallback(
    (event: QueueEventType, data?: SyncOperationBase | QueueStats) => {
      switch (event) {
        case 'operation_started':
          setIsSyncing(true);
          break;

        case 'operation_completed':
          setIsSyncing(false);
          refreshStats();
          if (onOperationComplete && data && 'id' in data) {
            onOperationComplete(data as SyncOperationBase);
          }
          break;

        case 'operation_failed':
          setIsSyncing(false);
          refreshStats();
          refreshFailedItems();
          if (onOperationFailed && data && 'id' in data) {
            onOperationFailed(data as SyncOperationBase);
          }
          break;

        case 'operation_retrying':
          setIsSyncing(false);
          refreshStats();
          break;

        case 'queue_empty':
          setIsSyncing(false);
          refreshStats();
          if (onQueueEmpty) {
            onQueueEmpty();
          }
          break;

        case 'queue_processing_started':
          setIsProcessing(true);
          break;

        case 'queue_processing_stopped':
          setIsProcessing(false);
          setIsSyncing(false);
          break;
      }
    },
    [refreshStats, refreshFailedItems, onOperationComplete, onOperationFailed, onQueueEmpty]
  );

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInitialize) {
      initialize();
    }

    return () => {
      // Cleanup on unmount
      if (queueRef.current) {
        queueRef.current.stopProcessing();
      }
    };
  }, [autoInitialize, initialize]);

  // Subscribe to queue events
  useEffect(() => {
    if (!queueRef.current?.initialized) return;

    const unsubscribe = queueRef.current.addEventListener(handleQueueEvent);
    return unsubscribe;
  }, [isInitialized, handleQueueEvent]);

  // Auto-start/stop processing based on network status
  useEffect(() => {
    if (!isInitialized || !autoProcess) return;

    if (isOnline && !isProcessing && pendingCount > 0) {
      startProcessing();
    } else if (!isOnline && isProcessing) {
      stopProcessing();
    }
  }, [isOnline, isInitialized, autoProcess, isProcessing, pendingCount, startProcessing, stopProcessing]);

  // Periodic stats refresh
  useEffect(() => {
    if (!isInitialized || refreshInterval <= 0) return;

    const intervalId = setInterval(refreshStats, refreshInterval);
    return () => clearInterval(intervalId);
  }, [isInitialized, refreshInterval, refreshStats]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isInitialized) {
        // Refresh when app comes to foreground
        refreshStats();
        refreshFailedItems();

        // Resume processing if online
        if (isOnline && autoProcess && pendingCount > 0 && !isProcessing) {
          startProcessing();
        }
      } else if (nextAppState === 'background') {
        // Stop processing when going to background
        stopProcessing();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [
    isInitialized,
    isOnline,
    autoProcess,
    pendingCount,
    isProcessing,
    refreshStats,
    refreshFailedItems,
    startProcessing,
    stopProcessing,
  ]);

  return {
    // State
    isInitialized,
    isProcessing,
    isSyncing,
    pendingCount,
    failedCount,
    totalCount,
    failedItems,
    stats,
    lastError,
    isOnline,

    // Actions
    initialize,
    addOperation,
    startProcessing,
    stopProcessing,
    retryOperation,
    retryAllFailed,
    getPendingOperations,
    getFailedOperations,
    removeOperation,
    clearCompleted,
    clearAll,
    refreshStats,
    forceSync,
  };
}

// ============================================
// Specialized Hooks
// ============================================

/**
 * Hook to get only the sync status (lighter weight)
 */
export function useSyncStatus(): {
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  isOnline: boolean;
} {
  const { pendingCount, failedCount, isSyncing, isOnline } = useSyncQueue({
    autoProcess: false,
    refreshInterval: 10000,
  });

  return { pendingCount, failedCount, isSyncing, isOnline };
}

/**
 * Hook to manage a specific operation type
 */
export function useSyncOperationType(type: SyncOperationType) {
  const {
    addOperation,
    getPendingOperations,
    getFailedOperations,
    retryAllFailed,
  } = useSyncQueue();

  const [operations, setOperations] = useState<SyncOperationBase[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const pending = await getPendingOperations();
      const failed = await getFailedOperations();
      const filtered = [...pending, ...failed].filter((op) => op.type === type);
      setOperations(filtered);
    } finally {
      setLoading(false);
    }
  }, [type, getPendingOperations, getFailedOperations]);

  const add = useCallback(
    async (
      entityId: string,
      payload: Record<string, unknown>,
      crudOperation: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE'
    ) => {
      await addOperation({
        type,
        crudOperation,
        entityId,
        payload,
      });
      await refresh();
    },
    [type, addOperation, refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    operations,
    loading,
    add,
    refresh,
    retryAll: retryAllFailed,
  };
}

export default useSyncQueue;
