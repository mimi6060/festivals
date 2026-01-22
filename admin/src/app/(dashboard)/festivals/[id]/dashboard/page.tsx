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
} from 'lucide-react'
import { LiveStats } from '@/components/dashboard/LiveStats'
import { LiveTransactions } from '@/components/dashboard/LiveTransactions'
import { LiveRevenue } from '@/components/dashboard/LiveRevenue'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { useDashboardWebSocket } from '@/hooks/useWebSocket'
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

  // WebSocket connection for real-time updates
  const {
    status: wsStatus,
    stats: liveStats,
    transactions: liveTransactions,
    alerts: liveAlerts,
    revenuePoints,
    reconnect,
  } = useDashboardWebSocket(festivalId, isLiveMode)

  // Fetch festival stats (fallback when WebSocket is not connected)
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: statsQueryKeys.festival(festivalId),
    queryFn: () => statsApi.getFestivalStats(festivalId),
    refetchInterval: isLiveMode && wsStatus === 'connected' ? false : 30000,
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
    refetchInterval: isLiveMode && wsStatus === 'connected' ? false : 15000,
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
    refetchInterval: isLiveMode && wsStatus === 'connected' ? false : 10000,
  })

  // Use live alerts if available, otherwise fallback to API
  const displayAlerts = liveAlerts.length > 0 ? liveAlerts : apiAlerts

  const handleRefresh = useCallback(() => {
    refetchStats()
    setLastRefresh(new Date())
    if (wsStatus !== 'connected') {
      reconnect()
    }
  }, [refetchStats, wsStatus, reconnect])

  const toggleLiveMode = useCallback(() => {
    setIsLiveMode((prev) => !prev)
  }, [])

  // Convert API stats to WebSocket format for LiveStats component
  const convertedStats = liveStats || (stats ? {
    total_revenue: stats.totalRevenue,
    revenue_change: stats.revenueChange,
    tickets_sold: stats.ticketsSold,
    tickets_used: stats.ticketsUsed,
    active_wallets: stats.activeWallets,
    today_transactions: stats.todayTransactions,
    transaction_volume: stats.transactionVolume,
    average_wallet_balance: stats.averageWalletBalance,
    entries_last_hour: 0,
    timestamp: new Date().toISOString(),
  } : null)

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'error':
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

      {/* Alerts */}
      {displayAlerts && displayAlerts.length > 0 && (
        <div className="space-y-2">
          {displayAlerts.map((alert) => {
            const AlertIcon = getAlertIcon(alert.type as Alert['type'])
            return (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-4',
                  getAlertColor(alert.type)
                )}
              >
                <AlertIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">{alert.title}</p>
                  <p className="text-sm opacity-90">{alert.message}</p>
                </div>
                {('actionUrl' in alert && alert.actionUrl) || ('action_url' in alert && alert.action_url) ? (
                  <Link
                    href={('actionUrl' in alert ? alert.actionUrl : alert.action_url) || '#'}
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
        connectionStatus={wsStatus}
        loading={statsLoading && !liveStats}
        icons={{
          revenue: DollarSign,
          tickets: Ticket,
          wallets: Wallet,
          transactions: CreditCard,
        }}
      />

      {/* Charts and Live Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Revenue Chart */}
        <div className="lg:col-span-2">
          {isLiveMode && revenuePoints.length > 0 ? (
            <LiveRevenue
              revenuePoints={revenuePoints}
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
          {isLiveMode && liveTransactions.length > 0 ? (
            <LiveTransactions
              transactions={liveTransactions}
              loading={false}
              maxItems={10}
              title="Transactions en direct"
            />
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
              <h3 className="font-semibold text-gray-900">Performance du Festival</h3>
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
