'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { inventoryApi, StockAlert, AlertStatus, AlertType } from '@/lib/api/inventory'
import {
  Package,
  History,
  Bell,
  ClipboardList,
  Search,
  Filter,
  ChevronDown,
  X,
  AlertTriangle,
  AlertCircle,
  PackageX,
  Check,
  Clock,
  CheckCircle,
} from 'lucide-react'

const alertTypes: { value: AlertType; label: string; icon: typeof AlertTriangle; color: string; bgColor: string }[] = [
  { value: 'LOW_STOCK', label: 'Stock bas', icon: AlertTriangle, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  { value: 'OUT_OF_STOCK', label: 'Rupture', icon: PackageX, color: 'text-red-600', bgColor: 'bg-red-100' },
  { value: 'OVER_STOCK', label: 'Surstock', icon: AlertCircle, color: 'text-blue-600', bgColor: 'bg-blue-100' },
]

const statusOptions: { value: AlertStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'ACKNOWLEDGED', label: 'Pris en compte' },
  { value: 'RESOLVED', label: 'Resolus' },
]

function getAlertConfig(type: AlertType) {
  return alertTypes.find((t) => t.value === type) || alertTypes[0]
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AlertsPage() {
  const params = useParams()
  const festivalId = params.id as string
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<AlertStatus | 'ALL'>('ACTIVE')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [page, setPage] = useState(1)

  // Fetch alerts
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory-alerts', festivalId, selectedStatus, page],
    queryFn: () =>
      inventoryApi.listAlerts(festivalId, {
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        page,
        perPage: 50,
      }),
  })

  // Fetch summary
  const { data: summaryData } = useQuery({
    queryKey: ['inventory-summary', festivalId],
    queryFn: () => inventoryApi.getSummary(festivalId),
  })

  // Acknowledge mutation
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => inventoryApi.acknowledgeAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts', festivalId] })
      queryClient.invalidateQueries({ queryKey: ['inventory-summary', festivalId] })
    },
  })

  const summary = summaryData?.data
  const alerts = data?.data || []
  const meta = data?.meta

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    return (
      alert.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.standName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.message?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertes de stock</h1>
          <p className="mt-1 text-sm text-gray-500">
            Surveillez les alertes de stock bas et ruptures
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <Bell className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Alertes actives</p>
              <p className="text-2xl font-bold text-red-600">{summary?.activeAlerts || 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Stock bas</p>
              <p className="text-2xl font-bold text-yellow-600">{summary?.lowStockCount || 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <PackageX className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Ruptures</p>
              <p className="text-2xl font-bold text-red-600">{summary?.outOfStockCount || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex gap-4 border-b">
        <Link
          href={`/festivals/${festivalId}/inventory`}
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <Package className="mr-2 inline h-4 w-4" />
          Stocks
        </Link>
        <Link
          href={`/festivals/${festivalId}/inventory/movements`}
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <History className="mr-2 inline h-4 w-4" />
          Mouvements
        </Link>
        <Link
          href={`/festivals/${festivalId}/inventory/alerts`}
          className="border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary"
        >
          <Bell className="mr-2 inline h-4 w-4" />
          Alertes
          {summary?.activeAlerts ? (
            <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {summary.activeAlerts}
            </span>
          ) : null}
        </Link>
        <Link
          href={`/festivals/${festivalId}/inventory/count`}
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ClipboardList className="mr-2 inline h-4 w-4" />
          Comptages
        </Link>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col gap-4 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border py-2 pl-10 pr-4 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Status filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                selectedStatus !== 'ALL'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Filter className="h-4 w-4" />
              {statusOptions.find((s) => s.value === selectedStatus)?.label}
              <ChevronDown className="h-4 w-4" />
            </button>

            {filterMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setFilterMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border bg-white p-2 shadow-lg">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSelectedStatus(option.value)
                        setFilterMenuOpen(false)
                        setPage(1)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                        selectedStatus === option.value
                          ? 'bg-primary/10 text-primary'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alerts list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-white p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/4 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            {searchQuery ? 'Aucune alerte trouvee' : 'Aucune alerte'}
          </h3>
          <p className="text-gray-500">
            {searchQuery
              ? 'Essayez de modifier votre recherche'
              : selectedStatus === 'ACTIVE'
              ? 'Tous les stocks sont a un niveau correct'
              : 'Aucune alerte dans cette categorie'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const config = getAlertConfig(alert.type)
            const Icon = config.icon

            return (
              <div key={alert.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start gap-4">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', config.bgColor)}>
                    <Icon className={cn('h-5 w-5', config.color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {alert.productName || 'Produit'}
                      </p>
                      <span className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        alert.status === 'ACTIVE' ? 'bg-red-100 text-red-700' :
                        alert.status === 'ACKNOWLEDGED' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      )}>
                        {alert.status === 'ACTIVE' ? 'Actif' :
                         alert.status === 'ACKNOWLEDGED' ? 'Pris en compte' :
                         'Resolu'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                      <span>{alert.standName || 'Stand'}</span>
                      <span>-</span>
                      <span>Stock actuel: {alert.currentQty}</span>
                      <span>-</span>
                      <span>Seuil: {alert.thresholdQty}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(alert.createdAt)}</span>
                      {alert.acknowledgedAt && (
                        <>
                          <span>-</span>
                          <span>Pris en compte: {formatDate(alert.acknowledgedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {alert.status === 'ACTIVE' && (
                    <button
                      onClick={() => acknowledgeMutation.mutate(alert.id)}
                      disabled={acknowledgeMutation.isPending}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Prendre en compte
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > meta.perPage && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-gray-500">
            Page {page} sur {Math.ceil(meta.total / meta.perPage)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
            >
              Precedent
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(meta.total / meta.perPage)}
              className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
