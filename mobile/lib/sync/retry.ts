/**
 * Retry Policy and Exponential Backoff Logic
 *
 * Handles retry logic with exponential backoff for sync operations.
 * Distinguishes between network errors and server errors for appropriate handling.
 */

// ============================================
// Error Types
// ============================================

/**
 * Categories of errors that can occur during sync
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK', // Network connectivity issues
  SERVER = 'SERVER', // Server-side errors (5xx)
  CLIENT = 'CLIENT', // Client-side errors (4xx)
  TIMEOUT = 'TIMEOUT', // Request timeout
  VALIDATION = 'VALIDATION', // Validation errors
  CONFLICT = 'CONFLICT', // Data conflict errors
  AUTHENTICATION = 'AUTHENTICATION', // Auth errors (401, 403)
  RATE_LIMIT = 'RATE_LIMIT', // Rate limiting (429)
  UNKNOWN = 'UNKNOWN', // Unknown errors
}

/**
 * Parsed error information
 */
export interface ParsedError {
  category: ErrorCategory;
  code: string;
  message: string;
  statusCode?: number;
  retryable: boolean;
  retryAfter?: number; // Seconds to wait before retry (from Rate-Limit headers)
}

// ============================================
// Retry Policy Configuration
// ============================================

/**
 * Configuration for retry policy
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds before first retry */
  initialDelayMs: number;
  /** Maximum delay in milliseconds between retries */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Whether to add jitter to prevent thundering herd */
  useJitter: boolean;
  /** Jitter factor (0-1), applied as random variance */
  jitterFactor: number;
  /** Error categories that should be retried */
  retryableCategories: ErrorCategory[];
  /** Specific HTTP status codes that should be retried */
  retryableStatusCodes: number[];
}

/**
 * Default retry policy
 * Uses exponential backoff: 1s, 2s, 4s, 8s, 16s (capped)
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 5,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 16000, // 16 seconds max
  backoffMultiplier: 2,
  useJitter: true,
  jitterFactor: 0.2, // +/- 20% variance
  retryableCategories: [
    ErrorCategory.NETWORK,
    ErrorCategory.SERVER,
    ErrorCategory.TIMEOUT,
    ErrorCategory.RATE_LIMIT,
  ],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Aggressive retry policy for critical operations
 * More retries with shorter initial delay
 */
export const CRITICAL_RETRY_POLICY: RetryPolicy = {
  maxRetries: 10,
  initialDelayMs: 500, // 500ms
  maxDelayMs: 30000, // 30 seconds max
  backoffMultiplier: 2,
  useJitter: true,
  jitterFactor: 0.15,
  retryableCategories: [
    ErrorCategory.NETWORK,
    ErrorCategory.SERVER,
    ErrorCategory.TIMEOUT,
    ErrorCategory.RATE_LIMIT,
  ],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Conservative retry policy for low-priority operations
 * Fewer retries with longer delays
 */
export const CONSERVATIVE_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 2000, // 2 seconds
  maxDelayMs: 60000, // 60 seconds max
  backoffMultiplier: 3,
  useJitter: true,
  jitterFactor: 0.25,
  retryableCategories: [
    ErrorCategory.NETWORK,
    ErrorCategory.SERVER,
    ErrorCategory.TIMEOUT,
  ],
  retryableStatusCodes: [500, 502, 503, 504],
};

// ============================================
// Backoff Calculation
// ============================================

/**
 * Calculates the backoff delay for a given retry attempt
 *
 * @param retryCount - Current retry attempt (0-based)
 * @param policy - Retry policy to use
 * @returns Delay in milliseconds before next retry
 *
 * @example
 * // With default policy (initialDelay=1000, multiplier=2):
 * // Retry 0: 1000ms (1s)
 * // Retry 1: 2000ms (2s)
 * // Retry 2: 4000ms (4s)
 * // Retry 3: 8000ms (8s)
 * // Retry 4: 16000ms (16s) - capped at maxDelayMs
 */
export function calculateBackoff(
  retryCount: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): number {
  // Calculate base exponential delay
  const exponentialDelay =
    policy.initialDelayMs * Math.pow(policy.backoffMultiplier, retryCount);

  // Apply maximum delay cap
  let delay = Math.min(exponentialDelay, policy.maxDelayMs);

  // Apply jitter if enabled
  if (policy.useJitter) {
    const jitterRange = delay * policy.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange; // Random value between -jitterRange and +jitterRange
    delay = Math.max(0, delay + jitter);
  }

  return Math.round(delay);
}

/**
 * Calculates the next retry timestamp
 *
 * @param retryCount - Current retry attempt (0-based)
 * @param policy - Retry policy to use
 * @returns ISO timestamp of when to retry next
 */
export function calculateNextRetryTime(
  retryCount: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): string {
  const delayMs = calculateBackoff(retryCount, policy);
  const nextRetryTime = new Date(Date.now() + delayMs);
  return nextRetryTime.toISOString();
}

/**
 * Gets all retry delays for visualization/debugging
 *
 * @param policy - Retry policy to use
 * @returns Array of delays for each retry attempt
 */
export function getRetrySchedule(
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): number[] {
  const schedule: number[] = [];
  for (let i = 0; i < policy.maxRetries; i++) {
    // Calculate without jitter for predictable output
    const exponentialDelay =
      policy.initialDelayMs * Math.pow(policy.backoffMultiplier, i);
    schedule.push(Math.min(exponentialDelay, policy.maxDelayMs));
  }
  return schedule;
}

// ============================================
// Error Parsing and Classification
// ============================================

/**
 * Parses an error and categorizes it
 */
export function parseError(error: unknown): ParsedError {
  // Handle fetch/network errors
  if (error instanceof TypeError) {
    if (
      error.message.includes('Network request failed') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('network')
    ) {
      return {
        category: ErrorCategory.NETWORK,
        code: 'NETWORK_ERROR',
        message: error.message,
        retryable: true,
      };
    }
  }

  // Handle timeout errors
  if (error instanceof Error) {
    if (
      error.name === 'AbortError' ||
      error.message.includes('timeout') ||
      error.message.includes('Timeout')
    ) {
      return {
        category: ErrorCategory.TIMEOUT,
        code: 'TIMEOUT_ERROR',
        message: error.message,
        retryable: true,
      };
    }
  }

  // Handle HTTP response errors
  if (isHttpError(error)) {
    const statusCode = error.statusCode || error.status;
    return parseHttpError(statusCode, error.message || 'HTTP Error');
  }

  // Handle generic errors with status codes
  if (
    error &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
  ) {
    const statusCode = (error as { statusCode: number }).statusCode;
    const message = 'message' in error ? String((error as { message: unknown }).message) : 'HTTP Error';
    return parseHttpError(statusCode, message);
  }

  // Handle Error instances
  if (error instanceof Error) {
    return {
      category: ErrorCategory.UNKNOWN,
      code: 'UNKNOWN_ERROR',
      message: error.message,
      retryable: false,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      category: ErrorCategory.UNKNOWN,
      code: 'UNKNOWN_ERROR',
      message: error,
      retryable: false,
    };
  }

  // Fallback
  return {
    category: ErrorCategory.UNKNOWN,
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    retryable: false,
  };
}

/**
 * Type guard for HTTP-like errors
 */
function isHttpError(
  error: unknown
): error is { statusCode?: number; status?: number; message?: string } {
  return (
    error !== null &&
    typeof error === 'object' &&
    ('statusCode' in error || 'status' in error)
  );
}

/**
 * Parses an HTTP status code into a categorized error
 */
function parseHttpError(statusCode: number, message: string): ParsedError {
  // 4xx Client Errors
  if (statusCode >= 400 && statusCode < 500) {
    switch (statusCode) {
      case 401:
        return {
          category: ErrorCategory.AUTHENTICATION,
          code: 'UNAUTHORIZED',
          message,
          statusCode,
          retryable: false, // Need to re-authenticate
        };

      case 403:
        return {
          category: ErrorCategory.AUTHENTICATION,
          code: 'FORBIDDEN',
          message,
          statusCode,
          retryable: false,
        };

      case 404:
        return {
          category: ErrorCategory.CLIENT,
          code: 'NOT_FOUND',
          message,
          statusCode,
          retryable: false,
        };

      case 408:
        return {
          category: ErrorCategory.TIMEOUT,
          code: 'REQUEST_TIMEOUT',
          message,
          statusCode,
          retryable: true,
        };

      case 409:
        return {
          category: ErrorCategory.CONFLICT,
          code: 'CONFLICT',
          message,
          statusCode,
          retryable: false, // Needs conflict resolution
        };

      case 422:
        return {
          category: ErrorCategory.VALIDATION,
          code: 'VALIDATION_ERROR',
          message,
          statusCode,
          retryable: false,
        };

      case 429:
        return {
          category: ErrorCategory.RATE_LIMIT,
          code: 'RATE_LIMITED',
          message,
          statusCode,
          retryable: true,
        };

      default:
        return {
          category: ErrorCategory.CLIENT,
          code: `CLIENT_ERROR_${statusCode}`,
          message,
          statusCode,
          retryable: false,
        };
    }
  }

  // 5xx Server Errors
  if (statusCode >= 500) {
    return {
      category: ErrorCategory.SERVER,
      code: `SERVER_ERROR_${statusCode}`,
      message,
      statusCode,
      retryable: true,
    };
  }

  // Other errors
  return {
    category: ErrorCategory.UNKNOWN,
    code: `HTTP_ERROR_${statusCode}`,
    message,
    statusCode,
    retryable: false,
  };
}

// ============================================
// Retry Decision Logic
// ============================================

/**
 * Determines if an operation should be retried based on the error and retry state
 *
 * @param error - The error that occurred
 * @param retryCount - Current retry count
 * @param policy - Retry policy to use
 * @returns Object indicating whether to retry and why
 */
export function shouldRetry(
  error: unknown,
  retryCount: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): { retry: boolean; reason: string; delayMs?: number } {
  // Check if max retries exceeded
  if (retryCount >= policy.maxRetries) {
    return {
      retry: false,
      reason: `Maximum retries (${policy.maxRetries}) exceeded`,
    };
  }

  // Parse the error
  const parsedError = parseError(error);

  // Check if error category is retryable
  if (!parsedError.retryable) {
    return {
      retry: false,
      reason: `Error category ${parsedError.category} is not retryable: ${parsedError.message}`,
    };
  }

  // Check if error category is in policy's retryable list
  if (!policy.retryableCategories.includes(parsedError.category)) {
    return {
      retry: false,
      reason: `Error category ${parsedError.category} not in retryable categories`,
    };
  }

  // Check specific status codes
  if (
    parsedError.statusCode &&
    !policy.retryableStatusCodes.includes(parsedError.statusCode)
  ) {
    // Still allow if category is retryable (e.g., network errors don't have status codes)
    if (parsedError.category !== ErrorCategory.NETWORK) {
      return {
        retry: false,
        reason: `Status code ${parsedError.statusCode} not in retryable status codes`,
      };
    }
  }

  // Calculate delay
  let delayMs = calculateBackoff(retryCount, policy);

  // Use Retry-After header if available (for rate limiting)
  if (
    parsedError.category === ErrorCategory.RATE_LIMIT &&
    parsedError.retryAfter
  ) {
    delayMs = Math.max(delayMs, parsedError.retryAfter * 1000);
  }

  return {
    retry: true,
    reason: `Retrying due to ${parsedError.category} error`,
    delayMs,
  };
}

/**
 * Checks if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.category === ErrorCategory.NETWORK;
}

/**
 * Checks if an error is a server error
 */
export function isServerError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.category === ErrorCategory.SERVER;
}

/**
 * Checks if an error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.category === ErrorCategory.TIMEOUT;
}

/**
 * Checks if an error is an authentication error
 */
export function isAuthenticationError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.category === ErrorCategory.AUTHENTICATION;
}

/**
 * Checks if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.category === ErrorCategory.RATE_LIMIT;
}

/**
 * Checks if an error is a conflict error
 */
export function isConflictError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.category === ErrorCategory.CONFLICT;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Creates a delay promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an async function with retry logic
 *
 * @param fn - The async function to wrap
 * @param policy - Retry policy to use
 * @param onRetry - Optional callback called before each retry
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  onRetry?: (error: unknown, retryCount: number, delayMs: number) => void
): Promise<T> {
  let lastError: unknown;
  let retryCount = 0;

  while (retryCount <= policy.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const decision = shouldRetry(error, retryCount, policy);

      if (!decision.retry || !decision.delayMs) {
        throw error;
      }

      if (onRetry) {
        onRetry(error, retryCount, decision.delayMs);
      }

      await delay(decision.delayMs);
      retryCount++;
    }
  }

  throw lastError;
}

/**
 * Gets the total time spent on retries for a given number of attempts
 */
export function getTotalRetryTime(
  retryCount: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): number {
  let total = 0;
  for (let i = 0; i < retryCount; i++) {
    total += calculateBackoff(i, policy);
  }
  return total;
}
