'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { inventoryApi, StockMovement, MovementType } from '@/lib/api/inventory'
import {
  Package,
  History,
  Bell,
  ClipboardList,
  Search,
  Filter,
  ChevronDown,
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Truck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'

const movementTypes: { value: MovementType | 'ALL'; label: string; icon: typeof ArrowUpCircle; color: string }[] = [
  { value: 'ALL', label: 'Tous', icon: History, color: 'text-gray-600' },
  { value: 'IN', label: 'Entree', icon: ArrowUpCircle, color: 'text-green-600' },
  { value: 'OUT', label: 'Sortie', icon: ArrowDownCircle, color: 'text-red-600' },
  { value: 'ADJUSTMENT', label: 'Ajustement', icon: RefreshCw, color: 'text-blue-600' },
  { value: 'TRANSFER', label: 'Transfert', icon: Truck, color: 'text-purple-600' },
  { value: 'LOSS', label: 'Perte', icon: AlertTriangle, color: 'text-orange-600' },
  { value: 'RETURN', label: 'Retour', icon: RotateCcw, color: 'text-teal-600' },
]

function getMovementIcon(type: MovementType) {
  const config = movementTypes.find((t) => t.value === type)
  if (!config) return { Icon: History, color: 'text-gray-600' }
  return { Icon: config.icon, color: config.color }
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

export default function MovementsPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<MovementType | 'ALL'>('ALL')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [page, setPage] = useState(1)

  // Fetch movements
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', festivalId, page],
    queryFn: () => inventoryApi.listMovements(festivalId, { page, perPage: 50 }),
  })

  // Fetch summary
  const { data: summaryData } = useQuery({
    queryKey: ['inventory-summary', festivalId],
    queryFn: () => inventoryApi.getSummary(festivalId),
  })

  const summary = summaryData?.data
  const movements = data?.data || []
  const meta = data?.meta

  // Filter movements
  const filteredMovements = movements.filter((movement) => {
    const matchesSearch =
      movement.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.standName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.reason?.toLowerCase().includes(searchQuery.toLowerCase())

    if (selectedType !== 'ALL' && movement.type !== selectedType) return false

    return matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mouvements de stock</h1>
          <p className="mt-1 text-sm text-gray-500">
            Historique de tous les mouvements d'inventaire
          </p>
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
          className="border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary"
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
          {/* Type filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                selectedType !== 'ALL'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Filter className="h-4 w-4" />
              {movementTypes.find((t) => t.value === selectedType)?.label || 'Type'}
              <ChevronDown className="h-4 w-4" />
            </button>

            {filterMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setFilterMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border bg-white p-2 shadow-lg">
                  {movementTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.value}
                        onClick={() => {
                          setSelectedType(type.value)
                          setFilterMenuOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                          selectedType === type.value
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <Icon className={cn('h-4 w-4', type.color)} />
                        {type.label}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Movements list */}
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
                <div className="h-6 w-16 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredMovements.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <History className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            {searchQuery || selectedType !== 'ALL' ? 'Aucun mouvement trouve' : 'Aucun mouvement'}
          </h3>
          <p className="text-gray-500">
            {searchQuery || selectedType !== 'ALL'
              ? 'Essayez de modifier vos filtres'
              : "Les mouvements de stock apparaitront ici"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMovements.map((movement) => {
            const { Icon, color } = getMovementIcon(movement.type)
            const isPositive = movement.quantity > 0

            return (
              <div key={movement.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-center gap-4">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-full',
                    movement.type === 'IN' ? 'bg-green-100' :
                    movement.type === 'OUT' ? 'bg-red-100' :
                    movement.type === 'ADJUSTMENT' ? 'bg-blue-100' :
                    movement.type === 'TRANSFER' ? 'bg-purple-100' :
                    movement.type === 'LOSS' ? 'bg-orange-100' :
                    'bg-teal-100'
                  )}>
                    <Icon className={cn('h-5 w-5', color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">
                        {movement.productName || 'Produit'}
                      </p>
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {movementTypes.find((t) => t.value === movement.type)?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{movement.standName || 'Stand'}</span>
                      <span>-</span>
                      <span>{formatDate(movement.createdAt)}</span>
                      {movement.reason && (
                        <>
                          <span>-</span>
                          <span className="truncate">{movement.reason}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Par {movement.performedByName}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={cn(
                      'text-lg font-semibold',
                      isPositive ? 'text-green-600' : 'text-red-600'
                    )}>
                      {isPositive ? '+' : ''}{movement.quantity}
                    </p>
                    <p className="text-xs text-gray-500">
                      {movement.previousQty} &rarr; {movement.newQty}
                    </p>
                  </div>
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
