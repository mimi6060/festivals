'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Bell,
  MapPin,
  TrendingUp,
  Users,
  Plus,
} from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import { AlertCard } from '@/components/security/AlertCard'
import { AlertMap } from '@/components/security/AlertMap'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn, formatNumber, formatDateTime } from '@/lib/utils'
import {
  securityApi,
  securityQueryKeys,
  SecurityAlert,
  AlertStats,
  getStatusLabel,
  getSeverityLabel,
} from '@/lib/api/security'

export default function SecurityDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const festivalId = params.id as string

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null)

  // Fetch active alerts
  const {
    data: activeAlerts,
    isLoading: alertsLoading,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: securityQueryKeys.activeAlerts(festivalId),
    queryFn: () => securityApi.getActiveAlerts(festivalId),
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  // Fetch alert statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: securityQueryKeys.alertStats(festivalId),
    queryFn: () => securityApi.getAlertStats(festivalId),
    refetchInterval: 30000,
  })

  // Acknowledge mutation
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => securityApi.acknowledgeAlert(festivalId, alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityQueryKeys.activeAlerts(festivalId) })
      queryClient.invalidateQueries({ queryKey: securityQueryKeys.alertStats(festivalId) })
    },
  })

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: ({ alertId, resolution }: { alertId: string; resolution: string }) =>
      securityApi.resolveAlert(festivalId, alertId, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityQueryKeys.activeAlerts(festivalId) })
      queryClient.invalidateQueries({ queryKey: securityQueryKeys.alertStats(festivalId) })
    },
  })

  const handleRefresh = useCallback(() => {
    refetchAlerts()
    setLastRefresh(new Date())
  }, [refetchAlerts])

  const handleAcknowledge = (alertId: string) => {
    acknowledgeMutation.mutate(alertId)
  }

  const handleResolve = (alertId: string) => {
    const resolution = prompt('Resolution de l\'alerte:')
    if (resolution) {
      resolveMutation.mutate({ alertId, resolution })
    }
  }

  const handleAlertClick = (alert: SecurityAlert) => {
    setSelectedAlert(alert)
  }

  // Count by severity
  const criticalCount = activeAlerts?.filter((a) => a.severity === 'CRITICAL').length || 0
  const highCount = activeAlerts?.filter((a) => a.severity === 'HIGH').length || 0
  const pendingCount = activeAlerts?.filter((a) => a.status === 'PENDING').length || 0

  // Audio alert for new critical alerts
  useEffect(() => {
    if (criticalCount > 0) {
      // In production, play an audio alert sound
      // new Audio('/sounds/alert.mp3').play()
    }
  }, [criticalCount])

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
            Retour au tableau de bord
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Derniere mise a jour: {formatDateTime(lastRefresh.toISOString())}
          </span>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className={cn('h-4 w-4 mr-2', alertsLoading && 'animate-spin')} />
            Actualiser
          </Button>
          <Link href={`/festivals/${festivalId}/security/alerts`}>
            <Button variant="outline" size="sm">
              Voir tout l'historique
            </Button>
          </Link>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {criticalCount > 0 && (
        <div className="bg-red-500 text-white rounded-xl p-4 flex items-center gap-4 animate-pulse">
          <div className="bg-white/20 rounded-full p-3">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg">
              {criticalCount} alerte{criticalCount > 1 ? 's' : ''} critique{criticalCount > 1 ? 's' : ''}!
            </h3>
            <p className="text-white/90">
              Intervention immediate requise
            </p>
          </div>
          <Button
            variant="outline"
            className="bg-white text-red-500 hover:bg-white/90 border-white"
            onClick={() => {
              const firstCritical = activeAlerts?.find((a) => a.severity === 'CRITICAL')
              if (firstCritical) setSelectedAlert(firstCritical)
            }}
          >
            Voir les alertes
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Alertes actives"
          value={formatNumber(activeAlerts?.length || 0)}
          icon={AlertTriangle}
          loading={alertsLoading}
          className={pendingCount > 0 ? 'border-red-200 bg-red-50' : ''}
        />
        <StatCard
          title="En attente"
          value={formatNumber(stats?.pendingAlerts || 0)}
          icon={Clock}
          loading={statsLoading}
          className={stats?.pendingAlerts && stats.pendingAlerts > 0 ? 'border-yellow-200 bg-yellow-50' : ''}
        />
        <StatCard
          title="Resolues aujourd'hui"
          value={formatNumber(stats?.resolvedAlerts || 0)}
          icon={CheckCircle}
          loading={statsLoading}
        />
        <StatCard
          title="Temps de reponse moyen"
          value={stats?.averageResponseTime ? `${Math.round(stats.averageResponseTime / 60)} min` : '-'}
          icon={TrendingUp}
          loading={statsLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Carte des alertes
              </h2>
              <div className="flex items-center gap-2">
                {criticalCount > 0 && (
                  <Badge className="bg-red-100 text-red-700">
                    {criticalCount} critique{criticalCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {highCount > 0 && (
                  <Badge className="bg-orange-100 text-orange-700">
                    {highCount} eleve{highCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
            <AlertMap
              alerts={activeAlerts || []}
              onAlertClick={handleAlertClick}
              onRefresh={handleRefresh}
              isLoading={alertsLoading}
              className="h-[400px]"
            />
          </div>
        </div>

        {/* Active Alerts List */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden h-full max-h-[500px] flex flex-col">
            <div className="border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Alertes actives
              </h2>
              <Badge className="bg-primary/10 text-primary">
                {activeAlerts?.length || 0}
              </Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {alertsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-20 bg-gray-200 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : activeAlerts && activeAlerts.length > 0 ? (
                activeAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    compact
                    onViewDetails={handleAlertClick}
                  />
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Shield className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-gray-600 font-medium">Aucune alerte active</p>
                  <p className="text-sm text-gray-400">La situation est calme</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Alert View */}
      {selectedAlert && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detail de l'alerte</h3>
            <AlertCard
              alert={selectedAlert}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              isLoading={acknowledgeMutation.isPending || resolveMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.criticalAlerts + stats.highAlerts}
                </p>
                <p className="text-sm text-gray-500">Alertes prioritaires</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.inProgressAlerts}</p>
                <p className="text-sm text-gray-500">En cours de traitement</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAlerts}</p>
                <p className="text-sm text-gray-500">Total des alertes</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
