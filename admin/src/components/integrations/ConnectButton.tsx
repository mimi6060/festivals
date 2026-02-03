'use client'

import * as React from 'react'
import { Loader2, Link as LinkIcon, ExternalLink, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'stripe' | 'twilio' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ConnectButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  connected?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  children?: React.ReactNode
  className?: string
  loadingText?: string
  externalLink?: boolean
}

export function ConnectButton({
  onClick,
  disabled = false,
  loading = false,
  connected = false,
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className,
  loadingText = 'Connecting...',
  externalLink = false,
}: ConnectButtonProps) {
  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-white hover:bg-primary/90',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    stripe: 'bg-[#635BFF] text-white hover:bg-[#5851E5]',
    twilio: 'bg-[#F22F46] text-white hover:bg-[#D91C32]',
    outline: 'border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50',
  }

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  }

  const iconSizes: Record<ButtonSize, string> = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-5 w-5',
  }

  const defaultIcon = connected ? (
    <Check className={iconSizes[size]} />
  ) : externalLink ? (
    <ExternalLink className={iconSizes[size]} />
  ) : (
    <LinkIcon className={iconSizes[size]} />
  )

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {loading ? (
        <>
          <Loader2 className={cn(iconSizes[size], 'animate-spin')} />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {icon || defaultIcon}
          <span>{children || (connected ? 'Connected' : 'Connect')}</span>
        </>
      )}
    </button>
  )
}

interface OAuthConnectButtonProps {
  provider: 'stripe' | 'twilio' | 'google' | 'custom'
  onConnect: () => void
  onDisconnect?: () => void
  connected?: boolean
  loading?: boolean
  disabled?: boolean
  accountInfo?: {
    name?: string
    email?: string
    id?: string
  }
  className?: string
}

export function OAuthConnectButton({
  provider,
  onConnect,
  onDisconnect,
  connected = false,
  loading = false,
  disabled = false,
  accountInfo,
  className,
}: OAuthConnectButtonProps) {
  const providerConfig = {
    stripe: {
      name: 'Stripe',
      color: '#635BFF',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
        </svg>
      ),
    },
    twilio: {
      name: 'Twilio',
      color: '#F22F46',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.381 0 0 5.381 0 12s5.381 12 12 12 12-5.381 12-12S18.619 0 12 0zm0 20.16c-4.502 0-8.16-3.658-8.16-8.16S7.498 3.84 12 3.84s8.16 3.658 8.16 8.16-3.658 8.16-8.16 8.16zm0-13.92c-3.18 0-5.76 2.58-5.76 5.76s2.58 5.76 5.76 5.76 5.76-2.58 5.76-5.76-2.58-5.76-5.76-5.76zm3.36 5.76c0 1.856-1.504 3.36-3.36 3.36s-3.36-1.504-3.36-3.36 1.504-3.36 3.36-3.36 3.36 1.504 3.36 3.36z" />
        </svg>
      ),
    },
    google: {
      name: 'Google',
      color: '#4285F4',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      ),
    },
    custom: {
      name: 'Connect',
      color: '#6366F1',
      icon: <LinkIcon className="h-5 w-5" />,
    },
  }

  const config = providerConfig[provider]

  if (connected && accountInfo) {
    return (
      <div className={cn('rounded-lg border p-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: config.color }}
            >
              {config.icon}
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {accountInfo.name || config.name}
              </p>
              {accountInfo.email && (
                <p className="text-sm text-gray-500">{accountInfo.email}</p>
              )}
              {accountInfo.id && (
                <p className="text-xs text-gray-400">{accountInfo.id}</p>
              )}
            </div>
          </div>
          {onDisconnect && (
            <button
              onClick={onDisconnect}
              disabled={disabled || loading}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onConnect}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-white transition-all',
        'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      style={{ backgroundColor: config.color }}
    >
      {loading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          {config.icon}
          <span>Connect with {config.name}</span>
        </>
      )}
    </button>
  )
}

interface ConnectionStatusProps {
  connected: boolean
  error?: string | null
  className?: string
}

export function ConnectionStatus({ connected, error, className }: ConnectionStatusProps) {
  if (error) {
    return (
      <div className={cn('flex items-center gap-2 text-red-600', className)}>
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">{error}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        connected ? 'text-green-600' : 'text-gray-400',
        className
      )}
    >
      {connected ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
      <span className="text-sm">{connected ? 'Connected' : 'Not connected'}</span>
    </div>
  )
}
