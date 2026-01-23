import { useEffect, useState, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { useNetworkStore } from '@/stores/networkStore';
import { useSyncStore } from '@/stores/syncStore';
import { checkApiReachability, NetworkQuality, determineNetworkQuality } from '@/lib/network';

export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none';

export interface NetworkStatusState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: ConnectionType;
  networkQuality: NetworkQuality;
  isApiReachable: boolean;
  lastChecked: Date | null;
}

export interface UseNetworkStatusOptions {
  /** Debounce delay for status changes in ms */
  debounceDelay?: number;
  /** Interval for API reachability checks in ms */
  apiCheckInterval?: number;
  /** Whether to check API reachability */
  checkApiReachability?: boolean;
  /** Callback when network status changes */
  onStatusChange?: (status: NetworkStatusState) => void;
  /** Callback when coming online */
  onOnline?: () => void;
  /** Callback when going offline */
  onOffline?: () => void;
}

const DEFAULT_DEBOUNCE_DELAY = 300;
const DEFAULT_API_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Maps NetInfo connection type to our simplified ConnectionType
 */
const mapConnectionType = (type: NetInfoStateType): ConnectionType => {
  switch (type) {
    case NetInfoStateType.wifi:
      return 'wifi';
    case NetInfoStateType.cellular:
      return 'cellular';
    case NetInfoStateType.ethernet:
      return 'ethernet';
    case NetInfoStateType.none:
      return 'none';
    default:
      return 'unknown';
  }
};

/**
 * Enhanced hook for monitoring network status with debouncing and API reachability
 */
export const useNetworkStatus = (options: UseNetworkStatusOptions = {}) => {
  const {
    debounceDelay = DEFAULT_DEBOUNCE_DELAY,
    apiCheckInterval = DEFAULT_API_CHECK_INTERVAL,
    checkApiReachability: shouldCheckApi = true,
    onStatusChange,
    onOnline,
    onOffline,
  } = options;

  // Network store
  const { isOnline, setOnline } = useNetworkStore();
  const { pendingTransactions, isSyncing, syncStatus } = useSyncStore();

  // Local state
  const [status, setStatus] = useState<NetworkStatusState>({
    isConnected: isOnline,
    isInternetReachable: null,
    connectionType: 'unknown',
    networkQuality: 'unknown',
    isApiReachable: false,
    lastChecked: null,
  });

  // Refs for debouncing and tracking
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const apiCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previouslyOnlineRef = useRef<boolean>(isOnline);

  /**
   * Check API reachability
   */
  const checkApi = useCallback(async () => {
    if (!status.isConnected) {
      setStatus((prev) => ({
        ...prev,
        isApiReachable: false,
        networkQuality: 'offline',
        lastChecked: new Date(),
      }));
      return;
    }

    try {
      const result = await checkApiReachability();
      const quality = determineNetworkQuality(result.latency, status.connectionType);

      setStatus((prev) => ({
        ...prev,
        isApiReachable: result.reachable,
        networkQuality: quality,
        lastChecked: new Date(),
      }));
    } catch {
      setStatus((prev) => ({
        ...prev,
        isApiReachable: false,
        networkQuality: 'poor',
        lastChecked: new Date(),
      }));
    }
  }, [status.isConnected, status.connectionType]);

  /**
   * Handle network state changes with debouncing
   */
  const handleNetworkChange = useCallback(
    (netInfoState: NetInfoState) => {
      // Clear existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Debounce the status update
      debounceTimeoutRef.current = setTimeout(() => {
        const isConnected = netInfoState.isConnected ?? false;
        const isInternetReachable = netInfoState.isInternetReachable;
        const connectionType = mapConnectionType(netInfoState.type);

        // Update global store
        setOnline(isConnected);

        // Determine initial quality based on connection type
        let networkQuality: NetworkQuality = 'unknown';
        if (!isConnected) {
          networkQuality = 'offline';
        } else if (connectionType === 'wifi') {
          networkQuality = 'good';
        } else if (connectionType === 'cellular') {
          networkQuality = 'poor'; // Assume poor until verified
        }

        const newStatus: NetworkStatusState = {
          isConnected,
          isInternetReachable,
          connectionType,
          networkQuality,
          isApiReachable: status.isApiReachable && isConnected,
          lastChecked: new Date(),
        };

        setStatus(newStatus);

        // Fire callbacks
        if (onStatusChange) {
          onStatusChange(newStatus);
        }

        // Check for online/offline transitions
        if (isConnected && !previouslyOnlineRef.current) {
          if (onOnline) {
            onOnline();
          }
        } else if (!isConnected && previouslyOnlineRef.current) {
          if (onOffline) {
            onOffline();
          }
        }

        previouslyOnlineRef.current = isConnected;

        // Check API reachability after connection change
        if (isConnected && shouldCheckApi) {
          checkApi();
        }
      }, debounceDelay);
    },
    [debounceDelay, setOnline, onStatusChange, onOnline, onOffline, shouldCheckApi, checkApi, status.isApiReachable]
  );

  // Set up network listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    // Initial fetch
    NetInfo.fetch().then(handleNetworkChange);

    return () => {
      unsubscribe();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [handleNetworkChange]);

  // Set up periodic API reachability checks
  useEffect(() => {
    if (!shouldCheckApi) return;

    // Initial check
    checkApi();

    // Periodic checks
    apiCheckIntervalRef.current = setInterval(checkApi, apiCheckInterval);

    return () => {
      if (apiCheckIntervalRef.current) {
        clearInterval(apiCheckIntervalRef.current);
      }
    };
  }, [shouldCheckApi, apiCheckInterval, checkApi]);

  /**
   * Force a network status refresh
   */
  const refresh = useCallback(async () => {
    const netInfoState = await NetInfo.fetch();
    handleNetworkChange(netInfoState);
  }, [handleNetworkChange]);

  return {
    // Core status
    isConnected: status.isConnected,
    isInternetReachable: status.isInternetReachable,
    connectionType: status.connectionType,
    networkQuality: status.networkQuality,
    isApiReachable: status.isApiReachable,
    lastChecked: status.lastChecked,

    // Sync status
    pendingCount: pendingTransactions.length,
    isSyncing,
    syncStatus,

    // Computed
    isFullyOnline: status.isConnected && status.isApiReachable,
    hasNetworkIssues: status.isConnected && !status.isApiReachable,

    // Actions
    refresh,
    checkApi,
  };
};

/**
 * Simplified hook for basic online/offline status
 */
export const useIsOnline = (): boolean => {
  const { isOnline } = useNetworkStore();
  return isOnline;
};

/**
 * Hook for connection type monitoring
 */
export const useConnectionType = (): ConnectionType => {
  const [connectionType, setConnectionType] = useState<ConnectionType>('unknown');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setConnectionType(mapConnectionType(state.type));
    });

    NetInfo.fetch().then((state) => {
      setConnectionType(mapConnectionType(state.type));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return connectionType;
};

export default useNetworkStatus;
