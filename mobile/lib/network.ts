import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { useNetworkStore } from '@/stores/networkStore';

// API Configuration
const API_HEALTH_ENDPOINT = '/health';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.festivals.app';
const API_TIMEOUT_MS = 10000;

export type NetworkQuality = 'good' | 'poor' | 'offline' | 'unknown';

export interface ApiReachabilityResult {
  reachable: boolean;
  latency: number | null;
  error?: string;
}

export interface NetworkMonitorConfig {
  /** Interval for periodic checks in ms */
  checkInterval?: number;
  /** API endpoint for health checks */
  healthEndpoint?: string;
  /** Timeout for API requests in ms */
  timeout?: number;
  /** Callback when network status changes */
  onStatusChange?: (isOnline: boolean, quality: NetworkQuality) => void;
}

const DEFAULT_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Checks if the API is reachable by pinging the health endpoint
 */
export const checkApiReachability = async (
  baseUrl: string = API_BASE_URL,
  timeout: number = API_TIMEOUT_MS
): Promise<ApiReachabilityResult> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const startTime = Date.now();

  try {
    const response = await fetch(`${baseUrl}${API_HEALTH_ENDPOINT}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    if (response.ok) {
      return { reachable: true, latency };
    }

    return {
      reachable: false,
      latency,
      error: `Server returned ${response.status}`,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { reachable: false, latency: null, error: 'Request timeout' };
      }
      return { reachable: false, latency, error: error.message };
    }

    return { reachable: false, latency, error: 'Unknown error' };
  }
};

/**
 * Determines network quality based on latency and connection type
 */
export const determineNetworkQuality = (
  latency: number | null,
  connectionType: string
): NetworkQuality => {
  if (latency === null) {
    return 'offline';
  }

  // Quality thresholds in ms
  const GOOD_LATENCY_WIFI = 500;
  const GOOD_LATENCY_CELLULAR = 1000;
  const POOR_LATENCY_WIFI = 2000;
  const POOR_LATENCY_CELLULAR = 3000;

  const isWifi = connectionType === 'wifi' || connectionType === 'ethernet';
  const goodThreshold = isWifi ? GOOD_LATENCY_WIFI : GOOD_LATENCY_CELLULAR;
  const poorThreshold = isWifi ? POOR_LATENCY_WIFI : POOR_LATENCY_CELLULAR;

  if (latency <= goodThreshold) {
    return 'good';
  }

  if (latency <= poorThreshold) {
    return 'poor';
  }

  return 'poor';
};

/**
 * Network monitoring class for global network state management
 */
class NetworkMonitor {
  private isInitialized = false;
  private unsubscribe: (() => void) | null = null;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private config: NetworkMonitorConfig;
  private lastQuality: NetworkQuality = 'unknown';

  constructor(config: NetworkMonitorConfig = {}) {
    this.config = {
      checkInterval: config.checkInterval ?? DEFAULT_CHECK_INTERVAL,
      healthEndpoint: config.healthEndpoint ?? API_HEALTH_ENDPOINT,
      timeout: config.timeout ?? API_TIMEOUT_MS,
      onStatusChange: config.onStatusChange,
    };
  }

  /**
   * Initializes the network monitor
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Subscribe to network state changes
    this.unsubscribe = NetInfo.addEventListener(this.handleNetworkChange.bind(this));

    // Initial state check
    NetInfo.fetch().then(this.handleNetworkChange.bind(this));

    // Start periodic API checks
    this.startPeriodicChecks();

    this.isInitialized = true;
    console.log('[NetworkMonitor] Initialized');
  }

  /**
   * Stops the network monitor
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }

    this.isInitialized = false;
    console.log('[NetworkMonitor] Stopped');
  }

  /**
   * Handles network state changes from NetInfo
   */
  private async handleNetworkChange(state: NetInfoState): Promise<void> {
    const isConnected = state.isConnected ?? false;
    const store = useNetworkStore.getState();

    store.setOnline(isConnected);

    if (!isConnected) {
      this.lastQuality = 'offline';
      if (this.config.onStatusChange) {
        this.config.onStatusChange(false, 'offline');
      }
      return;
    }

    // Check API reachability when connected
    await this.checkApiAndUpdateQuality();
  }

  /**
   * Checks API reachability and updates quality
   */
  private async checkApiAndUpdateQuality(): Promise<void> {
    const store = useNetworkStore.getState();

    if (!store.isOnline) {
      this.lastQuality = 'offline';
      return;
    }

    try {
      const result = await checkApiReachability(
        API_BASE_URL,
        this.config.timeout
      );

      const netInfo = await NetInfo.fetch();
      const connectionType = netInfo.type === NetInfoStateType.wifi ? 'wifi' : 'cellular';
      const quality = result.reachable
        ? determineNetworkQuality(result.latency, connectionType)
        : 'poor';

      if (quality !== this.lastQuality) {
        this.lastQuality = quality;
        if (this.config.onStatusChange) {
          this.config.onStatusChange(true, quality);
        }
      }
    } catch (error) {
      console.error('[NetworkMonitor] API check failed:', error);
    }
  }

  /**
   * Starts periodic API reachability checks
   */
  private startPeriodicChecks(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }

    this.checkIntervalId = setInterval(() => {
      this.checkApiAndUpdateQuality();
    }, this.config.checkInterval);
  }

  /**
   * Forces an immediate network check
   */
  async forceCheck(): Promise<{ isOnline: boolean; quality: NetworkQuality }> {
    const netInfo = await NetInfo.fetch();
    await this.handleNetworkChange(netInfo);
    return {
      isOnline: useNetworkStore.getState().isOnline,
      quality: this.lastQuality,
    };
  }

  /**
   * Gets current network quality
   */
  getQuality(): NetworkQuality {
    return this.lastQuality;
  }

  /**
   * Gets whether the monitor is initialized
   */
  isActive(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
let networkMonitorInstance: NetworkMonitor | null = null;

/**
 * Gets or creates the network monitor singleton
 */
export const getNetworkMonitor = (config?: NetworkMonitorConfig): NetworkMonitor => {
  if (!networkMonitorInstance) {
    networkMonitorInstance = new NetworkMonitor(config);
  }
  return networkMonitorInstance;
};

/**
 * Initializes network monitoring with optional configuration
 */
export const initializeNetworkMonitoring = (config?: NetworkMonitorConfig): void => {
  const monitor = getNetworkMonitor(config);
  monitor.initialize();
};

/**
 * Stops network monitoring
 */
export const stopNetworkMonitoring = (): void => {
  if (networkMonitorInstance) {
    networkMonitorInstance.stop();
  }
};

/**
 * Forces an immediate network check
 */
export const forceNetworkCheck = async (): Promise<{
  isOnline: boolean;
  quality: NetworkQuality;
}> => {
  const monitor = getNetworkMonitor();
  return monitor.forceCheck();
};

/**
 * Gets the current network quality
 */
export const getCurrentNetworkQuality = (): NetworkQuality => {
  const monitor = getNetworkMonitor();
  return monitor.getQuality();
};

/**
 * Utility to format connection type for display
 */
export const formatConnectionType = (type: NetInfoStateType): string => {
  switch (type) {
    case NetInfoStateType.wifi:
      return 'Wi-Fi';
    case NetInfoStateType.cellular:
      return 'Cellular';
    case NetInfoStateType.ethernet:
      return 'Ethernet';
    case NetInfoStateType.bluetooth:
      return 'Bluetooth';
    case NetInfoStateType.vpn:
      return 'VPN';
    case NetInfoStateType.none:
      return 'No Connection';
    default:
      return 'Unknown';
  }
};

/**
 * Gets network status description for UI
 */
export const getNetworkStatusDescription = (
  isOnline: boolean,
  quality: NetworkQuality,
  isSyncing: boolean,
  pendingCount: number
): string => {
  if (!isOnline) {
    return 'You are offline';
  }

  if (isSyncing) {
    return 'Syncing...';
  }

  if (pendingCount > 0) {
    return `${pendingCount} pending ${pendingCount === 1 ? 'change' : 'changes'}`;
  }

  if (quality === 'poor') {
    return 'Poor connection';
  }

  return 'Connected';
};

export { NetworkMonitor };
