'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown, Minus, Wifi, WifiOff } from 'lucide-react'
import type { StatsUpdate, ConnectionStatus } from '@/hooks/useWebSocket'

interface LiveStatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  change?: {
    value: number
    period?: string
  }
  className?: string
  isLive?: boolean
  animate?: boolean
}

function LiveStatCard({
  title,
  value,
  icon: Icon,
  change,
  className,
  isLive = false,
  animate = false,
}: LiveStatCardProps) {
  const getTrendIcon = () => {
    if (!change) return null
    if (change.value > 0) return TrendingUp
    if (change.value < 0) return TrendingDown
    return Minus
  }

  const getTrendColor = () => {
    if (!change) return ''
    if (change.value > 0) return 'text-green-600'
    if (change.value < 0) return 'text-red-600'
    return 'text-gray-500'
  }

  const TrendIcon = getTrendIcon()

  return (
    <div
      className={cn(
        'relative rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md',
        animate && 'animate-pulse-subtle',
        className
      )}
    >
      {isLive && (
        <span className="absolute right-3 top-3 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              'text-2xl font-bold tracking-tight transition-transform',
              animate && 'scale-105'
            )}
          >
            {value}
          </p>
          {change && (
            <div className={cn('flex items-center gap-1 text-sm', getTrendColor())}>
              {TrendIcon && <TrendIcon className="h-4 w-4" />}
              <span>
                {change.value > 0 ? '+' : ''}
                {change.value.toFixed(1)}%
              </span>
              {change.period && (
                <span className="text-muted-foreground">vs {change.period}</span>
              )}
            </div>
          )}
        </div>
        <div className="rounded-full bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  )
}

interface LiveStatsProps {
  stats: StatsUpdate | null
  connectionStatus: ConnectionStatus
  loading?: boolean
  icons: {
    revenue: LucideIcon
    tickets: LucideIcon
    wallets: LucideIcon
    transactions: LucideIcon
  }
  className?: string
}

export function LiveStats({
  stats,
  connectionStatus,
  loading = false,
  icons,
  className,
}: LiveStatsProps) {
  const [animatingField, setAnimatingField] = useState<string | null>(null)
  const prevStatsRef = useRef<StatsUpdate | null>(null)

  // Detect changes and animate
  useEffect(() => {
    if (stats && prevStatsRef.current) {
      const prev = prevStatsRef.current
      if (stats.total_revenue !== prev.total_revenue) {
        setAnimatingField('revenue')
        setTimeout(() => setAnimatingField(null), 500)
      } else if (stats.today_transactions !== prev.today_transactions) {
        setAnimatingField('transactions')
        setTimeout(() => setAnimatingField(null), 500)
      } else if (stats.tickets_used !== prev.tickets_used) {
        setAnimatingField('tickets')
        setTimeout(() => setAnimatingField(null), 500)
      } else if (stats.active_wallets !== prev.active_wallets) {
        setAnimatingField('wallets')
        setTimeout(() => setAnimatingField(null), 500)
      }
    }
    prevStatsRef.current = stats
  }, [stats])

  const isConnected = connectionStatus === 'connected'

  if (loading || !stats) {
    return (
      <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Connection Status Banner */}
      <div
        className={cn(
          'mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all',
          isConnected
            ? 'bg-green-50 text-green-700'
            : connectionStatus === 'connecting'
              ? 'bg-yellow-50 text-yellow-700'
              : 'bg-red-50 text-red-700'
        )}
      >
        {isConnected ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>Live - Real-time updates active</span>
          </>
        ) : connectionStatus === 'connecting' ? (
          <>
            <Wifi className="h-4 w-4 animate-pulse" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Disconnected - Attempting to reconnect...</span>
          </>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LiveStatCard
          title="Total Revenue"
          value={formatCurrency(stats.total_revenue)}
          icon={icons.revenue}
          change={{ value: stats.revenue_change, period: 'yesterday' }}
          isLive={isConnected}
          animate={animatingField === 'revenue'}
        />
        <LiveStatCard
          title="Tickets Used"
          value={`${formatNumber(stats.tickets_used)} / ${formatNumber(stats.tickets_sold)}`}
          icon={icons.tickets}
          isLive={isConnected}
          animate={animatingField === 'tickets'}
        />
        <LiveStatCard
          title="Active Wallets"
          value={formatNumber(stats.active_wallets)}
          icon={icons.wallets}
          change={{
            value:
              stats.average_wallet_balance > 0
                ? ((stats.average_wallet_balance - 25) / 25) * 100
                : 0,
            period: 'avg balance',
          }}
          isLive={isConnected}
          animate={animatingField === 'wallets'}
        />
        <LiveStatCard
          title="Today's Transactions"
          value={formatNumber(stats.today_transactions)}
          icon={icons.transactions}
          change={{
            value:
              stats.transaction_volume > 0
                ? ((stats.transaction_volume - 1000) / 1000) * 100
                : 0,
            period: 'volume',
          }}
          isLive={isConnected}
          animate={animatingField === 'transactions'}
        />
      </div>

      {/* Additional Stats Row */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Avg. Wallet Balance</p>
          <p className="text-xl font-bold">{formatCurrency(stats.average_wallet_balance)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Transaction Volume</p>
          <p className="text-xl font-bold">{formatCurrency(stats.transaction_volume)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Entries (Last Hour)</p>
          <p className="text-xl font-bold">{formatNumber(stats.entries_last_hour)}</p>
        </div>
      </div>
    </div>
  )
}
