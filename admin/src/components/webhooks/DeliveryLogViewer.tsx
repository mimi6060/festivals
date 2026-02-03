'use client'

import { useState } from 'react'
import {
  X,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, formatHttpStatusCode, type WebhookDelivery } from '@/lib/api/webhooks'

interface DeliveryLogViewerProps {
  delivery: WebhookDelivery
  onRetry?: () => Promise<void>
  onClose: () => void
}

export function DeliveryLogViewer({
  delivery,
  onRetry,
  onClose,
}: DeliveryLogViewerProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['request', 'response'])
  )
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const handleRetry = async () => {
    if (!onRetry) return
    setIsRetrying(true)
    try {
      await onRetry()
    } finally {
      setIsRetrying(false)
    }
  }

  const copyToClipboard = async (content: string, section: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedSection(section)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const formatJson = (jsonString: string): string => {
    try {
      return JSON.stringify(JSON.parse(jsonString), null, 2)
    } catch {
      return jsonString
    }
  }

  const formatHeaders = (headers: Record<string, string>): string => {
    return Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
  }

  const statusInfo = formatHttpStatusCode(delivery.responseCode)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-6">
          <div className="flex items-center gap-3">
            {delivery.success ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <XCircle className="h-6 w-6 text-red-500" />
            )}
            <div>
              <h2 className="text-xl font-semibold">Detail de la livraison</h2>
              <p className="text-sm text-gray-500">
                {new Date(delivery.deliveredAt).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-gray-500">Statut</p>
              <p className={cn('font-semibold', statusInfo.color)}>
                {statusInfo.label}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-gray-500">Duree</p>
              <p className="font-semibold">{formatDuration(delivery.duration)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-gray-500">Tentative</p>
              <p className="font-semibold">
                {delivery.attemptNumber}/{delivery.maxAttempts}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-gray-500">Evenement</p>
              <p className="font-semibold font-mono text-sm">{delivery.eventType}</p>
            </div>
          </div>

          {/* Error message */}
          {delivery.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h4 className="font-medium text-red-800 mb-1">Erreur</h4>
              <p className="text-sm text-red-700">{delivery.error}</p>
            </div>
          )}

          {/* Retry button for failed deliveries */}
          {!delivery.success && onRetry && (
            <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div>
                <h4 className="font-medium text-yellow-800">Livraison echouee</h4>
                <p className="text-sm text-yellow-700">
                  {delivery.nextRetryAt
                    ? `Prochaine tentative: ${new Date(delivery.nextRetryAt).toLocaleString('fr-FR')}`
                    : 'Nombre maximum de tentatives atteint'}
                </p>
              </div>
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 rounded-lg bg-yellow-600 px-3 py-2 text-sm text-white hover:bg-yellow-700 disabled:opacity-50"
              >
                <RefreshCw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
                {isRetrying ? 'Nouvelle tentative...' : 'Reessayer maintenant'}
              </button>
            </div>
          )}

          {/* Request Section */}
          <div className="rounded-lg border">
            <button
              onClick={() => toggleSection('request')}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <h3 className="font-semibold">Requete</h3>
              {expandedSections.has('request') ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {expandedSections.has('request') && (
              <div className="border-t p-4 space-y-4">
                {/* URL */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-gray-700">URL</h4>
                    <a
                      href={delivery.requestUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Ouvrir <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <code className="block rounded bg-gray-100 px-3 py-2 text-sm break-all">
                    POST {delivery.requestUrl}
                  </code>
                </div>

                {/* Request Headers */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-gray-700">En-tetes</h4>
                    <button
                      onClick={() => copyToClipboard(formatHeaders(delivery.requestHeaders), 'reqHeaders')}
                      className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedSection === 'reqHeaders' ? 'Copie!' : 'Copier'}
                    </button>
                  </div>
                  <pre className="rounded bg-gray-100 px-3 py-2 text-xs overflow-x-auto max-h-40">
                    {formatHeaders(delivery.requestHeaders)}
                  </pre>
                </div>

                {/* Request Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-gray-700">Corps</h4>
                    <button
                      onClick={() => copyToClipboard(delivery.requestBody, 'reqBody')}
                      className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedSection === 'reqBody' ? 'Copie!' : 'Copier'}
                    </button>
                  </div>
                  <pre className="rounded bg-gray-100 px-3 py-2 text-xs overflow-x-auto max-h-64">
                    {formatJson(delivery.requestBody)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Response Section */}
          <div className="rounded-lg border">
            <button
              onClick={() => toggleSection('response')}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Reponse</h3>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium',
                    delivery.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  )}
                >
                  {statusInfo.label}
                </span>
              </div>
              {expandedSections.has('response') ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {expandedSections.has('response') && (
              <div className="border-t p-4 space-y-4">
                {delivery.responseCode === null ? (
                  <div className="text-center py-4 text-gray-500">
                    <Clock className="h-8 w-8 mx-auto mb-2" />
                    <p>Aucune reponse recue (timeout ou erreur reseau)</p>
                  </div>
                ) : (
                  <>
                    {/* Response Headers */}
                    {delivery.responseHeaders && Object.keys(delivery.responseHeaders).length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-700">En-tetes</h4>
                          <button
                            onClick={() => copyToClipboard(formatHeaders(delivery.responseHeaders!), 'resHeaders')}
                            className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedSection === 'resHeaders' ? 'Copie!' : 'Copier'}
                          </button>
                        </div>
                        <pre className="rounded bg-gray-100 px-3 py-2 text-xs overflow-x-auto max-h-40">
                          {formatHeaders(delivery.responseHeaders)}
                        </pre>
                      </div>
                    )}

                    {/* Response Body */}
                    {delivery.responseBody && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-700">Corps</h4>
                          <button
                            onClick={() => copyToClipboard(delivery.responseBody!, 'resBody')}
                            className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedSection === 'resBody' ? 'Copie!' : 'Copier'}
                          </button>
                        </div>
                        <pre className="rounded bg-gray-100 px-3 py-2 text-xs overflow-x-auto max-h-64">
                          {formatJson(delivery.responseBody)}
                        </pre>
                      </div>
                    )}

                    {!delivery.responseBody && (
                      <p className="text-center py-4 text-gray-500">Corps de reponse vide</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Timing Info */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold mb-3">Informations de timing</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Cree le</p>
                <p className="font-medium">{new Date(delivery.createdAt).toLocaleString('fr-FR')}</p>
              </div>
              <div>
                <p className="text-gray-500">Envoye le</p>
                <p className="font-medium">{new Date(delivery.deliveredAt).toLocaleString('fr-FR')}</p>
              </div>
              <div>
                <p className="text-gray-500">Duree de la requete</p>
                <p className="font-medium">{formatDuration(delivery.duration)}</p>
              </div>
              <div>
                <p className="text-gray-500">ID de l'evenement</p>
                <p className="font-medium font-mono text-xs">{delivery.eventId}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white p-6">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// Compact log row component for list view
interface DeliveryLogRowProps {
  delivery: WebhookDelivery
  onClick: () => void
}

export function DeliveryLogRow({ delivery, onClick }: DeliveryLogRowProps) {
  const statusInfo = formatHttpStatusCode(delivery.responseCode)

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-lg bg-white p-3 text-sm text-left hover:bg-gray-50 border transition-colors"
    >
      <div className="flex items-center gap-3">
        {delivery.success ? (
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
        )}
        <div>
          <span className="font-mono text-gray-700">{delivery.eventType}</span>
          <span
            className={cn(
              'ml-2 rounded px-1.5 py-0.5 text-xs font-medium',
              delivery.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}
          >
            {statusInfo.label}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-gray-500">
        <span>{formatDuration(delivery.duration)}</span>
        <span className="text-xs">
          {new Date(delivery.deliveredAt).toLocaleString('fr-FR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </button>
  )
}
