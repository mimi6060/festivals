'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  DollarSign,
  Ticket,
  Wallet,
  CreditCard,
  TrendingUp,
  Users,
  ShoppingBag,
  AlertCircle,
  CheckCircle,
  Info,
  RefreshCw,
  ArrowLeft,
  Radio,
  Activity,
} from 'lucide-react'
import { LiveStats } from '@/components/dashboard/LiveStats'
import { LiveTransactions } from '@/components/dashboard/LiveTransactions'
import { LiveRevenue } from '@/components/dashboard/LiveRevenue'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { ConnectionStatus, ConnectionBadge, LiveIndicator } from '@/components/dashboard/ConnectionStatus'
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard'
import {
  statsApi,
  statsQueryKeys,
  TopProduct,
  StaffActivityItem,
  Alert,
} from '@/lib/api/stats'
import { formatCurrency, formatNumber, formatDateTime, cn } from '@/lib/utils'

export default function FestivalDashboardPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isLiveMode, setIsLiveMode] = useState(true)

  // Real-time dashboard hook with all features
  const {
    stats: realtimeStats,
    animatedRevenue,
    isRevenueAnimating,
    transactions: liveTransactions,
    newTransactionsCount,
    alerts: liveAlerts,
    unreadAlertsCount,
    revenueHistory,
    connection,
    isLive,
    isLoading: realtimeLoading,
    reconnect,
    clearTransactions,
    markAlertsRead,
    clearAlerts,
    refresh: refreshRealtime,
  } = useRealtimeDashboard({
    festivalId,
    enabled: isLiveMode,
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectDelay: 2000,
    bufferUpdates: true,
  })

  // Fetch festival stats (fallback when WebSocket is not connected)
  const {
    data: apiStats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: statsQueryKeys.festival(festivalId),
    queryFn: () => statsApi.getFestivalStats(festivalId),
    refetchInterval: isLiveMode && isLive ? false : 30000,
  })

  // Fetch revenue data for historical chart
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: statsQueryKeys.revenue(festivalId, 7),
    queryFn: () => statsApi.getRevenueData(festivalId, 7),
  })

  // Fetch recent activities
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: statsQueryKeys.activities(festivalId),
    queryFn: () => statsApi.getRecentActivities(festivalId, 15),
    refetchInterval: isLiveMode && isLive ? false : 15000,
  })

  // Fetch top products
  const { data: topProducts, isLoading: productsLoading } = useQuery({
    queryKey: statsQueryKeys.topProducts(festivalId),
    queryFn: () => statsApi.getTopProducts(festivalId, 5),
  })

  // Fetch staff activity
  const { data: staffActivity, isLoading: staffLoading } = useQuery({
    queryKey: statsQueryKeys.staffActivity(festivalId),
    queryFn: () => statsApi.getStaffActivity(festivalId),
  })

  // Fetch alerts (fallback)
  const { data: apiAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: statsQueryKeys.alerts(festivalId),
    queryFn: () => statsApi.getAlerts(festivalId),
    refetchInterval: isLiveMode && isLive ? false : 10000,
  })

  // Use live alerts if available, otherwise fallback to API
  const displayAlerts = liveAlerts.length > 0 ? liveAlerts : apiAlerts

  // Convert stats to WebSocket format for LiveStats component
  const convertedStats = realtimeStats.lastUpdated
    ? {
        total_revenue: realtimeStats.totalRevenue,
        revenue_change: realtimeStats.revenueChange,
        tickets_sold: realtimeStats.ticketsSold,
        tickets_used: realtimeStats.ticketsUsed,
        active_wallets: realtimeStats.activeWallets,
        active_users: realtimeStats.activeUsers,
        today_transactions: realtimeStats.todayTransactions,
        transaction_volume: realtimeStats.transactionVolume,
        average_wallet_balance: realtimeStats.averageWalletBalance,
        entries_last_hour: realtimeStats.entriesLastHour,
        timestamp: realtimeStats.lastUpdated?.toISOString() || new Date().toISOString(),
      }
    : apiStats
      ? {
          total_revenue: apiStats.totalRevenue,
          revenue_change: apiStats.revenueChange,
          tickets_sold: apiStats.ticketsSold,
          tickets_used: apiStats.ticketsUsed,
          active_wallets: apiStats.activeWallets,
          active_users: apiStats.activeWallets,
          today_transactions: apiStats.todayTransactions,
          transaction_volume: apiStats.transactionVolume,
          average_wallet_balance: apiStats.averageWalletBalance,
          entries_last_hour: 0,
          timestamp: new Date().toISOString(),
        }
      : null

  // Convert live transactions to the format expected by LiveTransactions
  const formattedLiveTransactions = liveTransactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    wallet_id: tx.walletId,
    stand_name: tx.standName,
    product_name: tx.productName,
    staff_name: tx.staffName,
    timestamp: tx.timestamp.toISOString(),
  }))

  // Convert live revenue history for chart
  const liveRevenuePoints = revenueHistory.map((point) => ({
    timestamp: point.timestamp.toISOString(),
    revenue: point.revenue,
    label: point.label,
  }))

  const handleRefresh = useCallback(() => {
    refetchStats()
    setLastRefresh(new Date())
    if (!isLive) {
      reconnect()
    }
  }, [refetchStats, isLive, reconnect])

  const toggleLiveMode = useCallback(() => {
    setIsLiveMode((prev) => !prev)
  }, [])

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
      case 'critical':
        return AlertCircle
      case 'warning':
        return AlertCircle
      case 'info':
        return Info
      default:
        return Info
    }
  }

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error':
      case 'critical':
        return 'border-red-200 bg-red-50 text-red-800'
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800'
      case 'info':
        return 'border-blue-200 bg-blue-50 text-blue-800'
      default:
        return 'border-gray-200 bg-gray-50 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          {/* Connection Badge */}
          <ConnectionBadge state={connection.state} />
        </div>
        <div className="flex items-center gap-4">
          {/* Live Mode Toggle */}
          <button
            onClick={toggleLiveMode}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isLiveMode
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <Radio className={cn('h-4 w-4', isLiveMode && 'animate-pulse')} />
            {isLiveMode ? 'Mode Live' : 'Mode Standard'}
          </button>
          <span className="text-sm text-gray-500">
            Mise a jour: {formatDateTime(lastRefresh.toISOString())}
          </span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Connection Status Banner (when not connected in live mode) */}
      {isLiveMode && !isLive && (
        <ConnectionStatus
          state={connection.state}
          reconnectAttempts={connection.reconnectAttempts}
          maxReconnectAttempts={10}
          onReconnect={reconnect}
          variant="full"
        />
      )}

      {/* Alerts */}
      {displayAlerts && displayAlerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              Alertes {unreadAlertsCount > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {unreadAlertsCount} non lue{unreadAlertsCount > 1 ? 's' : ''}
                </span>
              )}
            </h3>
            {liveAlerts.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={markAlertsRead}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Marquer comme lues
                </button>
                <button
                  onClick={clearAlerts}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Effacer
                </button>
              </div>
            )}
          </div>
          {displayAlerts.slice(0, 3).map((alert) => {
            const AlertIcon = getAlertIcon(alert.type)
            const isNew = 'isRead' in alert && !alert.isRead
            return (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 transition-all',
                  getAlertColor(alert.type),
                  isNew && 'ring-2 ring-primary/20'
                )}
              >
                <AlertIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{alert.title}</p>
                    {isNew && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        Nouveau
                      </span>
                    )}
                  </div>
                  <p className="text-sm opacity-90">{alert.message}</p>
                </div>
                {(('actionUrl' in alert && alert.actionUrl) || ('action_url' in alert && (alert as {action_url?: string}).action_url)) ? (
                  <Link
                    href={('actionUrl' in alert ? alert.actionUrl : (alert as {action_url?: string}).action_url) || '#'}
                    className="text-sm font-medium underline hover:no-underline"
                  >
                    Voir
                  </Link>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {/* Live Stats Cards */}
      <LiveStats
        stats={convertedStats}
        connectionStatus={connection.state}
        loading={(statsLoading || realtimeLoading) && !convertedStats}
        icons={{
          revenue: DollarSign,
          tickets: Ticket,
          wallets: Wallet,
          transactions: CreditCard,
        }}
      />

      {/* Animated Revenue Counter (when live) */}
      {isLiveMode && isLive && realtimeStats.lastUpdated && (
        <div className="rounded-lg border bg-gradient-to-r from-green-50 to-emerald-50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full bg-green-100 transition-transform',
                isRevenueAnimating && 'scale-110'
              )}>
                <Activity className={cn(
                  'h-6 w-6 text-green-600',
                  isRevenueAnimating && 'animate-pulse'
                )} />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Revenue en direct</p>
                <p className={cn(
                  'text-3xl font-bold text-green-800 transition-all',
                  isRevenueAnimating && 'scale-105'
                )}>
                  {formatCurrency(animatedRevenue)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LiveIndicator isLive={true} size="lg" />
              <span className="text-sm font-medium text-green-700">
                {newTransactionsCount > 0 && (
                  <span className="mr-2 rounded-full bg-green-200 px-2 py-0.5 text-xs">
                    +{newTransactionsCount} nouveau{newTransactionsCount > 1 ? 'x' : ''}
                  </span>
                )}
                Mise a jour automatique
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Charts and Live Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Revenue Chart */}
        <div className="lg:col-span-2">
          {isLiveMode && liveRevenuePoints.length > 0 ? (
            <LiveRevenue
              revenuePoints={liveRevenuePoints}
              currentStats={convertedStats}
              loading={false}
              title="Revenue en temps reel"
            />
          ) : (
            <RevenueChart
              data={revenueData || []}
              loading={revenueLoading}
              title="Revenue (7 derniers jours)"
            />
          )}
        </div>

        {/* Live Transactions Feed */}
        <div className="lg:col-span-1">
          {isLiveMode && formattedLiveTransactions.length > 0 ? (
            <div className="relative">
              <LiveTransactions
                transactions={formattedLiveTransactions}
                loading={false}
                maxItems={10}
                title="Transactions en direct"
              />
              {liveTransactions.length > 0 && (
                <button
                  onClick={clearTransactions}
                  className="absolute right-4 top-4 text-xs text-gray-500 hover:text-gray-700"
                >
                  Effacer
                </button>
              )}
            </div>
          ) : (
            <ActivityFeed
              activities={activities || []}
              loading={activitiesLoading}
              maxItems={8}
              title="Activite recente"
            />
          )}
        </div>
      </div>

      {/* Top Products and Staff Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Selling Products */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-6 py-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Produits les plus vendus
            </h3>
            <p className="text-sm text-muted-foreground">
              Meilleurs performances par revenu
            </p>
          </div>
          <div className="p-6">
            {productsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : topProducts && topProducts.length > 0 ? (
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center gap-4">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                        index === 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : index === 1
                            ? 'bg-gray-200 text-gray-700'
                            : index === 2
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        {product.standName} - {product.quantity} vendus
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatCurrency(product.revenue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500">Aucune donnee produit disponible</p>
            )}
          </div>
        </div>

        {/* Staff Activity */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-6 py-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-primary" />
              Activite du personnel
            </h3>
            <p className="text-sm text-muted-foreground">
              Membres actifs aujourd'hui
            </p>
          </div>
          <div className="p-6">
            {staffLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : staffActivity && staffActivity.length > 0 ? (
              <div className="space-y-4">
                {staffActivity.map((staff) => (
                  <div key={staff.id} className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {staff.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{staff.name}</p>
                      <p className="text-sm text-gray-500">
                        {staff.role} - Arrive {formatDateTime(staff.checkinTime)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {staff.transactionCount} txns
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(staff.totalSales)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">Aucun personnel enregistre</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Summary */}
      {convertedStats && (
        <div className="rounded-lg border bg-gradient-to-r from-primary/10 to-primary/5 p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Performance du Festival</h3>
                {isLive && <LiveIndicator isLive={true} />}
              </div>
              <p className="text-sm text-gray-600">
                Solde moyen portefeuille: {formatCurrency(convertedStats.average_wallet_balance)} |
                Volume transactions: {formatCurrency(convertedStats.transaction_volume)} |
                Utilisation billets:{' '}
                {convertedStats.tickets_sold > 0
                  ? ((convertedStats.tickets_used / convertedStats.tickets_sold) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
