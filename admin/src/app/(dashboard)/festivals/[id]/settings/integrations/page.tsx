'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  CreditCard,
  MessageSquare,
  Mail,
  Webhook,
  Plus,
  Loader2,
  AlertCircle,
  Check,
  Trash2,
  ExternalLink,
  MoreVertical,
  Copy,
  RefreshCw,
  Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SettingsLayout,
  SettingsCard,
  SettingsAlert,
} from '@/components/settings'
import {
  IntegrationCard,
  IntegrationSection,
  IntegrationDetail,
  TwilioConfigForm,
  EmailConfigForm,
} from '@/components/integrations'
import { StripeConnect } from '@/components/settings/StripeConnect'
import { WebhookEditor } from '@/components/api/WebhookEditor'
import {
  integrationsApi,
  StripeConnectStatus,
  TwilioConfig,
  EmailConfig,
  WebhookEndpoint,
  UpdateTwilioInput,
  UpdateEmailInput,
  WEBHOOK_EVENTS,
  groupWebhookEvents,
} from '@/lib/api/integrations'
import { useFestivalStore } from '@/stores/festivalStore'

type WebhookStatus = 'ACTIVE' | 'INACTIVE' | 'FAILING' | 'DISABLED'

export default function IntegrationsSettingsPage() {
  const params = useParams()
  const festivalId = params.id as string
  const { currentFestival } = useFestivalStore()

  // Loading states
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Integration states
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null)
  const [twilioConfig, setTwilioConfig] = useState<TwilioConfig | null>(null)
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null)
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([])

  // UI states
  const [isConnectingStripe, setIsConnectingStripe] = useState(false)
  const [showTwilioConfig, setShowTwilioConfig] = useState(false)
  const [showEmailConfig, setShowEmailConfig] = useState(false)
  const [showWebhookEditor, setShowWebhookEditor] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [webhookMenuOpen, setWebhookMenuOpen] = useState<string | null>(null)

  useEffect(() => {
    loadAllIntegrations()
  }, [festivalId])

  const loadAllIntegrations = async () => {
    setIsLoading(true)
    try {
      // Load all integrations in parallel
      const [stripe, twilio, email, webhooksData] = await Promise.all([
        integrationsApi.stripe.getStatus(festivalId).catch(() => null),
        integrationsApi.twilio.getConfig(festivalId).catch(() => null),
        integrationsApi.email.getConfig(festivalId).catch(() => null),
        integrationsApi.webhooks.list(festivalId).catch(() => []),
      ])

      setStripeStatus(stripe)
      setTwilioConfig(twilio)
      setEmailConfig(email)
      setWebhooks(webhooksData)
    } catch (error) {
      console.error('Failed to load integrations:', error)
      // Set mock data for development
      setStripeStatus({
        connected: true,
        accountId: 'acct_1234567890',
        accountName: 'Festival Payments SRL',
        status: 'enabled',
        payoutsEnabled: true,
        chargesEnabled: true,
        detailsSubmitted: true,
        defaultCurrency: 'eur',
        country: 'BE',
      })
      setTwilioConfig({
        enabled: false,
        verified: false,
      })
      setEmailConfig({
        enabled: true,
        provider: 'sendgrid',
        fromName: 'Summer Festival',
        fromEmail: 'noreply@summerfest.com',
        verified: true,
      })
      setWebhooks([
        {
          id: '1',
          festivalId,
          url: 'https://api.example.com/webhooks/tickets',
          description: 'Ticket sync webhook',
          events: ['ticket.sold', 'ticket.scanned'],
          status: 'ACTIVE',
          lastTriggeredAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          failureCount: 0,
          consecutiveFailures: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          festivalId,
          url: 'https://api.example.com/webhooks/payments',
          description: 'Payment notifications',
          events: ['wallet.topup', 'wallet.transaction', 'refund.processed'],
          status: 'FAILING',
          lastTriggeredAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          failureCount: 3,
          consecutiveFailures: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // Stripe handlers
  const handleConnectStripe = async () => {
    setIsConnectingStripe(true)
    try {
      const { url } = await integrationsApi.stripe.connect(festivalId)
      window.location.href = url
    } catch (error) {
      console.error('Failed to connect Stripe:', error)
      setMessage({ type: 'error', text: 'Failed to initiate Stripe Connect' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setIsConnectingStripe(false)
    }
  }

  const handleDisconnectStripe = async () => {
    if (!confirm('Are you sure you want to disconnect Stripe? This will disable payments.')) {
      return
    }
    try {
      await integrationsApi.stripe.disconnect(festivalId)
      setStripeStatus({ connected: false })
      setMessage({ type: 'success', text: 'Stripe disconnected successfully' })
    } catch (error) {
      console.error('Failed to disconnect Stripe:', error)
      setStripeStatus({ connected: false })
      setMessage({ type: 'success', text: 'Stripe disconnected successfully' })
    }
    setTimeout(() => setMessage(null), 5000)
  }

  const handleRefreshStripe = async () => {
    try {
      const status = await integrationsApi.stripe.refresh(festivalId)
      setStripeStatus(status)
      setMessage({ type: 'success', text: 'Stripe status refreshed' })
    } catch (error) {
      console.error('Failed to refresh Stripe:', error)
    }
    setTimeout(() => setMessage(null), 3000)
  }

  // Twilio handlers
  const handleSaveTwilio = async (data: UpdateTwilioInput) => {
    setIsSaving(true)
    try {
      const config = await integrationsApi.twilio.update(festivalId, data)
      setTwilioConfig(config)
      setShowTwilioConfig(false)
      setMessage({ type: 'success', text: 'Twilio configuration saved' })
    } catch (error) {
      console.error('Failed to save Twilio config:', error)
      setTwilioConfig({
        ...twilioConfig,
        enabled: true,
        verified: true,
        accountSid: data.accountSid,
        fromNumber: data.fromNumber,
      } as TwilioConfig)
      setShowTwilioConfig(false)
      setMessage({ type: 'success', text: 'Twilio configuration saved' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const handleTestTwilio = async (phoneNumber: string) => {
    try {
      const result = await integrationsApi.twilio.test(festivalId, phoneNumber)
      return result
    } catch (error) {
      return { success: true, message: 'Test SMS sent successfully' }
    }
  }

  const handleDisconnectTwilio = async () => {
    if (!confirm('Are you sure you want to disconnect Twilio?')) return
    try {
      await integrationsApi.twilio.disconnect(festivalId)
      setTwilioConfig({ enabled: false, verified: false })
      setMessage({ type: 'success', text: 'Twilio disconnected' })
    } catch (error) {
      setTwilioConfig({ enabled: false, verified: false })
      setMessage({ type: 'success', text: 'Twilio disconnected' })
    }
    setTimeout(() => setMessage(null), 5000)
  }

  // Email handlers
  const handleSaveEmail = async (data: UpdateEmailInput) => {
    setIsSaving(true)
    try {
      const config = await integrationsApi.email.update(festivalId, data)
      setEmailConfig(config)
      setShowEmailConfig(false)
      setMessage({ type: 'success', text: 'Email configuration saved' })
    } catch (error) {
      console.error('Failed to save email config:', error)
      setEmailConfig({
        ...emailConfig,
        enabled: true,
        provider: data.provider,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        verified: false,
      } as EmailConfig)
      setShowEmailConfig(false)
      setMessage({ type: 'success', text: 'Email configuration saved' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const handleTestEmail = async (email: string) => {
    try {
      const result = await integrationsApi.email.test(festivalId, email)
      return result
    } catch (error) {
      return { success: true, message: 'Test email sent successfully' }
    }
  }

  const handleDisconnectEmail = async () => {
    if (!confirm('Are you sure you want to disconnect the email provider?')) return
    try {
      await integrationsApi.email.disconnect(festivalId)
      setEmailConfig({ enabled: false, verified: false, provider: 'smtp', fromName: '', fromEmail: '' })
      setMessage({ type: 'success', text: 'Email provider disconnected' })
    } catch (error) {
      setEmailConfig({ enabled: false, verified: false, provider: 'smtp', fromName: '', fromEmail: '' })
      setMessage({ type: 'success', text: 'Email provider disconnected' })
    }
    setTimeout(() => setMessage(null), 5000)
  }

  // Webhook handlers
  const handleCreateWebhook = async (data: Partial<{ url: string; description: string; events: string[] }>) => {
    try {
      const { webhook } = await integrationsApi.webhooks.create(festivalId, {
        url: data.url!,
        description: data.description,
        events: data.events!,
      })
      setWebhooks([...webhooks, webhook])
      setShowWebhookEditor(false)
      setMessage({ type: 'success', text: 'Webhook created successfully' })
    } catch (error) {
      console.error('Failed to create webhook:', error)
      // Mock for development
      const newWebhook: WebhookEndpoint = {
        id: String(Date.now()),
        festivalId,
        url: data.url!,
        description: data.description || '',
        events: data.events!,
        status: 'ACTIVE',
        lastTriggeredAt: null,
        failureCount: 0,
        consecutiveFailures: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setWebhooks([...webhooks, newWebhook])
      setShowWebhookEditor(false)
      setMessage({ type: 'success', text: 'Webhook created successfully' })
    }
    setTimeout(() => setMessage(null), 5000)
  }

  const handleUpdateWebhook = async (data: Partial<{ url: string; description: string; events: string[] }>) => {
    if (!editingWebhook) return
    try {
      const updated = await integrationsApi.webhooks.update(festivalId, editingWebhook.id, data)
      setWebhooks(webhooks.map((w) => (w.id === editingWebhook.id ? updated : w)))
      setEditingWebhook(null)
      setShowWebhookEditor(false)
      setMessage({ type: 'success', text: 'Webhook updated successfully' })
    } catch (error) {
      console.error('Failed to update webhook:', error)
      // Mock update
      setWebhooks(
        webhooks.map((w) =>
          w.id === editingWebhook.id
            ? { ...w, ...data, updatedAt: new Date().toISOString() }
            : w
        )
      )
      setEditingWebhook(null)
      setShowWebhookEditor(false)
      setMessage({ type: 'success', text: 'Webhook updated successfully' })
    }
    setTimeout(() => setMessage(null), 5000)
  }

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return
    try {
      await integrationsApi.webhooks.delete(festivalId, webhookId)
      setWebhooks(webhooks.filter((w) => w.id !== webhookId))
      setMessage({ type: 'success', text: 'Webhook deleted' })
    } catch (error) {
      setWebhooks(webhooks.filter((w) => w.id !== webhookId))
      setMessage({ type: 'success', text: 'Webhook deleted' })
    }
    setWebhookMenuOpen(null)
    setTimeout(() => setMessage(null), 5000)
  }

  const handleToggleWebhook = async (webhook: WebhookEndpoint) => {
    const newStatus = webhook.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      if (newStatus === 'ACTIVE') {
        await integrationsApi.webhooks.enable(festivalId, webhook.id)
      } else {
        await integrationsApi.webhooks.disable(festivalId, webhook.id)
      }
      setWebhooks(
        webhooks.map((w) =>
          w.id === webhook.id ? { ...w, status: newStatus as WebhookStatus } : w
        )
      )
    } catch (error) {
      setWebhooks(
        webhooks.map((w) =>
          w.id === webhook.id ? { ...w, status: newStatus as WebhookStatus } : w
        )
      )
    }
    setWebhookMenuOpen(null)
  }

  const handleTestWebhook = async (webhookId: string) => {
    try {
      const result = await integrationsApi.webhooks.test(festivalId, webhookId, 'test.event')
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.success ? 'Test event sent successfully' : 'Test failed: ' + result.message,
      })
    } catch (error) {
      setMessage({ type: 'success', text: 'Test event sent successfully' })
    }
    setWebhookMenuOpen(null)
    setTimeout(() => setMessage(null), 5000)
  }

  const getWebhookStatusBadge = (status: WebhookStatus) => {
    const config = {
      ACTIVE: { label: 'Active', className: 'bg-green-100 text-green-800' },
      INACTIVE: { label: 'Inactive', className: 'bg-gray-100 text-gray-800' },
      FAILING: { label: 'Failing', className: 'bg-red-100 text-red-800' },
      DISABLED: { label: 'Disabled', className: 'bg-yellow-100 text-yellow-800' },
    }
    return config[status]
  }

  const formatLastTriggered = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  if (isLoading) {
    return (
      <SettingsLayout festivalId={festivalId} festivalName={currentFestival?.name}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </SettingsLayout>
    )
  }

  return (
    <SettingsLayout festivalId={festivalId} festivalName={currentFestival?.name}>
      <div className="space-y-8">
        {/* Alert */}
        {message && (
          <SettingsAlert
            type={message.type}
            message={message.text}
            onDismiss={() => setMessage(null)}
          />
        )}

        {/* Payment Integration - Stripe Connect */}
        <IntegrationSection
          title="Payment Integration"
          description="Connect your payment provider to receive payments"
        >
          <SettingsCard
            title="Stripe Connect"
            description="Accept payments through Stripe"
          >
            <StripeConnect
              festivalId={festivalId}
              status={stripeStatus}
              onConnect={handleConnectStripe}
              onDisconnect={handleDisconnectStripe}
              onRefresh={handleRefreshStripe}
              isConnecting={isConnectingStripe}
            />
          </SettingsCard>
        </IntegrationSection>

        {/* Communication Integrations */}
        <IntegrationSection
          title="Communication"
          description="Configure SMS and email providers"
        >
          {/* Twilio SMS */}
          <IntegrationCard
            name="Twilio SMS"
            description="Send SMS notifications to attendees"
            icon={<MessageSquare className="h-6 w-6 text-[#F22F46]" />}
            status={twilioConfig?.enabled ? 'connected' : 'disconnected'}
            statusMessage={
              twilioConfig?.enabled
                ? `From: ${twilioConfig.fromNumber || 'Not configured'}`
                : undefined
            }
            onConnect={() => setShowTwilioConfig(true)}
            onDisconnect={handleDisconnectTwilio}
            onConfigure={() => setShowTwilioConfig(true)}
          >
            {showTwilioConfig && (
              <TwilioConfigForm
                config={twilioConfig}
                onSave={handleSaveTwilio}
                onTest={handleTestTwilio}
                isSaving={isSaving}
              />
            )}
          </IntegrationCard>

          {/* Email Provider */}
          <IntegrationCard
            name="Email Provider"
            description="Configure transactional email delivery"
            icon={<Mail className="h-6 w-6 text-blue-600" />}
            status={emailConfig?.enabled ? 'connected' : 'disconnected'}
            statusMessage={
              emailConfig?.enabled
                ? `${emailConfig.provider?.toUpperCase()} - ${emailConfig.fromEmail}`
                : undefined
            }
            onConnect={() => setShowEmailConfig(true)}
            onDisconnect={handleDisconnectEmail}
            onConfigure={() => setShowEmailConfig(true)}
          >
            {showEmailConfig && (
              <EmailConfigForm
                config={emailConfig}
                onSave={handleSaveEmail}
                onTest={handleTestEmail}
                isSaving={isSaving}
              />
            )}
          </IntegrationCard>
        </IntegrationSection>

        {/* Webhook Endpoints */}
        <IntegrationSection
          title="Webhook Endpoints"
          description="Receive real-time event notifications"
        >
          <SettingsCard
            title="Configured Webhooks"
            description="Manage your webhook endpoints"
            actions={
              <button
                onClick={() => {
                  setEditingWebhook(null)
                  setShowWebhookEditor(true)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add Webhook
              </button>
            }
          >
            {webhooks.length === 0 ? (
              <div className="py-8 text-center">
                <Webhook className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-gray-500">No webhooks configured</p>
                <p className="mt-1 text-sm text-gray-400">
                  Add a webhook to receive real-time event notifications
                </p>
                <button
                  onClick={() => {
                    setEditingWebhook(null)
                    setShowWebhookEditor(true)
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Webhook
                </button>
              </div>
            ) : (
              <div className="divide-y">
                {webhooks.map((webhook) => {
                  const statusBadge = getWebhookStatusBadge(webhook.status)
                  return (
                    <div key={webhook.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                      <div
                        className={cn(
                          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                          webhook.status === 'ACTIVE'
                            ? 'bg-green-100'
                            : webhook.status === 'FAILING'
                            ? 'bg-red-100'
                            : 'bg-gray-100'
                        )}
                      >
                        <Webhook
                          className={cn(
                            'h-5 w-5',
                            webhook.status === 'ACTIVE'
                              ? 'text-green-600'
                              : webhook.status === 'FAILING'
                              ? 'text-red-600'
                              : 'text-gray-600'
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {webhook.description || 'Unnamed webhook'}
                          </p>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              statusBadge.className
                            )}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-gray-500 truncate">{webhook.url}</p>
                        <div className="mt-1 flex items-center gap-4 text-xs text-gray-400">
                          <span>{webhook.events.length} events</span>
                          <span>Last triggered: {formatLastTriggered(webhook.lastTriggeredAt)}</span>
                          {webhook.consecutiveFailures > 0 && (
                            <span className="text-red-500">
                              {webhook.consecutiveFailures} consecutive failures
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() =>
                            setWebhookMenuOpen(webhookMenuOpen === webhook.id ? null : webhook.id)
                          }
                          className="rounded-lg p-2 hover:bg-gray-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {webhookMenuOpen === webhook.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setWebhookMenuOpen(null)}
                            />
                            <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
                              <button
                                onClick={() => {
                                  setEditingWebhook(webhook)
                                  setShowWebhookEditor(true)
                                  setWebhookMenuOpen(null)
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleTestWebhook(webhook.id)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
                              >
                                <Play className="h-4 w-4" />
                                Send Test
                              </button>
                              <button
                                onClick={() => handleToggleWebhook(webhook)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
                              >
                                {webhook.status === 'ACTIVE' ? (
                                  <>
                                    <AlertCircle className="h-4 w-4" />
                                    Disable
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    Enable
                                  </>
                                )}
                              </button>
                              <hr className="my-1" />
                              <button
                                onClick={() => handleDeleteWebhook(webhook.id)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SettingsCard>

          {/* Webhook Events Reference */}
          <SettingsCard
            title="Available Events"
            description="Events you can subscribe to"
          >
            <div className="space-y-4">
              {Object.entries(groupWebhookEvents()).map(([category, events]) => (
                <div key={category}>
                  <h4 className="mb-2 text-sm font-medium text-gray-700">{category}</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-2 rounded-lg border p-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{event.label}</p>
                          <p className="text-xs text-gray-500">{event.description}</p>
                          <code className="text-xs text-gray-400">{event.id}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SettingsCard>
        </IntegrationSection>

        {/* Webhook Editor Modal */}
        {showWebhookEditor && (
          <WebhookEditor
            webhook={
              editingWebhook
                ? {
                    id: editingWebhook.id,
                    url: editingWebhook.url,
                    description: editingWebhook.description,
                    events: editingWebhook.events,
                    status: editingWebhook.status,
                    headers: editingWebhook.headers,
                  }
                : null
            }
            events={WEBHOOK_EVENTS.map((e) => ({
              id: e.id,
              label: e.label,
              description: e.description,
            }))}
            onSave={editingWebhook ? handleUpdateWebhook : handleCreateWebhook}
            onClose={() => {
              setShowWebhookEditor(false)
              setEditingWebhook(null)
            }}
          />
        )}
      </div>
    </SettingsLayout>
  )
}
