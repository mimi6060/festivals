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
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface IntegrationCardProps {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  connected: boolean
  status?: 'active' | 'inactive' | 'error' | 'pending'
  lastSyncAt?: string
  onConnect?: () => void
  onDisconnect?: () => void
  onConfigure?: () => void
  configUrl?: string
  children?: React.ReactNode
  disabled?: boolean
  loading?: boolean
}

export function IntegrationCard({
  id,
  name,
  description,
  icon,
  connected,
  status = 'inactive',
  lastSyncAt,
  onConnect,
  onDisconnect,
  onConfigure,
  configUrl,
  children,
  disabled = false,
  loading = false,
}: IntegrationCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const statusConfig = {
    active: { label: 'Active', className: 'bg-green-100 text-green-800' },
    inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-800' },
    error: { label: 'Error', className: 'bg-red-100 text-red-800' },
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  }

  const currentStatus = statusConfig[status]

  const formatLastSync = (timestamp?: string) => {
    if (!timestamp) return null
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `Last synced ${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Last synced ${hours}h ago`
    return `Last synced ${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className={cn(
      'rounded-lg border bg-white transition-shadow',
      connected && 'border-green-200',
      disabled && 'opacity-60'
    )}>
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg',
            connected ? 'bg-green-100' : 'bg-gray-100'
          )}>
            {icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{name}</h3>
              {connected && (
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  currentStatus.className
                )}>
                  {currentStatus.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
            {connected && lastSyncAt && (
              <p className="mt-1 text-xs text-gray-400">{formatLastSync(lastSyncAt)}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : connected ? (
              <>
                {(onConfigure || configUrl || children) && (
                  <button
                    onClick={() => children ? setIsExpanded(!isExpanded) : (configUrl ? window.open(configUrl, '_blank') : onConfigure?.())}
                    disabled={disabled}
                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {children ? (
                      <span className="flex items-center gap-1">
                        <Settings className="h-4 w-4" />
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
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
                    <X className="h-4 w-4" />
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onConnect}
                disabled={disabled}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Config */}
      {children && isExpanded && connected && (
        <div className="border-t bg-gray-50 p-4">
          {children}
        </div>
      )}
    </div>
  )
}

interface IntegrationGroupProps {
  title: string
  description?: string
  children: React.ReactNode
}

export function IntegrationGroup({ title, description, children }: IntegrationGroupProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}
