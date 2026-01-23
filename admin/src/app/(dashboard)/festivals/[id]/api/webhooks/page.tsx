'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Webhook,
  Play,
  Pause,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Settings,
  Key,
  RotateCcw,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WebhookForm } from '@/components/webhooks/WebhookForm'
import { DeliveryLogRow, DeliveryLogViewer } from '@/components/webhooks/DeliveryLogViewer'
import {
  webhooksApi,
  WEBHOOK_EVENTS,
  getWebhookStatusLabel,
  getWebhookStatusColor,
  formatDuration,
  type Webhook as WebhookType,
  type WebhookDelivery,
  type CreateWebhookInput,
  type UpdateWebhookInput,
} from '@/lib/api/webhooks'

export default function WebhooksPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string

  const [webhooks, setWebhooks] = useState<WebhookType[]>([])
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({})
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null)
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null)
  const [testEventType, setTestEventType] = useState<string>('ticket.sold')
  const [showTestDialog, setShowTestDialog] = useState<string | null>(null)

  useEffect(() => {
    loadWebhooks()
  }, [festivalId])

  const loadWebhooks = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await webhooksApi.list(festivalId)
      // setWebhooks(response.data)

      // Mock data
      setWebhooks([
        {
          id: '1',
          festivalId,
          url: 'https://partner.example.com/webhooks/festival',
          description: 'Integration partenaire principal',
          events: ['ticket.sold', 'ticket.scanned', 'wallet.topup'],
          status: 'ACTIVE',
          lastTriggeredAt: new Date(Date.now() - 5 * 60000).toISOString(),
          failureCount: 0,
          consecutiveFailures: 0,
          createdAt: '2026-01-10T10:00:00Z',
          updatedAt: '2026-01-10T10:00:00Z',
        },
        {
          id: '2',
          festivalId,
          url: 'https://analytics.example.com/events',
          description: 'Tracking analytique',
          events: ['ticket.sold', 'wallet.transaction'],
          status: 'ACTIVE',
          lastTriggeredAt: new Date(Date.now() - 30 * 60000).toISOString(),
          failureCount: 0,
          consecutiveFailures: 0,
          createdAt: '2026-01-12T14:00:00Z',
          updatedAt: '2026-01-12T14:00:00Z',
        },
        {
          id: '3',
          festivalId,
          url: 'https://failing-endpoint.example.com/hook',
          description: 'Endpoint en echec',
          events: ['refund.requested'],
          status: 'FAILING',
          lastTriggeredAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
          failureCount: 5,
          consecutiveFailures: 5,
          createdAt: '2026-01-15T09:00:00Z',
          updatedAt: '2026-01-15T09:00:00Z',
        },
      ])

      // Mock deliveries
      setDeliveries({
        '1': [
          {
            id: 'd1',
            webhookId: '1',
            eventType: 'ticket.sold',
            eventId: 'evt_abc123',
            requestUrl: 'https://partner.example.com/webhooks/festival',
            requestHeaders: { 'Content-Type': 'application/json', 'X-Webhook-Signature': 'sha256=abc...' },
            requestBody: '{"event":"ticket.sold","data":{"ticketId":"tkt_123"}}',
            responseCode: 200,
            responseHeaders: { 'Content-Type': 'application/json' },
            responseBody: '{"received":true}',
            duration: 45,
            success: true,
            attemptNumber: 1,
            maxAttempts: 3,
            deliveredAt: new Date(Date.now() - 5 * 60000).toISOString(),
            createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
          },
          {
            id: 'd2',
            webhookId: '1',
            eventType: 'wallet.topup',
            eventId: 'evt_def456',
            requestUrl: 'https://partner.example.com/webhooks/festival',
            requestHeaders: { 'Content-Type': 'application/json', 'X-Webhook-Signature': 'sha256=def...' },
            requestBody: '{"event":"wallet.topup","data":{"walletId":"wal_456","amount":5000}}',
            responseCode: 200,
            responseHeaders: { 'Content-Type': 'application/json' },
            responseBody: '{"received":true}',
            duration: 52,
            success: true,
            attemptNumber: 1,
            maxAttempts: 3,
            deliveredAt: new Date(Date.now() - 15 * 60000).toISOString(),
            createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
          },
        ],
        '2': [
          {
            id: 'd4',
            webhookId: '2',
            eventType: 'ticket.sold',
            eventId: 'evt_ghi789',
            requestUrl: 'https://analytics.example.com/events',
            requestHeaders: { 'Content-Type': 'application/json' },
            requestBody: '{"event":"ticket.sold","data":{}}',
            responseCode: 200,
            responseHeaders: {},
            responseBody: '',
            duration: 120,
            success: true,
            attemptNumber: 1,
            maxAttempts: 3,
            deliveredAt: new Date(Date.now() - 30 * 60000).toISOString(),
            createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
          },
        ],
        '3': [
          {
            id: 'd6',
            webhookId: '3',
            eventType: 'refund.requested',
            eventId: 'evt_jkl012',
            requestUrl: 'https://failing-endpoint.example.com/hook',
            requestHeaders: { 'Content-Type': 'application/json' },
            requestBody: '{"event":"refund.requested","data":{}}',
            responseCode: 500,
            responseHeaders: { 'Content-Type': 'text/plain' },
            responseBody: 'Internal Server Error',
            duration: 5000,
            success: false,
            error: 'Internal Server Error',
            attemptNumber: 3,
            maxAttempts: 3,
            deliveredAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
            createdAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
          },
        ],
      })
    } catch (error) {
      console.error('Failed to load webhooks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateWebhook = async (data: CreateWebhookInput) => {
    try {
      // TODO: Replace with actual API call
      // const result = await webhooksApi.create(festivalId, data)
      // setNewSecret(result.secret)

      const mockSecret = `whsec_${generateRandomString(32)}`
      setNewSecret(mockSecret)

      const newWebhook: WebhookType = {
        id: String(Date.now()),
        festivalId,
        url: data.url,
        description: data.description || '',
        events: data.events,
        status: 'ACTIVE',
        headers: data.headers,
        lastTriggeredAt: null,
        failureCount: 0,
        consecutiveFailures: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setWebhooks([...webhooks, newWebhook])
    } catch (error) {
      console.error('Failed to create webhook:', error)
      throw error
    }
  }

  const handleUpdateWebhook = async (data: UpdateWebhookInput) => {
    if (!editingWebhook) return

    try {
      // TODO: Replace with actual API call
      // await webhooksApi.update(festivalId, editingWebhook.id, data)

      setWebhooks(
        webhooks.map((w) =>
          w.id === editingWebhook.id
            ? { ...w, ...data, updatedAt: new Date().toISOString() }
            : w
        )
      )
      setShowForm(false)
      setEditingWebhook(null)
    } catch (error) {
      console.error('Failed to update webhook:', error)
      throw error
    }
  }

  const handleToggleStatus = async (webhookId: string) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return

    const newStatus = webhook.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

    try {
      // TODO: Replace with actual API call
      // if (newStatus === 'ACTIVE') {
      //   await webhooksApi.enable(festivalId, webhookId)
      // } else {
      //   await webhooksApi.disable(festivalId, webhookId)
      // }

      setWebhooks(
        webhooks.map((w) =>
          w.id === webhookId ? { ...w, status: newStatus } : w
        )
      )
    } catch (error) {
      console.error('Failed to toggle webhook status:', error)
    }
  }

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Etes-vous sur de vouloir supprimer ce webhook ? Cette action est irreversible.')) {
      return
    }

    try {
      // TODO: Replace with actual API call
      // await webhooksApi.delete(festivalId, webhookId)

      setWebhooks(webhooks.filter((w) => w.id !== webhookId))
    } catch (error) {
      console.error('Failed to delete webhook:', error)
    }
  }

  const handleTestWebhook = async (webhookId: string, eventType: string) => {
    setTestingWebhook(webhookId)
    setShowTestDialog(null)

    try {
      // TODO: Replace with actual API call
      // const result = await webhooksApi.test(festivalId, webhookId, eventType)

      // Mock test delivery
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const testDelivery: WebhookDelivery = {
        id: `test-${Date.now()}`,
        webhookId,
        eventType,
        eventId: `evt_test_${generateRandomString(8)}`,
        requestUrl: webhooks.find((w) => w.id === webhookId)?.url || '',
        requestHeaders: { 'Content-Type': 'application/json', 'X-Webhook-Signature': 'sha256=test...' },
        requestBody: JSON.stringify({ event: eventType, data: { test: true }, timestamp: new Date().toISOString() }),
        responseCode: 200,
        responseHeaders: { 'Content-Type': 'application/json' },
        responseBody: '{"received":true}',
        duration: 125,
        success: true,
        attemptNumber: 1,
        maxAttempts: 1,
        deliveredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }

      setDeliveries({
        ...deliveries,
        [webhookId]: [testDelivery, ...(deliveries[webhookId] || [])],
      })

      // Auto-expand to show result
      setExpandedWebhook(webhookId)
    } catch (error) {
      console.error('Failed to test webhook:', error)
    } finally {
      setTestingWebhook(null)
    }
  }

  const handleRetryDelivery = async (webhookId: string, deliveryId: string) => {
    try {
      // TODO: Replace with actual API call
      // await webhooksApi.retryDelivery(festivalId, webhookId, deliveryId)

      // Mock retry
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Update the delivery to show it was retried
      setDeliveries({
        ...deliveries,
        [webhookId]: deliveries[webhookId]?.map((d) =>
          d.id === deliveryId
            ? { ...d, attemptNumber: d.attemptNumber + 1, success: true, responseCode: 200, error: undefined }
            : d
        ) || [],
      })

      setSelectedDelivery(null)
    } catch (error) {
      console.error('Failed to retry delivery:', error)
    }
  }

  const generateRandomString = (length: number) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `Il y a ${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Il y a ${hours}h`
    return `Il y a ${Math.floor(hours / 24)}j`
  }

  const getStatusConfig = (status: WebhookType['status']) => {
    switch (status) {
      case 'ACTIVE':
        return { label: 'Actif', className: 'bg-green-100 text-green-800', icon: CheckCircle }
      case 'INACTIVE':
        return { label: 'Inactif', className: 'bg-gray-100 text-gray-800', icon: Pause }
      case 'FAILING':
        return { label: 'En echec', className: 'bg-red-100 text-red-800', icon: AlertTriangle }
      case 'DISABLED':
        return { label: 'Desactive', className: 'bg-yellow-100 text-yellow-800', icon: XCircle }
      default:
        return { label: status, className: 'bg-gray-100 text-gray-800', icon: Clock }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="mt-1 text-gray-500">
            Configurez les webhooks pour recevoir des evenements en temps reel
          </p>
        </div>
        <button
          onClick={() => {
            setEditingWebhook(null)
            setNewSecret(null)
            setShowForm(true)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
        >
          <Plus className="h-5 w-5" />
          Nouveau webhook
        </button>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <Webhook className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Comment fonctionnent les webhooks</h4>
            <p className="mt-1 text-sm text-blue-800">
              Les webhooks envoient des requetes HTTP POST a votre endpoint chaque fois qu'un evenement se produit.
              Chaque requete inclut une signature HMAC-SHA256 pour verification.
              En cas d'echec, nous reessayons jusqu'a 3 fois avec un delai exponentiel.
            </p>
          </div>
        </div>
      </div>

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <Webhook className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-gray-500">Aucun webhook configure</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            Creer votre premier webhook
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => {
            const statusConfig = getStatusConfig(webhook.status)
            const StatusIcon = statusConfig.icon
            const isExpanded = expandedWebhook === webhook.id
            const webhookDeliveries = deliveries[webhook.id] || []

            return (
              <div
                key={webhook.id}
                className="rounded-lg border bg-white overflow-hidden"
              >
                {/* Webhook Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <Webhook className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={webhook.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-gray-900 truncate hover:text-primary"
                            >
                              {webhook.url}
                              <ExternalLink className="inline-block ml-1 h-3 w-3" />
                            </a>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                statusConfig.className
                              )}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig.label}
                            </span>
                          </div>
                          {webhook.description && (
                            <p className="text-sm text-gray-500 truncate">{webhook.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Events */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {webhook.events.slice(0, 5).map((event) => (
                          <span
                            key={event}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {event}
                          </span>
                        ))}
                        {webhook.events.length > 5 && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            +{webhook.events.length - 5} autres
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {/* Test Button */}
                      <div className="relative">
                        <button
                          onClick={() => setShowTestDialog(showTestDialog === webhook.id ? null : webhook.id)}
                          disabled={testingWebhook === webhook.id || webhook.status !== 'ACTIVE'}
                          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                          title="Tester le webhook"
                        >
                          {testingWebhook === webhook.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>

                        {/* Test Event Type Selector */}
                        {showTestDialog === webhook.id && (
                          <div className="absolute right-0 top-full mt-1 z-10 w-64 rounded-lg border bg-white shadow-lg p-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">Type d'evenement de test</p>
                            <select
                              value={testEventType}
                              onChange={(e) => setTestEventType(e.target.value)}
                              className="w-full rounded-lg border px-3 py-2 text-sm mb-2"
                            >
                              {webhook.events.map((event) => (
                                <option key={event} value={event}>
                                  {event}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleTestWebhook(webhook.id, testEventType)}
                              className="w-full rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90"
                            >
                              Envoyer le test
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleToggleStatus(webhook.id)}
                        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                        title={webhook.status === 'ACTIVE' ? 'Desactiver' : 'Activer'}
                      >
                        {webhook.status === 'ACTIVE' ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setEditingWebhook(webhook)
                          setNewSecret(null)
                          setShowForm(true)
                        }}
                        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                        title="Modifier"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                      <Link
                        href={`/festivals/${festivalId}/api/webhooks/${webhook.id}/logs`}
                        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                        title="Voir tous les logs"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDeleteWebhook(webhook.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    {webhook.lastTriggeredAt && (
                      <span>Dernier envoi: {formatTimeAgo(webhook.lastTriggeredAt)}</span>
                    )}
                    {webhook.failureCount > 0 && (
                      <span className="text-red-600">{webhook.failureCount} echec(s)</span>
                    )}
                    <button
                      onClick={() => setExpandedWebhook(isExpanded ? null : webhook.id)}
                      className="ml-auto flex items-center gap-1 hover:text-gray-700"
                    >
                      Historique recent
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Deliveries History (Inline Preview) */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">Derniers envois</h4>
                      <Link
                        href={`/festivals/${festivalId}/api/webhooks/${webhook.id}/logs`}
                        className="text-sm text-primary hover:underline"
                      >
                        Voir tout
                      </Link>
                    </div>
                    {webhookDeliveries.length === 0 ? (
                      <p className="text-sm text-gray-500">Aucun envoi enregistre</p>
                    ) : (
                      <div className="space-y-2">
                        {webhookDeliveries.slice(0, 5).map((delivery) => (
                          <DeliveryLogRow
                            key={delivery.id}
                            delivery={delivery}
                            onClick={() => setSelectedDelivery(delivery)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Webhook Form Modal */}
      {showForm && (
        <WebhookForm
          webhook={editingWebhook}
          onSave={editingWebhook ? handleUpdateWebhook : handleCreateWebhook}
          onClose={() => {
            setShowForm(false)
            setEditingWebhook(null)
            setNewSecret(null)
          }}
          newSecret={newSecret}
          onSecretAcknowledged={() => {
            setNewSecret(null)
            setShowForm(false)
          }}
        />
      )}

      {/* Delivery Log Viewer Modal */}
      {selectedDelivery && (
        <DeliveryLogViewer
          delivery={selectedDelivery}
          onRetry={
            !selectedDelivery.success
              ? () => handleRetryDelivery(selectedDelivery.webhookId, selectedDelivery.id)
              : undefined
          }
          onClose={() => setSelectedDelivery(null)}
        />
      )}
    </div>
  )
}
