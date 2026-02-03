// API Configuration
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

export const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// Endpoints
export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',

  // User
  USER_ME: '/users/me',
  USER_UPDATE: '/users/me',

  // Festivals
  FESTIVALS: '/festivals',
  FESTIVAL_BY_ID: (id: string) => `/festivals/${id}`,

  // Map
  MAP_FULL: (festivalId: string) => `/festivals/${festivalId}/map`,
  MAP_CONFIG: (festivalId: string) => `/festivals/${festivalId}/map/config`,
  MAP_POIS: (festivalId: string) => `/festivals/${festivalId}/map/pois`,
  MAP_ZONES: (festivalId: string) => `/festivals/${festivalId}/map/zones`,

  // Tickets
  TICKETS: (festivalId: string) => `/festivals/${festivalId}/tickets`,
  TICKET_VALIDATE: (festivalId: string, ticketId: string) =>
    `/festivals/${festivalId}/tickets/${ticketId}/validate`,

  // Wallet
  WALLET: (festivalId: string) => `/festivals/${festivalId}/wallet`,
  WALLET_TRANSACTIONS: (festivalId: string) =>
    `/festivals/${festivalId}/wallet/transactions`,
  WALLET_RECHARGE: (festivalId: string) => `/festivals/${festivalId}/wallet/recharge`,

  // Lineup
  LINEUP: (festivalId: string) => `/festivals/${festivalId}/lineup`,
  ARTISTS: (festivalId: string) => `/festivals/${festivalId}/lineup/artists`,
  STAGES: (festivalId: string) => `/festivals/${festivalId}/lineup/stages`,
  PERFORMANCES: (festivalId: string) => `/festivals/${festivalId}/lineup/performances`,

  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_MARK_READ: (id: string) => `/notifications/${id}/read`,
  PUSH_TOKEN: '/notifications/push-token',
};

// Error classes
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code: string = 'UNKNOWN') {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
}

export class ApiTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'ApiTimeoutError';
  }
}

// Sleep utility for retry delays
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Calculate exponential backoff delay with jitter
function getRetryDelay(attempt: number): number {
  const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * delay; // 30% jitter
  return Math.min(delay + jitter, 10000); // Max 10 seconds
}

// Check if error is retryable
function isRetryable(error: unknown, status?: number): boolean {
  if (error instanceof ApiTimeoutError) return true;
  if (error instanceof TypeError && error.message.includes('fetch')) return true; // Network error
  if (status && RETRYABLE_STATUS_CODES.includes(status)) return true;
  return false;
}

// Fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiTimeoutError(timeout);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface ApiFetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  skipRetry?: boolean;
}

// Fetch wrapper with error handling, timeout, and retry logic
export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { timeout = API_TIMEOUT, retries = MAX_RETRIES, skipRetry = false, ...fetchOptions } = options;
  const url = `${API_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const requestOptions: RequestInit = {
    ...fetchOptions,
    headers: {
      ...defaultHeaders,
      ...fetchOptions.headers,
    },
  };

  let lastError: unknown;
  const maxAttempts = skipRetry ? 1 : retries + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, requestOptions, timeout);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({
          message: 'An error occurred',
          code: 'UNKNOWN',
        }));

        // Check if we should retry
        if (attempt < maxAttempts - 1 && isRetryable(null, response.status)) {
          lastError = new ApiError(response.status, errorBody.message || `HTTP ${response.status}`, errorBody.code);
          await sleep(getRetryDelay(attempt));
          continue;
        }

        throw new ApiError(response.status, errorBody.message || `HTTP ${response.status}`, errorBody.code);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const data = await response.json();
      return data.data ?? data;
    } catch (error) {
      lastError = error;

      // Don't retry if it's a non-retryable error or we've exhausted retries
      if (attempt >= maxAttempts - 1 || (!(error instanceof ApiTimeoutError) && !isRetryable(error))) {
        throw error;
      }

      await sleep(getRetryDelay(attempt));
    }
  }

  throw lastError;
}

// HTTP method helpers with options support
export const apiClient = {
  get: <T>(endpoint: string, options?: ApiFetchOptions) => apiFetch<T>(endpoint, options),

  post: <T>(endpoint: string, data?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: ApiFetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'DELETE',
    }),
};
