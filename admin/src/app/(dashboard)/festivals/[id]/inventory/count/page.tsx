'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { inventoryApi, InventoryCount, CountStatus } from '@/lib/api/inventory'
import { standsApi } from '@/lib/api/stands'
import {
  Package,
  History,
  Bell,
  ClipboardList,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  ChevronRight,
  Search,
  X,
} from 'lucide-react'

const statusConfig: Record<CountStatus, { label: string; icon: typeof Clock; color: string; bgColor: string }> = {
  PENDING: { label: 'En attente', icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  IN_PROGRESS: { label: 'En cours', icon: Play, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  COMPLETED: { label: 'Termine', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  CANCELLED: { label: 'Annule', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
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

export default function CountPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedStand, setSelectedStand] = useState<string>('')
  const [notes, setNotes] = useState('')

  // Fetch counts
  const { data: countsData, isLoading } = useQuery({
    queryKey: ['inventory-counts', festivalId],
    queryFn: () => inventoryApi.listCounts(festivalId, { perPage: 100 }),
  })

  // Fetch summary
  const { data: summaryData } = useQuery({
    queryKey: ['inventory-summary', festivalId],
    queryFn: () => inventoryApi.getSummary(festivalId),
  })

  // Fetch stands for creation
  const { data: standsData } = useQuery({
    queryKey: ['stands', festivalId],
    queryFn: () => standsApi.list(festivalId),
  })

  // Create count mutation
  const createMutation = useMutation({
    mutationFn: (data: { standId: string; festivalId: string; notes?: string }) =>
      inventoryApi.createCount(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-counts', festivalId] })
      setShowCreateModal(false)
      setSelectedStand('')
      setNotes('')
      // Navigate to the count detail page
      router.push(`/festivals/${festivalId}/inventory/count/${data.data.id}`)
    },
  })

  // Cancel count mutation
  const cancelMutation = useMutation({
    mutationFn: (countId: string) => inventoryApi.cancelCount(countId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-counts', festivalId] })
    },
  })

  const summary = summaryData?.data
  const counts = countsData?.data || []
  const stands = standsData?.stands || []

  // Filter counts
  const filteredCounts = counts.filter((count) => {
    return (
      count.standName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      count.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const handleCreateCount = () => {
    if (!selectedStand) return
    createMutation.mutate({
      standId: selectedStand,
      festivalId,
      notes: notes || undefined,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptages d'inventaire</h1>
          <p className="mt-1 text-sm text-gray-500">
            Effectuez des comptages periodiques pour verifier les stocks
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
        >
          <Plus className="h-5 w-5" />
          Nouveau comptage
        </button>
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
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
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
          className="border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary"
        >
          <ClipboardList className="mr-2 inline h-4 w-4" />
          Comptages
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un comptage..."
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

      {/* Counts list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
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
      ) : filteredCounts.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <ClipboardList className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            {searchQuery ? 'Aucun comptage trouve' : 'Aucun comptage'}
          </h3>
          <p className="mb-6 text-gray-500">
            {searchQuery
              ? 'Essayez de modifier votre recherche'
              : 'Commencez par creer un nouveau comptage d\'inventaire'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
            >
              <Plus className="h-5 w-5" />
              Nouveau comptage
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCounts.map((count) => {
            const config = statusConfig[count.status]
            const Icon = config.icon

            return (
              <Link
                key={count.id}
                href={`/festivals/${festivalId}/inventory/count/${count.id}`}
                className="flex items-center gap-4 rounded-lg border bg-white p-4 hover:bg-gray-50 transition-colors"
              >
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', config.bgColor)}>
                  <Icon className={cn('h-5 w-5', config.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {count.standName || 'Stand'}
                    </p>
                    <span className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium',
                      config.bgColor, config.color
                    )}>
                      {config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    <span>{count.itemCount} produits</span>
                    {count.countedCount > 0 && (
                      <>
                        <span>-</span>
                        <span>{count.countedCount} comptes</span>
                      </>
                    )}
                    {count.varianceCount > 0 && (
                      <>
                        <span>-</span>
                        <span className="text-orange-600">{count.varianceCount} ecarts</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <Clock className="h-3 w-3" />
                    <span>Cree le {formatDate(count.createdAt)}</span>
                    {count.startedAt && (
                      <>
                        <span>-</span>
                        <span>Demarre le {formatDate(count.startedAt)}</span>
                      </>
                    )}
                  </div>
                  {count.notes && (
                    <p className="text-sm text-gray-500 mt-1 truncate">{count.notes}</p>
                  )}
                </div>

                <ChevronRight className="h-5 w-5 text-gray-400" />
              </Link>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Nouveau comptage d'inventaire
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stand
                </label>
                <select
                  value={selectedStand}
                  onChange={(e) => setSelectedStand(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Selectionnez un stand</option>
                  {stands.map((stand) => (
                    <option key={stand.id} value={stand.id}>
                      {stand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notes sur ce comptage..."
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateCount}
                disabled={!selectedStand || createMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creation...' : 'Creer le comptage'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
