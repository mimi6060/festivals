import { api } from '../api'

// Types
export type APIKeyStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED' | 'EXPIRED'
export type APIKeyEnvironment = 'SANDBOX' | 'PRODUCTION'

export interface APIKey {
  id: string
  festivalId: string
  name: string
  description: string
  keyPrefix: string
  permissions: string[]
  rateLimit: {
    requestsPerMinute: number
    requestsPerDay: number
    enabled: boolean
  }
  status: APIKeyStatus
  environment: APIKeyEnvironment
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface APIKeyStats {
  totalKeys: number
  activeKeys: number
  totalWebhooks: number
  activeWebhooks: number
  requestsToday: number
  requestsThisMonth: number
  successRate: number
  avgResponseTime: number
}

export interface RecentActivity {
  id: string
  type: 'request' | 'webhook' | 'key_created' | 'key_revoked'
  description: string
  timestamp: string
  status: 'success' | 'error' | 'pending'
}

export interface CreateAPIKeyRequest {
  name: string
  description?: string
  permissions: string[]
  environment: APIKeyEnvironment
  expiresAt?: string
}

export interface UpdateAPIKeyRequest {
  name?: string
  description?: string
  permissions?: string[]
  rateLimit?: {
    requestsPerMinute?: number
    requestsPerDay?: number
    enabled?: boolean
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
}

// API functions
export const apiKeysApi = {
  // List all API keys for a festival
  list: (festivalId: string, params?: {
    status?: APIKeyStatus
    environment?: APIKeyEnvironment
    page?: number
    perPage?: number
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.environment) searchParams.set('environment', params.environment)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.perPage) searchParams.set('perPage', params.perPage.toString())

    const query = searchParams.toString()
    return api.get<PaginatedResponse<APIKey>>(
      `/api/v1/festivals/${festivalId}/api-keys${query ? `?${query}` : ''}`
    )
  },

  // Get a single API key
  get: (festivalId: string, keyId: string) =>
    api.get<APIKey>(`/api/v1/festivals/${festivalId}/api-keys/${keyId}`),

  // Create a new API key
  create: (festivalId: string, data: CreateAPIKeyRequest) =>
    api.post<{ apiKey: APIKey; secret: string }>(
      `/api/v1/festivals/${festivalId}/api-keys`,
      data
    ),

  // Update an API key
  update: (festivalId: string, keyId: string, data: UpdateAPIKeyRequest) =>
    api.patch<APIKey>(
      `/api/v1/festivals/${festivalId}/api-keys/${keyId}`,
      data
    ),

  // Revoke an API key
  revoke: (festivalId: string, keyId: string) =>
    api.post<APIKey>(`/api/v1/festivals/${festivalId}/api-keys/${keyId}/revoke`),

  // Rotate an API key (regenerate secret)
  rotate: (festivalId: string, keyId: string) =>
    api.post<{ apiKey: APIKey; secret: string }>(
      `/api/v1/festivals/${festivalId}/api-keys/${keyId}/rotate`
    ),

  // Get API stats for dashboard
  getStats: (festivalId: string) =>
    api.get<APIKeyStats>(`/api/v1/festivals/${festivalId}/api-keys/stats`),

  // Get recent API activity
  getRecentActivity: (festivalId: string, params?: {
    limit?: number
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return api.get<RecentActivity[]>(
      `/api/v1/festivals/${festivalId}/api-keys/activity${query ? `?${query}` : ''}`
    )
  },
}

// Query keys for React Query
export const apiKeysQueryKeys = {
  all: ['apiKeys'] as const,
  list: (festivalId: string) => [...apiKeysQueryKeys.all, 'list', festivalId] as const,
  detail: (festivalId: string, keyId: string) =>
    [...apiKeysQueryKeys.all, 'detail', festivalId, keyId] as const,
  stats: (festivalId: string) =>
    [...apiKeysQueryKeys.all, 'stats', festivalId] as const,
  activity: (festivalId: string) =>
    [...apiKeysQueryKeys.all, 'activity', festivalId] as const,
}

// Available permissions
export const API_KEY_PERMISSIONS = [
  { id: 'festivals:read', label: 'Lire les infos festival', description: 'Acces aux informations publiques du festival' },
  { id: 'lineup:read', label: 'Lire le lineup', description: 'Acces a la programmation et aux artistes' },
  { id: 'tickets:read', label: 'Lire les billets', description: 'Acces aux types de billets disponibles' },
  { id: 'tickets:write', label: 'Gerer les billets', description: 'Creer et modifier des billets' },
  { id: 'wallets:read', label: 'Lire les wallets', description: 'Acces aux informations des portefeuilles' },
  { id: 'wallets:write', label: 'Gerer les wallets', description: 'Effectuer des transactions wallet' },
  { id: 'stats:read', label: 'Lire les statistiques', description: 'Acces aux statistiques et rapports' },
  { id: 'webhooks:manage', label: 'Gerer les webhooks', description: 'Creer et configurer des webhooks' },
]

// Helper functions
export function getStatusLabel(status: APIKeyStatus): string {
  const labels: Record<APIKeyStatus, string> = {
    ACTIVE: 'Actif',
    INACTIVE: 'Inactif',
    REVOKED: 'Revoque',
    EXPIRED: 'Expire',
  }
  return labels[status] || status
}

export function getStatusColor(status: APIKeyStatus): 'success' | 'default' | 'error' | 'warning' {
  const colors: Record<APIKeyStatus, 'success' | 'default' | 'error' | 'warning'> = {
    ACTIVE: 'success',
    INACTIVE: 'default',
    REVOKED: 'error',
    EXPIRED: 'warning',
  }
  return colors[status] || 'default'
}

export function getEnvironmentLabel(env: APIKeyEnvironment): string {
  return env === 'PRODUCTION' ? 'Production' : 'Sandbox'
}

export function getEnvironmentColor(env: APIKeyEnvironment): 'success' | 'warning' {
  return env === 'PRODUCTION' ? 'success' : 'warning'
}
