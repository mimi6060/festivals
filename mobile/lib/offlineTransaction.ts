import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PendingTransaction } from '@/stores/syncStore';

// Storage keys
const OFFLINE_TRANSACTIONS_KEY = '@offline_transactions';
const OFFLINE_SECRET_KEY = '@offline_secret';

// Types
export interface OfflineTransactionInput {
  type: 'PURCHASE' | 'PAYMENT' | 'REFUND' | 'CANCEL';
  amount: number;
  walletId: string;
  userId: string;
  standId?: string;
  standName?: string;
  description?: string;
}

export interface OfflineTransaction extends OfflineTransactionInput {
  id: string;
  idempotencyKey: string;
  offlineSignature: string;
  createdAt: string;
  deviceId: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Generates a unique device ID for this installation
 * Used to identify transactions created on this device
 */
const getDeviceId = async (): Promise<string> => {
  const storedId = await AsyncStorage.getItem('@device_id');
  if (storedId) {
    return storedId;
  }

  const newId = Crypto.randomUUID();
  await AsyncStorage.setItem('@device_id', newId);
  return newId;
};

/**
 * Gets or generates the secret key used for HMAC signatures
 * This key should be synced with the server during initial setup
 */
const getOfflineSecret = async (): Promise<string> => {
  let secret = await AsyncStorage.getItem(OFFLINE_SECRET_KEY);

  if (!secret) {
    // In production, this would come from server during authentication
    // For now, we generate a random secret
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    secret = Array.from(new Uint8Array(randomBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await AsyncStorage.setItem(OFFLINE_SECRET_KEY, secret);
  }

  return secret;
};

/**
 * Generates an HMAC signature for offline transaction validation
 * This signature can be verified by the server when syncing
 */
export const generateOfflineSignature = async (
  transactionData: {
    id: string;
    type: string;
    amount: number;
    walletId: string;
    userId: string;
    idempotencyKey: string;
    createdAt: string;
    deviceId: string;
  }
): Promise<string> => {
  const secret = await getOfflineSecret();

  // Create a canonical string representation of the transaction data
  const message = [
    transactionData.id,
    transactionData.type,
    transactionData.amount.toString(),
    transactionData.walletId,
    transactionData.userId,
    transactionData.idempotencyKey,
    transactionData.createdAt,
    transactionData.deviceId,
  ].join('|');

  // Generate HMAC-SHA256 signature
  const signature = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message + secret,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  return signature;
};

/**
 * Generates a unique idempotency key for the transaction
 * This prevents duplicate transactions during sync
 */
const generateIdempotencyKey = async (): Promise<string> => {
  const timestamp = Date.now().toString(36);
  const randomPart = Crypto.randomUUID().split('-')[0];
  return `offline_${timestamp}_${randomPart}`;
};

/**
 * Creates an offline transaction with all required fields
 * including signature for server validation
 */
export const createOfflineTransaction = async (
  input: OfflineTransactionInput
): Promise<OfflineTransaction> => {
  const id = Crypto.randomUUID();
  const deviceId = await getDeviceId();
  const idempotencyKey = await generateIdempotencyKey();
  const createdAt = new Date().toISOString();

  const transactionData = {
    id,
    type: input.type,
    amount: input.amount,
    walletId: input.walletId,
    userId: input.userId,
    idempotencyKey,
    createdAt,
    deviceId,
  };

  const offlineSignature = await generateOfflineSignature(transactionData);

  const transaction: OfflineTransaction = {
    ...input,
    id,
    idempotencyKey,
    offlineSignature,
    createdAt,
    deviceId,
  };

  return transaction;
};

/**
 * Validates an offline transaction
 * Checks signature integrity and transaction validity
 */
export const validateOfflineTransaction = async (
  transaction: OfflineTransaction
): Promise<ValidationResult> => {
  // Check required fields
  if (!transaction.id || !transaction.type || !transaction.walletId || !transaction.userId) {
    return { valid: false, error: 'Missing required fields' };
  }

  // Check amount validity
  if (typeof transaction.amount !== 'number' || isNaN(transaction.amount)) {
    return { valid: false, error: 'Invalid amount' };
  }

  // Check transaction type
  const validTypes = ['PURCHASE', 'PAYMENT', 'REFUND', 'CANCEL'];
  if (!validTypes.includes(transaction.type)) {
    return { valid: false, error: 'Invalid transaction type' };
  }

  // Verify signature
  const expectedSignature = await generateOfflineSignature({
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    walletId: transaction.walletId,
    userId: transaction.userId,
    idempotencyKey: transaction.idempotencyKey,
    createdAt: transaction.createdAt,
    deviceId: transaction.deviceId,
  });

  if (expectedSignature !== transaction.offlineSignature) {
    return { valid: false, error: 'Invalid signature' };
  }

  // Check transaction age (e.g., reject if older than 7 days)
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  const transactionAge = Date.now() - new Date(transaction.createdAt).getTime();
  if (transactionAge > maxAgeMs) {
    return { valid: false, error: 'Transaction expired' };
  }

  return { valid: true };
};

// ============================================
// Local Storage Management
// ============================================

/**
 * Saves an offline transaction to local storage
 */
export const saveOfflineTransaction = async (
  transaction: OfflineTransaction
): Promise<void> => {
  const stored = await getStoredOfflineTransactions();
  stored.push(transaction);
  await AsyncStorage.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify(stored));
};

/**
 * Gets all stored offline transactions
 */
export const getStoredOfflineTransactions = async (): Promise<OfflineTransaction[]> => {
  const stored = await AsyncStorage.getItem(OFFLINE_TRANSACTIONS_KEY);
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as OfflineTransaction[];
  } catch {
    return [];
  }
};

/**
 * Removes a transaction from local storage by ID
 */
export const removeStoredOfflineTransaction = async (id: string): Promise<void> => {
  const stored = await getStoredOfflineTransactions();
  const filtered = stored.filter((tx) => tx.id !== id);
  await AsyncStorage.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify(filtered));
};

/**
 * Removes multiple transactions from local storage
 */
export const removeStoredOfflineTransactions = async (ids: string[]): Promise<void> => {
  const stored = await getStoredOfflineTransactions();
  const filtered = stored.filter((tx) => !ids.includes(tx.id));
  await AsyncStorage.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify(filtered));
};

/**
 * Clears all stored offline transactions
 */
export const clearStoredOfflineTransactions = async (): Promise<void> => {
  await AsyncStorage.removeItem(OFFLINE_TRANSACTIONS_KEY);
};

/**
 * Gets the count of stored offline transactions
 */
export const getStoredOfflineTransactionCount = async (): Promise<number> => {
  const stored = await getStoredOfflineTransactions();
  return stored.length;
};

/**
 * Converts an OfflineTransaction to a PendingTransaction for the sync store
 */
export const toPendingTransaction = (
  offlineTransaction: OfflineTransaction
): Omit<PendingTransaction, 'retryCount'> => {
  return {
    id: offlineTransaction.id,
    type: offlineTransaction.type,
    amount: offlineTransaction.amount,
    walletId: offlineTransaction.walletId,
    userId: offlineTransaction.userId,
    standId: offlineTransaction.standId,
    standName: offlineTransaction.standName,
    description: offlineTransaction.description,
    idempotencyKey: offlineTransaction.idempotencyKey,
    offlineSignature: offlineTransaction.offlineSignature,
    createdAt: offlineTransaction.createdAt,
  };
};

/**
 * Sets the offline secret (called after server authentication)
 */
export const setOfflineSecret = async (secret: string): Promise<void> => {
  await AsyncStorage.setItem(OFFLINE_SECRET_KEY, secret);
};

/**
 * Clears the offline secret (called on logout)
 */
export const clearOfflineSecret = async (): Promise<void> => {
  await AsyncStorage.removeItem(OFFLINE_SECRET_KEY);
};
