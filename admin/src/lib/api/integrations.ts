import { api } from '../api'

// Types
export type IntegrationType = 'stripe' | 'twilio' | 'email' | 'webhook' | 'analytics' | 'custom'
export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending'
export type EmailProvider = 'smtp' | 'sendgrid' | 'ses' | 'resend' | 'mailgun' | 'postmark'

export interface Integration {
  id: string
  festivalId: string
  type: IntegrationType
  name: string
  description: string
  status: IntegrationStatus
  connected: boolean
  configuredAt: string | null
  lastSyncAt: string | null
  config: Record<string, unknown>
  credentials?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface StripeConnectStatus {
  connected: boolean
  accountId?: string
  accountName?: string
  status?: 'enabled' | 'pending' | 'restricted' | 'rejected'
  payoutsEnabled?: boolean
  chargesEnabled?: boolean
  detailsSubmitted?: boolean
  defaultCurrency?: string
  country?: string
  dashboardUrl?: string
}

export interface TwilioConfig {
  enabled: boolean
  accountSid?: string
  authToken?: string
  fromNumber?: string
  messagingServiceSid?: string
  verified: boolean
  balance?: number
  currency?: string
}

export interface EmailConfig {
  enabled: boolean
  provider: EmailProvider
  fromName: string
  fromEmail: string
  replyToEmail?: string
  // SMTP specific
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPassword?: string
  smtpSecure?: boolean
  // API-based providers
  apiKey?: string
  // Status
  verified: boolean
  lastTestedAt?: string
}

export interface WebhookEndpoint {
  id: string
  festivalId: string
  url: string
  description: string
  events: string[]
  status: 'ACTIVE' | 'INACTIVE' | 'FAILING' | 'DISABLED'
  secret?: string
  headers?: Record<string, string>
  lastTriggeredAt: string | null
  failureCount: number
  consecutiveFailures: number
  createdAt: string
  updatedAt: string
}

export interface IntegrationOverview {
  stripe: StripeConnectStatus
  twilio: TwilioConfig
  email: EmailConfig
  webhooks: WebhookEndpoint[]
  webhookStats: {
    total: number
    active: number
    failing: number
  }
}

export interface TestConnectionResult {
  success: boolean
  message: string
  details?: Record<string, unknown>
  responseTime?: number
}

export interface UpdateTwilioInput {
  accountSid: string
  authToken: string
  fromNumber?: string
  messagingServiceSid?: string
}

export interface UpdateEmailInput {
  provider: EmailProvider
  fromName: string
  fromEmail: string
  replyToEmail?: string
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPassword?: string
  smtpSecure?: boolean
  apiKey?: string
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
  status?: 'ACTIVE' | 'INACTIVE' | 'DISABLED'
}

// API functions
export const integrationsApi = {
  // Get integration overview for a festival
  getOverview: (festivalId: string) =>
    api.get<IntegrationOverview>(`/api/v1/festivals/${festivalId}/integrations`),

  // Get all integrations for a festival
  list: (festivalId: string) =>
    api.get<Integration[]>(`/api/v1/festivals/${festivalId}/integrations/list`),

  // Stripe Connect
  stripe: {
    getStatus: (festivalId: string) =>
      api.get<StripeConnectStatus>(`/api/v1/festivals/${festivalId}/integrations/stripe`),

    connect: (festivalId: string) =>
      api.post<{ url: string }>(`/api/v1/festivals/${festivalId}/integrations/stripe/connect`),

    disconnect: (festivalId: string) =>
      api.post<void>(`/api/v1/festivals/${festivalId}/integrations/stripe/disconnect`),

    refresh: (festivalId: string) =>
      api.post<StripeConnectStatus>(`/api/v1/festivals/${festivalId}/integrations/stripe/refresh`),
  },

  // Twilio SMS
  twilio: {
    getConfig: (festivalId: string) =>
      api.get<TwilioConfig>(`/api/v1/festivals/${festivalId}/integrations/twilio`),

    update: (festivalId: string, data: UpdateTwilioInput) =>
      api.put<TwilioConfig>(`/api/v1/festivals/${festivalId}/integrations/twilio`, data),

    test: (festivalId: string, phoneNumber: string) =>
      api.post<TestConnectionResult>(
        `/api/v1/festivals/${festivalId}/integrations/twilio/test`,
        { phoneNumber }
      ),

    disconnect: (festivalId: string) =>
      api.post<void>(`/api/v1/festivals/${festivalId}/integrations/twilio/disconnect`),

    getBalance: (festivalId: string) =>
      api.get<{ balance: number; currency: string }>(
        `/api/v1/festivals/${festivalId}/integrations/twilio/balance`
      ),
  },

  // Email Provider
  email: {
    getConfig: (festivalId: string) =>
      api.get<EmailConfig>(`/api/v1/festivals/${festivalId}/integrations/email`),

    update: (festivalId: string, data: UpdateEmailInput) =>
      api.put<EmailConfig>(`/api/v1/festivals/${festivalId}/integrations/email`, data),

    test: (festivalId: string, email: string) =>
      api.post<TestConnectionResult>(
        `/api/v1/festivals/${festivalId}/integrations/email/test`,
        { email }
      ),

    verifyDomain: (festivalId: string, domain: string) =>
      api.post<{ dnsRecords: Array<{ type: string; name: string; value: string }> }>(
        `/api/v1/festivals/${festivalId}/integrations/email/verify-domain`,
        { domain }
      ),

    disconnect: (festivalId: string) =>
      api.post<void>(`/api/v1/festivals/${festivalId}/integrations/email/disconnect`),
  },

  // Webhooks
  webhooks: {
    list: (festivalId: string) =>
      api.get<WebhookEndpoint[]>(`/api/v1/festivals/${festivalId}/integrations/webhooks`),

    get: (festivalId: string, webhookId: string) =>
      api.get<WebhookEndpoint>(
        `/api/v1/festivals/${festivalId}/integrations/webhooks/${webhookId}`
      ),

    create: (festivalId: string, data: CreateWebhookInput) =>
      api.post<{ webhook: WebhookEndpoint; secret: string }>(
        `/api/v1/festivals/${festivalId}/integrations/webhooks`,
        data
      ),

    update: (festivalId: string, webhookId: string, data: UpdateWebhookInput) =>
      api.patch<WebhookEndpoint>(
        `/api/v1/festivals/${festivalId}/integrations/webhooks/${webhookId}`,
        data
      ),

    delete: (festivalId: string, webhookId: string) =>
      api.delete<void>(`/api/v1/festivals/${festivalId}/integrations/webhooks/${webhookId}`),

    rotateSecret: (festivalId: string, webhookId: string) =>
      api.post<{ secret: string }>(
        `/api/v1/festivals/${festivalId}/integrations/webhooks/${webhookId}/rotate-secret`
      ),

    test: (festivalId: string, webhookId: string, eventType: string) =>
      api.post<TestConnectionResult>(
        `/api/v1/festivals/${festivalId}/integrations/webhooks/${webhookId}/test`,
        { eventType }
      ),

    enable: (festivalId: string, webhookId: string) =>
      api.post<WebhookEndpoint>(
        `/api/v1/festivals/${festivalId}/integrations/webhooks/${webhookId}/enable`
      ),

    disable: (festivalId: string, webhookId: string) =>
      api.post<WebhookEndpoint>(
        `/api/v1/festivals/${festivalId}/integrations/webhooks/${webhookId}/disable`
      ),
  },
}

// Query keys for React Query
export const integrationsQueryKeys = {
  all: ['integrations'] as const,
  overview: (festivalId: string) => [...integrationsQueryKeys.all, 'overview', festivalId] as const,
  list: (festivalId: string) => [...integrationsQueryKeys.all, 'list', festivalId] as const,
  stripe: (festivalId: string) => [...integrationsQueryKeys.all, 'stripe', festivalId] as const,
  twilio: (festivalId: string) => [...integrationsQueryKeys.all, 'twilio', festivalId] as const,
  email: (festivalId: string) => [...integrationsQueryKeys.all, 'email', festivalId] as const,
  webhooks: (festivalId: string) => [...integrationsQueryKeys.all, 'webhooks', festivalId] as const,
  webhook: (festivalId: string, webhookId: string) =>
    [...integrationsQueryKeys.all, 'webhook', festivalId, webhookId] as const,
}

// Available webhook events
export const WEBHOOK_EVENTS = [
  // Ticket events
  { id: 'ticket.sold', label: 'Ticket Sold', description: 'When a ticket is purchased', category: 'Tickets' },
  { id: 'ticket.scanned', label: 'Ticket Scanned', description: 'When a ticket is scanned at entry', category: 'Tickets' },
  { id: 'ticket.transferred', label: 'Ticket Transferred', description: 'When a ticket is transferred', category: 'Tickets' },
  { id: 'ticket.cancelled', label: 'Ticket Cancelled', description: 'When a ticket is cancelled', category: 'Tickets' },

  // Wallet events
  { id: 'wallet.topup', label: 'Wallet Top-up', description: 'When a wallet is topped up', category: 'Wallet' },
  { id: 'wallet.transaction', label: 'Wallet Transaction', description: 'For each transaction', category: 'Wallet' },
  { id: 'wallet.refund', label: 'Wallet Refund', description: 'When a wallet is refunded', category: 'Wallet' },

  // Refund events
  { id: 'refund.requested', label: 'Refund Requested', description: 'When a refund is requested', category: 'Refunds' },
  { id: 'refund.approved', label: 'Refund Approved', description: 'When a refund is approved', category: 'Refunds' },
  { id: 'refund.processed', label: 'Refund Processed', description: 'When a refund is processed', category: 'Refunds' },

  // Festival events
  { id: 'festival.updated', label: 'Festival Updated', description: 'When festival info changes', category: 'Festival' },
  { id: 'lineup.changed', label: 'Lineup Changed', description: 'When the lineup changes', category: 'Festival' },

  // NFC events
  { id: 'nfc.activated', label: 'NFC Activated', description: 'When an NFC bracelet is activated', category: 'NFC' },
  { id: 'nfc.blocked', label: 'NFC Blocked', description: 'When an NFC bracelet is blocked', category: 'NFC' },

  // Security events
  { id: 'security.alert', label: 'Security Alert', description: 'For security alerts', category: 'Security' },
] as const

// Email providers list
export const EMAIL_PROVIDERS: Array<{ value: EmailProvider; label: string; description: string }> = [
  { value: 'smtp', label: 'SMTP', description: 'Custom SMTP server' },
  { value: 'sendgrid', label: 'SendGrid', description: 'Twilio SendGrid' },
  { value: 'ses', label: 'Amazon SES', description: 'AWS Simple Email Service' },
  { value: 'resend', label: 'Resend', description: 'Modern email API' },
  { value: 'mailgun', label: 'Mailgun', description: 'Powerful email API' },
  { value: 'postmark', label: 'Postmark', description: 'Transactional email' },
]

// Helper functions
export function getIntegrationStatusColor(status: IntegrationStatus): string {
  const colors = {
    connected: 'text-green-600 bg-green-100',
    disconnected: 'text-gray-600 bg-gray-100',
    error: 'text-red-600 bg-red-100',
    pending: 'text-yellow-600 bg-yellow-100',
  }
  return colors[status] || colors.disconnected
}

export function getIntegrationStatusLabel(status: IntegrationStatus): string {
  const labels = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Error',
    pending: 'Pending',
  }
  return labels[status] || status
}

export function groupWebhookEvents() {
  return WEBHOOK_EVENTS.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = []
    }
    acc[event.category].push(event)
    return acc
  }, {} as Record<string, typeof WEBHOOK_EVENTS[number][]>)
}
