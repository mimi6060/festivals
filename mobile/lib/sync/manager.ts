/**
 * Sync Manager - E4-S12
 *
 * Singleton that coordinates all sync strategies.
 * Provides progress tracking and error aggregation.
 */

import {
  SyncStrategy,
  StrategyResult,
  TransactionSyncStrategy,
  WalletSyncStrategy,
  ProductSyncStrategy,
  StandSyncStrategy,
  createSyncStrategies,
} from './strategies';
import { SyncError, ConflictRecord } from './engine';
import { ConflictData } from './conflict';
import { logger } from '@/lib/logger';

// Sync progress event
export interface SyncProgress {
  currentStrategy: string;
  currentIndex: number;
  totalStrategies: number;
  progress: number; // 0-100
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// Progress listener type
type ProgressListener = (progress: SyncProgress) => void;

// Manager result for each entity type
export interface EntitySyncResult {
  syncedCount: number;
  errors: SyncError[];
  conflicts: ConflictData[];
}

/**
 * SyncManager singleton
 *
 * Coordinates all sync strategies and provides unified access
 * to sync operations with progress tracking and error handling.
 */
export class SyncManager {
  private static instance: SyncManager | null = null;

  private strategies: SyncStrategy[] = [];
  private isInitialized: boolean = false;
  private isCancelled: boolean = false;

  // Progress tracking
  private currentProgress: SyncProgress | null = null;
  private progressListeners: Set<ProgressListener> = new Set();

  // Error aggregation
  private aggregatedErrors: SyncError[] = [];

  // Individual strategy instances
  private transactionStrategy: TransactionSyncStrategy;
  private walletStrategy: WalletSyncStrategy;
  private productStrategy: ProductSyncStrategy;
  private standStrategy: StandSyncStrategy;

  private constructor() {
    this.transactionStrategy = new TransactionSyncStrategy();
    this.walletStrategy = new WalletSyncStrategy();
    this.productStrategy = new ProductSyncStrategy();
    this.standStrategy = new StandSyncStrategy();

    this.strategies = [
      this.transactionStrategy,
      this.walletStrategy,
      this.productStrategy,
      this.standStrategy,
    ];
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    SyncManager.instance = null;
  }

  /**
   * Initialize the sync manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.syncManager.warn('Already initialized');
      return;
    }

    logger.syncManager.info('Initializing...');

    // Sort strategies by priority
    this.strategies.sort((a, b) => a.priority - b.priority);

    this.isInitialized = true;
    logger.syncManager.info(`Initialized with ${this.strategies.length} strategies`);
  }

  /**
   * Execute all sync strategies in priority order
   */
  public async syncAll(): Promise<{
    success: boolean;
    results: Map<string, StrategyResult>;
    errors: SyncError[];
  }> {
    this.isCancelled = false;
    this.aggregatedErrors = [];
    const results = new Map<string, StrategyResult>();

    logger.syncManager.info('Starting full sync');

    for (let i = 0; i < this.strategies.length; i++) {
      if (this.isCancelled) {
        logger.syncManager.info('Sync cancelled');
        break;
      }

      const strategy = this.strategies[i];

      // Update progress
      this.updateProgress({
        currentStrategy: strategy.name,
        currentIndex: i,
        totalStrategies: this.strategies.length,
        progress: Math.round((i / this.strategies.length) * 100),
        status: 'running',
      });

      try {
        logger.syncManager.debug(`Executing strategy: ${strategy.name}`);
        const result = await strategy.execute();
        results.set(strategy.name, result);

        // Aggregate errors
        this.aggregatedErrors.push(...result.errors);

        // Update progress for completion
        this.updateProgress({
          currentStrategy: strategy.name,
          currentIndex: i,
          totalStrategies: this.strategies.length,
          progress: Math.round(((i + 1) / this.strategies.length) * 100),
          status: result.success ? 'completed' : 'failed',
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.syncManager.error(`Strategy ${strategy.name} failed:`, errorMessage);

        const syncError: SyncError = {
          code: 'STRATEGY_ERROR',
          message: errorMessage,
          entityType: strategy.name.replace('Sync', '').toLowerCase(),
          recoverable: true,
          timestamp: new Date().toISOString(),
        };

        this.aggregatedErrors.push(syncError);

        results.set(strategy.name, {
          success: false,
          syncedCount: 0,
          errors: [syncError],
          conflicts: [],
        });

        this.updateProgress({
          currentStrategy: strategy.name,
          currentIndex: i,
          totalStrategies: this.strategies.length,
          progress: Math.round(((i + 1) / this.strategies.length) * 100),
          status: 'failed',
        });
      }
    }

    // Final progress update
    this.updateProgress({
      currentStrategy: '',
      currentIndex: this.strategies.length,
      totalStrategies: this.strategies.length,
      progress: 100,
      status: this.aggregatedErrors.length === 0 ? 'completed' : 'failed',
    });

    const hasUnrecoverableErrors = this.aggregatedErrors.some(e => !e.recoverable);

    logger.syncManager.info(`Full sync completed. Errors: ${this.aggregatedErrors.length}`);

    return {
      success: !hasUnrecoverableErrors,
      results,
      errors: this.aggregatedErrors,
    };
  }

  /**
   * Sync transactions only (highest priority)
   */
  public async syncTransactions(): Promise<EntitySyncResult> {
    logger.syncManager.debug('Syncing transactions');
    const result = await this.transactionStrategy.execute();
    return {
      syncedCount: result.syncedCount,
      errors: result.errors,
      conflicts: result.conflicts,
    };
  }

  /**
   * Sync wallet balance
   */
  public async syncWallets(): Promise<EntitySyncResult> {
    logger.syncManager.debug('Syncing wallets');
    const result = await this.walletStrategy.execute();
    return {
      syncedCount: result.syncedCount,
      errors: result.errors,
      conflicts: result.conflicts,
    };
  }

  /**
   * Sync product catalog
   */
  public async syncProducts(): Promise<EntitySyncResult> {
    logger.syncManager.debug('Syncing products');
    const result = await this.productStrategy.execute();
    return {
      syncedCount: result.syncedCount,
      errors: result.errors,
      conflicts: result.conflicts,
    };
  }

  /**
   * Sync stand information
   */
  public async syncStands(): Promise<EntitySyncResult> {
    logger.syncManager.debug('Syncing stands');
    const result = await this.standStrategy.execute();
    return {
      syncedCount: result.syncedCount,
      errors: result.errors,
      conflicts: result.conflicts,
    };
  }

  /**
   * Cancel ongoing sync operations
   */
  public cancel(): void {
    logger.syncManager.info('Cancel requested');
    this.isCancelled = true;
  }

  /**
   * Check if there are any pending changes to sync
   */
  public async hasPendingChanges(): Promise<boolean> {
    for (const strategy of this.strategies) {
      if (await strategy.hasPendingChanges()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get total count of pending items across all strategies
   */
  public async getPendingCount(): Promise<number> {
    let total = 0;
    for (const strategy of this.strategies) {
      total += await strategy.getPendingCount();
    }
    return total;
  }

  /**
   * Get pending counts by entity type
   */
  public async getPendingCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const strategy of this.strategies) {
      const name = strategy.name.replace('Sync', '').toLowerCase();
      counts[name] = await strategy.getPendingCount();
    }
    return counts;
  }

  /**
   * Get current progress
   */
  public getProgress(): SyncProgress | null {
    return this.currentProgress;
  }

  /**
   * Get aggregated errors from last sync
   */
  public getErrors(): SyncError[] {
    return [...this.aggregatedErrors];
  }

  /**
   * Clear aggregated errors
   */
  public clearErrors(): void {
    this.aggregatedErrors = [];
  }

  /**
   * Add progress listener
   */
  public addProgressListener(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  /**
   * Get strategy by name
   */
  public getStrategy(name: string): SyncStrategy | undefined {
    return this.strategies.find(s => s.name === name);
  }

  /**
   * Get all strategies
   */
  public getStrategies(): SyncStrategy[] {
    return [...this.strategies];
  }

  // =====================
  // Private Methods
  // =====================

  private updateProgress(progress: SyncProgress): void {
    this.currentProgress = progress;
    this.progressListeners.forEach(listener => {
      try {
        listener(progress);
      } catch (error) {
        logger.syncManager.error('Error in progress listener:', error);
      }
    });
  }
}

/**
 * Sync queue for managing sync operations
 *
 * Ensures sync operations are executed in order and
 * prevents concurrent sync operations.
 */
export class SyncQueue {
  private queue: Array<{
    id: string;
    operation: () => Promise<void>;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessing: boolean = false;

  /**
   * Add an operation to the queue
   */
  public async add(operation: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      this.queue.push({ id, operation, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Clear the queue
   */
  public clear(): void {
    const pending = this.queue.splice(0);
    pending.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
  }

  /**
   * Get queue length
   */
  public get length(): number {
    return this.queue.length;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        await item.operation();
        item.resolve();
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isProcessing = false;
  }
}

// Export singleton getter for convenience
export const getSyncManager = (): SyncManager => {
  return SyncManager.getInstance();
};
