/**
 * SQLite Database Schema for Offline-First Functionality
 *
 * This module defines the database schema for offline data storage,
 * including pending transactions, cached data, and sync queue management.
 */

// ============================================
// Table Definitions
// ============================================

/**
 * Schema version for migration tracking
 * Increment this when making schema changes
 */
export const SCHEMA_VERSION = 1;

/**
 * SQL statements to create all tables
 */
export const CREATE_TABLES = {
  /**
   * Pending Transactions Table
   * Stores transactions created offline that need to be synced
   */
  pending_transactions: `
    CREATE TABLE IF NOT EXISTS pending_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      wallet_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('PURCHASE', 'PAYMENT', 'REFUND', 'CANCEL')),
      stand_id TEXT,
      stand_name TEXT,
      description TEXT,
      product_items TEXT,
      idempotency_key TEXT UNIQUE NOT NULL,
      offline_signature TEXT NOT NULL,
      device_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_retry_at TEXT,
      error TEXT
    );
  `,

  /**
   * Cached Wallets Table
   * Stores wallet data for offline access
   */
  cached_wallets: `
    CREATE TABLE IF NOT EXISTS cached_wallets (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      currency_name TEXT NOT NULL DEFAULT 'Credits',
      exchange_rate REAL NOT NULL DEFAULT 1.0,
      qr_code TEXT,
      qr_expires_at TEXT,
      last_sync TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,

  /**
   * Cached Products Table
   * Stores product catalog for offline browsing and transactions
   */
  cached_products: `
    CREATE TABLE IF NOT EXISTS cached_products (
      id TEXT PRIMARY KEY NOT NULL,
      stand_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT,
      description TEXT,
      image_url TEXT,
      available INTEGER NOT NULL DEFAULT 1,
      stock_quantity INTEGER,
      sort_order INTEGER DEFAULT 0,
      last_sync TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (stand_id) REFERENCES cached_stands(id) ON DELETE CASCADE
    );
  `,

  /**
   * Cached Stands Table
   * Stores stand/vendor information for offline access
   */
  cached_stands: `
    CREATE TABLE IF NOT EXISTS cached_stands (
      id TEXT PRIMARY KEY NOT NULL,
      festival_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('FOOD', 'DRINK', 'MERCHANDISE', 'SERVICE', 'OTHER')),
      description TEXT,
      location_lat REAL,
      location_lng REAL,
      image_url TEXT,
      is_open INTEGER NOT NULL DEFAULT 1,
      opening_hours TEXT,
      last_sync TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,

  /**
   * Sync Queue Table
   * Generic queue for any data that needs to be synced
   */
  sync_queue: `
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL,
      last_attempt TEXT,
      next_attempt TEXT,
      error TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
    );
  `,

  /**
   * Schema Migrations Table
   * Tracks applied migrations for schema versioning
   */
  schema_migrations: `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `,

  /**
   * Cached Transactions Table
   * Stores transaction history for offline viewing
   */
  cached_transactions: `
    CREATE TABLE IF NOT EXISTS cached_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      wallet_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      reference TEXT,
      description TEXT,
      stand_id TEXT,
      stand_name TEXT,
      created_at TEXT NOT NULL,
      synced_at TEXT,
      FOREIGN KEY (wallet_id) REFERENCES cached_wallets(id) ON DELETE CASCADE
    );
  `,
};

/**
 * SQL statements to create indexes for better query performance
 */
export const CREATE_INDEXES = [
  // Pending transactions indexes
  `CREATE INDEX IF NOT EXISTS idx_pending_transactions_wallet_id ON pending_transactions(wallet_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pending_transactions_synced ON pending_transactions(synced);`,
  `CREATE INDEX IF NOT EXISTS idx_pending_transactions_created_at ON pending_transactions(created_at);`,

  // Cached wallets indexes
  `CREATE INDEX IF NOT EXISTS idx_cached_wallets_user_id ON cached_wallets(user_id);`,

  // Cached products indexes
  `CREATE INDEX IF NOT EXISTS idx_cached_products_stand_id ON cached_products(stand_id);`,
  `CREATE INDEX IF NOT EXISTS idx_cached_products_category ON cached_products(category);`,
  `CREATE INDEX IF NOT EXISTS idx_cached_products_available ON cached_products(available);`,

  // Cached stands indexes
  `CREATE INDEX IF NOT EXISTS idx_cached_stands_festival_id ON cached_stands(festival_id);`,
  `CREATE INDEX IF NOT EXISTS idx_cached_stands_type ON cached_stands(type);`,

  // Sync queue indexes
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_next_attempt ON sync_queue(next_attempt);`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);`,

  // Cached transactions indexes
  `CREATE INDEX IF NOT EXISTS idx_cached_transactions_wallet_id ON cached_transactions(wallet_id);`,
  `CREATE INDEX IF NOT EXISTS idx_cached_transactions_created_at ON cached_transactions(created_at);`,
];

// ============================================
// TypeScript Interfaces
// ============================================

/**
 * Pending transaction stored in SQLite
 */
export interface PendingTransactionRow {
  id: string;
  wallet_id: string;
  user_id: string;
  amount: number;
  type: 'PURCHASE' | 'PAYMENT' | 'REFUND' | 'CANCEL';
  stand_id: string | null;
  stand_name: string | null;
  description: string | null;
  product_items: string | null; // JSON string
  idempotency_key: string;
  offline_signature: string;
  device_id: string;
  created_at: string;
  synced: number; // 0 or 1
  retry_count: number;
  last_retry_at: string | null;
  error: string | null;
}

/**
 * Product item in a transaction
 */
export interface ProductItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

/**
 * Cached wallet stored in SQLite
 */
export interface CachedWalletRow {
  id: string;
  user_id: string;
  balance: number;
  currency_name: string;
  exchange_rate: number;
  qr_code: string | null;
  qr_expires_at: string | null;
  last_sync: string;
  created_at: string;
  updated_at: string;
}

/**
 * Cached product stored in SQLite
 */
export interface CachedProductRow {
  id: string;
  stand_id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  image_url: string | null;
  available: number; // 0 or 1
  stock_quantity: number | null;
  sort_order: number;
  last_sync: string;
  created_at: string;
  updated_at: string;
}

/**
 * Stand type enumeration
 */
export type StandType = 'FOOD' | 'DRINK' | 'MERCHANDISE' | 'SERVICE' | 'OTHER';

/**
 * Cached stand stored in SQLite
 */
export interface CachedStandRow {
  id: string;
  festival_id: string;
  name: string;
  type: StandType;
  description: string | null;
  location_lat: number | null;
  location_lng: number | null;
  image_url: string | null;
  is_open: number; // 0 or 1
  opening_hours: string | null; // JSON string
  last_sync: string;
  created_at: string;
  updated_at: string;
}

/**
 * Sync operation type
 */
export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Sync status type
 */
export type SyncStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Sync queue item stored in SQLite
 */
export interface SyncQueueRow {
  id: string;
  operation: SyncOperation;
  entity_type: string;
  entity_id: string;
  payload: string; // JSON string
  priority: number;
  retry_count: number;
  max_retries: number;
  created_at: string;
  last_attempt: string | null;
  next_attempt: string | null;
  error: string | null;
  status: SyncStatus;
}

/**
 * Schema migration record
 */
export interface SchemaMigrationRow {
  version: number;
  name: string;
  applied_at: string;
}

/**
 * Cached transaction stored in SQLite
 */
export interface CachedTransactionRow {
  id: string;
  wallet_id: string;
  type: string;
  amount: number;
  balance_after: number;
  reference: string | null;
  description: string | null;
  stand_id: string | null;
  stand_name: string | null;
  created_at: string;
  synced_at: string | null;
}

// ============================================
// Helper Types for Application Use
// ============================================

/**
 * Pending transaction for application use (parsed from row)
 */
export interface PendingTransaction {
  id: string;
  walletId: string;
  userId: string;
  amount: number;
  type: 'PURCHASE' | 'PAYMENT' | 'REFUND' | 'CANCEL';
  standId?: string;
  standName?: string;
  description?: string;
  productItems?: ProductItem[];
  idempotencyKey: string;
  offlineSignature: string;
  deviceId: string;
  createdAt: Date;
  synced: boolean;
  retryCount: number;
  lastRetryAt?: Date;
  error?: string;
}

/**
 * Cached wallet for application use
 */
export interface CachedWallet {
  id: string;
  userId: string;
  balance: number;
  currencyName: string;
  exchangeRate: number;
  qrCode?: string;
  qrExpiresAt?: Date;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cached product for application use
 */
export interface CachedProduct {
  id: string;
  standId: string;
  name: string;
  price: number;
  category?: string;
  description?: string;
  imageUrl?: string;
  available: boolean;
  stockQuantity?: number;
  sortOrder: number;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cached stand for application use
 */
export interface CachedStand {
  id: string;
  festivalId: string;
  name: string;
  type: StandType;
  description?: string;
  locationLat?: number;
  locationLng?: number;
  imageUrl?: string;
  isOpen: boolean;
  openingHours?: Record<string, string>;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sync queue item for application use
 */
export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  lastAttempt?: Date;
  nextAttempt?: Date;
  error?: string;
  status: SyncStatus;
}

/**
 * Cached transaction for application use
 */
export interface CachedTransaction {
  id: string;
  walletId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reference?: string;
  description?: string;
  standId?: string;
  standName?: string;
  createdAt: Date;
  syncedAt?: Date;
}

// ============================================
// Row Converters
// ============================================

/**
 * Convert database row to PendingTransaction
 */
export function rowToPendingTransaction(row: PendingTransactionRow): PendingTransaction {
  return {
    id: row.id,
    walletId: row.wallet_id,
    userId: row.user_id,
    amount: row.amount,
    type: row.type,
    standId: row.stand_id ?? undefined,
    standName: row.stand_name ?? undefined,
    description: row.description ?? undefined,
    productItems: row.product_items ? JSON.parse(row.product_items) : undefined,
    idempotencyKey: row.idempotency_key,
    offlineSignature: row.offline_signature,
    deviceId: row.device_id,
    createdAt: new Date(row.created_at),
    synced: row.synced === 1,
    retryCount: row.retry_count,
    lastRetryAt: row.last_retry_at ? new Date(row.last_retry_at) : undefined,
    error: row.error ?? undefined,
  };
}

/**
 * Convert database row to CachedWallet
 */
export function rowToCachedWallet(row: CachedWalletRow): CachedWallet {
  return {
    id: row.id,
    userId: row.user_id,
    balance: row.balance,
    currencyName: row.currency_name,
    exchangeRate: row.exchange_rate,
    qrCode: row.qr_code ?? undefined,
    qrExpiresAt: row.qr_expires_at ? new Date(row.qr_expires_at) : undefined,
    lastSync: new Date(row.last_sync),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Convert database row to CachedProduct
 */
export function rowToCachedProduct(row: CachedProductRow): CachedProduct {
  return {
    id: row.id,
    standId: row.stand_id,
    name: row.name,
    price: row.price,
    category: row.category ?? undefined,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    available: row.available === 1,
    stockQuantity: row.stock_quantity ?? undefined,
    sortOrder: row.sort_order,
    lastSync: new Date(row.last_sync),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Convert database row to CachedStand
 */
export function rowToCachedStand(row: CachedStandRow): CachedStand {
  return {
    id: row.id,
    festivalId: row.festival_id,
    name: row.name,
    type: row.type,
    description: row.description ?? undefined,
    locationLat: row.location_lat ?? undefined,
    locationLng: row.location_lng ?? undefined,
    imageUrl: row.image_url ?? undefined,
    isOpen: row.is_open === 1,
    openingHours: row.opening_hours ? JSON.parse(row.opening_hours) : undefined,
    lastSync: new Date(row.last_sync),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Convert database row to SyncQueueItem
 */
export function rowToSyncQueueItem(row: SyncQueueRow): SyncQueueItem {
  return {
    id: row.id,
    operation: row.operation,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: JSON.parse(row.payload),
    priority: row.priority,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    createdAt: new Date(row.created_at),
    lastAttempt: row.last_attempt ? new Date(row.last_attempt) : undefined,
    nextAttempt: row.next_attempt ? new Date(row.next_attempt) : undefined,
    error: row.error ?? undefined,
    status: row.status,
  };
}

/**
 * Convert database row to CachedTransaction
 */
export function rowToCachedTransaction(row: CachedTransactionRow): CachedTransaction {
  return {
    id: row.id,
    walletId: row.wallet_id,
    type: row.type,
    amount: row.amount,
    balanceAfter: row.balance_after,
    reference: row.reference ?? undefined,
    description: row.description ?? undefined,
    standId: row.stand_id ?? undefined,
    standName: row.stand_name ?? undefined,
    createdAt: new Date(row.created_at),
    syncedAt: row.synced_at ? new Date(row.synced_at) : undefined,
  };
}
