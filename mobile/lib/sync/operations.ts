/**
 * Sync Operation Types and Helpers
 *
 * Defines the types of operations that can be queued for synchronization,
 * along with serialization/deserialization and conflict detection utilities.
 */

// ============================================
// Operation Types
// ============================================

/**
 * Types of sync operations supported by the queue
 */
export enum SyncOperationType {
  // Transaction operations
  TRANSACTION_CREATE = 'TRANSACTION_CREATE',
  TRANSACTION_CANCEL = 'TRANSACTION_CANCEL',

  // Wallet operations
  WALLET_UPDATE = 'WALLET_UPDATE',
  WALLET_TOPUP = 'WALLET_TOPUP',
  WALLET_REFUND = 'WALLET_REFUND',

  // User operations
  USER_PROFILE_UPDATE = 'USER_PROFILE_UPDATE',
  USER_PREFERENCES_UPDATE = 'USER_PREFERENCES_UPDATE',

  // Ticket operations
  TICKET_TRANSFER = 'TICKET_TRANSFER',
  TICKET_VALIDATE = 'TICKET_VALIDATE',

  // NFC operations
  NFC_LINK = 'NFC_LINK',
  NFC_UNLINK = 'NFC_UNLINK',
  NFC_PAYMENT = 'NFC_PAYMENT',

  // Favorites operations
  FAVORITE_ADD = 'FAVORITE_ADD',
  FAVORITE_REMOVE = 'FAVORITE_REMOVE',

  // Social operations
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  FRIEND_ACCEPT = 'FRIEND_ACCEPT',
  FRIEND_REJECT = 'FRIEND_REJECT',
  LOCATION_SHARE = 'LOCATION_SHARE',

  // Notification operations
  NOTIFICATION_READ = 'NOTIFICATION_READ',
  PUSH_TOKEN_REGISTER = 'PUSH_TOKEN_REGISTER',
}

/**
 * CRUD operation types
 */
export type CrudOperation = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Priority levels for sync operations
 * Higher priority operations are processed first
 */
export enum SyncPriority {
  CRITICAL = 0, // Financial transactions, must sync ASAP
  HIGH = 1, // Important user actions
  NORMAL = 2, // Regular operations
  LOW = 3, // Background sync, can wait
}

/**
 * Status of a sync operation
 */
export enum SyncOperationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// ============================================
// Operation Interfaces
// ============================================

/**
 * Base interface for all sync operations
 */
export interface SyncOperationBase {
  id: string;
  type: SyncOperationType;
  crudOperation: CrudOperation;
  priority: SyncPriority;
  status: SyncOperationStatus;
  entityId: string;
  entityType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  maxRetries: number;
  lastRetryAt: string | null;
  nextRetryAt: string | null;
  error: string | null;
  errorCode: string | null;
  metadata: SyncOperationMetadata;
}

/**
 * Metadata associated with a sync operation
 */
export interface SyncOperationMetadata {
  deviceId: string;
  userId: string;
  festivalId?: string;
  sessionId?: string;
  offlineSignature?: string;
  conflictResolution?: ConflictResolutionStrategy;
  dependsOn?: string[]; // IDs of operations this one depends on
  version?: number; // For optimistic locking
}

/**
 * Conflict resolution strategies
 */
export type ConflictResolutionStrategy =
  | 'CLIENT_WINS'
  | 'SERVER_WINS'
  | 'LATEST_WINS'
  | 'MERGE'
  | 'MANUAL';

/**
 * Result of a sync operation attempt
 */
export interface SyncOperationResult {
  success: boolean;
  operationId: string;
  serverResponse?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  conflict?: ConflictInfo;
}

/**
 * Information about a detected conflict
 */
export interface ConflictInfo {
  type: ConflictType;
  serverVersion: Record<string, unknown>;
  clientVersion: Record<string, unknown>;
  suggestedResolution: ConflictResolutionStrategy;
}

/**
 * Types of conflicts that can occur
 */
export type ConflictType =
  | 'VERSION_MISMATCH'
  | 'CONCURRENT_MODIFICATION'
  | 'DELETED_ON_SERVER'
  | 'DUPLICATE_ENTITY'
  | 'CONSTRAINT_VIOLATION';

// ============================================
// Serialization / Deserialization
// ============================================

/**
 * Serializes a sync operation for SQLite storage
 */
export function serializeOperation(operation: SyncOperationBase): string {
  return JSON.stringify({
    ...operation,
    payload: operation.payload,
    metadata: operation.metadata,
  });
}

/**
 * Deserializes a sync operation from SQLite storage
 */
export function deserializeOperation(data: string): SyncOperationBase {
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    payload: parsed.payload || {},
    metadata: parsed.metadata || {},
  };
}

/**
 * Serializes just the payload of an operation
 */
export function serializePayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

/**
 * Deserializes a payload string
 */
export function deserializePayload(data: string): Record<string, unknown> {
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Serializes metadata for storage
 */
export function serializeMetadata(metadata: SyncOperationMetadata): string {
  return JSON.stringify(metadata);
}

/**
 * Deserializes metadata from storage
 */
export function deserializeMetadata(data: string): SyncOperationMetadata {
  try {
    return JSON.parse(data);
  } catch {
    return { deviceId: '', userId: '' };
  }
}

// ============================================
// Conflict Detection
// ============================================

/**
 * Detects if there's a conflict between a local and server operation
 */
export function detectConflict(
  localOperation: SyncOperationBase,
  serverState: Record<string, unknown> | null
): ConflictInfo | null {
  // If server state doesn't exist and we're updating, conflict
  if (!serverState && localOperation.crudOperation === 'UPDATE') {
    return {
      type: 'DELETED_ON_SERVER',
      serverVersion: {},
      clientVersion: localOperation.payload,
      suggestedResolution: 'CLIENT_WINS',
    };
  }

  // If server state doesn't exist and we're creating, check for duplicates
  if (!serverState && localOperation.crudOperation === 'CREATE') {
    return null; // No conflict, can create
  }

  if (!serverState) {
    return null;
  }

  // Check version mismatch (optimistic locking)
  const serverVersion = serverState['version'] as number | undefined;
  const clientVersion = localOperation.metadata.version;

  if (
    serverVersion !== undefined &&
    clientVersion !== undefined &&
    serverVersion !== clientVersion
  ) {
    return {
      type: 'VERSION_MISMATCH',
      serverVersion: serverState,
      clientVersion: localOperation.payload,
      suggestedResolution: 'LATEST_WINS',
    };
  }

  // Check for concurrent modification based on timestamps
  const serverUpdatedAt = serverState['updatedAt'] as string | undefined;
  const clientCreatedAt = localOperation.createdAt;

  if (serverUpdatedAt && new Date(serverUpdatedAt) > new Date(clientCreatedAt)) {
    return {
      type: 'CONCURRENT_MODIFICATION',
      serverVersion: serverState,
      clientVersion: localOperation.payload,
      suggestedResolution: 'LATEST_WINS',
    };
  }

  return null; // No conflict detected
}

/**
 * Checks if two operations conflict with each other
 */
export function operationsConflict(
  op1: SyncOperationBase,
  op2: SyncOperationBase
): boolean {
  // Same entity and type
  if (op1.entityId === op2.entityId && op1.entityType === op2.entityType) {
    // DELETE conflicts with UPDATE
    if (
      (op1.crudOperation === 'DELETE' && op2.crudOperation === 'UPDATE') ||
      (op1.crudOperation === 'UPDATE' && op2.crudOperation === 'DELETE')
    ) {
      return true;
    }

    // Multiple UPDATEs on same entity may conflict
    if (op1.crudOperation === 'UPDATE' && op2.crudOperation === 'UPDATE') {
      // Check if they modify the same fields
      const op1Fields = Object.keys(op1.payload);
      const op2Fields = Object.keys(op2.payload);
      return op1Fields.some((field) => op2Fields.includes(field));
    }
  }

  return false;
}

/**
 * Resolves a conflict based on the specified strategy
 */
export function resolveConflict(
  conflict: ConflictInfo,
  strategy: ConflictResolutionStrategy
): Record<string, unknown> {
  switch (strategy) {
    case 'CLIENT_WINS':
      return conflict.clientVersion;

    case 'SERVER_WINS':
      return conflict.serverVersion;

    case 'LATEST_WINS': {
      const serverTime = conflict.serverVersion['updatedAt'] as string | undefined;
      const clientTime = conflict.clientVersion['updatedAt'] as string | undefined;

      if (!serverTime) return conflict.clientVersion;
      if (!clientTime) return conflict.serverVersion;

      return new Date(serverTime) > new Date(clientTime)
        ? conflict.serverVersion
        : conflict.clientVersion;
    }

    case 'MERGE': {
      // Simple merge: client values override server values
      return {
        ...conflict.serverVersion,
        ...conflict.clientVersion,
        updatedAt: new Date().toISOString(),
      };
    }

    case 'MANUAL':
      // Return server version and let the user decide
      return conflict.serverVersion;

    default:
      return conflict.serverVersion;
  }
}

// ============================================
// Operation Helpers
// ============================================

/**
 * Gets the priority for a given operation type
 */
export function getPriorityForType(type: SyncOperationType): SyncPriority {
  switch (type) {
    // Critical priority for financial operations
    case SyncOperationType.TRANSACTION_CREATE:
    case SyncOperationType.WALLET_TOPUP:
    case SyncOperationType.NFC_PAYMENT:
      return SyncPriority.CRITICAL;

    // High priority for important user actions
    case SyncOperationType.TRANSACTION_CANCEL:
    case SyncOperationType.WALLET_REFUND:
    case SyncOperationType.TICKET_TRANSFER:
    case SyncOperationType.TICKET_VALIDATE:
    case SyncOperationType.NFC_LINK:
    case SyncOperationType.NFC_UNLINK:
      return SyncPriority.HIGH;

    // Normal priority for regular operations
    case SyncOperationType.WALLET_UPDATE:
    case SyncOperationType.USER_PROFILE_UPDATE:
    case SyncOperationType.FRIEND_REQUEST:
    case SyncOperationType.FRIEND_ACCEPT:
    case SyncOperationType.FRIEND_REJECT:
    case SyncOperationType.FAVORITE_ADD:
    case SyncOperationType.FAVORITE_REMOVE:
      return SyncPriority.NORMAL;

    // Low priority for background operations
    case SyncOperationType.USER_PREFERENCES_UPDATE:
    case SyncOperationType.LOCATION_SHARE:
    case SyncOperationType.NOTIFICATION_READ:
    case SyncOperationType.PUSH_TOKEN_REGISTER:
      return SyncPriority.LOW;

    default:
      return SyncPriority.NORMAL;
  }
}

/**
 * Gets the entity type for a given operation type
 */
export function getEntityTypeForOperation(type: SyncOperationType): string {
  switch (type) {
    case SyncOperationType.TRANSACTION_CREATE:
    case SyncOperationType.TRANSACTION_CANCEL:
      return 'transaction';

    case SyncOperationType.WALLET_UPDATE:
    case SyncOperationType.WALLET_TOPUP:
    case SyncOperationType.WALLET_REFUND:
      return 'wallet';

    case SyncOperationType.USER_PROFILE_UPDATE:
    case SyncOperationType.USER_PREFERENCES_UPDATE:
      return 'user';

    case SyncOperationType.TICKET_TRANSFER:
    case SyncOperationType.TICKET_VALIDATE:
      return 'ticket';

    case SyncOperationType.NFC_LINK:
    case SyncOperationType.NFC_UNLINK:
    case SyncOperationType.NFC_PAYMENT:
      return 'nfc';

    case SyncOperationType.FAVORITE_ADD:
    case SyncOperationType.FAVORITE_REMOVE:
      return 'favorite';

    case SyncOperationType.FRIEND_REQUEST:
    case SyncOperationType.FRIEND_ACCEPT:
    case SyncOperationType.FRIEND_REJECT:
    case SyncOperationType.LOCATION_SHARE:
      return 'social';

    case SyncOperationType.NOTIFICATION_READ:
    case SyncOperationType.PUSH_TOKEN_REGISTER:
      return 'notification';

    default:
      return 'unknown';
  }
}

/**
 * Determines if an operation can be retried
 */
export function isRetryableOperation(type: SyncOperationType): boolean {
  // All operations are retryable by default
  // Some operations might be explicitly non-retryable in the future
  return true;
}

/**
 * Gets the maximum number of retries for an operation type
 */
export function getMaxRetriesForType(type: SyncOperationType): number {
  switch (type) {
    // Critical operations get more retries
    case SyncOperationType.TRANSACTION_CREATE:
    case SyncOperationType.WALLET_TOPUP:
    case SyncOperationType.NFC_PAYMENT:
      return 10;

    // High priority operations
    case SyncOperationType.TRANSACTION_CANCEL:
    case SyncOperationType.WALLET_REFUND:
    case SyncOperationType.TICKET_TRANSFER:
    case SyncOperationType.TICKET_VALIDATE:
      return 7;

    // Normal operations
    default:
      return 5;
  }
}

/**
 * Creates an operation ID
 */
export function createOperationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `op_${timestamp}_${random}`;
}

/**
 * Creates an idempotency key for an operation
 */
export function createIdempotencyKey(
  type: SyncOperationType,
  entityId: string,
  userId: string
): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${type}_${entityId}_${userId}_${timestamp}_${random}`;
}
