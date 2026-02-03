/**
 * Offline transaction creation and management
 * Handles creating, validating, and storing offline transactions
 */

import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  signTransaction,
  generateOfflineReceiptId,
  getDeviceIdentifier,
} from './crypto';

// Storage keys
const OFFLINE_TRANSACTIONS_KEY = '@offline_transactions_v2';
const PROCESSED_TRANSACTION_IDS_KEY = '@processed_transaction_ids_v2';

// TTL for processed transaction IDs (7 days in milliseconds)
const PROCESSED_ID_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Types
export interface OfflineTransactionItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OfflineTransactionInput {
  walletId: string;
  userId: string;
  customerName?: string;
  amount: number;
  items: OfflineTransactionItem[];
  standId: string;
  standName: string;
  staffId: string;
}

export interface OfflineTransaction {
  id: string;
  receiptId: string;
  type: 'PURCHASE' | 'PAYMENT';
  walletId: string;
  userId: string;
  customerName?: string;
  amount: number;
  balanceAfter: number;
  items: OfflineTransactionItem[];
  standId: string;
  standName: string;
  staffId: string;
  idempotencyKey: string;
  signature: string;
  deviceId: string;
  createdAt: string;
  timestamp: number;
  synced: boolean;
  syncedAt?: string;
  syncError?: string;
  retryCount: number;
}

export interface CreateTransactionResult {
  success: boolean;
  transaction?: OfflineTransaction;
  error?: string;
}

/**
 * Generates a unique idempotency key for the transaction
 */
const generateIdempotencyKey = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Crypto.randomUUID().split('-')[0];
  return `offline_${timestamp}_${random}`;
};

/**
 * Creates an offline transaction with cryptographic signature
 */
export const createOfflineTransaction = async (
  input: OfflineTransactionInput,
  cachedBalance: number
): Promise<CreateTransactionResult> => {
  try {
    // Validate inputs
    if (!input.walletId || !input.userId) {
      return { success: false, error: 'Invalid wallet or user ID' };
    }

    if (input.amount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    if (input.amount > cachedBalance) {
      return { success: false, error: 'Insufficient balance' };
    }

    const id = Crypto.randomUUID();
    const receiptId = await generateOfflineReceiptId();
    const deviceId = await getDeviceIdentifier();
    const idempotencyKey = generateIdempotencyKey();
    const timestamp = Date.now();
    const createdAt = new Date().toISOString();

    // Sign the transaction
    const signature = await signTransaction({
      id,
      type: 'PURCHASE',
      amount: input.amount,
      walletId: input.walletId,
      userId: input.userId,
      standId: input.standId,
      idempotencyKey,
      timestamp,
    });

    const transaction: OfflineTransaction = {
      id,
      receiptId,
      type: 'PURCHASE',
      walletId: input.walletId,
      userId: input.userId,
      customerName: input.customerName,
      amount: input.amount,
      balanceAfter: cachedBalance - input.amount,
      items: input.items,
      standId: input.standId,
      standName: input.standName,
      staffId: input.staffId,
      idempotencyKey,
      signature,
      deviceId,
      createdAt,
      timestamp,
      synced: false,
      retryCount: 0,
    };

    // Store the transaction
    await saveOfflineTransaction(transaction);

    // Track the transaction ID to prevent duplicates
    await addProcessedTransactionId(id);

    return { success: true, transaction };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
};

/**
 * Saves an offline transaction to storage
 */
export const saveOfflineTransaction = async (
  transaction: OfflineTransaction
): Promise<void> => {
  const transactions = await getStoredOfflineTransactions();

  // Prevent duplicates
  const existingIndex = transactions.findIndex((t) => t.id === transaction.id);
  if (existingIndex >= 0) {
    transactions[existingIndex] = transaction;
  } else {
    transactions.push(transaction);
  }

  await AsyncStorage.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify(transactions));
};

/**
 * Gets all stored offline transactions
 */
export const getStoredOfflineTransactions = async (): Promise<OfflineTransaction[]> => {
  try {
    const stored = await AsyncStorage.getItem(OFFLINE_TRANSACTIONS_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as OfflineTransaction[];
  } catch {
    return [];
  }
};

/**
 * Gets pending (unsynced) offline transactions
 */
export const getPendingOfflineTransactions = async (): Promise<OfflineTransaction[]> => {
  const transactions = await getStoredOfflineTransactions();
  return transactions.filter((t) => !t.synced);
};

/**
 * Gets the count of pending transactions
 */
export const getPendingTransactionCount = async (): Promise<number> => {
  const pending = await getPendingOfflineTransactions();
  return pending.length;
};

/**
 * Marks a transaction as synced
 */
export const markTransactionSynced = async (
  transactionId: string,
  serverTransactionId?: string
): Promise<void> => {
  const transactions = await getStoredOfflineTransactions();
  const updated = transactions.map((t) =>
    t.id === transactionId
      ? {
          ...t,
          synced: true,
          syncedAt: new Date().toISOString(),
          serverTransactionId,
        }
      : t
  );
  await AsyncStorage.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify(updated));
};

/**
 * Updates transaction sync error
 */
export const updateTransactionSyncError = async (
  transactionId: string,
  error: string
): Promise<void> => {
  const transactions = await getStoredOfflineTransactions();
  const updated = transactions.map((t) =>
    t.id === transactionId
      ? {
          ...t,
          syncError: error,
          retryCount: t.retryCount + 1,
        }
      : t
  );
  await AsyncStorage.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify(updated));
};

/**
 * Removes a transaction from storage
 */
export const removeOfflineTransaction = async (transactionId: string): Promise<void> => {
  const transactions = await getStoredOfflineTransactions();
  const filtered = transactions.filter((t) => t.id !== transactionId);
  await AsyncStorage.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify(filtered));
};

/**
 * Clears all synced transactions (cleanup)
 */
export const clearSyncedTransactions = async (): Promise<void> => {
  const transactions = await getStoredOfflineTransactions();
  const pending = transactions.filter((t) => !t.synced);
  await AsyncStorage.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify(pending));
};

/**
 * Clears all offline transactions
 */
export const clearAllOfflineTransactions = async (): Promise<void> => {
  await AsyncStorage.removeItem(OFFLINE_TRANSACTIONS_KEY);
  await AsyncStorage.removeItem(PROCESSED_TRANSACTION_IDS_KEY);
};

// ==============================================================
// Duplicate Detection with TTL
// ==============================================================

interface ProcessedTransactionEntry {
  id: string;
  timestamp: number;
}

/**
 * Gets the map of processed transaction IDs with timestamps (for duplicate detection)
 */
export const getProcessedTransactionEntries = async (): Promise<ProcessedTransactionEntry[]> => {
  try {
    const stored = await AsyncStorage.getItem(PROCESSED_TRANSACTION_IDS_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as ProcessedTransactionEntry[];
  } catch {
    return [];
  }
};

/**
 * Gets the set of processed transaction IDs (for duplicate detection)
 * Filters out expired entries based on TTL
 */
export const getProcessedTransactionIds = async (): Promise<Set<string>> => {
  const entries = await getProcessedTransactionEntries();
  const now = Date.now();

  // Filter out expired entries
  const validEntries = entries.filter(
    (entry) => now - entry.timestamp < PROCESSED_ID_TTL_MS
  );

  return new Set(validEntries.map((e) => e.id));
};

/**
 * Adds a transaction ID to the processed set with timestamp
 */
export const addProcessedTransactionId = async (transactionId: string): Promise<void> => {
  const entries = await getProcessedTransactionEntries();
  const now = Date.now();

  // Filter out expired entries and add new one
  const validEntries = entries.filter(
    (entry) => now - entry.timestamp < PROCESSED_ID_TTL_MS
  );

  // Check if already exists
  const existingIndex = validEntries.findIndex((e) => e.id === transactionId);
  if (existingIndex >= 0) {
    // Update timestamp
    validEntries[existingIndex].timestamp = now;
  } else {
    validEntries.push({ id: transactionId, timestamp: now });
  }

  // Keep only last 1000 entries to prevent unlimited growth
  const trimmedEntries = validEntries.slice(-1000);

  await AsyncStorage.setItem(
    PROCESSED_TRANSACTION_IDS_KEY,
    JSON.stringify(trimmedEntries)
  );
};

/**
 * Checks if a transaction ID has already been processed
 */
export const isTransactionProcessed = async (transactionId: string): Promise<boolean> => {
  const ids = await getProcessedTransactionIds();
  return ids.has(transactionId);
};

/**
 * Cleans up expired transaction IDs from storage
 */
export const cleanupExpiredTransactionIds = async (): Promise<number> => {
  const entries = await getProcessedTransactionEntries();
  const now = Date.now();

  const validEntries = entries.filter(
    (entry) => now - entry.timestamp < PROCESSED_ID_TTL_MS
  );

  const removedCount = entries.length - validEntries.length;

  if (removedCount > 0) {
    await AsyncStorage.setItem(
      PROCESSED_TRANSACTION_IDS_KEY,
      JSON.stringify(validEntries)
    );
  }

  return removedCount;
};

// ==============================================================
// Transaction Summary & Stats
// ==============================================================

export interface OfflineTransactionSummary {
  totalPending: number;
  totalSynced: number;
  totalAmount: number;
  pendingAmount: number;
  oldestPendingDate: string | null;
  newestTransactionDate: string | null;
}

/**
 * Gets a summary of offline transactions
 */
export const getOfflineTransactionSummary = async (): Promise<OfflineTransactionSummary> => {
  const transactions = await getStoredOfflineTransactions();

  const pending = transactions.filter((t) => !t.synced);
  const synced = transactions.filter((t) => t.synced);

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const pendingAmount = pending.reduce((sum, t) => sum + t.amount, 0);

  // Sort by date
  const sortedPending = [...pending].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const sortedAll = [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    totalPending: pending.length,
    totalSynced: synced.length,
    totalAmount,
    pendingAmount,
    oldestPendingDate: sortedPending[0]?.createdAt || null,
    newestTransactionDate: sortedAll[0]?.createdAt || null,
  };
};

/**
 * Gets transactions for a specific wallet (for local balance tracking)
 */
export const getTransactionsForWallet = async (
  walletId: string
): Promise<OfflineTransaction[]> => {
  const transactions = await getStoredOfflineTransactions();
  return transactions.filter((t) => t.walletId === walletId && !t.synced);
};

/**
 * Calculates the pending deduction for a wallet (not yet synced)
 */
export const getPendingDeductionForWallet = async (walletId: string): Promise<number> => {
  const walletTransactions = await getTransactionsForWallet(walletId);
  return walletTransactions.reduce((sum, t) => sum + t.amount, 0);
};
