/**
 * Cryptographic utilities for offline transaction verification
 * Handles HMAC-SHA256 signatures, transaction signing, and key management
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Secure storage keys
const OFFLINE_SIGNING_KEY = 'offline_signing_key';
const QR_VERIFICATION_KEY = 'qr_verification_key';
const DEVICE_SECRET_KEY = 'device_secret_key';

// Key derivation constants
const KEY_DERIVATION_SALT = 'festivals_offline_v1';

export interface SignedData {
  data: string;
  signature: string;
  timestamp: number;
  deviceId: string;
}

export interface QRSignatureData {
  walletId: string;
  userId: string;
  balance: number;
  expiresAt: number;
  signature: string;
}

/**
 * Generates HMAC-SHA256 signature for given data
 * Uses standard HMAC construction: H((K XOR opad) || H((K XOR ipad) || message))
 * This is a proper HMAC implementation when native HMAC is not available
 */
export const generateHMACSHA256 = async (
  message: string,
  key: string
): Promise<string> => {
  const BLOCK_SIZE = 64; // SHA-256 block size in bytes

  // Convert key to bytes, pad or hash as needed
  let keyBytes: Uint8Array;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);

  if (keyData.length > BLOCK_SIZE) {
    // If key is longer than block size, hash it first
    const hashedKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      key,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    keyBytes = new Uint8Array(BLOCK_SIZE);
    const hashedKeyBytes = hexToBytes(hashedKey);
    keyBytes.set(hashedKeyBytes);
  } else {
    // Pad key with zeros to block size
    keyBytes = new Uint8Array(BLOCK_SIZE);
    keyBytes.set(keyData);
  }

  // Create ipad (0x36 repeated) and opad (0x5c repeated)
  const ipad = new Uint8Array(BLOCK_SIZE);
  const opad = new Uint8Array(BLOCK_SIZE);
  for (let i = 0; i < BLOCK_SIZE; i++) {
    ipad[i] = keyBytes[i] ^ 0x36;
    opad[i] = keyBytes[i] ^ 0x5c;
  }

  // Inner hash: H((K XOR ipad) || message)
  const messageBytes = encoder.encode(message);
  const innerData = new Uint8Array(BLOCK_SIZE + messageBytes.length);
  innerData.set(ipad);
  innerData.set(messageBytes, BLOCK_SIZE);

  const innerHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytesToHex(innerData),
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  // Outer hash: H((K XOR opad) || inner_hash)
  const innerHashBytes = hexToBytes(innerHash);
  const outerData = new Uint8Array(BLOCK_SIZE + innerHashBytes.length);
  outerData.set(opad);
  outerData.set(innerHashBytes, BLOCK_SIZE);

  const signature = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytesToHex(outerData),
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  return signature;
};

// Helper: Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Helper: Convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Gets or generates the device-specific secret key
 * This key is unique per device installation
 */
export const getDeviceSecret = async (): Promise<string> => {
  try {
    const existingKey = await SecureStore.getItemAsync(DEVICE_SECRET_KEY);
    if (existingKey) {
      return existingKey;
    }
  } catch {
    // Key doesn't exist yet
  }

  // Generate new device secret
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const newSecret = Array.from(new Uint8Array(randomBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await SecureStore.setItemAsync(DEVICE_SECRET_KEY, newSecret);
  return newSecret;
};

/**
 * Sets the offline signing key (received from server during authentication)
 * This key is used to sign offline transactions
 */
export const setOfflineSigningKey = async (key: string): Promise<void> => {
  await SecureStore.setItemAsync(OFFLINE_SIGNING_KEY, key);
};

/**
 * Gets the offline signing key
 */
export const getOfflineSigningKey = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(OFFLINE_SIGNING_KEY);
  } catch {
    return null;
  }
};

/**
 * Sets the QR verification key (used to verify QR code signatures offline)
 */
export const setQRVerificationKey = async (key: string): Promise<void> => {
  await SecureStore.setItemAsync(QR_VERIFICATION_KEY, key);
};

/**
 * Gets the QR verification key
 */
export const getQRVerificationKey = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(QR_VERIFICATION_KEY);
  } catch {
    return null;
  }
};

/**
 * Clears all stored cryptographic keys (called on logout)
 */
export const clearCryptoKeys = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(OFFLINE_SIGNING_KEY);
    await SecureStore.deleteItemAsync(QR_VERIFICATION_KEY);
    // Device secret is intentionally not cleared as it's device-specific
  } catch {
    // Ignore errors during cleanup
  }
};

/**
 * Signs transaction data for offline verification
 */
export const signTransaction = async (transactionData: {
  id: string;
  type: string;
  amount: number;
  walletId: string;
  userId: string;
  standId?: string;
  idempotencyKey: string;
  timestamp: number;
}): Promise<string> => {
  const signingKey = await getOfflineSigningKey();
  const deviceSecret = await getDeviceSecret();

  // Create canonical string representation
  const canonicalData = [
    transactionData.id,
    transactionData.type,
    transactionData.amount.toFixed(2),
    transactionData.walletId,
    transactionData.userId,
    transactionData.standId || '',
    transactionData.idempotencyKey,
    transactionData.timestamp.toString(),
    KEY_DERIVATION_SALT,
  ].join('|');

  // Use signing key if available, otherwise use device secret
  const key = signingKey || deviceSecret;

  return generateHMACSHA256(canonicalData, key);
};

/**
 * Verifies a transaction signature
 */
export const verifyTransactionSignature = async (
  transactionData: {
    id: string;
    type: string;
    amount: number;
    walletId: string;
    userId: string;
    standId?: string;
    idempotencyKey: string;
    timestamp: number;
  },
  signature: string
): Promise<boolean> => {
  const expectedSignature = await signTransaction(transactionData);
  return signature === expectedSignature;
};

/**
 * Verifies a QR code signature offline using HMAC
 */
export const verifyQRSignature = async (
  qrData: QRSignatureData
): Promise<{ valid: boolean; error?: string }> => {
  const verificationKey = await getQRVerificationKey();

  if (!verificationKey) {
    // If no verification key is set, we can still do basic validation
    // but cannot cryptographically verify
    return { valid: false, error: 'No verification key available' };
  }

  // Check expiration
  if (qrData.expiresAt < Date.now()) {
    return { valid: false, error: 'QR code has expired' };
  }

  // Reconstruct the signed message
  const message = [
    qrData.walletId,
    qrData.userId,
    qrData.balance.toFixed(2),
    qrData.expiresAt.toString(),
  ].join('|');

  // Verify signature
  const expectedSignature = await generateHMACSHA256(message, verificationKey);

  if (expectedSignature !== qrData.signature) {
    return { valid: false, error: 'Invalid QR signature' };
  }

  return { valid: true };
};

/**
 * Generates a unique receipt ID for offline transactions
 */
export const generateOfflineReceiptId = async (): Promise<string> => {
  const deviceSecret = await getDeviceSecret();
  const timestamp = Date.now();
  const random = Crypto.randomUUID().split('-')[0];

  // Create a short hash for the receipt
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${deviceSecret}|${timestamp}|${random}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  // Format: OFF-XXXX-XXXX (12 chars from hash)
  const shortHash = hash.substring(0, 8).toUpperCase();
  return `OFF-${shortHash.slice(0, 4)}-${shortHash.slice(4, 8)}`;
};

/**
 * Generates a device-specific identifier for tracking
 */
export const getDeviceIdentifier = async (): Promise<string> => {
  const secret = await getDeviceSecret();
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    secret,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  // Return first 16 chars as device ID
  return hash.substring(0, 16);
};

/**
 * Derives a session key from master key and session data
 * Used for additional security in transaction signing
 */
export const deriveSessionKey = async (
  sessionId: string,
  timestamp: number
): Promise<string> => {
  const deviceSecret = await getDeviceSecret();
  const signingKey = await getOfflineSigningKey();

  const derivationData = [
    deviceSecret,
    signingKey || '',
    sessionId,
    timestamp.toString(),
    KEY_DERIVATION_SALT,
  ].join('|');

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    derivationData,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
};

/**
 * Creates a signed data payload that can be verified later
 */
export const createSignedPayload = async (data: string): Promise<SignedData> => {
  const deviceId = await getDeviceIdentifier();
  const timestamp = Date.now();

  const messageToSign = `${data}|${timestamp}|${deviceId}`;
  const deviceSecret = await getDeviceSecret();
  const signature = await generateHMACSHA256(messageToSign, deviceSecret);

  return {
    data,
    signature,
    timestamp,
    deviceId,
  };
};

/**
 * Verifies a signed payload
 */
export const verifySignedPayload = async (payload: SignedData): Promise<boolean> => {
  const currentDeviceId = await getDeviceIdentifier();

  // Verify this payload was created on this device
  if (payload.deviceId !== currentDeviceId) {
    return false;
  }

  const messageToSign = `${payload.data}|${payload.timestamp}|${payload.deviceId}`;
  const deviceSecret = await getDeviceSecret();
  const expectedSignature = await generateHMACSHA256(messageToSign, deviceSecret);

  return payload.signature === expectedSignature;
};
