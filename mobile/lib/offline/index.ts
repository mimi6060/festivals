/**
 * Offline module exports
 * Provides all offline transaction and validation functionality
 */

// Crypto utilities
export {
  generateHMACSHA256,
  getDeviceSecret,
  setOfflineSigningKey,
  getOfflineSigningKey,
  setQRVerificationKey,
  getQRVerificationKey,
  clearCryptoKeys,
  signTransaction,
  verifyTransactionSignature,
  verifyQRSignature,
  generateOfflineReceiptId,
  getDeviceIdentifier,
  deriveSessionKey,
  createSignedPayload,
  verifySignedPayload,
} from './crypto';

export type { SignedData, QRSignatureData } from './crypto';

// Transaction handling
export {
  createOfflineTransaction,
  saveOfflineTransaction,
  getStoredOfflineTransactions,
  getPendingOfflineTransactions,
  getPendingTransactionCount,
  markTransactionSynced,
  updateTransactionSyncError,
  removeOfflineTransaction,
  clearSyncedTransactions,
  clearAllOfflineTransactions,
  getProcessedTransactionIds,
  addProcessedTransactionId,
  isTransactionProcessed,
  getOfflineTransactionSummary,
  getTransactionsForWallet,
  getPendingDeductionForWallet,
} from './transaction';

export type {
  OfflineTransactionItem,
  OfflineTransactionInput,
  OfflineTransaction,
  CreateTransactionResult,
  OfflineTransactionSummary,
} from './transaction';

// Validation utilities
export {
  cacheWallet,
  getCachedWallets,
  getCachedWallet,
  updateCachedWalletBalance,
  clearCachedWallets,
  cacheQRCode,
  getCachedQRCodes,
  getCachedQRCode,
  clearExpiredQRCodes,
  validateOfflinePayment,
  parseQRCode,
  validateQROffline,
  checkDuplicateQRScan,
  verifyQRHMAC,
  createVerificationChallenge,
} from './validation';

export type {
  CachedWallet,
  CachedQRCode,
  PaymentValidationResult,
  QRValidationResult,
  ParsedQRPayload,
} from './validation';
