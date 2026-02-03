/**
 * SQLite Database Module
 *
 * Provides offline-first database functionality for the mobile app.
 * Export all public APIs from this module.
 */

// Schema types and converters
export {
  SCHEMA_VERSION,
  // Row types (database representation)
  type PendingTransactionRow,
  type CachedWalletRow,
  type CachedProductRow,
  type CachedStandRow,
  type SyncQueueRow,
  type CachedTransactionRow,
  type SchemaMigrationRow,
  // Application types
  type PendingTransaction,
  type CachedWallet,
  type CachedProduct,
  type CachedStand,
  type SyncQueueItem,
  type CachedTransaction,
  type ProductItem,
  type StandType,
  type SyncOperation,
  type SyncStatus,
  // Row converters
  rowToPendingTransaction,
  rowToCachedWallet,
  rowToCachedProduct,
  rowToCachedStand,
  rowToSyncQueueItem,
  rowToCachedTransaction,
} from './schema';

// Migration system
export {
  type Migration,
  type MigrationResult,
  MIGRATIONS,
  runMigrations,
  rollbackToVersion,
  resetDatabase,
  needsMigration,
  getCurrentVersion,
  getAppliedMigrations,
  getPendingMigrations,
} from './migrations';

// Database operations
export {
  // Initialization
  initializeDatabase,
  getDatabase,
  closeDatabase,
  generateId,
  // Pending transactions
  type CreatePendingTransactionInput,
  createPendingTransaction,
  getPendingTransaction,
  getAllPendingTransactions,
  getPendingTransactionsByWallet,
  markTransactionSynced,
  updateTransactionRetry,
  deletePendingTransaction,
  deleteSyncedTransactions,
  getPendingTransactionCount,
  // Cached wallets
  type UpsertCachedWalletInput,
  upsertCachedWallet,
  getCachedWallet,
  getCachedWalletByUser,
  updateWalletBalance,
  deleteCachedWallet,
  // Cached products
  type UpsertCachedProductInput,
  upsertCachedProduct,
  upsertCachedProducts,
  getCachedProduct,
  getCachedProductsByStand,
  getAvailableProductsByStand,
  getCachedProductsByCategory,
  deleteCachedProduct,
  deleteCachedProductsByStand,
  // Cached stands
  type UpsertCachedStandInput,
  upsertCachedStand,
  upsertCachedStands,
  getCachedStand,
  getCachedStandsByFestival,
  getCachedStandsByType,
  getOpenStands,
  deleteCachedStand,
  // Sync queue
  type CreateSyncQueueItemInput,
  createSyncQueueItem,
  getPendingSyncItems,
  getSyncQueueItem,
  updateSyncQueueItemStatus,
  completeSyncQueueItem,
  failSyncQueueItem,
  deleteSyncQueueItem,
  deleteCompletedSyncItems,
  getSyncQueueCount,
  // Cached transactions
  type CreateCachedTransactionInput,
  createCachedTransaction,
  batchInsertCachedTransactions,
  getCachedTransactionsByWallet,
  deleteOldCachedTransactions,
  // Utilities
  clearAllCachedData,
  getDatabaseStats,
} from './database';
