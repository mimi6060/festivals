'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Map,
  Brain,
  Download,
  RefreshCw,
  ArrowLeft,
  Activity,
  Clock,
  DollarSign,
  UserCheck,
  Zap,
} from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import { analyticsApi, analyticsQueryKeys, type AnalyticsSummary, type RealTimeMetrics } from '@/lib/api/stats'
import { formatCurrency, formatNumber, formatDateTime, cn } from '@/lib/utils'

export default function AnalyticsDashboardPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')

  const getDateRange = () => {
    const end = new Date()
    const start = new Date()
    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7)
        break
      case '30d':
        start.setDate(start.getDate() - 30)
        break
      case '90d':
        start.setDate(start.getDate() - 90)
        break
    }
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    }
  }

  const { startDate, endDate } = getDateRange()

  // Fetch analytics summary
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: [...analyticsQueryKeys.summary(festivalId), dateRange],
    queryFn: () => analyticsApi.getSummary(festivalId, startDate, endDate),
  })

  // Fetch real-time metrics
  const { data: realtime, isLoading: realtimeLoading } = useQuery({
    queryKey: analyticsQueryKeys.realtime(festivalId),
    queryFn: () => analyticsApi.getRealTimeMetrics(festivalId),
    refetchInterval: 30000,
  })

  // Fetch key metrics
  const { data: conversionData } = useQuery({
    queryKey: [...analyticsQueryKeys.conversion(festivalId), dateRange],
    queryFn: () => analyticsApi.getConversionRate(festivalId, startDate, endDate),
  })

  const { data: avgSpendData } = useQuery({
    queryKey: analyticsQueryKeys.avgSpend(festivalId),
    queryFn: () => analyticsApi.getAverageSpend(festivalId),
  })

  const { data: retentionData } = useQuery({
    queryKey: analyticsQueryKeys.retention(festivalId),
    queryFn: () => analyticsApi.getRetentionRate(festivalId),
  })

  const analyticsModules = [
    {
      title: 'Entonnoirs de Conversion',
      description: 'Analysez les parcours utilisateurs et identifiez les points de friction',
      href: `/festivals/${festivalId}/analytics/funnels`,
      icon: Target,
      color: 'bg-blue-500',
    },
    {
      title: 'Analyse de Cohortes',
      description: 'Suivez la retention et le comportement des groupes dans le temps',
      href: `/festivals/${festivalId}/analytics/cohorts`,
      icon: Users,
      color: 'bg-green-500',
    },
    {
      title: 'Cartes de Chaleur',
      description: 'Visualisez les zones de forte affluence et les pics horaires',
      href: `/festivals/${festivalId}/analytics/heatmaps`,
      icon: Map,
      color: 'bg-orange-500',
    },
    {
      title: 'Predictions ML',
      description: 'Previsions de revenus, affluence et recommandations',
      href: `/festivals/${festivalId}/analytics/predictions`,
      icon: Brain,
      color: 'bg-purple-500',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/dashboard`}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Analytics Avances</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Date Range Selector */}
          <div className="flex rounded-lg border bg-white p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  dateRange === range
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {range === '7d' ? '7 jours' : range === '30d' ? '30 jours' : '90 jours'}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetchSummary()}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Real-time Banner */}
      {realtime && (
        <div className="rounded-lg border bg-gradient-to-r from-green-50 to-emerald-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900">Temps Reel</h3>
                <p className="text-sm text-green-700">
                  Derniere mise a jour: {formatDateTime(realtime.timestamp)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-900">{realtime.activeUsers}</p>
                <p className="text-xs text-green-700">Utilisateurs actifs</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-900">{realtime.eventsPerMinute.toFixed(1)}</p>
                <p className="text-xs text-green-700">Events/min</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-900">{realtime.transactionsNow}</p>
                <p className="text-xs text-green-700">Transactions/min</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(realtime.revenueLastHour)}
                </p>
                <p className="text-xs text-green-700">CA derniere heure</p>
              </div>
            </div>
          </div>
          {realtime.queueAlerts.length > 0 && (
            <div className="mt-3 rounded bg-yellow-100 p-2">
              <p className="text-sm font-medium text-yellow-800">
                Alertes file d'attente: {realtime.queueAlerts.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Taux de Conversion"
          value={conversionData ? `${conversionData.conversionRate.toFixed(1)}%` : '-'}
          icon={Target}
          loading={!conversionData}
        />
        <StatCard
          title="Depense Moyenne/Visiteur"
          value={avgSpendData?.averageSpendDisplay || '-'}
          icon={DollarSign}
          loading={!avgSpendData}
        />
        <StatCard
          title="Taux de Retention"
          value={retentionData ? `${retentionData.retentionRate.toFixed(1)}%` : '-'}
          icon={UserCheck}
          loading={!retentionData}
        />
        <StatCard
          title="Engagement"
          value={summary ? summary.engagementRate.toFixed(2) : '-'}
          icon={Activity}
          loading={summaryLoading}
        />
      </div>

      {/* Analytics Summary */}
      {summary && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Event Distribution */}
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="h-5 w-5 text-primary" />
                Distribution des Evenements
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatNumber(summary.totalEvents)} evenements sur la periode
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {summary.topEvents.slice(0, 6).map((event, index) => (
                  <div key={event.type} className="flex items-center gap-4">
                    <div className="w-32 truncate text-sm font-medium">{event.type}</div>
                    <div className="flex-1">
                      <div className="h-4 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${event.percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-20 text-right text-sm text-gray-600">
                      {event.percentage.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Platform & Device Distribution */}
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5 text-primary" />
                Utilisateurs
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatNumber(summary.uniqueUsers)} utilisateurs uniques,{' '}
                {formatNumber(summary.uniqueSessions)} sessions
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Platforms */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-gray-700">Plateformes</h4>
                  <div className="space-y-2">
                    {summary.topPlatforms.map((platform) => (
                      <div key={platform.platform} className="flex items-center justify-between">
                        <span className="text-sm">{platform.platform || 'Inconnu'}</span>
                        <span className="text-sm font-medium">{platform.percentage.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Devices */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-gray-700">Appareils</h4>
                  <div className="space-y-2">
                    {summary.topDevices.map((device) => (
                      <div key={device.device} className="flex items-center justify-between">
                        <span className="text-sm">{device.device || 'Inconnu'}</span>
                        <span className="text-sm font-medium">{device.percentage.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modules */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Modules d'Analyse</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {analyticsModules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group rounded-lg border bg-card p-6 shadow-sm transition-all hover:border-primary hover:shadow-md"
            >
              <div
                className={cn(
                  'mb-4 flex h-12 w-12 items-center justify-center rounded-lg text-white',
                  module.color
                )}
              >
                <module.icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-primary">
                {module.title}
              </h3>
              <p className="mt-1 text-sm text-gray-600">{module.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
        <div>
          <h3 className="font-semibold text-gray-900">Exporter les Donnees</h3>
          <p className="text-sm text-gray-600">
            Telechargez vos donnees analytics au format CSV, JSON ou Excel
          </p>
        </div>
        <Link
          href={`/festivals/${festivalId}/analytics/exports`}
          className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Download className="h-4 w-4" />
          Exporter
        </Link>
      </div>
    </div>
  )
}
