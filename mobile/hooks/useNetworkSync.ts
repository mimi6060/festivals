import { useEffect, useRef, useCallback, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useNetworkStore } from '@/stores/networkStore';
import { useSyncStore, SyncResult, SyncStatus } from '@/stores/syncStore';
import { logger } from '@/lib/logger';

export interface NetworkSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  lastSyncTime: string | null;
  syncError: string | null;
}

export interface UseNetworkSyncOptions {
  /** Whether to automatically sync when coming online */
  autoSync?: boolean;
  /** Minimum interval between auto-syncs in ms */
  syncInterval?: number;
  /** Callback when sync completes */
  onSyncComplete?: (result: SyncResult) => void;
  /** Callback when network status changes */
  onNetworkChange?: (isOnline: boolean) => void;
  /** Callback when coming back online */
  onComingOnline?: () => void;
}

// Sync configuration constants
const DEFAULT_SYNC_INTERVAL = 30000; // 30 seconds between periodic syncs
const RECONNECTION_DELAY_MS = 2500; // 2.5 seconds delay after coming online to ensure network stability

/**
 * Hook that monitors network status and auto-syncs when coming online
 */
export const useNetworkSync = (options: UseNetworkSyncOptions = {}) => {
  const {
    autoSync = true,
    syncInterval = DEFAULT_SYNC_INTERVAL,
    onSyncComplete,
    onNetworkChange,
    onComingOnline,
  } = options;

  // Network store state
  const { isOnline, setOnline, setSyncing } = useNetworkStore();

  // Sync store state and actions
  const {
    pendingTransactions,
    lastSyncTime,
    syncStatus,
    syncError,
    isSyncing,
    syncPendingTransactions,
  } = useSyncStore();

  // Local state
  const [wasOffline, setWasOffline] = useState(false);

  // Refs for tracking
  const lastSyncTimeRef = useRef<number>(0);
  const syncInProgressRef = useRef(false);

  /**
   * Performs sync of pending transactions
   */
  const sync = useCallback(async (): Promise<SyncResult | null> => {
    // Prevent concurrent syncs
    if (syncInProgressRef.current || isSyncing) {
      return null;
    }

    // Check if there's anything to sync
    if (pendingTransactions.length === 0) {
      return { success: true, syncedCount: 0, failedCount: 0, errors: [] };
    }

    // Check if we're online
    if (!isOnline) {
      return { success: false, syncedCount: 0, failedCount: 0, errors: [{ id: '', error: 'No network connection' }] };
    }

    // Check sync interval
    const now = Date.now();
    if (now - lastSyncTimeRef.current < syncInterval) {
      return null;
    }

    syncInProgressRef.current = true;
    setSyncing(true);

    try {
      const result = await syncPendingTransactions();
      lastSyncTimeRef.current = Date.now();

      if (onSyncComplete) {
        onSyncComplete(result);
      }

      return result;
    } catch (error) {
      logger.sync.error('Sync failed:', error);
      return {
        success: false,
        syncedCount: 0,
        failedCount: pendingTransactions.length,
        errors: [{ id: '', error: error instanceof Error ? error.message : 'Unknown error' }],
      };
    } finally {
      syncInProgressRef.current = false;
      setSyncing(false);
    }
  }, [isOnline, isSyncing, pendingTransactions.length, syncInterval, syncPendingTransactions, setSyncing, onSyncComplete]);

  /**
   * Force sync regardless of interval
   */
  const forceSync = useCallback(async (): Promise<SyncResult | null> => {
    lastSyncTimeRef.current = 0; // Reset interval
    return sync();
  }, [sync]);

  /**
   * Handle network state changes
   */
  const handleNetworkChange = useCallback(
    (state: NetInfoState) => {
      const newIsOnline = state.isConnected ?? false;
      const previouslyOffline = !isOnline && newIsOnline;

      setOnline(newIsOnline);

      if (onNetworkChange) {
        onNetworkChange(newIsOnline);
      }

      // Coming back online
      if (previouslyOffline) {
        setWasOffline(true);

        if (onComingOnline) {
          onComingOnline();
        }

        // Auto-sync when coming online
        if (autoSync && pendingTransactions.length > 0) {
          // Delay sync to ensure network connection is stable before attempting
          // This prevents failed syncs due to intermittent connectivity
          setTimeout(() => {
            forceSync();
          }, RECONNECTION_DELAY_MS);
        }
      }
    },
    [isOnline, setOnline, autoSync, pendingTransactions.length, forceSync, onNetworkChange, onComingOnline]
  );

  // Set up network listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    // Initial network check
    NetInfo.fetch().then(handleNetworkChange);

    return () => {
      unsubscribe();
    };
  }, [handleNetworkChange]);

  // Periodic sync when online with pending transactions
  useEffect(() => {
    if (!autoSync || !isOnline || pendingTransactions.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      sync();
    }, syncInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [autoSync, isOnline, pendingTransactions.length, syncInterval, sync]);

  // Clear wasOffline flag after a short delay
  useEffect(() => {
    if (wasOffline) {
      const timeoutId = setTimeout(() => {
        setWasOffline(false);
      }, 5000);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [wasOffline]);

  return {
    // State
    isOnline,
    isSyncing,
    syncStatus,
    pendingCount: pendingTransactions.length,
    lastSyncTime,
    syncError,
    wasOffline,

    // Actions
    sync,
    forceSync,
  };
};

/**
 * Hook that only provides network status without auto-sync
 */
export const useNetworkStatus = () => {
  const { isOnline } = useNetworkStore();
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      useNetworkStore.getState().setOnline(state.isConnected ?? false);
      setConnectionType(state.type);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isOnline,
    connectionType,
  };
};

/**
 * Hook that provides sync status for UI indicators
 */
export const useSyncStatus = (): NetworkSyncState => {
  const { isOnline } = useNetworkStore();
  const { pendingTransactions, lastSyncTime, syncStatus, syncError, isSyncing } = useSyncStore();

  return {
    isOnline,
    isSyncing,
    syncStatus,
    pendingCount: pendingTransactions.length,
    lastSyncTime,
    syncError,
  };
};

export default useNetworkSync;
