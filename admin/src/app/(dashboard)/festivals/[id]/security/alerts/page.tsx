'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  UserPlus,
} from 'lucide-react'
import { AlertCard } from '@/components/security/AlertCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { cn, formatDateTime } from '@/lib/utils'
import {
  securityApi,
  securityQueryKeys,
  SecurityAlert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  AlertFilters,
  getAlertTypeLabel,
  getSeverityLabel,
  getStatusLabel,
  getSeverityColor,
  getStatusColor,
} from '@/lib/api/security'

const alertTypes: AlertType[] = ['SOS', 'MEDICAL', 'FIRE', 'THEFT', 'VIOLENCE', 'LOST_CHILD', 'SUSPICIOUS', 'CROWD_CONTROL', 'OTHER']
const severities: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const statuses: AlertStatus[] = ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']

export default function AlertsListPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const festivalId = params.id as string

  // Filters
  const [page, setPage] = useState(1)
  const [perPage] = useState(20)
  const [typeFilter, setTypeFilter] = useState<AlertType[]>([])
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity[]>([])
  const [statusFilter, setStatusFilter] = useState<AlertStatus[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Modal state
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [resolution, setResolution] = useState('')
  const [cancelReason, setCancelReason] = useState('')

  // Build filters
  const filters: AlertFilters = {
    type: typeFilter.length > 0 ? typeFilter : undefined,
    severity: severityFilter.length > 0 ? severityFilter : undefined,
    status: statusFilter.length > 0 ? statusFilter : undefined,
    page,
    perPage,
  }

  // Fetch alerts
  const {
    data: alertsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [...securityQueryKeys.alerts(festivalId), filters],
    queryFn: () => securityApi.getAlerts(festivalId, filters),
  })

  const alerts = alertsData?.data || []
  const totalPages = Math.ceil((alertsData?.meta?.total || 0) / perPage)

  // Mutations
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => securityApi.acknowledgeAlert(festivalId, alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityQueryKeys.alerts(festivalId) })
    },
  })

  const resolveMutation = useMutation({
    mutationFn: ({ alertId, resolution }: { alertId: string; resolution: string }) =>
      securityApi.resolveAlert(festivalId, alertId, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityQueryKeys.alerts(festivalId) })
      setShowResolveModal(false)
      setResolution('')
      setSelectedAlert(null)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ alertId, reason }: { alertId: string; reason: string }) =>
      securityApi.cancelAlert(festivalId, alertId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityQueryKeys.alerts(festivalId) })
      setShowCancelModal(false)
      setCancelReason('')
      setSelectedAlert(null)
    },
  })

  const handleAcknowledge = (alertId: string) => {
    acknowledgeMutation.mutate(alertId)
  }

  const handleResolve = (alert: SecurityAlert) => {
    setSelectedAlert(alert)
    setShowResolveModal(true)
  }

  const handleCancel = (alert: SecurityAlert) => {
    setSelectedAlert(alert)
    setShowCancelModal(true)
  }

  const submitResolve = () => {
    if (selectedAlert && resolution.trim()) {
      resolveMutation.mutate({ alertId: selectedAlert.id, resolution })
    }
  }

  const submitCancel = () => {
    if (selectedAlert && cancelReason.trim()) {
      cancelMutation.mutate({ alertId: selectedAlert.id, reason: cancelReason })
    }
  }

  const clearFilters = () => {
    setTypeFilter([])
    setSeverityFilter([])
    setStatusFilter([])
    setSearchQuery('')
    setPage(1)
  }

  const hasActiveFilters = typeFilter.length > 0 || severityFilter.length > 0 || statusFilter.length > 0

  const getSeverityBadgeClass = (severity: AlertSeverity) => {
    const classes: Record<AlertSeverity, string> = {
      LOW: 'bg-gray-100 text-gray-700',
      MEDIUM: 'bg-yellow-100 text-yellow-700',
      HIGH: 'bg-orange-100 text-orange-700',
      CRITICAL: 'bg-red-100 text-red-700',
    }
    return classes[severity]
  }

  const getStatusBadgeClass = (status: AlertStatus) => {
    const classes: Record<AlertStatus, string> = {
      PENDING: 'bg-red-100 text-red-700',
      ACKNOWLEDGED: 'bg-yellow-100 text-yellow-700',
      IN_PROGRESS: 'bg-blue-100 text-blue-700',
      RESOLVED: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-gray-100 text-gray-500',
    }
    return classes[status]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/security`}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au dashboard securite
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Actualiser
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          {/* Search */}
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Recherche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher une alerte..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Type filter */}
          <div className="w-full lg:w-48">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
            <Select
              value={typeFilter.length === 1 ? typeFilter[0] : ''}
              onChange={(e) => setTypeFilter(e.target.value ? [e.target.value as AlertType] : [])}
            >
              <option value="">Tous les types</option>
              {alertTypes.map((type) => (
                <option key={type} value={type}>
                  {getAlertTypeLabel(type)}
                </option>
              ))}
            </Select>
          </div>

          {/* Severity filter */}
          <div className="w-full lg:w-40">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Severite</label>
            <Select
              value={severityFilter.length === 1 ? severityFilter[0] : ''}
              onChange={(e) => setSeverityFilter(e.target.value ? [e.target.value as AlertSeverity] : [])}
            >
              <option value="">Toutes</option>
              {severities.map((severity) => (
                <option key={severity} value={severity}>
                  {getSeverityLabel(severity)}
                </option>
              ))}
            </Select>
          </div>

          {/* Status filter */}
          <div className="w-full lg:w-40">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Statut</label>
            <Select
              value={statusFilter.length === 1 ? statusFilter[0] : ''}
              onChange={(e) => setStatusFilter(e.target.value ? [e.target.value as AlertStatus] : [])}
            >
              <option value="">Tous</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </Select>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <XCircle className="h-4 w-4 mr-1" />
              Effacer
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {alertsData?.meta?.total || 0} alerte{(alertsData?.meta?.total || 0) !== 1 ? 's' : ''} trouvee{(alertsData?.meta?.total || 0) !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Alerts Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alerte
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severite
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-4">
                      <div className="h-10 bg-gray-200 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : alerts.length > 0 ? (
                alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className={cn(
                      'hover:bg-gray-50',
                      alert.status === 'PENDING' && alert.severity === 'CRITICAL' && 'bg-red-50'
                    )}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{alert.title}</p>
                        {alert.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">
                            {alert.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700">
                        {getAlertTypeLabel(alert.type)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={getSeverityBadgeClass(alert.severity)}>
                        {getSeverityLabel(alert.severity)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={getStatusBadgeClass(alert.status)}>
                        {getStatusLabel(alert.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {formatDateTime(alert.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {alert.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={acknowledgeMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(alert.status) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolve(alert)}
                            >
                              Resoudre
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancel(alert)}
                              className="text-gray-500"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Aucune alerte trouvee</p>
                    {hasActiveFilters && (
                      <Button variant="link" onClick={clearFilters} className="mt-2">
                        Effacer les filtres
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} sur {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && !showResolveModal && !showCancelModal && (
        <Modal
          isOpen={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          title="Detail de l'alerte"
        >
          <AlertCard
            alert={selectedAlert}
            onAcknowledge={handleAcknowledge}
            onResolve={() => handleResolve(selectedAlert)}
            onCancel={() => handleCancel(selectedAlert)}
            isLoading={acknowledgeMutation.isPending}
          />
        </Modal>
      )}

      {/* Resolve Modal */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => {
          setShowResolveModal(false)
          setResolution('')
        }}
        title="Resoudre l'alerte"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Decrivez comment l'alerte a ete resolue:
          </p>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Resolution..."
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary"
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowResolveModal(false)
                setResolution('')
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={submitResolve}
              disabled={!resolution.trim() || resolveMutation.isPending}
            >
              {resolveMutation.isPending ? 'En cours...' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false)
          setCancelReason('')
        }}
        title="Annuler l'alerte"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Indiquez la raison de l'annulation (ex: fausse alerte):
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Raison de l'annulation..."
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCancelModal(false)
                setCancelReason('')
              }}
            >
              Retour
            </Button>
            <Button
              variant="destructive"
              onClick={submitCancel}
              disabled={!cancelReason.trim() || cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'En cours...' : 'Annuler l\'alerte'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
