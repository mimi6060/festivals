const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

// Configuration
const DEFAULT_TIMEOUT = 30000 // 30 seconds
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // 1 second base delay for exponential backoff
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504]

// Impersonation header key
const IMPERSONATION_TOKEN_KEY = 'impersonation_token'
const IMPERSONATION_HEADER = 'X-Impersonation-Token'

// Get impersonation token from localStorage
function getImpersonationToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(IMPERSONATION_TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, body: { error: { code: string; message: string; details?: unknown } }) {
    super(body.error.message)
    this.status = status
    this.code = body.error.code
    this.details = body.error.details
  }
}

export class ApiTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`)
    this.name = 'ApiTimeoutError'
  }
}

// Sleep utility for retry delays
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

// Calculate exponential backoff delay with jitter
function getRetryDelay(attempt: number): number {
  const delay = RETRY_DELAY_BASE * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * delay // 30% jitter
  return Math.min(delay + jitter, 10000) // Max 10 seconds
}

// Check if error is retryable
function isRetryable(error: unknown, status?: number): boolean {
  if (error instanceof ApiTimeoutError) return true
  if (error instanceof TypeError && error.message.includes('fetch')) return true // Network error
  if (status && RETRYABLE_STATUS_CODES.includes(status)) return true
  return false
}

// Fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiTimeoutError(timeout)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export interface ApiClientOptions extends RequestInit {
  timeout?: number
  retries?: number
  skipRetry?: boolean
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, skipRetry = false, ...fetchOptions } = options

  // Build headers with impersonation support
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }

  // Add impersonation token if present
  const impersonationToken = getImpersonationToken()
  if (impersonationToken) {
    headers[IMPERSONATION_HEADER] = impersonationToken
  }

  const requestOptions: RequestInit = {
    ...fetchOptions,
    headers,
    credentials: 'include',
  }

  let lastError: unknown
  const maxAttempts = skipRetry ? 1 : retries + 1

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE}${endpoint}`,
        requestOptions,
        timeout
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({
          error: { code: 'UNKNOWN', message: 'An error occurred' },
        }))

        // Check if we should retry
        if (attempt < maxAttempts - 1 && isRetryable(null, response.status)) {
          lastError = new ApiError(response.status, body)
          await sleep(getRetryDelay(attempt))
          continue
        }

        throw new ApiError(response.status, body)
      }

      if (response.status === 204) {
        return undefined as T
      }

      const data = await response.json()
      return data.data ?? data
    } catch (error) {
      lastError = error

      // Don't retry if it's a non-retryable error or we've exhausted retries
      if (attempt >= maxAttempts - 1 || (!(error instanceof ApiTimeoutError) && !isRetryable(error))) {
        throw error
      }

      await sleep(getRetryDelay(attempt))
    }
  }

  throw lastError
}

// HTTP method helpers
export const api = {
  get: <T>(endpoint: string) => apiClient<T>(endpoint),

  post: <T>(endpoint: string, data?: unknown) =>
    apiClient<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown) =>
    apiClient<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    apiClient<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    apiClient<T>(endpoint, {
      method: 'DELETE',
    }),
}
