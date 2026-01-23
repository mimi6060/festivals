'use client'

import * as React from 'react'
import {
  Check,
  X,
  ExternalLink,
  Settings,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending'

interface IntegrationCardProps {
  name: string
  description: string
  icon: React.ReactNode
  status: IntegrationStatus
  statusMessage?: string
  lastSyncAt?: string | null
  onConnect?: () => void
  onDisconnect?: () => void
  onConfigure?: () => void
  onRefresh?: () => void
  configUrl?: string
  children?: React.ReactNode
  disabled?: boolean
  loading?: boolean
  connectLabel?: string
  disconnectLabel?: string
}

export function IntegrationCard({
  name,
  description,
  icon,
  status,
  statusMessage,
  lastSyncAt,
  onConnect,
  onDisconnect,
  onConfigure,
  onRefresh,
  configUrl,
  children,
  disabled = false,
  loading = false,
  connectLabel = 'Connect',
  disconnectLabel = 'Disconnect',
}: IntegrationCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const statusConfig = {
    connected: { label: 'Connected', className: 'bg-green-100 text-green-800', icon: Check },
    disconnected: { label: 'Not connected', className: 'bg-gray-100 text-gray-800', icon: X },
    error: { label: 'Error', className: 'bg-red-100 text-red-800', icon: AlertCircle },
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800', icon: Loader2 },
  }

  const currentStatus = statusConfig[status]
  const StatusIcon = currentStatus.icon
  const isConnected = status === 'connected'

  const formatLastSync = (timestamp?: string | null) => {
    if (!timestamp) return null
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

  return (
    <div
      className={cn(
        'rounded-lg border bg-white transition-all',
        isConnected && 'border-green-200',
        status === 'error' && 'border-red-200',
        disabled && 'opacity-60'
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={cn(
              'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg',
              isConnected ? 'bg-green-100' : status === 'error' ? 'bg-red-100' : 'bg-gray-100'
            )}
          >
            {icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{name}</h3>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  currentStatus.className
                )}
              >
                <StatusIcon
                  className={cn('h-3 w-3', status === 'pending' && 'animate-spin')}
                />
                {currentStatus.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
            {statusMessage && (
              <p
                className={cn(
                  'mt-1 text-xs',
                  status === 'error' ? 'text-red-600' : 'text-gray-400'
                )}
              >
                {statusMessage}
              </p>
            )}
            {isConnected && lastSyncAt && (
              <p className="mt-1 text-xs text-gray-400">Last synced {formatLastSync(lastSyncAt)}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : isConnected ? (
              <>
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={disabled}
                    className="rounded-lg border p-2 hover:bg-gray-50 disabled:opacity-50"
                    title="Refresh status"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
                {(onConfigure || configUrl || children) && (
                  <button
                    onClick={() =>
                      children
                        ? setIsExpanded(!isExpanded)
                        : configUrl
                        ? window.open(configUrl, '_blank')
                        : onConfigure?.()
                    }
                    disabled={disabled}
                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {children ? (
                      <span className="flex items-center gap-1">
                        <Settings className="h-4 w-4" />
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </span>
                    ) : configUrl ? (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    ) : (
                      <Settings className="h-4 w-4" />
                    )}
                  </button>
                )}
                {onDisconnect && (
                  <button
                    onClick={onDisconnect}
                    disabled={disabled}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {disconnectLabel}
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onConnect}
                disabled={disabled || status === 'pending'}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {connectLabel}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Config */}
      {children && isExpanded && isConnected && (
        <div className="border-t bg-gray-50 p-4">{children}</div>
      )}
    </div>
  )
}

interface IntegrationSectionProps {
  title: string
  description?: string
  children: React.ReactNode
}

export function IntegrationSection({ title, description, children }: IntegrationSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

interface IntegrationDetailProps {
  label: string
  value: React.ReactNode
  className?: string
}

export function IntegrationDetail({ label, value, className }: IntegrationDetailProps) {
  return (
    <div className={cn('flex justify-between text-sm', className)}>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  )
}
