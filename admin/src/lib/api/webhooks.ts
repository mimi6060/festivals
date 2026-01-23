import { api } from '@/lib/api'

// Types
export type WebhookStatus = 'ACTIVE' | 'INACTIVE' | 'FAILING' | 'DISABLED'

export interface WebhookEvent {
  id: string
  label: string
  description: string
  category: string
}

export interface Webhook {
  id: string
  festivalId: string
  url: string
  description: string
  events: string[]
  status: WebhookStatus
  secret?: string
  headers?: Record<string, string>
  lastTriggeredAt: string | null
  failureCount: number
  consecutiveFailures: number
  createdAt: string
  updatedAt: string
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  eventType: string
  eventId: string
  requestUrl: string
  requestHeaders: Record<string, string>
  requestBody: string
  responseCode: number | null
  responseHeaders?: Record<string, string>
  responseBody?: string
  duration: number
  success: boolean
  error?: string
  attemptNumber: number
  maxAttempts: number
  nextRetryAt?: string
  deliveredAt: string
  createdAt: string
}

export interface WebhookDeliveryStats {
  total: number
  successful: number
  failed: number
  pending: number
  averageResponseTime: number
  successRate: number
}

export interface CreateWebhookInput {
  url: string
  description?: string
  events: string[]
  headers?: Record<string, string>
}

export interface UpdateWebhookInput {
  url?: string
  description?: string
  events?: string[]
  headers?: Record<string, string>
  status?: WebhookStatus
}

export interface WebhookListParams {
  status?: WebhookStatus
  page?: number
  perPage?: number
}

export interface DeliveryListParams {
  eventType?: string
  success?: boolean
  page?: number
  perPage?: number
  startDate?: string
  endDate?: string
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

export interface TestWebhookResult {
  success: boolean
  responseCode: number | null
  responseBody?: string
  duration: number
  error?: string
}

// Available webhook events
export const WEBHOOK_EVENTS: WebhookEvent[] = [
  // Ticket events
  { id: 'ticket.sold', label: 'Billet vendu', description: 'Declenche quand un billet est achete', category: 'Billets' },
  { id: 'ticket.scanned', label: 'Billet scanne', description: 'Declenche quand un billet est scanne a l\'entree', category: 'Billets' },
  { id: 'ticket.transferred', label: 'Billet transfere', description: 'Declenche quand un billet est transfere a un autre utilisateur', category: 'Billets' },
  { id: 'ticket.cancelled', label: 'Billet annule', description: 'Declenche quand un billet est annule', category: 'Billets' },
  { id: 'ticket.validated', label: 'Billet valide', description: 'Declenche quand un billet est valide manuellement', category: 'Billets' },

  // Wallet events
  { id: 'wallet.topup', label: 'Rechargement wallet', description: 'Declenche quand un wallet est recharge', category: 'Portefeuille' },
  { id: 'wallet.transaction', label: 'Transaction wallet', description: 'Declenche pour chaque transaction effectuee', category: 'Portefeuille' },
  { id: 'wallet.refund', label: 'Remboursement wallet', description: 'Declenche quand un wallet est rembourse', category: 'Portefeuille' },
  { id: 'wallet.transfer', label: 'Transfert wallet', description: 'Declenche lors d\'un transfert entre wallets', category: 'Portefeuille' },

  // Refund events
  { id: 'refund.requested', label: 'Remboursement demande', description: 'Declenche quand un remboursement est demande', category: 'Remboursements' },
  { id: 'refund.approved', label: 'Remboursement approuve', description: 'Declenche quand un remboursement est approuve', category: 'Remboursements' },
  { id: 'refund.processed', label: 'Remboursement traite', description: 'Declenche quand un remboursement est effectue', category: 'Remboursements' },
  { id: 'refund.rejected', label: 'Remboursement refuse', description: 'Declenche quand un remboursement est refuse', category: 'Remboursements' },

  // Festival events
  { id: 'festival.updated', label: 'Festival mis a jour', description: 'Declenche quand les infos festival changent', category: 'Festival' },
  { id: 'festival.activated', label: 'Festival active', description: 'Declenche quand le festival est active', category: 'Festival' },
  { id: 'festival.completed', label: 'Festival termine', description: 'Declenche quand le festival est termine', category: 'Festival' },

  // Lineup events
  { id: 'lineup.changed', label: 'Lineup modifie', description: 'Declenche quand la programmation change', category: 'Programmation' },
  { id: 'artist.added', label: 'Artiste ajoute', description: 'Declenche quand un artiste est ajoute', category: 'Programmation' },
  { id: 'performance.scheduled', label: 'Performance programmee', description: 'Declenche quand une performance est planifiee', category: 'Programmation' },

  // NFC events
  { id: 'nfc.activated', label: 'Bracelet NFC active', description: 'Declenche quand un bracelet NFC est active', category: 'NFC' },
  { id: 'nfc.blocked', label: 'Bracelet NFC bloque', description: 'Declenche quand un bracelet NFC est bloque', category: 'NFC' },

  // Security events
  { id: 'security.alert', label: 'Alerte securite', description: 'Declenche pour les alertes de securite', category: 'Securite' },
  { id: 'security.incident', label: 'Incident signale', description: 'Declenche quand un incident est signale', category: 'Securite' },
]

// API functions
export const webhooksApi = {
  // List all webhooks for a festival
  list: (festivalId: string, params?: WebhookListParams) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.perPage) searchParams.set('perPage', params.perPage.toString())

    const query = searchParams.toString()
    return api.get<PaginatedResponse<Webhook>>(
      `/api/v1/festivals/${festivalId}/webhooks${query ? `?${query}` : ''}`
    )
  },

  // Get a single webhook
  get: (festivalId: string, webhookId: string) =>
    api.get<Webhook>(`/api/v1/festivals/${festivalId}/webhooks/${webhookId}`),

  // Create a new webhook
  create: (festivalId: string, data: CreateWebhookInput) =>
    api.post<{ webhook: Webhook; secret: string }>(
      `/api/v1/festivals/${festivalId}/webhooks`,
      data
    ),

  // Update a webhook
  update: (festivalId: string, webhookId: string, data: UpdateWebhookInput) =>
    api.patch<Webhook>(
      `/api/v1/festivals/${festivalId}/webhooks/${webhookId}`,
      data
    ),

  // Delete a webhook
  delete: (festivalId: string, webhookId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/webhooks/${webhookId}`),

  // Rotate webhook secret
  rotateSecret: (festivalId: string, webhookId: string) =>
    api.post<{ secret: string }>(
      `/api/v1/festivals/${festivalId}/webhooks/${webhookId}/rotate-secret`
    ),

  // Test webhook
  test: (festivalId: string, webhookId: string, eventType: string) =>
    api.post<TestWebhookResult>(
      `/api/v1/festivals/${festivalId}/webhooks/${webhookId}/test`,
      { eventType }
    ),

  // Enable webhook
  enable: (festivalId: string, webhookId: string) =>
    api.post<Webhook>(`/api/v1/festivals/${festivalId}/webhooks/${webhookId}/enable`),

  // Disable webhook
  disable: (festivalId: string, webhookId: string) =>
    api.post<Webhook>(`/api/v1/festivals/${festivalId}/webhooks/${webhookId}/disable`),

  // Get delivery logs for a webhook
  getDeliveries: (festivalId: string, webhookId: string, params?: DeliveryListParams) => {
    const searchParams = new URLSearchParams()
    if (params?.eventType) searchParams.set('eventType', params.eventType)
    if (params?.success !== undefined) searchParams.set('success', params.success.toString())
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.perPage) searchParams.set('perPage', params.perPage.toString())
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)

    const query = searchParams.toString()
    return api.get<PaginatedResponse<WebhookDelivery>>(
      `/api/v1/festivals/${festivalId}/webhooks/${webhookId}/deliveries${query ? `?${query}` : ''}`
    )
  },

  // Get a single delivery
  getDelivery: (festivalId: string, webhookId: string, deliveryId: string) =>
    api.get<WebhookDelivery>(
      `/api/v1/festivals/${festivalId}/webhooks/${webhookId}/deliveries/${deliveryId}`
    ),

  // Retry a failed delivery
  retryDelivery: (festivalId: string, webhookId: string, deliveryId: string) =>
    api.post<WebhookDelivery>(
      `/api/v1/festivals/${festivalId}/webhooks/${webhookId}/deliveries/${deliveryId}/retry`
    ),

  // Get delivery statistics
  getDeliveryStats: (festivalId: string, webhookId: string) =>
    api.get<WebhookDeliveryStats>(
      `/api/v1/festivals/${festivalId}/webhooks/${webhookId}/deliveries/stats`
    ),
}

// Query keys for React Query
export const webhooksQueryKeys = {
  all: ['webhooks'] as const,
  list: (festivalId: string) => [...webhooksQueryKeys.all, 'list', festivalId] as const,
  detail: (festivalId: string, webhookId: string) =>
    [...webhooksQueryKeys.all, 'detail', festivalId, webhookId] as const,
  deliveries: (festivalId: string, webhookId: string) =>
    [...webhooksQueryKeys.all, 'deliveries', festivalId, webhookId] as const,
  deliveryStats: (festivalId: string, webhookId: string) =>
    [...webhooksQueryKeys.all, 'deliveryStats', festivalId, webhookId] as const,
}

// Helper functions
export function getWebhookStatusLabel(status: WebhookStatus): string {
  const labels: Record<WebhookStatus, string> = {
    ACTIVE: 'Actif',
    INACTIVE: 'Inactif',
    FAILING: 'En echec',
    DISABLED: 'Desactive',
  }
  return labels[status] || status
}

export function getWebhookStatusColor(status: WebhookStatus): 'success' | 'default' | 'error' | 'warning' {
  const colors: Record<WebhookStatus, 'success' | 'default' | 'error' | 'warning'> = {
    ACTIVE: 'success',
    INACTIVE: 'default',
    FAILING: 'error',
    DISABLED: 'warning',
  }
  return colors[status] || 'default'
}

export function groupEventsByCategory(events: WebhookEvent[]): Record<string, WebhookEvent[]> {
  return events.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = []
    }
    acc[event.category].push(event)
    return acc
  }, {} as Record<string, WebhookEvent[]>)
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatHttpStatusCode(code: number | null): { label: string; color: string } {
  if (code === null) {
    return { label: 'ERR', color: 'text-red-600' }
  }
  if (code >= 200 && code < 300) {
    return { label: code.toString(), color: 'text-green-600' }
  }
  if (code >= 300 && code < 400) {
    return { label: code.toString(), color: 'text-yellow-600' }
  }
  if (code >= 400 && code < 500) {
    return { label: code.toString(), color: 'text-orange-600' }
  }
  return { label: code.toString(), color: 'text-red-600' }
}
