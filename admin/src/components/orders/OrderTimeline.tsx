'use client'

import { cn, formatDateTime } from '@/lib/utils'
import {
  ShoppingCart,
  CheckCircle,
  XCircle,
  RotateCcw,
  Edit,
  AlertCircle,
} from 'lucide-react'
import type { OrderHistoryEntry } from '@/lib/api/orders'

interface OrderTimelineProps {
  history: OrderHistoryEntry[]
  className?: string
}

const actionConfig: Record<
  OrderHistoryEntry['action'],
  { icon: typeof CheckCircle; color: string; label: string }
> = {
  CREATED: { icon: ShoppingCart, color: 'bg-blue-500', label: 'Commande creee' },
  UPDATED: { icon: Edit, color: 'bg-gray-500', label: 'Commande modifiee' },
  COMPLETED: { icon: CheckCircle, color: 'bg-green-500', label: 'Commande completee' },
  CANCELLED: { icon: XCircle, color: 'bg-gray-500', label: 'Commande annulee' },
  REFUNDED: { icon: RotateCcw, color: 'bg-red-500', label: 'Commande remboursee' },
  PARTIAL_REFUND: { icon: AlertCircle, color: 'bg-orange-500', label: 'Remboursement partiel' },
}

export function OrderTimeline({ history, className }: OrderTimelineProps) {
  if (history.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        Aucun historique disponible
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      {/* Vertical line */}
      <div className="absolute left-4 top-0 h-full w-0.5 bg-gray-200" />

      <ul className="space-y-6">
        {history.map((entry, index) => {
          const config = actionConfig[entry.action]
          const Icon = config.icon
          const isFirst = index === 0

          return (
            <li key={entry.id} className="relative pl-10">
              {/* Icon */}
              <div
                className={cn(
                  'absolute left-0 flex h-8 w-8 items-center justify-center rounded-full',
                  config.color
                )}
              >
                <Icon className="h-4 w-4 text-white" />
              </div>

              {/* Content */}
              <div
                className={cn(
                  'rounded-lg border bg-white p-4',
                  isFirst && 'border-primary/20 bg-primary/5'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{config.label}</p>
                    <p className="text-sm text-gray-500">
                      par {entry.performedByName}
                    </p>
                  </div>
                  <time className="text-sm text-gray-500">
                    {formatDateTime(entry.createdAt)}
                  </time>
                </div>

                {entry.note && (
                  <div className="mt-2 rounded-md bg-gray-50 p-2">
                    <p className="text-sm text-gray-600">{entry.note}</p>
                  </div>
                )}

                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(entry.metadata).map(([key, value]) => (
                      <p key={key} className="text-xs text-gray-500">
                        <span className="font-medium">{formatMetadataKey(key)}:</span>{' '}
                        {formatMetadataValue(value)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function formatMetadataKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

function formatMetadataValue(value: unknown): string {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(value)
  }
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non'
  }
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
    return formatDateTime(value as string)
  }
  return String(value)
}

// Compact timeline for smaller spaces
export function OrderTimelineCompact({ history, className }: OrderTimelineProps) {
  if (history.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-2', className)}>
      {history.slice(0, 5).map((entry) => {
        const config = actionConfig[entry.action]
        const Icon = config.icon

        return (
          <div
            key={entry.id}
            className="flex items-center gap-3 text-sm"
          >
            <div
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                config.color
              )}
            >
              <Icon className="h-3 w-3 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-gray-900">{config.label}</p>
            </div>
            <time className="shrink-0 text-gray-500">
              {formatDateTime(entry.createdAt)}
            </time>
          </div>
        )
      })}
      {history.length > 5 && (
        <p className="pl-9 text-sm text-gray-500">
          +{history.length - 5} autres evenements
        </p>
      )}
    </div>
  )
}
