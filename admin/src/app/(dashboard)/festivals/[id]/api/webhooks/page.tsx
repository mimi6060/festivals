'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WebhookEditor } from '@/components/api/WebhookEditor'

interface WebhookConfig {
  id: string
  url: string
  description: string
  events: string[]
  status: 'ACTIVE' | 'INACTIVE' | 'FAILING' | 'DISABLED'
  secret?: string
  lastTriggeredAt: string | null
  failureCount: number
  createdAt: string
}

interface WebhookDelivery {
  id: string
  webhookId: string
  eventType: string
  responseCode: number
  duration: number
  success: boolean
  error?: string
  attemptNumber: number
  deliveredAt: string
}

const availableEvents = [
  { id: 'ticket.sold', label: 'Billet vendu', description: 'Declenche quand un billet est achete' },
  { id: 'ticket.scanned', label: 'Billet scanne', description: 'Declenche quand un billet est scanne a l\'entree' },
  { id: 'ticket.transferred', label: 'Billet transfere', description: 'Declenche quand un billet est transfere' },
  { id: 'wallet.topup', label: 'Rechargement wallet', description: 'Declenche quand un wallet est recharge' },
  { id: 'wallet.transaction', label: 'Transaction wallet', description: 'Declenche pour chaque transaction' },
  { id: 'refund.requested', label: 'Remboursement demande', description: 'Declenche quand un remboursement est demande' },
  { id: 'refund.processed', label: 'Remboursement traite', description: 'Declenche quand un remboursement est effectue' },
  { id: 'festival.updated', label: 'Festival mis a jour', description: 'Declenche quand les infos festival changent' },
  { id: 'lineup.changed', label: 'Lineup modifie', description: 'Declenche quand la programmation change' },
]

export default function WebhooksPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({})
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null)

  useEffect(() => {
    loadWebhooks()
  }, [festivalId])

  const loadWebhooks = async () => {
    try {
      // TODO: Replace with actual API call
      // const data = await webhooksApi.list(festivalId)

      // Mock data
      setWebhooks([
        {
          id: '1',
          url: 'https://partner.example.com/webhooks/festival',
          description: 'Integration partenaire principal',
          events: ['ticket.sold', 'ticket.scanned', 'wallet.topup'],
          status: 'ACTIVE',
          lastTriggeredAt: new Date(Date.now() - 5 * 60000).toISOString(),
          failureCount: 0,
          createdAt: '2026-01-10T10:00:00Z',
        },
        {
          id: '2',
          url: 'https://analytics.example.com/events',
          description: 'Tracking analytique',
          events: ['ticket.sold', 'wallet.transaction'],
          status: 'ACTIVE',
          lastTriggeredAt: new Date(Date.now() - 30 * 60000).toISOString(),
          failureCount: 0,
          createdAt: '2026-01-12T14:00:00Z',
        },
        {
          id: '3',
          url: 'https://failing-endpoint.example.com/hook',
          description: 'Endpoint en echec',
          events: ['refund.requested'],
          status: 'FAILING',
          lastTriggeredAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
          failureCount: 5,
          createdAt: '2026-01-15T09:00:00Z',
        },
      ])

      // Mock deliveries
      setDeliveries({
        '1': [
          { id: 'd1', webhookId: '1', eventType: 'ticket.sold', responseCode: 200, duration: 45, success: true, attemptNumber: 1, deliveredAt: new Date(Date.now() - 5 * 60000).toISOString() },
          { id: 'd2', webhookId: '1', eventType: 'wallet.topup', responseCode: 200, duration: 52, success: true, attemptNumber: 1, deliveredAt: new Date(Date.now() - 15 * 60000).toISOString() },
          { id: 'd3', webhookId: '1', eventType: 'ticket.scanned', responseCode: 200, duration: 38, success: true, attemptNumber: 1, deliveredAt: new Date(Date.now() - 25 * 60000).toISOString() },
        ],
        '2': [
          { id: 'd4', webhookId: '2', eventType: 'ticket.sold', responseCode: 200, duration: 120, success: true, attemptNumber: 1, deliveredAt: new Date(Date.now() - 30 * 60000).toISOString() },
          { id: 'd5', webhookId: '2', eventType: 'wallet.transaction', responseCode: 200, duration: 89, success: true, attemptNumber: 1, deliveredAt: new Date(Date.now() - 45 * 60000).toISOString() },
        ],
        '3': [
          { id: 'd6', webhookId: '3', eventType: 'refund.requested', responseCode: 500, duration: 5000, success: false, error: 'Internal Server Error', attemptNumber: 3, deliveredAt: new Date(Date.now() - 2 * 60 * 60000).toISOString() },
          { id: 'd7', webhookId: '3', eventType: 'refund.requested', responseCode: 0, duration: 30000, success: false, error: 'Connection timeout', attemptNumber: 2, deliveredAt: new Date(Date.now() - 3 * 60 * 60000).toISOString() },
        ],
      })
    } catch (error) {
      console.error('Failed to load webhooks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateWebhook = async (data: Partial<WebhookConfig>) => {
    try {
      // TODO: Replace with actual API call
      // const result = await webhooksApi.create(festivalId, data)

      const mockSecret = `whsec_${generateRandomString(32)}`
      setNewSecret(mockSecret)

      const newWebhook: WebhookConfig = {
        id: String(Date.now()),
        url: data.url!,
        description: data.description || '',
        events: data.events || [],
        status: 'ACTIVE',
        secret: mockSecret,
        lastTriggeredAt: null,
        failureCount: 0,
        createdAt: new Date().toISOString(),
      }

      setWebhooks([...webhooks, newWebhook])
      setShowEditor(false)
      setEditingWebhook(null)
    } catch (error) {
      console.error('Failed to create webhook:', error)
    }
  }

  const handleUpdateWebhook = async (data: Partial<WebhookConfig>) => {
    if (!editingWebhook) return

    try {
      // TODO: Replace with actual API call
      // await webhooksApi.update(festivalId, editingWebhook.id, data)

      setWebhooks(webhooks.map(w =>
        w.id === editingWebhook.id
          ? { ...w, ...data }
          : w
      ))
      setShowEditor(false)
      setEditingWebhook(null)
    } catch (error) {
      console.error('Failed to update webhook:', error)
    }
  }

  const handleToggleStatus = async (webhookId: string) => {
    const webhook = webhooks.find(w => w.id === webhookId)
    if (!webhook) return

    const newStatus = webhook.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

    try {
      // TODO: Replace with actual API call
      // await webhooksApi.update(festivalId, webhookId, { status: newStatus })

      setWebhooks(webhooks.map(w =>
        w.id === webhookId
          ? { ...w, status: newStatus }
          : w
      ))
    } catch (error) {
      console.error('Failed to toggle webhook status:', error)
    }
  }

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Etes-vous sur de vouloir supprimer ce webhook ?')) return

    try {
      // TODO: Replace with actual API call
      // await webhooksApi.delete(festivalId, webhookId)

      setWebhooks(webhooks.filter(w => w.id !== webhookId))
    } catch (error) {
      console.error('Failed to delete webhook:', error)
    }
  }

  const handleTestWebhook = async (webhookId: string) => {
    setTestingWebhook(webhookId)
    try {
      // TODO: Replace with actual API call
      // const result = await webhooksApi.test(festivalId, webhookId, { eventType: 'ticket.sold' })

      // Mock test delivery
      await new Promise(resolve => setTimeout(resolve, 1000))

      const testDelivery: WebhookDelivery = {
        id: `test-${Date.now()}`,
        webhookId,
        eventType: 'ticket.sold',
        responseCode: 200,
        duration: 125,
        success: true,
        attemptNumber: 1,
        deliveredAt: new Date().toISOString(),
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

  const getStatusConfig = (status: WebhookConfig['status']) => {
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
            setShowEditor(true)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
        >
          <Plus className="h-5 w-5" />
          Nouveau webhook
        </button>
      </div>

      {/* New Secret Alert */}
      {newSecret && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-800">Secret de signature</h4>
              <p className="mt-1 text-sm text-yellow-700">
                Utilisez ce secret pour verifier la signature des webhooks. Il ne sera plus affiche.
              </p>
              <code className="mt-2 block rounded bg-yellow-100 px-3 py-2 text-sm font-mono break-all">
                {newSecret}
              </code>
              <button
                onClick={() => setNewSecret(null)}
                className="mt-3 text-sm text-yellow-700 hover:underline"
              >
                J'ai copie le secret
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <Webhook className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-gray-500">Aucun webhook configure</p>
          <button
            onClick={() => setShowEditor(true)}
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
                          <div className="flex items-center gap-2">
                            <a
                              href={webhook.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-gray-900 truncate hover:text-primary"
                            >
                              {webhook.url}
                              <ExternalLink className="inline-block ml-1 h-3 w-3" />
                            </a>
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                              statusConfig.className
                            )}>
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
                        {webhook.events.map((event) => (
                          <span
                            key={event}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {event}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleTestWebhook(webhook.id)}
                        disabled={testingWebhook === webhook.id || webhook.status !== 'ACTIVE'}
                        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                      >
                        {testingWebhook === webhook.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
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
                          setShowEditor(true)
                        }}
                        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDeleteWebhook(webhook.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
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
                      Historique
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Deliveries History */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Historique des envois</h4>
                    {webhookDeliveries.length === 0 ? (
                      <p className="text-sm text-gray-500">Aucun envoi enregistre</p>
                    ) : (
                      <div className="space-y-2">
                        {webhookDeliveries.slice(0, 5).map((delivery) => (
                          <div
                            key={delivery.id}
                            className="flex items-center justify-between rounded-lg bg-white p-3 text-sm"
                          >
                            <div className="flex items-center gap-3">
                              {delivery.success ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className="font-mono text-gray-600">{delivery.eventType}</span>
                              <span className={cn(
                                'rounded px-1.5 py-0.5 text-xs font-medium',
                                delivery.responseCode >= 200 && delivery.responseCode < 300
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              )}>
                                {delivery.responseCode || 'ERR'}
                              </span>
                              <span className="text-gray-400">{delivery.duration}ms</span>
                            </div>
                            <span className="text-gray-500">{formatTimeAgo(delivery.deliveredAt)}</span>
                          </div>
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

      {/* Webhook Editor Modal */}
      {showEditor && (
        <WebhookEditor
          webhook={editingWebhook}
          events={availableEvents}
          onSave={editingWebhook ? handleUpdateWebhook : handleCreateWebhook}
          onClose={() => {
            setShowEditor(false)
            setEditingWebhook(null)
          }}
        />
      )}
    </div>
  )
}
