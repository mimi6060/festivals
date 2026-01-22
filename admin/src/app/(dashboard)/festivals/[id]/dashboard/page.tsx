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
} from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import {
  statsApi,
  statsQueryKeys,
  FestivalStats,
  TopProduct,
  StaffActivityItem,
  Alert,
} from '@/lib/api/stats'
import { formatCurrency, formatNumber, formatDateTime, cn } from '@/lib/utils'

export default function FestivalDashboardPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Fetch festival stats
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: statsQueryKeys.festival(festivalId),
    queryFn: () => statsApi.getFestivalStats(festivalId),
    refetchInterval: 30000, // Refetch every 30 seconds for real-time feel
  })

  // Fetch revenue data
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: statsQueryKeys.revenue(festivalId, 7),
    queryFn: () => statsApi.getRevenueData(festivalId, 7),
  })

  // Fetch recent activities
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: statsQueryKeys.activities(festivalId),
    queryFn: () => statsApi.getRecentActivities(festivalId, 15),
    refetchInterval: 15000, // Refetch every 15 seconds
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

  // Fetch alerts
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: statsQueryKeys.alerts(festivalId),
    queryFn: () => statsApi.getAlerts(festivalId),
    refetchInterval: 10000, // Check for new alerts frequently
  })

  const handleRefresh = useCallback(() => {
    refetchStats()
    setLastRefresh(new Date())
  }, [refetchStats])

  // Real-time stats via SSE (Server-Sent Events)
  useEffect(() => {
    const eventSource = new EventSource(statsApi.getRealtimeStatsUrl(festivalId))

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Handle real-time updates - in a real app, we'd update the query cache
        console.log('Real-time update:', data)
      } catch (e) {
        // Ignore parse errors
      }
    }

    eventSource.onerror = () => {
      // SSE connection failed, rely on polling instead
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [festivalId])

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

  const getAlertColor = (type: Alert['type']) => {
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
            Back to Overview
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Last updated: {formatDateTime(lastRefresh.toISOString())}
          </span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const AlertIcon = getAlertIcon(alert.type)
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
                {alert.actionUrl && (
                  <Link
                    href={alert.actionUrl}
                    className="text-sm font-medium underline hover:no-underline"
                  >
                    View
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={stats ? formatCurrency(stats.totalRevenue) : '-'}
          icon={DollarSign}
          change={stats ? { value: stats.revenueChange, period: 'yesterday' } : undefined}
          loading={statsLoading}
        />
        <StatCard
          title="Tickets Used"
          value={
            stats
              ? `${formatNumber(stats.ticketsUsed)} / ${formatNumber(stats.ticketsSold)}`
              : '-'
          }
          icon={Ticket}
          loading={statsLoading}
        />
        <StatCard
          title="Active Wallets"
          value={stats ? formatNumber(stats.activeWallets) : '-'}
          icon={Wallet}
          change={
            stats
              ? {
                  value:
                    stats.averageWalletBalance > 0
                      ? ((stats.averageWalletBalance - 25) / 25) * 100
                      : 0,
                  period: 'avg balance',
                }
              : undefined
          }
          loading={statsLoading}
        />
        <StatCard
          title="Today's Transactions"
          value={stats ? formatNumber(stats.todayTransactions) : '-'}
          icon={CreditCard}
          change={
            stats
              ? {
                  value:
                    stats.transactionVolume > 0
                      ? ((stats.transactionVolume - 1000) / 1000) * 100
                      : 0,
                  period: 'volume',
                }
              : undefined
          }
          loading={statsLoading}
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart
            data={revenueData || []}
            loading={revenueLoading}
            title="Revenue (Last 7 Days)"
          />
        </div>
        <div className="lg:col-span-1">
          <ActivityFeed
            activities={activities || []}
            loading={activitiesLoading}
            maxItems={8}
            title="Live Activity"
          />
        </div>
      </div>

      {/* Top Products and Staff Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Selling Products */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-6 py-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Top Selling Products
            </h3>
            <p className="text-sm text-muted-foreground">
              Best performers by revenue
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
                        {product.standName} - {product.quantity} sold
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
              <p className="text-center text-sm text-gray-500">No product data available</p>
            )}
          </div>
        </div>

        {/* Staff Activity */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-6 py-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-primary" />
              Staff Activity
            </h3>
            <p className="text-sm text-muted-foreground">
              Active team members today
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
                        {staff.role} - Checked in{' '}
                        {formatDateTime(staff.checkinTime)}
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
                <p className="mt-2 text-sm text-gray-500">No staff checked in yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Summary */}
      {stats && (
        <div className="rounded-lg border bg-gradient-to-r from-primary/10 to-primary/5 p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold text-gray-900">Festival Performance</h3>
              <p className="text-sm text-gray-600">
                Average wallet balance: {formatCurrency(stats.averageWalletBalance)} |
                Transaction volume: {formatCurrency(stats.transactionVolume)} |
                Ticket utilization:{' '}
                {stats.ticketsSold > 0
                  ? ((stats.ticketsUsed / stats.ticketsSold) * 100).toFixed(1)
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
