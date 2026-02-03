/**
 * SQLite Database Initialization and CRUD Helpers
 *
 * This module provides database initialization, connection management,
 * and CRUD operations for all offline data tables.
 */

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { runMigrations, needsMigration, getCurrentVersion } from './migrations';
import {
  PendingTransactionRow,
  CachedWalletRow,
  CachedProductRow,
  CachedStandRow,
  SyncQueueRow,
  CachedTransactionRow,
  PendingTransaction,
  CachedWallet,
  CachedProduct,
  CachedStand,
  SyncQueueItem,
  CachedTransaction,
  ProductItem,
  StandType,
  SyncOperation,
  SyncStatus,
  rowToPendingTransaction,
  rowToCachedWallet,
  rowToCachedProduct,
  rowToCachedStand,
  rowToSyncQueueItem,
  rowToCachedTransaction,
} from './schema';

// ============================================
// Database Configuration
// ============================================

const DATABASE_NAME = 'festivals_offline.db';

// Singleton database instance
let dbInstance: SQLite.SQLiteDatabase | null = null;

// ============================================
// Database Initialization
// ============================================

/**
 * Opens and initializes the database connection
 * Creates tables and runs migrations if needed
 */
export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    console.log('[Database] Opening database...');
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Check and run migrations
    if (await needsMigration(db)) {
      console.log('[Database] Running migrations...');
      const result = await runMigrations(db);

      if (!result.success) {
        throw new Error(`Migration failed: ${result.error}`);
      }

      console.log(`[Database] Applied ${result.appliedMigrations.length} migration(s)`);
    }

    const version = await getCurrentVersion(db);
    console.log(`[Database] Database ready at version ${version}`);

    dbInstance = db;
    return db;
  } catch (error) {
    console.error('[Database] Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Gets the database instance, initializing if necessary
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    return await initializeDatabase();
  }
  return dbInstance;
}

/**
 * Closes the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    console.log('[Database] Database closed');
  }
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return Crypto.randomUUID();
}

/**
 * Gets the current ISO timestamp
 */
function now(): string {
  return new Date().toISOString();
}

// ============================================
// Pending Transactions CRUD
// ============================================

/**
 * Input for creating a pending transaction
 */
export interface CreatePendingTransactionInput {
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
}

/**
 * Creates a new pending transaction
 */
export async function createPendingTransaction(
  input: CreatePendingTransactionInput
): Promise<PendingTransaction> {
  const db = await getDatabase();
  const id = generateId();
  const createdAt = now();

  await db.runAsync(
    `INSERT INTO pending_transactions (
      id, wallet_id, user_id, amount, type, stand_id, stand_name, description,
      product_items, idempotency_key, offline_signature, device_id, created_at, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    [
      id,
      input.walletId,
      input.userId,
      input.amount,
      input.type,
      input.standId ?? null,
      input.standName ?? null,
      input.description ?? null,
      input.productItems ? JSON.stringify(input.productItems) : null,
      input.idempotencyKey,
      input.offlineSignature,
      input.deviceId,
      createdAt,
    ]
  );

  const row = await db.getFirstAsync<PendingTransactionRow>(
    `SELECT * FROM pending_transactions WHERE id = ?;`,
    [id]
  );

  if (!row) {
    throw new Error('Failed to create pending transaction');
  }

  return rowToPendingTransaction(row);
}

/**
 * Gets a pending transaction by ID
 */
export async function getPendingTransaction(id: string): Promise<PendingTransaction | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PendingTransactionRow>(
    `SELECT * FROM pending_transactions WHERE id = ?;`,
    [id]
  );

  return row ? rowToPendingTransaction(row) : null;
}

/**
 * Gets all pending transactions (not synced)
 */
export async function getAllPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PendingTransactionRow>(
    `SELECT * FROM pending_transactions WHERE synced = 0 ORDER BY created_at ASC;`
  );

  return rows.map(rowToPendingTransaction);
}

/**
 * Gets pending transactions for a specific wallet
 */
export async function getPendingTransactionsByWallet(
  walletId: string
): Promise<PendingTransaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PendingTransactionRow>(
    `SELECT * FROM pending_transactions WHERE wallet_id = ? AND synced = 0 ORDER BY created_at ASC;`,
    [walletId]
  );

  return rows.map(rowToPendingTransaction);
}

/**
 * Marks a pending transaction as synced
 */
export async function markTransactionSynced(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE pending_transactions SET synced = 1 WHERE id = ?;`,
    [id]
  );
}

/**
 * Updates retry info for a pending transaction
 */
export async function updateTransactionRetry(
  id: string,
  error?: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE pending_transactions SET retry_count = retry_count + 1, last_retry_at = ?, error = ? WHERE id = ?;`,
    [now(), error ?? null, id]
  );
}

/**
 * Deletes a pending transaction
 */
export async function deletePendingTransaction(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM pending_transactions WHERE id = ?;`, [id]);
}

/**
 * Deletes all synced pending transactions
 */
export async function deleteSyncedTransactions(): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `DELETE FROM pending_transactions WHERE synced = 1;`
  );
  return result.changes;
}

/**
 * Gets count of pending transactions
 */
export async function getPendingTransactionCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_transactions WHERE synced = 0;`
  );
  return result?.count ?? 0;
}

// ============================================
// Cached Wallets CRUD
// ============================================

/**
 * Input for creating/updating a cached wallet
 */
export interface UpsertCachedWalletInput {
  id: string;
  userId: string;
  balance: number;
  currencyName?: string;
  exchangeRate?: number;
  qrCode?: string;
  qrExpiresAt?: Date;
}

/**
 * Creates or updates a cached wallet
 */
export async function upsertCachedWallet(input: UpsertCachedWalletInput): Promise<CachedWallet> {
  const db = await getDatabase();
  const timestamp = now();

  await db.runAsync(
    `INSERT INTO cached_wallets (
      id, user_id, balance, currency_name, exchange_rate, qr_code, qr_expires_at,
      last_sync, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      balance = excluded.balance,
      currency_name = COALESCE(excluded.currency_name, currency_name),
      exchange_rate = COALESCE(excluded.exchange_rate, exchange_rate),
      qr_code = excluded.qr_code,
      qr_expires_at = excluded.qr_expires_at,
      last_sync = excluded.last_sync,
      updated_at = excluded.updated_at;`,
    [
      input.id,
      input.userId,
      input.balance,
      input.currencyName ?? 'Credits',
      input.exchangeRate ?? 1.0,
      input.qrCode ?? null,
      input.qrExpiresAt?.toISOString() ?? null,
      timestamp,
      timestamp,
      timestamp,
    ]
  );

  const row = await db.getFirstAsync<CachedWalletRow>(
    `SELECT * FROM cached_wallets WHERE id = ?;`,
    [input.id]
  );

  if (!row) {
    throw new Error('Failed to upsert cached wallet');
  }

  return rowToCachedWallet(row);
}

/**
 * Gets a cached wallet by ID
 */
export async function getCachedWallet(id: string): Promise<CachedWallet | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CachedWalletRow>(
    `SELECT * FROM cached_wallets WHERE id = ?;`,
    [id]
  );

  return row ? rowToCachedWallet(row) : null;
}

/**
 * Gets a cached wallet by user ID
 */
export async function getCachedWalletByUser(userId: string): Promise<CachedWallet | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CachedWalletRow>(
    `SELECT * FROM cached_wallets WHERE user_id = ?;`,
    [userId]
  );

  return row ? rowToCachedWallet(row) : null;
}

/**
 * Updates wallet balance locally (for offline transactions)
 */
export async function updateWalletBalance(id: string, newBalance: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE cached_wallets SET balance = ?, updated_at = ? WHERE id = ?;`,
    [newBalance, now(), id]
  );
}

/**
 * Deletes a cached wallet
 */
export async function deleteCachedWallet(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM cached_wallets WHERE id = ?;`, [id]);
}

// ============================================
// Cached Products CRUD
// ============================================

/**
 * Input for creating/updating a cached product
 */
export interface UpsertCachedProductInput {
  id: string;
  standId: string;
  name: string;
  price: number;
  category?: string;
  description?: string;
  imageUrl?: string;
  available?: boolean;
  stockQuantity?: number;
  sortOrder?: number;
}

/**
 * Creates or updates a cached product
 */
export async function upsertCachedProduct(input: UpsertCachedProductInput): Promise<CachedProduct> {
  const db = await getDatabase();
  const timestamp = now();

  await db.runAsync(
    `INSERT INTO cached_products (
      id, stand_id, name, price, category, description, image_url,
      available, stock_quantity, sort_order, last_sync, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      stand_id = excluded.stand_id,
      name = excluded.name,
      price = excluded.price,
      category = excluded.category,
      description = excluded.description,
      image_url = excluded.image_url,
      available = excluded.available,
      stock_quantity = excluded.stock_quantity,
      sort_order = excluded.sort_order,
      last_sync = excluded.last_sync,
      updated_at = excluded.updated_at;`,
    [
      input.id,
      input.standId,
      input.name,
      input.price,
      input.category ?? null,
      input.description ?? null,
      input.imageUrl ?? null,
      input.available !== false ? 1 : 0,
      input.stockQuantity ?? null,
      input.sortOrder ?? 0,
      timestamp,
      timestamp,
      timestamp,
    ]
  );

  const row = await db.getFirstAsync<CachedProductRow>(
    `SELECT * FROM cached_products WHERE id = ?;`,
    [input.id]
  );

  if (!row) {
    throw new Error('Failed to upsert cached product');
  }

  return rowToCachedProduct(row);
}

/**
 * Batch upsert products
 */
export async function upsertCachedProducts(
  products: UpsertCachedProductInput[]
): Promise<void> {
  const db = await getDatabase();
  const timestamp = now();

  await db.withTransactionAsync(async () => {
    for (const input of products) {
      await db.runAsync(
        `INSERT INTO cached_products (
          id, stand_id, name, price, category, description, image_url,
          available, stock_quantity, sort_order, last_sync, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          stand_id = excluded.stand_id,
          name = excluded.name,
          price = excluded.price,
          category = excluded.category,
          description = excluded.description,
          image_url = excluded.image_url,
          available = excluded.available,
          stock_quantity = excluded.stock_quantity,
          sort_order = excluded.sort_order,
          last_sync = excluded.last_sync,
          updated_at = excluded.updated_at;`,
        [
          input.id,
          input.standId,
          input.name,
          input.price,
          input.category ?? null,
          input.description ?? null,
          input.imageUrl ?? null,
          input.available !== false ? 1 : 0,
          input.stockQuantity ?? null,
          input.sortOrder ?? 0,
          timestamp,
          timestamp,
          timestamp,
        ]
      );
    }
  });
}

/**
 * Gets a cached product by ID
 */
export async function getCachedProduct(id: string): Promise<CachedProduct | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CachedProductRow>(
    `SELECT * FROM cached_products WHERE id = ?;`,
    [id]
  );

  return row ? rowToCachedProduct(row) : null;
}

/**
 * Gets all products for a stand
 */
export async function getCachedProductsByStand(standId: string): Promise<CachedProduct[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CachedProductRow>(
    `SELECT * FROM cached_products WHERE stand_id = ? ORDER BY sort_order ASC, name ASC;`,
    [standId]
  );

  return rows.map(rowToCachedProduct);
}

/**
 * Gets available products for a stand
 */
export async function getAvailableProductsByStand(standId: string): Promise<CachedProduct[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CachedProductRow>(
    `SELECT * FROM cached_products WHERE stand_id = ? AND available = 1 ORDER BY sort_order ASC, name ASC;`,
    [standId]
  );

  return rows.map(rowToCachedProduct);
}

/**
 * Gets products by category
 */
export async function getCachedProductsByCategory(category: string): Promise<CachedProduct[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CachedProductRow>(
    `SELECT * FROM cached_products WHERE category = ? ORDER BY sort_order ASC, name ASC;`,
    [category]
  );

  return rows.map(rowToCachedProduct);
}

/**
 * Deletes a cached product
 */
export async function deleteCachedProduct(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM cached_products WHERE id = ?;`, [id]);
}

/**
 * Deletes all products for a stand
 */
export async function deleteCachedProductsByStand(standId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM cached_products WHERE stand_id = ?;`, [standId]);
}

// ============================================
// Cached Stands CRUD
// ============================================

/**
 * Input for creating/updating a cached stand
 */
export interface UpsertCachedStandInput {
  id: string;
  festivalId: string;
  name: string;
  type: StandType;
  description?: string;
  locationLat?: number;
  locationLng?: number;
  imageUrl?: string;
  isOpen?: boolean;
  openingHours?: Record<string, string>;
}

/**
 * Creates or updates a cached stand
 */
export async function upsertCachedStand(input: UpsertCachedStandInput): Promise<CachedStand> {
  const db = await getDatabase();
  const timestamp = now();

  await db.runAsync(
    `INSERT INTO cached_stands (
      id, festival_id, name, type, description, location_lat, location_lng,
      image_url, is_open, opening_hours, last_sync, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      festival_id = excluded.festival_id,
      name = excluded.name,
      type = excluded.type,
      description = excluded.description,
      location_lat = excluded.location_lat,
      location_lng = excluded.location_lng,
      image_url = excluded.image_url,
      is_open = excluded.is_open,
      opening_hours = excluded.opening_hours,
      last_sync = excluded.last_sync,
      updated_at = excluded.updated_at;`,
    [
      input.id,
      input.festivalId,
      input.name,
      input.type,
      input.description ?? null,
      input.locationLat ?? null,
      input.locationLng ?? null,
      input.imageUrl ?? null,
      input.isOpen !== false ? 1 : 0,
      input.openingHours ? JSON.stringify(input.openingHours) : null,
      timestamp,
      timestamp,
      timestamp,
    ]
  );

  const row = await db.getFirstAsync<CachedStandRow>(
    `SELECT * FROM cached_stands WHERE id = ?;`,
    [input.id]
  );

  if (!row) {
    throw new Error('Failed to upsert cached stand');
  }

  return rowToCachedStand(row);
}

/**
 * Batch upsert stands
 */
export async function upsertCachedStands(stands: UpsertCachedStandInput[]): Promise<void> {
  const db = await getDatabase();
  const timestamp = now();

  await db.withTransactionAsync(async () => {
    for (const input of stands) {
      await db.runAsync(
        `INSERT INTO cached_stands (
          id, festival_id, name, type, description, location_lat, location_lng,
          image_url, is_open, opening_hours, last_sync, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          festival_id = excluded.festival_id,
          name = excluded.name,
          type = excluded.type,
          description = excluded.description,
          location_lat = excluded.location_lat,
          location_lng = excluded.location_lng,
          image_url = excluded.image_url,
          is_open = excluded.is_open,
          opening_hours = excluded.opening_hours,
          last_sync = excluded.last_sync,
          updated_at = excluded.updated_at;`,
        [
          input.id,
          input.festivalId,
          input.name,
          input.type,
          input.description ?? null,
          input.locationLat ?? null,
          input.locationLng ?? null,
          input.imageUrl ?? null,
          input.isOpen !== false ? 1 : 0,
          input.openingHours ? JSON.stringify(input.openingHours) : null,
          timestamp,
          timestamp,
          timestamp,
        ]
      );
    }
  });
}

/**
 * Gets a cached stand by ID
 */
export async function getCachedStand(id: string): Promise<CachedStand | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CachedStandRow>(
    `SELECT * FROM cached_stands WHERE id = ?;`,
    [id]
  );

  return row ? rowToCachedStand(row) : null;
}

/**
 * Gets all stands for a festival
 */
export async function getCachedStandsByFestival(festivalId: string): Promise<CachedStand[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CachedStandRow>(
    `SELECT * FROM cached_stands WHERE festival_id = ? ORDER BY name ASC;`,
    [festivalId]
  );

  return rows.map(rowToCachedStand);
}

/**
 * Gets stands by type
 */
export async function getCachedStandsByType(
  festivalId: string,
  type: StandType
): Promise<CachedStand[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CachedStandRow>(
    `SELECT * FROM cached_stands WHERE festival_id = ? AND type = ? ORDER BY name ASC;`,
    [festivalId, type]
  );

  return rows.map(rowToCachedStand);
}

/**
 * Gets open stands
 */
export async function getOpenStands(festivalId: string): Promise<CachedStand[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CachedStandRow>(
    `SELECT * FROM cached_stands WHERE festival_id = ? AND is_open = 1 ORDER BY name ASC;`,
    [festivalId]
  );

  return rows.map(rowToCachedStand);
}

/**
 * Deletes a cached stand
 */
export async function deleteCachedStand(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM cached_stands WHERE id = ?;`, [id]);
}

// ============================================
// Sync Queue CRUD
// ============================================

/**
 * Input for creating a sync queue item
 */
export interface CreateSyncQueueItemInput {
  operation: SyncOperation;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  priority?: number;
  maxRetries?: number;
}

/**
 * Creates a sync queue item
 */
export async function createSyncQueueItem(
  input: CreateSyncQueueItemInput
): Promise<SyncQueueItem> {
  const db = await getDatabase();
  const id = generateId();
  const createdAt = now();

  await db.runAsync(
    `INSERT INTO sync_queue (
      id, operation, entity_type, entity_id, payload, priority, max_retries, created_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
    [
      id,
      input.operation,
      input.entityType,
      input.entityId,
      JSON.stringify(input.payload),
      input.priority ?? 0,
      input.maxRetries ?? 3,
      createdAt,
    ]
  );

  const row = await db.getFirstAsync<SyncQueueRow>(
    `SELECT * FROM sync_queue WHERE id = ?;`,
    [id]
  );

  if (!row) {
    throw new Error('Failed to create sync queue item');
  }

  return rowToSyncQueueItem(row);
}

/**
 * Gets pending sync queue items
 */
export async function getPendingSyncItems(limit = 10): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SyncQueueRow>(
    `SELECT * FROM sync_queue
     WHERE status = 'pending' AND (next_attempt IS NULL OR next_attempt <= ?)
     ORDER BY priority DESC, created_at ASC
     LIMIT ?;`,
    [now(), limit]
  );

  return rows.map(rowToSyncQueueItem);
}

/**
 * Gets sync queue item by ID
 */
export async function getSyncQueueItem(id: string): Promise<SyncQueueItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SyncQueueRow>(
    `SELECT * FROM sync_queue WHERE id = ?;`,
    [id]
  );

  return row ? rowToSyncQueueItem(row) : null;
}

/**
 * Updates sync queue item status
 */
export async function updateSyncQueueItemStatus(
  id: string,
  status: SyncStatus,
  error?: string
): Promise<void> {
  const db = await getDatabase();

  if (status === 'failed' || status === 'processing') {
    // Calculate next retry time with exponential backoff
    const item = await getSyncQueueItem(id);
    if (item) {
      const backoffMs = Math.pow(2, item.retryCount) * 1000; // Exponential backoff
      const nextAttempt = new Date(Date.now() + backoffMs).toISOString();

      await db.runAsync(
        `UPDATE sync_queue SET
          status = ?,
          retry_count = retry_count + 1,
          last_attempt = ?,
          next_attempt = ?,
          error = ?
        WHERE id = ?;`,
        [status === 'processing' ? 'pending' : status, now(), nextAttempt, error ?? null, id]
      );
    }
  } else {
    await db.runAsync(
      `UPDATE sync_queue SET status = ?, last_attempt = ?, error = ? WHERE id = ?;`,
      [status, now(), error ?? null, id]
    );
  }
}

/**
 * Marks sync queue item as completed
 */
export async function completeSyncQueueItem(id: string): Promise<void> {
  await updateSyncQueueItemStatus(id, 'completed');
}

/**
 * Marks sync queue item as failed
 */
export async function failSyncQueueItem(id: string, error: string): Promise<void> {
  const db = await getDatabase();
  const item = await getSyncQueueItem(id);

  if (item && item.retryCount >= item.maxRetries) {
    await updateSyncQueueItemStatus(id, 'failed', error);
  } else {
    await updateSyncQueueItemStatus(id, 'processing', error);
  }
}

/**
 * Deletes a sync queue item
 */
export async function deleteSyncQueueItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?;`, [id]);
}

/**
 * Deletes completed sync queue items
 */
export async function deleteCompletedSyncItems(): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `DELETE FROM sync_queue WHERE status = 'completed';`
  );
  return result.changes;
}

/**
 * Gets sync queue count by status
 */
export async function getSyncQueueCount(status?: SyncStatus): Promise<number> {
  const db = await getDatabase();

  if (status) {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = ?;`,
      [status]
    );
    return result?.count ?? 0;
  }

  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue;`
  );
  return result?.count ?? 0;
}

// ============================================
// Cached Transactions CRUD
// ============================================

/**
 * Input for creating a cached transaction
 */
export interface CreateCachedTransactionInput {
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
}

/**
 * Creates a cached transaction
 */
export async function createCachedTransaction(
  input: CreateCachedTransactionInput
): Promise<CachedTransaction> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO cached_transactions (
      id, wallet_id, type, amount, balance_after, reference, description,
      stand_id, stand_name, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING;`,
    [
      input.id,
      input.walletId,
      input.type,
      input.amount,
      input.balanceAfter,
      input.reference ?? null,
      input.description ?? null,
      input.standId ?? null,
      input.standName ?? null,
      input.createdAt.toISOString(),
    ]
  );

  const row = await db.getFirstAsync<CachedTransactionRow>(
    `SELECT * FROM cached_transactions WHERE id = ?;`,
    [input.id]
  );

  if (!row) {
    throw new Error('Failed to create cached transaction');
  }

  return rowToCachedTransaction(row);
}

/**
 * Batch insert cached transactions
 */
export async function batchInsertCachedTransactions(
  transactions: CreateCachedTransactionInput[]
): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (const input of transactions) {
      await db.runAsync(
        `INSERT INTO cached_transactions (
          id, wallet_id, type, amount, balance_after, reference, description,
          stand_id, stand_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING;`,
        [
          input.id,
          input.walletId,
          input.type,
          input.amount,
          input.balanceAfter,
          input.reference ?? null,
          input.description ?? null,
          input.standId ?? null,
          input.standName ?? null,
          input.createdAt.toISOString(),
        ]
      );
    }
  });
}

/**
 * Gets cached transactions for a wallet
 */
export async function getCachedTransactionsByWallet(
  walletId: string,
  limit = 50,
  offset = 0
): Promise<CachedTransaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CachedTransactionRow>(
    `SELECT * FROM cached_transactions WHERE wallet_id = ?
     ORDER BY created_at DESC LIMIT ? OFFSET ?;`,
    [walletId, limit, offset]
  );

  return rows.map(rowToCachedTransaction);
}

/**
 * Deletes cached transactions older than a date
 */
export async function deleteOldCachedTransactions(olderThan: Date): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `DELETE FROM cached_transactions WHERE created_at < ?;`,
    [olderThan.toISOString()]
  );
  return result.changes;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Clears all cached data (useful for logout)
 */
export async function clearAllCachedData(): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM cached_transactions;');
    await db.execAsync('DELETE FROM cached_products;');
    await db.execAsync('DELETE FROM cached_stands;');
    await db.execAsync('DELETE FROM cached_wallets;');
    await db.execAsync('DELETE FROM sync_queue WHERE status = "completed";');
  });

  console.log('[Database] All cached data cleared');
}

/**
 * Gets database statistics
 */
export async function getDatabaseStats(): Promise<{
  pendingTransactions: number;
  cachedWallets: number;
  cachedProducts: number;
  cachedStands: number;
  syncQueuePending: number;
  syncQueueFailed: number;
  cachedTransactions: number;
}> {
  const db = await getDatabase();

  const [
    pendingTx,
    wallets,
    products,
    stands,
    syncPending,
    syncFailed,
    transactions,
  ] = await Promise.all([
    db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM pending_transactions WHERE synced = 0;'
    ),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cached_wallets;'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cached_products;'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cached_stands;'),
    db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending';"
    ),
    db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed';"
    ),
    db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM cached_transactions;'
    ),
  ]);

  return {
    pendingTransactions: pendingTx?.count ?? 0,
    cachedWallets: wallets?.count ?? 0,
    cachedProducts: products?.count ?? 0,
    cachedStands: stands?.count ?? 0,
    syncQueuePending: syncPending?.count ?? 0,
    syncQueueFailed: syncFailed?.count ?? 0,
    cachedTransactions: transactions?.count ?? 0,
  };
}
