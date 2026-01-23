const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

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

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Build headers with impersonation support
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  // Add impersonation token if present
  const impersonationToken = getImpersonationToken()
  if (impersonationToken) {
    headers[IMPERSONATION_HEADER] = impersonationToken
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({
      error: { code: 'UNKNOWN', message: 'An error occurred' },
    }))
    throw new ApiError(response.status, body)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const data = await response.json()
  return data.data ?? data
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
