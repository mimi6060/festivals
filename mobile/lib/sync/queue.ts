/**
 * Sync Queue with Priority-Based Processing and SQLite Persistence
 *
 * Implements a robust sync queue system that:
 * - Persists operations to SQLite for app restart survival
 * - Processes operations in priority order (FIFO within same priority)
 * - Uses exponential backoff retry for failed operations
 * - Supports operation dependencies and conflict resolution
 */

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  SyncOperationType,
  SyncOperationBase,
  SyncOperationStatus,
  SyncOperationMetadata,
  SyncPriority,
  CrudOperation,
  SyncOperationResult,
  getPriorityForType,
  getEntityTypeForOperation,
  getMaxRetriesForType,
  createOperationId,
  createIdempotencyKey,
  serializePayload,
  deserializePayload,
  serializeMetadata,
  deserializeMetadata,
} from './operations';

import {
  RetryPolicy,
  DEFAULT_RETRY_POLICY,
  CRITICAL_RETRY_POLICY,
  calculateBackoff,
  calculateNextRetryTime,
  shouldRetry,
  parseError,
  delay,
} from './retry';
import { logger } from '@/lib/logger';

// ============================================
// Types
// ============================================

/**
 * Input for creating a new sync operation
 */
export interface SyncOperationInput {
  type: SyncOperationType;
  crudOperation: CrudOperation;
  entityId: string;
  payload: Record<string, unknown>;
  priority?: SyncPriority;
  metadata?: Partial<SyncOperationMetadata>;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  totalCount: number;
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  failedCount: number;
  byPriority: Record<SyncPriority, number>;
  byType: Record<string, number>;
  oldestPendingAt: string | null;
  lastProcessedAt: string | null;
}

/**
 * Sync handler function type
 */
export type SyncHandler = (
  operation: SyncOperationBase
) => Promise<SyncOperationResult>;

/**
 * Event types emitted by the queue
 */
export type QueueEventType =
  | 'operation_added'
  | 'operation_started'
  | 'operation_completed'
  | 'operation_failed'
  | 'operation_retrying'
  | 'queue_empty'
  | 'queue_processing_started'
  | 'queue_processing_stopped';

/**
 * Queue event listener
 */
export type QueueEventListener = (
  event: QueueEventType,
  data?: SyncOperationBase | QueueStats
) => void;

// ============================================
// Constants
// ============================================

const DB_NAME = 'sync_queue.db';
const TABLE_NAME = 'sync_operations';
const DEVICE_ID_KEY = '@sync_queue_device_id';
const PROCESSING_LOCK_KEY = '@sync_queue_processing';

// ============================================
// SyncQueue Class
// ============================================

/**
 * Main sync queue class that manages offline operations
 */
export class SyncQueue {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  private isProcessing = false;
  private deviceId: string | null = null;
  private handlers: Map<SyncOperationType, SyncHandler> = new Map();
  private listeners: Set<QueueEventListener> = new Set();
  private retryPolicies: Map<SyncOperationType, RetryPolicy> = new Map();
  private processingPromise: Promise<void> | null = null;

  /**
   * Initializes the sync queue
   * Must be called before using other methods
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Open database
      this.db = await SQLite.openDatabaseAsync(DB_NAME);

      // Create table if not exists
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          crud_operation TEXT NOT NULL,
          priority INTEGER NOT NULL,
          status TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          idempotency_key TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          retry_count INTEGER DEFAULT 0,
          max_retries INTEGER DEFAULT 5,
          last_retry_at TEXT,
          next_retry_at TEXT,
          error TEXT,
          error_code TEXT,
          metadata TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_status ON ${TABLE_NAME}(status);
        CREATE INDEX IF NOT EXISTS idx_priority ON ${TABLE_NAME}(priority);
        CREATE INDEX IF NOT EXISTS idx_next_retry ON ${TABLE_NAME}(next_retry_at);
        CREATE INDEX IF NOT EXISTS idx_type ON ${TABLE_NAME}(type);
      `);

      // Get or create device ID
      this.deviceId = await this.getOrCreateDeviceId();

      this.isInitialized = true;
    } catch (error) {
      logger.syncQueue.error('Failed to initialize SyncQueue:', error);
      throw error;
    }
  }

  /**
   * Gets or creates a unique device ID
   */
  private async getOrCreateDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = Crypto.randomUUID();
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  /**
   * Ensures the queue is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error('SyncQueue not initialized. Call initialize() first.');
    }
  }

  // ============================================
  // Operation Management
  // ============================================

  /**
   * Adds a new operation to the queue
   */
  async addOperation(input: SyncOperationInput): Promise<SyncOperationBase> {
    this.ensureInitialized();

    const now = new Date().toISOString();
    const priority = input.priority ?? getPriorityForType(input.type);
    const entityType = getEntityTypeForOperation(input.type);
    const maxRetries = getMaxRetriesForType(input.type);

    const operation: SyncOperationBase = {
      id: createOperationId(),
      type: input.type,
      crudOperation: input.crudOperation,
      priority,
      status: SyncOperationStatus.PENDING,
      entityId: input.entityId,
      entityType,
      payload: input.payload,
      idempotencyKey: createIdempotencyKey(
        input.type,
        input.entityId,
        input.metadata?.userId || this.deviceId!
      ),
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      maxRetries,
      lastRetryAt: null,
      nextRetryAt: null,
      error: null,
      errorCode: null,
      metadata: {
        deviceId: this.deviceId!,
        userId: input.metadata?.userId || '',
        festivalId: input.metadata?.festivalId,
        sessionId: input.metadata?.sessionId,
        offlineSignature: input.metadata?.offlineSignature,
        conflictResolution: input.metadata?.conflictResolution,
        dependsOn: input.metadata?.dependsOn,
        version: input.metadata?.version,
      },
    };

    // Insert into database
    await this.db!.runAsync(
      `INSERT INTO ${TABLE_NAME} (
        id, type, crud_operation, priority, status, entity_id, entity_type,
        payload, idempotency_key, created_at, updated_at, retry_count, max_retries,
        last_retry_at, next_retry_at, error, error_code, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        operation.id,
        operation.type,
        operation.crudOperation,
        operation.priority,
        operation.status,
        operation.entityId,
        operation.entityType,
        serializePayload(operation.payload),
        operation.idempotencyKey,
        operation.createdAt,
        operation.updatedAt,
        operation.retryCount,
        operation.maxRetries,
        operation.lastRetryAt,
        operation.nextRetryAt,
        operation.error,
        operation.errorCode,
        serializeMetadata(operation.metadata),
      ]
    );

    this.emit('operation_added', operation);
    return operation;
  }

  /**
   * Gets an operation by ID
   */
  async getOperation(id: string): Promise<SyncOperationBase | null> {
    this.ensureInitialized();

    const row = await this.db!.getFirstAsync<SQLiteRow>(
      `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
      [id]
    );

    return row ? this.rowToOperation(row) : null;
  }

  /**
   * Gets all operations with optional filters
   */
  async getOperations(filters?: {
    status?: SyncOperationStatus;
    type?: SyncOperationType;
    priority?: SyncPriority;
    limit?: number;
  }): Promise<SyncOperationBase[]> {
    this.ensureInitialized();

    let query = `SELECT * FROM ${TABLE_NAME}`;
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters?.type) {
      conditions.push('type = ?');
      params.push(filters.type);
    }

    if (filters?.priority !== undefined) {
      conditions.push('priority = ?');
      params.push(filters.priority);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY priority ASC, created_at ASC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = await this.db!.getAllAsync<SQLiteRow>(query, params);
    return rows.map((row) => this.rowToOperation(row));
  }

  /**
   * Gets pending operations ready for processing
   */
  async getPendingOperations(limit = 10): Promise<SyncOperationBase[]> {
    this.ensureInitialized();

    const now = new Date().toISOString();

    // Get pending operations that:
    // 1. Have status PENDING
    // 2. Have next_retry_at null (first attempt) or next_retry_at <= now
    const rows = await this.db!.getAllAsync<SQLiteRow>(
      `SELECT * FROM ${TABLE_NAME}
       WHERE status = ?
       AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY priority ASC, created_at ASC
       LIMIT ?`,
      [SyncOperationStatus.PENDING, now, limit]
    );

    return rows.map((row) => this.rowToOperation(row));
  }

  /**
   * Gets failed operations
   */
  async getFailedOperations(): Promise<SyncOperationBase[]> {
    return this.getOperations({ status: SyncOperationStatus.FAILED });
  }

  /**
   * Updates an operation
   */
  async updateOperation(
    id: string,
    updates: Partial<SyncOperationBase>
  ): Promise<void> {
    this.ensureInitialized();

    const now = new Date().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [now];

    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }

    if (updates.retryCount !== undefined) {
      setClauses.push('retry_count = ?');
      params.push(updates.retryCount);
    }

    if (updates.lastRetryAt !== undefined) {
      setClauses.push('last_retry_at = ?');
      params.push(updates.lastRetryAt);
    }

    if (updates.nextRetryAt !== undefined) {
      setClauses.push('next_retry_at = ?');
      params.push(updates.nextRetryAt);
    }

    if (updates.error !== undefined) {
      setClauses.push('error = ?');
      params.push(updates.error);
    }

    if (updates.errorCode !== undefined) {
      setClauses.push('error_code = ?');
      params.push(updates.errorCode);
    }

    if (updates.payload !== undefined) {
      setClauses.push('payload = ?');
      params.push(serializePayload(updates.payload));
    }

    if (updates.metadata !== undefined) {
      setClauses.push('metadata = ?');
      params.push(serializeMetadata(updates.metadata));
    }

    params.push(id);

    await this.db!.runAsync(
      `UPDATE ${TABLE_NAME} SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Removes an operation from the queue
   */
  async removeOperation(id: string): Promise<void> {
    this.ensureInitialized();
    await this.db!.runAsync(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
  }

  /**
   * Removes completed operations older than the specified age
   */
  async cleanupCompleted(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    this.ensureInitialized();

    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const result = await this.db!.runAsync(
      `DELETE FROM ${TABLE_NAME} WHERE status = ? AND updated_at < ?`,
      [SyncOperationStatus.COMPLETED, cutoff]
    );

    return result.changes;
  }

  /**
   * Clears all operations from the queue
   */
  async clearAll(): Promise<void> {
    this.ensureInitialized();
    await this.db!.runAsync(`DELETE FROM ${TABLE_NAME}`);
  }

  // ============================================
  // Queue Processing
  // ============================================

  /**
   * Registers a handler for a specific operation type
   */
  registerHandler(type: SyncOperationType, handler: SyncHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Registers a custom retry policy for an operation type
   */
  registerRetryPolicy(type: SyncOperationType, policy: RetryPolicy): void {
    this.retryPolicies.set(type, policy);
  }

  /**
   * Gets the retry policy for an operation type
   */
  private getRetryPolicy(type: SyncOperationType): RetryPolicy {
    if (this.retryPolicies.has(type)) {
      return this.retryPolicies.get(type)!;
    }

    // Use critical policy for critical priority operations
    const priority = getPriorityForType(type);
    if (priority === SyncPriority.CRITICAL) {
      return CRITICAL_RETRY_POLICY;
    }

    return DEFAULT_RETRY_POLICY;
  }

  /**
   * Starts processing the queue
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.ensureInitialized();
    this.isProcessing = true;
    this.emit('queue_processing_started');

    this.processingPromise = this.processLoop();
  }

  /**
   * Stops processing the queue
   */
  stopProcessing(): void {
    this.isProcessing = false;
    this.emit('queue_processing_stopped');
  }

  /**
   * Processes a single batch of operations
   */
  async processBatch(): Promise<void> {
    this.ensureInitialized();

    const operations = await this.getPendingOperations(10);

    for (const operation of operations) {
      if (!this.isProcessing) {
        break;
      }
      await this.processOperation(operation);
    }
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.isProcessing) {
      try {
        const operations = await this.getPendingOperations(5);

        if (operations.length === 0) {
          this.emit('queue_empty');
          // Wait before checking again
          await delay(5000);
          continue;
        }

        for (const operation of operations) {
          if (!this.isProcessing) {
            break;
          }
          await this.processOperation(operation);
        }
      } catch (error) {
        logger.syncQueue.error('Error in processing loop:', error);
        await delay(5000); // Wait before retrying
      }
    }
  }

  /**
   * Processes a single operation
   */
  private async processOperation(operation: SyncOperationBase): Promise<void> {
    const handler = this.handlers.get(operation.type);

    if (!handler) {
      logger.syncQueue.warn(`No handler registered for operation type: ${operation.type}`);
      await this.markOperationFailed(
        operation,
        'NO_HANDLER',
        `No handler registered for operation type: ${operation.type}`
      );
      return;
    }

    // Mark as in progress
    await this.updateOperation(operation.id, {
      status: SyncOperationStatus.IN_PROGRESS,
    });
    this.emit('operation_started', operation);

    try {
      const result = await handler(operation);

      if (result.success) {
        await this.markOperationCompleted(operation);
      } else if (result.conflict) {
        // Handle conflict
        await this.handleConflict(operation, result);
      } else {
        // Handle failure
        await this.handleOperationFailure(
          operation,
          result.error?.code || 'UNKNOWN',
          result.error?.message || 'Unknown error'
        );
      }
    } catch (error) {
      const parsedError = parseError(error);
      await this.handleOperationFailure(
        operation,
        parsedError.code,
        parsedError.message
      );
    }
  }

  /**
   * Handles a failed operation
   */
  private async handleOperationFailure(
    operation: SyncOperationBase,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    const policy = this.getRetryPolicy(operation.type);
    const decision = shouldRetry({ code: errorCode }, operation.retryCount, policy);

    if (decision.retry) {
      // Schedule retry
      const nextRetryAt = calculateNextRetryTime(operation.retryCount, policy);

      await this.updateOperation(operation.id, {
        status: SyncOperationStatus.PENDING,
        retryCount: operation.retryCount + 1,
        lastRetryAt: new Date().toISOString(),
        nextRetryAt,
        error: errorMessage,
        errorCode,
      });

      this.emit('operation_retrying', {
        ...operation,
        retryCount: operation.retryCount + 1,
        nextRetryAt,
      });
    } else {
      // Mark as failed
      await this.markOperationFailed(operation, errorCode, errorMessage);
    }
  }

  /**
   * Handles a conflict during sync
   */
  private async handleConflict(
    operation: SyncOperationBase,
    result: SyncOperationResult
  ): Promise<void> {
    const conflictResolution =
      operation.metadata.conflictResolution || 'SERVER_WINS';

    // For now, mark as failed and let the user resolve
    // In a more sophisticated implementation, we could auto-resolve based on strategy
    await this.markOperationFailed(
      operation,
      'CONFLICT',
      `Conflict detected: ${result.conflict?.type}. Resolution strategy: ${conflictResolution}`
    );
  }

  /**
   * Marks an operation as completed
   */
  private async markOperationCompleted(
    operation: SyncOperationBase
  ): Promise<void> {
    await this.updateOperation(operation.id, {
      status: SyncOperationStatus.COMPLETED,
      error: null,
      errorCode: null,
    });
    this.emit('operation_completed', operation);
  }

  /**
   * Marks an operation as failed
   */
  private async markOperationFailed(
    operation: SyncOperationBase,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    await this.updateOperation(operation.id, {
      status: SyncOperationStatus.FAILED,
      error: errorMessage,
      errorCode,
    });
    this.emit('operation_failed', {
      ...operation,
      status: SyncOperationStatus.FAILED,
      error: errorMessage,
      errorCode,
    });
  }

  /**
   * Retries a failed operation manually
   */
  async retryOperation(id: string): Promise<void> {
    this.ensureInitialized();

    const operation = await this.getOperation(id);
    if (!operation) {
      throw new Error(`Operation not found: ${id}`);
    }

    if (operation.status !== SyncOperationStatus.FAILED) {
      throw new Error(`Operation is not in failed state: ${operation.status}`);
    }

    // Reset retry count and mark as pending
    await this.updateOperation(id, {
      status: SyncOperationStatus.PENDING,
      retryCount: 0,
      nextRetryAt: null,
      error: null,
      errorCode: null,
    });
  }

  /**
   * Retries all failed operations
   */
  async retryAllFailed(): Promise<number> {
    this.ensureInitialized();

    const result = await this.db!.runAsync(
      `UPDATE ${TABLE_NAME}
       SET status = ?, retry_count = 0, next_retry_at = NULL, error = NULL, error_code = NULL, updated_at = ?
       WHERE status = ?`,
      [SyncOperationStatus.PENDING, new Date().toISOString(), SyncOperationStatus.FAILED]
    );

    return result.changes;
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Gets queue statistics
   */
  async getStats(): Promise<QueueStats> {
    this.ensureInitialized();

    // Get counts by status
    const statusCounts = await this.db!.getAllAsync<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM ${TABLE_NAME} GROUP BY status`
    );

    // Get counts by priority
    const priorityCounts = await this.db!.getAllAsync<{ priority: number; count: number }>(
      `SELECT priority, COUNT(*) as count FROM ${TABLE_NAME} WHERE status = ? GROUP BY priority`,
      [SyncOperationStatus.PENDING]
    );

    // Get counts by type
    const typeCounts = await this.db!.getAllAsync<{ type: string; count: number }>(
      `SELECT type, COUNT(*) as count FROM ${TABLE_NAME} GROUP BY type`
    );

    // Get oldest pending
    const oldestPending = await this.db!.getFirstAsync<{ created_at: string }>(
      `SELECT created_at FROM ${TABLE_NAME} WHERE status = ? ORDER BY created_at ASC LIMIT 1`,
      [SyncOperationStatus.PENDING]
    );

    // Get last processed
    const lastProcessed = await this.db!.getFirstAsync<{ updated_at: string }>(
      `SELECT updated_at FROM ${TABLE_NAME} WHERE status = ? ORDER BY updated_at DESC LIMIT 1`,
      [SyncOperationStatus.COMPLETED]
    );

    const stats: QueueStats = {
      totalCount: 0,
      pendingCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      failedCount: 0,
      byPriority: {
        [SyncPriority.CRITICAL]: 0,
        [SyncPriority.HIGH]: 0,
        [SyncPriority.NORMAL]: 0,
        [SyncPriority.LOW]: 0,
      },
      byType: {},
      oldestPendingAt: oldestPending?.created_at || null,
      lastProcessedAt: lastProcessed?.updated_at || null,
    };

    for (const row of statusCounts) {
      stats.totalCount += row.count;
      switch (row.status) {
        case SyncOperationStatus.PENDING:
          stats.pendingCount = row.count;
          break;
        case SyncOperationStatus.IN_PROGRESS:
          stats.inProgressCount = row.count;
          break;
        case SyncOperationStatus.COMPLETED:
          stats.completedCount = row.count;
          break;
        case SyncOperationStatus.FAILED:
          stats.failedCount = row.count;
          break;
      }
    }

    for (const row of priorityCounts) {
      stats.byPriority[row.priority as SyncPriority] = row.count;
    }

    for (const row of typeCounts) {
      stats.byType[row.type] = row.count;
    }

    return stats;
  }

  /**
   * Gets the count of pending operations
   */
  async getPendingCount(): Promise<number> {
    this.ensureInitialized();

    const result = await this.db!.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE status = ?`,
      [SyncOperationStatus.PENDING]
    );

    return result?.count || 0;
  }

  /**
   * Gets the count of failed operations
   */
  async getFailedCount(): Promise<number> {
    this.ensureInitialized();

    const result = await this.db!.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE status = ?`,
      [SyncOperationStatus.FAILED]
    );

    return result?.count || 0;
  }

  // ============================================
  // Event Handling
  // ============================================

  /**
   * Adds an event listener
   */
  addEventListener(listener: QueueEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Removes an event listener
   */
  removeEventListener(listener: QueueEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emits an event to all listeners
   */
  private emit(
    event: QueueEventType,
    data?: SyncOperationBase | QueueStats
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (error) {
        logger.syncQueue.error('Error in queue event listener:', error);
      }
    }
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Converts a database row to a SyncOperationBase
   */
  private rowToOperation(row: SQLiteRow): SyncOperationBase {
    return {
      id: row.id,
      type: row.type as SyncOperationType,
      crudOperation: row.crud_operation as CrudOperation,
      priority: row.priority as SyncPriority,
      status: row.status as SyncOperationStatus,
      entityId: row.entity_id,
      entityType: row.entity_type,
      payload: deserializePayload(row.payload),
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastRetryAt: row.last_retry_at,
      nextRetryAt: row.next_retry_at,
      error: row.error,
      errorCode: row.error_code,
      metadata: deserializeMetadata(row.metadata),
    };
  }

  /**
   * Checks if the queue is currently processing
   */
  get processing(): boolean {
    return this.isProcessing;
  }

  /**
   * Checks if the queue is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Closes the database connection
   */
  async close(): Promise<void> {
    this.stopProcessing();
    if (this.processingPromise) {
      await this.processingPromise;
    }
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
    this.isInitialized = false;
  }
}

// ============================================
// SQLite Row Type
// ============================================

interface SQLiteRow {
  id: string;
  type: string;
  crud_operation: string;
  priority: number;
  status: string;
  entity_id: string;
  entity_type: string;
  payload: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  retry_count: number;
  max_retries: number;
  last_retry_at: string | null;
  next_retry_at: string | null;
  error: string | null;
  error_code: string | null;
  metadata: string;
}

// ============================================
// Singleton Instance
// ============================================

let syncQueueInstance: SyncQueue | null = null;

/**
 * Gets the singleton SyncQueue instance
 */
export function getSyncQueue(): SyncQueue {
  if (!syncQueueInstance) {
    syncQueueInstance = new SyncQueue();
  }
  return syncQueueInstance;
}

/**
 * Initializes and returns the singleton SyncQueue instance
 */
export async function initializeSyncQueue(): Promise<SyncQueue> {
  const queue = getSyncQueue();
  await queue.initialize();
  return queue;
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Adds an operation to the queue (convenience function)
 */
export async function queueOperation(
  input: SyncOperationInput
): Promise<SyncOperationBase> {
  const queue = await initializeSyncQueue();
  return queue.addOperation(input);
}

/**
 * Gets queue stats (convenience function)
 */
export async function getQueueStats(): Promise<QueueStats> {
  const queue = await initializeSyncQueue();
  return queue.getStats();
}
