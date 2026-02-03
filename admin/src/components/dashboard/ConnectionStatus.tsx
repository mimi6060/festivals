'use client'

import { cn } from '@/lib/utils'
import { Wifi, WifiOff, RefreshCw, Signal, AlertTriangle } from 'lucide-react'
import type { ConnectionState } from '@/lib/websocket'

interface ConnectionStatusProps {
  state: ConnectionState
  reconnectAttempts?: number
  maxReconnectAttempts?: number
  onReconnect?: () => void
  className?: string
  variant?: 'minimal' | 'compact' | 'full'
  showReconnectButton?: boolean
}

export function ConnectionStatus({
  state,
  reconnectAttempts = 0,
  maxReconnectAttempts = 10,
  onReconnect,
  className,
  variant = 'compact',
  showReconnectButton = true,
}: ConnectionStatusProps) {
  const getStateConfig = () => {
    switch (state) {
      case 'connected':
        return {
          icon: Wifi,
          label: 'Connecte',
          description: 'Mises a jour en temps reel actives',
          bgColor: 'bg-green-50',
          textColor: 'text-green-700',
          borderColor: 'border-green-200',
          dotColor: 'bg-green-500',
          pulse: true,
        }
      case 'connecting':
        return {
          icon: Signal,
          label: 'Connexion...',
          description: 'Etablissement de la connexion',
          bgColor: 'bg-yellow-50',
          textColor: 'text-yellow-700',
          borderColor: 'border-yellow-200',
          dotColor: 'bg-yellow-500',
          pulse: true,
        }
      case 'reconnecting':
        return {
          icon: RefreshCw,
          label: 'Reconnexion...',
          description: `Tentative ${reconnectAttempts}/${maxReconnectAttempts}`,
          bgColor: 'bg-orange-50',
          textColor: 'text-orange-700',
          borderColor: 'border-orange-200',
          dotColor: 'bg-orange-500',
          pulse: true,
        }
      case 'disconnected':
        return {
          icon: WifiOff,
          label: 'Deconnecte',
          description: 'Connexion perdue',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-600',
          borderColor: 'border-gray-200',
          dotColor: 'bg-gray-400',
          pulse: false,
        }
      case 'error':
        return {
          icon: AlertTriangle,
          label: 'Erreur',
          description: 'Erreur de connexion',
          bgColor: 'bg-red-50',
          textColor: 'text-red-700',
          borderColor: 'border-red-200',
          dotColor: 'bg-red-500',
          pulse: false,
        }
      default:
        return {
          icon: WifiOff,
          label: 'Inconnu',
          description: '',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-600',
          borderColor: 'border-gray-200',
          dotColor: 'bg-gray-400',
          pulse: false,
        }
    }
  }

  const config = getStateConfig()
  const Icon = config.icon
  const showReconnect = showReconnectButton && (state === 'disconnected' || state === 'error')

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="relative flex h-2.5 w-2.5">
          {config.pulse && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                config.dotColor
              )}
            />
          )}
          <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', config.dotColor)} />
        </span>
        <span className={cn('text-xs font-medium', config.textColor)}>{config.label}</span>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
          config.bgColor,
          config.borderColor,
          config.textColor,
          className
        )}
      >
        <span className="relative flex h-2 w-2">
          {config.pulse && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                config.dotColor
              )}
            />
          )}
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', config.dotColor)} />
        </span>
        <Icon className={cn('h-4 w-4', state === 'reconnecting' && 'animate-spin')} />
        <span className="font-medium">{config.label}</span>
        {showReconnect && onReconnect && (
          <button
            onClick={onReconnect}
            className="ml-2 rounded px-2 py-0.5 text-xs font-medium hover:bg-white/50 transition-colors"
          >
            Reconnecter
          </button>
        )}
      </div>
    )
  }

  // Full variant
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-4',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <div className="relative">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full',
            state === 'connected' ? 'bg-green-100' : 'bg-white/50'
          )}
        >
          <Icon
            className={cn(
              'h-5 w-5',
              config.textColor,
              state === 'reconnecting' && 'animate-spin'
            )}
          />
        </div>
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
          {config.pulse && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                config.dotColor
              )}
            />
          )}
          <span className={cn('relative inline-flex h-3 w-3 rounded-full', config.dotColor)} />
        </span>
      </div>

      <div className="flex-1">
        <p className={cn('font-medium', config.textColor)}>{config.label}</p>
        {config.description && (
          <p className={cn('text-sm opacity-80', config.textColor)}>{config.description}</p>
        )}
      </div>

      {showReconnect && onReconnect && (
        <button
          onClick={onReconnect}
          className={cn(
            'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            'bg-white/50 hover:bg-white/80',
            config.textColor
          )}
        >
          <RefreshCw className="h-4 w-4" />
          Reconnecter
        </button>
      )}
    </div>
  )
}

/**
 * Live indicator dot with pulse animation
 */
export function LiveIndicator({
  isLive,
  className,
  size = 'md',
}: {
  isLive: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
  }

  return (
    <span className={cn('relative flex', sizeClasses[size], className)}>
      {isLive && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full',
          sizeClasses[size],
          isLive ? 'bg-green-500' : 'bg-gray-400'
        )}
      />
    </span>
  )
}

/**
 * Small badge showing connection status
 */
export function ConnectionBadge({
  state,
  className,
}: {
  state: ConnectionState
  className?: string
}) {
  const isConnected = state === 'connected'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        isConnected
          ? 'bg-green-100 text-green-700'
          : state === 'connecting' || state === 'reconnecting'
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-gray-100 text-gray-600',
        className
      )}
    >
      <LiveIndicator isLive={isConnected} size="sm" />
      {isConnected ? 'Live' : state === 'connecting' ? 'Connecting' : 'Offline'}
    </span>
  )
}
