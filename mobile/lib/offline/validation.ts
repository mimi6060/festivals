/**
 * Offline validation utilities
 * Handles payment validation and QR code verification without server
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  verifyQRSignature,
  generateHMACSHA256,
  getQRVerificationKey,
  QRSignatureData,
} from './crypto';
import {
  getPendingDeductionForWallet,
  isTransactionProcessed,
} from './transaction';

// Storage keys
const CACHED_WALLETS_KEY = '@cached_wallets';
const CACHED_QR_CODES_KEY = '@cached_qr_codes';

// Types
export interface CachedWallet {
  walletId: string;
  userId: string;
  customerName: string;
  balance: number;
  lastSyncedAt: string;
  lastUsedAt?: string;
}

export interface CachedQRCode {
  qrData: string;
  walletId: string;
  userId: string;
  customerName: string;
  balance: number;
  expiresAt: number;
  signature: string;
  cachedAt: string;
}

export interface PaymentValidationResult {
  valid: boolean;
  error?: string;
  wallet?: CachedWallet;
  effectiveBalance?: number;
  warningMessage?: string;
}

export interface QRValidationResult {
  valid: boolean;
  error?: string;
  walletId?: string;
  userId?: string;
  customerName?: string;
  balance?: number;
  effectiveBalance?: number;
  isOfflineValidation: boolean;
  warningMessage?: string;
}

// ==============================================================
// Wallet Cache Management
// ==============================================================

/**
 * Caches wallet information for offline use
 */
export const cacheWallet = async (wallet: CachedWallet): Promise<void> => {
  const wallets = await getCachedWallets();
  const existingIndex = wallets.findIndex((w) => w.walletId === wallet.walletId);

  if (existingIndex >= 0) {
    wallets[existingIndex] = wallet;
  } else {
    wallets.push(wallet);
  }

  // Keep only last 100 wallets to prevent unlimited growth
  const trimmedWallets = wallets.slice(-100);
  await AsyncStorage.setItem(CACHED_WALLETS_KEY, JSON.stringify(trimmedWallets));
};

/**
 * Gets all cached wallets
 */
export const getCachedWallets = async (): Promise<CachedWallet[]> => {
  try {
    const stored = await AsyncStorage.getItem(CACHED_WALLETS_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as CachedWallet[];
  } catch {
    return [];
  }
};

/**
 * Gets a specific cached wallet by ID
 */
export const getCachedWallet = async (walletId: string): Promise<CachedWallet | null> => {
  const wallets = await getCachedWallets();
  return wallets.find((w) => w.walletId === walletId) || null;
};

/**
 * Updates the cached balance for a wallet after offline transaction
 */
export const updateCachedWalletBalance = async (
  walletId: string,
  newBalance: number
): Promise<void> => {
  const wallets = await getCachedWallets();
  const updated = wallets.map((w) =>
    w.walletId === walletId
      ? { ...w, balance: newBalance, lastUsedAt: new Date().toISOString() }
      : w
  );
  await AsyncStorage.setItem(CACHED_WALLETS_KEY, JSON.stringify(updated));
};

/**
 * Clears all cached wallets
 */
export const clearCachedWallets = async (): Promise<void> => {
  await AsyncStorage.removeItem(CACHED_WALLETS_KEY);
};

// ==============================================================
// QR Code Cache Management
// ==============================================================

/**
 * Caches a QR code for offline verification
 */
export const cacheQRCode = async (qrCode: CachedQRCode): Promise<void> => {
  const codes = await getCachedQRCodes();

  // Remove expired codes
  const now = Date.now();
  const validCodes = codes.filter((c) => c.expiresAt > now);

  // Add or update the new code
  const existingIndex = validCodes.findIndex((c) => c.walletId === qrCode.walletId);
  if (existingIndex >= 0) {
    validCodes[existingIndex] = qrCode;
  } else {
    validCodes.push(qrCode);
  }

  // Keep only last 50 codes
  const trimmedCodes = validCodes.slice(-50);
  await AsyncStorage.setItem(CACHED_QR_CODES_KEY, JSON.stringify(trimmedCodes));
};

/**
 * Gets all cached QR codes
 */
export const getCachedQRCodes = async (): Promise<CachedQRCode[]> => {
  try {
    const stored = await AsyncStorage.getItem(CACHED_QR_CODES_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as CachedQRCode[];
  } catch {
    return [];
  }
};

/**
 * Gets a cached QR code by wallet ID
 */
export const getCachedQRCode = async (walletId: string): Promise<CachedQRCode | null> => {
  const codes = await getCachedQRCodes();
  const code = codes.find((c) => c.walletId === walletId && c.expiresAt > Date.now());
  return code || null;
};

/**
 * Clears expired QR codes
 */
export const clearExpiredQRCodes = async (): Promise<void> => {
  const codes = await getCachedQRCodes();
  const now = Date.now();
  const validCodes = codes.filter((c) => c.expiresAt > now);
  await AsyncStorage.setItem(CACHED_QR_CODES_KEY, JSON.stringify(validCodes));
};

// ==============================================================
// Payment Validation
// ==============================================================

/**
 * Validates an offline payment against cached balance
 */
export const validateOfflinePayment = async (
  walletId: string,
  amount: number
): Promise<PaymentValidationResult> => {
  // Get cached wallet
  const wallet = await getCachedWallet(walletId);

  if (!wallet) {
    return {
      valid: false,
      error: 'Wallet not found in cache. Online verification required.',
    };
  }

  // Calculate effective balance (cached balance minus pending offline transactions)
  const pendingDeduction = await getPendingDeductionForWallet(walletId);
  const effectiveBalance = wallet.balance - pendingDeduction;

  // Check if sufficient balance
  if (amount > effectiveBalance) {
    return {
      valid: false,
      error: `Insufficient balance. Available: ${effectiveBalance.toFixed(2)}`,
      wallet,
      effectiveBalance,
    };
  }

  // Check cache age warning (older than 1 hour)
  const cacheAge = Date.now() - new Date(wallet.lastSyncedAt).getTime();
  const oneHour = 60 * 60 * 1000;
  let warningMessage: string | undefined;

  if (cacheAge > oneHour) {
    const hoursOld = Math.floor(cacheAge / oneHour);
    warningMessage = `Wallet data is ${hoursOld} hour${hoursOld > 1 ? 's' : ''} old`;
  }

  return {
    valid: true,
    wallet,
    effectiveBalance,
    warningMessage,
  };
};

// ==============================================================
// QR Code Validation
// ==============================================================

export interface ParsedQRPayload {
  walletId: string;
  userId: string;
  customerName?: string;
  balance: number;
  expiresAt: number;
  signature: string;
  version?: number;
}

/**
 * Parses QR code data
 */
export const parseQRCode = (qrData: string): ParsedQRPayload | null => {
  try {
    const parsed = JSON.parse(qrData);

    // Validate required fields
    if (!parsed.walletId || !parsed.userId || typeof parsed.balance !== 'number') {
      return null;
    }

    return {
      walletId: parsed.walletId,
      userId: parsed.userId,
      customerName: parsed.name || parsed.customerName,
      balance: parsed.balance,
      expiresAt: parsed.expiresAt || Date.now() + 5 * 60 * 1000, // Default 5 min
      signature: parsed.signature || '',
      version: parsed.version,
    };
  } catch {
    return null;
  }
};

/**
 * Validates a QR code offline
 */
export const validateQROffline = async (
  qrData: string,
  amount: number
): Promise<QRValidationResult> => {
  // Parse QR data
  const parsed = parseQRCode(qrData);

  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid QR code format',
      isOfflineValidation: true,
    };
  }

  // Check expiration
  if (parsed.expiresAt < Date.now()) {
    return {
      valid: false,
      error: 'QR code has expired. Ask customer to refresh.',
      isOfflineValidation: true,
      walletId: parsed.walletId,
      userId: parsed.userId,
      customerName: parsed.customerName,
    };
  }

  // Verify signature if available
  if (parsed.signature) {
    const signatureData: QRSignatureData = {
      walletId: parsed.walletId,
      userId: parsed.userId,
      balance: parsed.balance,
      expiresAt: parsed.expiresAt,
      signature: parsed.signature,
    };

    const signatureResult = await verifyQRSignature(signatureData);
    if (!signatureResult.valid) {
      // If signature verification fails but we have no key, continue with warning
      const verificationKey = await getQRVerificationKey();
      if (verificationKey) {
        return {
          valid: false,
          error: signatureResult.error || 'QR signature verification failed',
          isOfflineValidation: true,
          walletId: parsed.walletId,
          userId: parsed.userId,
          customerName: parsed.customerName,
        };
      }
    }
  }

  // Calculate effective balance
  const pendingDeduction = await getPendingDeductionForWallet(parsed.walletId);
  const effectiveBalance = parsed.balance - pendingDeduction;

  // Check balance
  if (amount > effectiveBalance) {
    return {
      valid: false,
      error: `Insufficient balance. Available: ${effectiveBalance.toFixed(2)}`,
      isOfflineValidation: true,
      walletId: parsed.walletId,
      userId: parsed.userId,
      customerName: parsed.customerName,
      balance: parsed.balance,
      effectiveBalance,
    };
  }

  // Cache the wallet for future offline use
  await cacheWallet({
    walletId: parsed.walletId,
    userId: parsed.userId,
    customerName: parsed.customerName || 'Client',
    balance: parsed.balance,
    lastSyncedAt: new Date().toISOString(),
  });

  // Calculate warning message if balance is close to empty
  let warningMessage: string | undefined;
  if (effectiveBalance - amount < 10) {
    warningMessage = `Low balance after transaction: ${(effectiveBalance - amount).toFixed(2)}`;
  }

  return {
    valid: true,
    isOfflineValidation: true,
    walletId: parsed.walletId,
    userId: parsed.userId,
    customerName: parsed.customerName,
    balance: parsed.balance,
    effectiveBalance,
    warningMessage,
  };
};

/**
 * Validates a QR code for duplicate scan prevention
 */
export const checkDuplicateQRScan = async (
  qrData: string,
  transactionId?: string
): Promise<{ isDuplicate: boolean; message?: string }> => {
  if (transactionId) {
    const processed = await isTransactionProcessed(transactionId);
    if (processed) {
      return {
        isDuplicate: true,
        message: 'This transaction has already been processed',
      };
    }
  }

  return { isDuplicate: false };
};

// ==============================================================
// HMAC Verification Utilities
// ==============================================================

/**
 * Verifies HMAC signature of QR code without server
 */
export const verifyQRHMAC = async (
  qrPayload: ParsedQRPayload
): Promise<{ valid: boolean; error?: string }> => {
  if (!qrPayload.signature) {
    return { valid: false, error: 'No signature in QR code' };
  }

  const verificationKey = await getQRVerificationKey();
  if (!verificationKey) {
    // Cannot verify without key, but allow with warning
    return { valid: true, error: 'Verification key not available - unverified' };
  }

  // Reconstruct the message that was signed
  const message = [
    qrPayload.walletId,
    qrPayload.userId,
    qrPayload.balance.toFixed(2),
    qrPayload.expiresAt.toString(),
  ].join('|');

  const expectedSignature = await generateHMACSHA256(message, verificationKey);

  if (expectedSignature !== qrPayload.signature) {
    return { valid: false, error: 'Invalid HMAC signature' };
  }

  return { valid: true };
};

/**
 * Creates a verification challenge for the QR code
 * This can be shown to customer as proof of offline validation
 */
export const createVerificationChallenge = async (
  walletId: string,
  amount: number,
  timestamp: number
): Promise<string> => {
  const verificationKey = await getQRVerificationKey();
  const message = `${walletId}|${amount.toFixed(2)}|${timestamp}`;

  if (!verificationKey) {
    // Fallback to simple hash
    const hash = await generateHMACSHA256(message, 'offline_fallback');
    return hash.substring(0, 8).toUpperCase();
  }

  const signature = await generateHMACSHA256(message, verificationKey);
  return signature.substring(0, 8).toUpperCase();
};
