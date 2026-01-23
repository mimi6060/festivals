/**
 * Sync Module Exports - E4-S11
 *
 * Central export point for all sync-related functionality.
 * This is a CRITICAL component for offline-first functionality.
 *
 * Main entry points:
 * - SyncQueue: Priority-based sync queue with SQLite persistence
 * - useSyncQueue: React hook for components
 *
 * Usage:
 *
 * 1. Initialize at app start:
 *    ```
 *    import { initializeSyncQueue } from '@/lib/sync';
 *    const queue = await initializeSyncQueue();
 *    ```
 *
 * 2. Use in components:
 *    ```
 *    import { useSyncQueue } from '@/hooks/useSyncQueue';
 *    const { pendingCount, failedItems, retryOperation } = useSyncQueue();
 *    ```
 *
 * 3. Queue operations:
 *    ```
 *    import { queueOperation, SyncOperationType } from '@/lib/sync';
 *    await queueOperation({
 *      type: SyncOperationType.TRANSACTION_CREATE,
 *      crudOperation: 'CREATE',
 *      entityId: 'tx_123',
 *      payload: { amount: 100 },
 *    });
 *    ```
 */

// Operations
export {
  // Enums
  SyncOperationType,
  SyncPriority,
  SyncOperationStatus,
  // Types
  type CrudOperation,
  type SyncOperationBase,
  type SyncOperationMetadata,
  type SyncOperationResult,
  type ConflictInfo,
  type ConflictType,
  type ConflictResolutionStrategy,
  // Functions
  serializeOperation,
  deserializeOperation,
  serializePayload,
  deserializePayload,
  serializeMetadata,
  deserializeMetadata,
  detectConflict,
  operationsConflict,
  resolveConflict,
  getPriorityForType,
  getEntityTypeForOperation,
  isRetryableOperation,
  getMaxRetriesForType,
  createOperationId,
  createIdempotencyKey,
} from './operations';

// Retry
export {
  // Enums
  ErrorCategory,
  // Types
  type ParsedError,
  type RetryPolicy,
  // Constants
  DEFAULT_RETRY_POLICY,
  CRITICAL_RETRY_POLICY,
  CONSERVATIVE_RETRY_POLICY,
  // Functions
  calculateBackoff,
  calculateNextRetryTime,
  getRetrySchedule,
  parseError,
  shouldRetry,
  isNetworkError,
  isServerError,
  isTimeoutError,
  isAuthenticationError,
  isRateLimitError,
  isConflictError,
  delay,
  withRetry,
  getTotalRetryTime,
} from './retry';

// Queue
export {
  // Class
  SyncQueue,
  // Types
  type SyncOperationInput,
  type QueueStats,
  type SyncHandler,
  type QueueEventType,
  type QueueEventListener,
  // Functions
  getSyncQueue,
  initializeSyncQueue,
  queueOperation,
  getQueueStats,
} from './queue';
