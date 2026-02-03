/**
 * Logger Utility
 *
 * A production-ready logging utility that:
 * - Only logs in __DEV__ mode
 * - Provides structured log levels (debug, info, warn, error)
 * - Includes timestamps and context
 * - Can be extended for remote logging services
 */

// React Native global that indicates development mode
declare const __DEV__: boolean;

// Log levels in order of severity
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Configuration for the logger
export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include timestamps */
  showTimestamp: boolean;
  /** Whether to include the caller context */
  showContext: boolean;
  /** Custom log handler for remote logging */
  remoteHandler?: (level: LogLevel, context: string, message: string, data?: unknown) => void;
}

// Default configuration
const defaultConfig: LoggerConfig = {
  minLevel: 'debug',
  showTimestamp: true,
  showContext: true,
};

// Current configuration
let config: LoggerConfig = { ...defaultConfig };

// Log level priorities (lower = more verbose)
const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if we should log at the given level
 */
function shouldLog(level: LogLevel): boolean {
  // Only log in development mode
  if (!__DEV__) {
    return false;
  }

  return levelPriority[level] >= levelPriority[config.minLevel];
}

/**
 * Format a log message with optional timestamp and context
 */
function formatMessage(context: string, message: string): string {
  const parts: string[] = [];

  if (config.showTimestamp) {
    const now = new Date();
    const timestamp = now.toISOString().slice(11, 23); // HH:mm:ss.sss
    parts.push(`[${timestamp}]`);
  }

  if (config.showContext && context) {
    parts.push(`[${context}]`);
  }

  parts.push(message);

  return parts.join(' ');
}

/**
 * Core logging function
 */
function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) {
    return;
  }

  const formattedMessage = formatMessage(context, message);

  // Call the appropriate console method
  switch (level) {
    case 'debug':
      if (data !== undefined) {
        console.log(formattedMessage, data);
      } else {
        console.log(formattedMessage);
      }
      break;
    case 'info':
      if (data !== undefined) {
        console.info(formattedMessage, data);
      } else {
        console.info(formattedMessage);
      }
      break;
    case 'warn':
      if (data !== undefined) {
        console.warn(formattedMessage, data);
      } else {
        console.warn(formattedMessage);
      }
      break;
    case 'error':
      if (data !== undefined) {
        console.error(formattedMessage, data);
      } else {
        console.error(formattedMessage);
      }
      break;
  }

  // Call remote handler if configured
  if (config.remoteHandler) {
    try {
      config.remoteHandler(level, context, message, data);
    } catch {
      // Silently ignore remote handler errors
    }
  }
}

/**
 * Create a logger instance with a fixed context
 */
export function createLogger(context: string) {
  return {
    debug: (message: string, data?: unknown) => log('debug', context, message, data),
    info: (message: string, data?: unknown) => log('info', context, message, data),
    warn: (message: string, data?: unknown) => log('warn', context, message, data),
    error: (message: string, data?: unknown) => log('error', context, message, data),
  };
}

/**
 * Configure the logger
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Reset logger to default configuration
 */
export function resetLoggerConfig(): void {
  config = { ...defaultConfig };
}

// Pre-created loggers for common contexts
export const logger = {
  // Core loggers
  app: createLogger('App'),
  network: createLogger('Network'),
  sync: createLogger('Sync'),
  db: createLogger('Database'),
  auth: createLogger('Auth'),

  // Feature loggers
  offline: createLogger('Offline'),
  nfc: createLogger('NFC'),
  wallet: createLogger('Wallet'),
  map: createLogger('Map'),
  notifications: createLogger('Notifications'),
  push: createLogger('Push'),
  location: createLogger('Location'),
  haptics: createLogger('Haptics'),

  // Store loggers
  stores: {
    offline: createLogger('OfflineStore'),
    wallet: createLogger('WalletStore'),
    user: createLogger('UserStore'),
    chat: createLogger('ChatStore'),
    social: createLogger('SocialStore'),
    favorites: createLogger('FavoritesStore'),
    map: createLogger('MapStore'),
    nfc: createLogger('NFCStore'),
    order: createLogger('OrderStore'),
    inventory: createLogger('InventoryStore'),
    scanStats: createLogger('ScanStatsStore'),
  },

  // Sync loggers
  syncEngine: createLogger('SyncEngine'),
  syncManager: createLogger('SyncManager'),
  syncQueue: createLogger('SyncQueue'),
  transactionSync: createLogger('TransactionSync'),
  walletSync: createLogger('WalletSync'),
  productSync: createLogger('ProductSync'),
  standSync: createLogger('StandSync'),
  conflictResolver: createLogger('ConflictResolver'),

  // Migration logger
  migration: createLogger('Migration'),

  // API loggers
  api: {
    scanStats: createLogger('API:ScanStats'),
    orders: createLogger('API:Orders'),
    social: createLogger('API:Social'),
  },
};

// Export default logger for quick access
export default logger;
