'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import type { ConnectionState } from '@/lib/websocket'

export interface ConnectionStatusProps {
  /** Current connection state */
  state: ConnectionState
  /** Show as banner (full width) or badge (inline) */
  variant?: 'banner' | 'badge' | 'minimal' | 'icon-only'
  /** Additional CSS classes */
  className?: string
  /** Callback when reconnect button is clicked */
  onReconnect?: () => void
  /** Show reconnect button */
  showReconnectButton?: boolean
  /** Custom labels */
  labels?: {
    connected?: string
    connecting?: string
    disconnected?: string
    reconnecting?: string
    error?: string
  }
}

interface StateConfig {
  icon: typeof Wifi
  label: string
  description: string
  bgColor: string
  textColor: string
  iconColor: string
  animate?: boolean
}

const DEFAULT_LABELS = {
  connected: 'Connected',
  connecting: 'Connecting...',
  disconnected: 'Disconnected',
  reconnecting: 'Reconnecting...',
  error: 'Connection Error',
}

function getStateConfig(state: ConnectionState, labels: typeof DEFAULT_LABELS): StateConfig {
  switch (state) {
    case 'connected':
      return {
        icon: Wifi,
        label: labels.connected,
        description: 'Real-time updates are active',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        iconColor: 'text-green-600',
      }
    case 'connecting':
      return {
        icon: Loader2,
        label: labels.connecting,
        description: 'Establishing connection...',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        iconColor: 'text-yellow-600',
        animate: true,
      }
    case 'reconnecting':
      return {
        icon: RefreshCw,
        label: labels.reconnecting,
        description: 'Attempting to reconnect...',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        iconColor: 'text-yellow-600',
        animate: true,
      }
    case 'disconnected':
      return {
        icon: WifiOff,
        label: labels.disconnected,
        description: 'Real-time updates paused',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-700',
        iconColor: 'text-gray-500',
      }
    case 'error':
      return {
        icon: AlertTriangle,
        label: labels.error,
        description: 'Unable to establish connection',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        iconColor: 'text-red-600',
      }
    default:
      return {
        icon: WifiOff,
        label: 'Unknown',
        description: 'Connection state unknown',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-700',
        iconColor: 'text-gray-500',
      }
  }
}

/**
 * Banner variant - Full width status bar
 */
function ConnectionBanner({
  state,
  config,
  onReconnect,
  showReconnectButton,
  className,
}: {
  state: ConnectionState
  config: StateConfig
  onReconnect?: () => void
  showReconnectButton?: boolean
  className?: string
}) {
  const Icon = config.icon
  const canReconnect = showReconnectButton && (state === 'disconnected' || state === 'error')

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md px-4 py-2 transition-all',
        config.bgColor,
        config.textColor,
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            'h-4 w-4',
            config.iconColor,
            config.animate && 'animate-spin'
          )}
        />
        <div>
          <span className="font-medium">{config.label}</span>
          <span className="ml-2 text-sm opacity-75">{config.description}</span>
        </div>
      </div>
      {canReconnect && (
        <button
          onClick={onReconnect}
          className={cn(
            'flex items-center gap-1 rounded-md px-3 py-1 text-sm font-medium transition-colors',
            'hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2',
            state === 'error' ? 'focus:ring-red-500' : 'focus:ring-gray-500'
          )}
        >
          <RefreshCw className="h-3 w-3" />
          Reconnect
        </button>
      )}
    </div>
  )
}

/**
 * Badge variant - Inline status indicator
 */
function ConnectionBadge({
  config,
  className,
}: {
  config: StateConfig
  className?: string
}) {
  const Icon = config.icon

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        config.bgColor,
        config.textColor,
        className
      )}
    >
      <Icon
        className={cn(
          'h-3 w-3',
          config.iconColor,
          config.animate && 'animate-spin'
        )}
      />
      {config.label}
    </div>
  )
}

/**
 * Minimal variant - Simple text with icon
 */
function ConnectionMinimal({
  config,
  className,
}: {
  config: StateConfig
  className?: string
}) {
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-sm',
        config.textColor,
        className
      )}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5',
          config.iconColor,
          config.animate && 'animate-spin'
        )}
      />
      <span>{config.label}</span>
    </div>
  )
}

/**
 * Icon-only variant - Just the icon with tooltip
 */
function ConnectionIconOnly({
  config,
  className,
}: {
  config: StateConfig
  className?: string
}) {
  const Icon = config.icon

  return (
    <div
      className={cn('relative', className)}
      title={`${config.label}: ${config.description}`}
    >
      <Icon
        className={cn(
          'h-4 w-4',
          config.iconColor,
          config.animate && 'animate-spin'
        )}
      />
      {config.label === DEFAULT_LABELS.connected && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )}
    </div>
  )
}

/**
 * Connection status indicator component
 * Shows the current WebSocket connection state in various formats
 */
export function ConnectionStatus({
  state,
  variant = 'banner',
  className,
  onReconnect,
  showReconnectButton = true,
  labels,
}: ConnectionStatusProps) {
  const mergedLabels = useMemo(
    () => ({ ...DEFAULT_LABELS, ...labels }),
    [labels]
  )
  const config = useMemo(
    () => getStateConfig(state, mergedLabels),
    [state, mergedLabels]
  )

  switch (variant) {
    case 'banner':
      return (
        <ConnectionBanner
          state={state}
          config={config}
          onReconnect={onReconnect}
          showReconnectButton={showReconnectButton}
          className={className}
        />
      )
    case 'badge':
      return <ConnectionBadge config={config} className={className} />
    case 'minimal':
      return <ConnectionMinimal config={config} className={className} />
    case 'icon-only':
      return <ConnectionIconOnly config={config} className={className} />
    default:
      return <ConnectionBanner state={state} config={config} className={className} />
  }
}

/**
 * Simple hook to get connection status color for custom implementations
 */
export function useConnectionStatusColor(state: ConnectionState) {
  return useMemo(() => {
    switch (state) {
      case 'connected':
        return { bg: 'bg-green-500', text: 'text-green-500', ring: 'ring-green-500' }
      case 'connecting':
      case 'reconnecting':
        return { bg: 'bg-yellow-500', text: 'text-yellow-500', ring: 'ring-yellow-500' }
      case 'disconnected':
        return { bg: 'bg-gray-400', text: 'text-gray-400', ring: 'ring-gray-400' }
      case 'error':
        return { bg: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500' }
      default:
        return { bg: 'bg-gray-400', text: 'text-gray-400', ring: 'ring-gray-400' }
    }
  }, [state])
}
