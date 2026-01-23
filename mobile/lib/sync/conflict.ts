/**
 * Conflict Resolution - E4-S12
 *
 * Handles conflicts between local and server data during sync.
 * Implements different resolution strategies based on entity type.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Conflict resolution strategies
export type ConflictResolutionStrategy =
  | 'server_wins'
  | 'client_wins'
  | 'merge'
  | 'manual'
  | 'newest_wins';

// Conflict data structure
export interface ConflictData {
  entityType: string;
  entityId: string;
  localVersion: unknown;
  serverVersion: unknown;
  localTimestamp?: string;
  serverTimestamp?: string;
}

// Resolved conflict record
export interface ResolvedConflict {
  conflict: ConflictData;
  resolution: ConflictResolutionStrategy;
  resolvedValue: unknown;
  resolvedAt: string;
  automatic: boolean;
}

// Conflict log entry
export interface ConflictLogEntry {
  id: string;
  conflict: ConflictData;
  resolution: ConflictResolutionStrategy;
  resolvedValue: unknown;
  resolvedAt: string;
  deviceId: string;
}

// Storage key for conflict log
const CONFLICT_LOG_KEY = '@conflict_log';
const MAX_LOG_ENTRIES = 100;

/**
 * Default resolution strategies per entity type
 */
const DEFAULT_STRATEGIES: Record<string, ConflictResolutionStrategy> = {
  // Wallets: Server is authoritative for balance
  wallet: 'server_wins',

  // Transactions: Merge based on idempotency key
  transaction: 'merge',

  // Products: Server is authoritative (catalog)
  product: 'server_wins',

  // Stands: Server is authoritative
  stand: 'server_wins',

  // User preferences: Client wins (local choices)
  preference: 'client_wins',

  // Favorites: Merge (keep both)
  favorite: 'merge',

  // Default
  default: 'server_wins',
};

/**
 * ConflictResolver class
 *
 * Detects and resolves conflicts between local and server data.
 * Logs conflicts for debugging and auditing.
 */
export class ConflictResolver {
  private deviceId: string = '';

  constructor() {
    this.initDeviceId();
  }

  private async initDeviceId(): Promise<void> {
    const stored = await AsyncStorage.getItem('@device_id');
    this.deviceId = stored || 'unknown';
  }

  /**
   * Detect if there's a conflict between local and server versions
   */
  public detectConflict(
    localData: unknown,
    serverData: unknown,
    localTimestamp?: string,
    serverTimestamp?: string
  ): boolean {
    // No conflict if either is null/undefined
    if (localData == null || serverData == null) {
      return false;
    }

    // For primitives, check equality
    if (typeof localData !== 'object' || typeof serverData !== 'object') {
      return localData !== serverData;
    }

    // For objects, compare JSON representation
    // This is a simple check - more sophisticated comparison could be added
    const localJson = JSON.stringify(localData);
    const serverJson = JSON.stringify(serverData);

    if (localJson === serverJson) {
      return false;
    }

    // If timestamps are provided and server is newer, consider it an update not a conflict
    if (localTimestamp && serverTimestamp) {
      const localTime = new Date(localTimestamp).getTime();
      const serverTime = new Date(serverTimestamp).getTime();

      // If server version is significantly newer (> 1 second), it's an update
      if (serverTime - localTime > 1000) {
        return false;
      }
    }

    return true;
  }

  /**
   * Resolve a conflict using the appropriate strategy
   */
  public resolve(
    conflict: ConflictData,
    strategy?: ConflictResolutionStrategy
  ): ResolvedConflict {
    const resolveStrategy = strategy || this.getStrategyForEntity(conflict.entityType);

    let resolvedValue: unknown;
    let automatic = true;

    switch (resolveStrategy) {
      case 'server_wins':
        resolvedValue = this.resolveServerWins(conflict);
        break;

      case 'client_wins':
        resolvedValue = this.resolveClientWins(conflict);
        break;

      case 'merge':
        resolvedValue = this.resolveMerge(conflict);
        break;

      case 'newest_wins':
        resolvedValue = this.resolveNewestWins(conflict);
        break;

      case 'manual':
        // For manual resolution, return server version but flag as non-automatic
        resolvedValue = conflict.serverVersion;
        automatic = false;
        break;

      default:
        resolvedValue = conflict.serverVersion;
    }

    const resolved: ResolvedConflict = {
      conflict,
      resolution: resolveStrategy,
      resolvedValue,
      resolvedAt: new Date().toISOString(),
      automatic,
    };

    // Log the conflict
    this.logConflict(resolved);

    return resolved;
  }

  /**
   * Get the default strategy for an entity type
   */
  public getStrategyForEntity(entityType: string): ConflictResolutionStrategy {
    return DEFAULT_STRATEGIES[entityType] || DEFAULT_STRATEGIES.default;
  }

  /**
   * Get conflict log for debugging
   */
  public async getConflictLog(): Promise<ConflictLogEntry[]> {
    try {
      const stored = await AsyncStorage.getItem(CONFLICT_LOG_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('[ConflictResolver] Failed to read conflict log:', error);
      return [];
    }
  }

  /**
   * Clear conflict log
   */
  public async clearConflictLog(): Promise<void> {
    await AsyncStorage.removeItem(CONFLICT_LOG_KEY);
  }

  /**
   * Get conflicts by entity type
   */
  public async getConflictsByType(entityType: string): Promise<ConflictLogEntry[]> {
    const log = await this.getConflictLog();
    return log.filter(entry => entry.conflict.entityType === entityType);
  }

  /**
   * Get recent conflicts (last N entries)
   */
  public async getRecentConflicts(count: number = 10): Promise<ConflictLogEntry[]> {
    const log = await this.getConflictLog();
    return log.slice(0, count);
  }

  // =====================
  // Resolution Methods
  // =====================

  /**
   * Server wins - use server version
   */
  private resolveServerWins(conflict: ConflictData): unknown {
    console.log(
      `[ConflictResolver] Server wins for ${conflict.entityType}:${conflict.entityId}`
    );
    return conflict.serverVersion;
  }

  /**
   * Client wins - use local version
   */
  private resolveClientWins(conflict: ConflictData): unknown {
    console.log(
      `[ConflictResolver] Client wins for ${conflict.entityType}:${conflict.entityId}`
    );
    return conflict.localVersion;
  }

  /**
   * Merge - combine local and server data
   */
  private resolveMerge(conflict: ConflictData): unknown {
    console.log(
      `[ConflictResolver] Merging ${conflict.entityType}:${conflict.entityId}`
    );

    const local = conflict.localVersion as Record<string, unknown> | undefined;
    const server = conflict.serverVersion as Record<string, unknown> | undefined;

    // If either is not an object, fall back to server wins
    if (typeof local !== 'object' || typeof server !== 'object') {
      return server ?? local;
    }

    if (!local) return server;
    if (!server) return local;

    // Merge objects, preferring server values for conflicts
    return this.deepMerge(local, server);
  }

  /**
   * Newest wins - compare timestamps
   */
  private resolveNewestWins(conflict: ConflictData): unknown {
    const localTime = conflict.localTimestamp
      ? new Date(conflict.localTimestamp).getTime()
      : 0;
    const serverTime = conflict.serverTimestamp
      ? new Date(conflict.serverTimestamp).getTime()
      : Date.now();

    if (localTime > serverTime) {
      console.log(
        `[ConflictResolver] Local wins (newer) for ${conflict.entityType}:${conflict.entityId}`
      );
      return conflict.localVersion;
    }

    console.log(
      `[ConflictResolver] Server wins (newer) for ${conflict.entityType}:${conflict.entityId}`
    );
    return conflict.serverVersion;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(
    local: Record<string, unknown>,
    server: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...local };

    for (const key in server) {
      if (Object.prototype.hasOwnProperty.call(server, key)) {
        const localValue = local[key];
        const serverValue = server[key];

        if (
          typeof localValue === 'object' &&
          typeof serverValue === 'object' &&
          localValue !== null &&
          serverValue !== null &&
          !Array.isArray(localValue) &&
          !Array.isArray(serverValue)
        ) {
          // Recursively merge nested objects
          result[key] = this.deepMerge(
            localValue as Record<string, unknown>,
            serverValue as Record<string, unknown>
          );
        } else if (Array.isArray(localValue) && Array.isArray(serverValue)) {
          // For arrays, merge unique values
          result[key] = this.mergeArrays(localValue, serverValue);
        } else {
          // For other values, server wins
          result[key] = serverValue;
        }
      }
    }

    return result;
  }

  /**
   * Merge two arrays, keeping unique values
   */
  private mergeArrays(local: unknown[], server: unknown[]): unknown[] {
    // For arrays of objects with IDs, merge by ID
    const hasIds = local.every(item => this.hasId(item)) && server.every(item => this.hasId(item));

    if (hasIds) {
      const merged = new Map<string, unknown>();

      // Add local items
      for (const item of local) {
        const id = (item as Record<string, unknown>).id as string;
        merged.set(id, item);
      }

      // Add/update with server items (server wins for conflicts)
      for (const item of server) {
        const id = (item as Record<string, unknown>).id as string;
        merged.set(id, item);
      }

      return Array.from(merged.values());
    }

    // For simple arrays, concatenate unique values
    const seen = new Set<string>();
    const result: unknown[] = [];

    for (const item of [...local, ...server]) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Check if an item has an ID property
   */
  private hasId(item: unknown): boolean {
    return (
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      typeof (item as Record<string, unknown>).id === 'string'
    );
  }

  /**
   * Log a resolved conflict for debugging
   */
  private async logConflict(resolved: ResolvedConflict): Promise<void> {
    try {
      const log = await this.getConflictLog();

      const entry: ConflictLogEntry = {
        id: `conflict_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        conflict: resolved.conflict,
        resolution: resolved.resolution,
        resolvedValue: resolved.resolvedValue,
        resolvedAt: resolved.resolvedAt,
        deviceId: this.deviceId,
      };

      // Add to beginning of log
      log.unshift(entry);

      // Trim log to max entries
      if (log.length > MAX_LOG_ENTRIES) {
        log.length = MAX_LOG_ENTRIES;
      }

      await AsyncStorage.setItem(CONFLICT_LOG_KEY, JSON.stringify(log));

      console.log(
        `[ConflictResolver] Logged conflict: ${resolved.conflict.entityType}:${resolved.conflict.entityId} -> ${resolved.resolution}`
      );
    } catch (error) {
      console.error('[ConflictResolver] Failed to log conflict:', error);
    }
  }
}

/**
 * Transaction-specific conflict resolver
 *
 * Special handling for transaction conflicts based on idempotency keys.
 */
export class TransactionConflictResolver extends ConflictResolver {
  /**
   * Resolve transaction conflicts using idempotency keys
   */
  public resolveTransaction(
    localTransaction: { idempotencyKey: string; [key: string]: unknown },
    serverTransaction: { idempotencyKey: string; [key: string]: unknown } | null
  ): { action: 'keep_local' | 'use_server' | 'discard'; reason: string } {
    // If no server transaction with this idempotency key, keep local
    if (!serverTransaction) {
      return {
        action: 'keep_local',
        reason: 'Transaction not found on server, will be pushed',
      };
    }

    // If idempotency keys match, server has already processed this transaction
    if (localTransaction.idempotencyKey === serverTransaction.idempotencyKey) {
      return {
        action: 'use_server',
        reason: 'Transaction already processed by server (idempotency key match)',
      };
    }

    // Different idempotency keys - this is a different transaction
    return {
      action: 'keep_local',
      reason: 'Different transaction (idempotency keys differ)',
    };
  }
}

/**
 * Wallet-specific conflict resolver
 *
 * Server always wins for wallet balance to ensure consistency.
 */
export class WalletConflictResolver extends ConflictResolver {
  /**
   * Resolve wallet balance conflict
   * Server ALWAYS wins for balance to ensure consistency
   */
  public resolveBalance(localBalance: number, serverBalance: number): {
    balance: number;
    hadConflict: boolean;
    reason: string;
  } {
    const hadConflict = localBalance !== serverBalance;

    return {
      balance: serverBalance,
      hadConflict,
      reason: hadConflict
        ? `Balance conflict resolved: local (${localBalance}) -> server (${serverBalance})`
        : 'No conflict, balances match',
    };
  }
}

// Export singleton instances for specialized resolvers
export const transactionConflictResolver = new TransactionConflictResolver();
export const walletConflictResolver = new WalletConflictResolver();
