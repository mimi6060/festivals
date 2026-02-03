'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { inventoryApi, InventoryItem, AlertStatus } from '@/lib/api/inventory'
import { StockTable } from '@/components/inventory/StockTable'
import { StockAdjustForm } from '@/components/inventory/StockAdjustForm'
import { LowStockAlert } from '@/components/inventory/LowStockAlert'
import {
  Package,
  AlertTriangle,
  TrendingDown,
  ClipboardList,
  Search,
  Plus,
  Filter,
  RefreshCw,
  X,
  ChevronDown,
  History,
  Bell,
} from 'lucide-react'

export default function InventoryPage() {
  const params = useParams()
  const festivalId = params.id as string
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [showOutOfStockOnly, setShowOutOfStockOnly] = useState(false)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)

  // Fetch inventory items
  const { data: itemsData, isLoading: itemsLoading, refetch } = useQuery({
    queryKey: ['inventory-items', festivalId],
    queryFn: () => inventoryApi.listItems(festivalId, { perPage: 100 }),
  })

  // Fetch summary
  const { data: summaryData } = useQuery({
    queryKey: ['inventory-summary', festivalId],
    queryFn: () => inventoryApi.getSummary(festivalId),
  })

  // Fetch active alerts
  const { data: alertsData } = useQuery({
    queryKey: ['inventory-alerts', festivalId, 'ACTIVE'],
    queryFn: () => inventoryApi.listAlerts(festivalId, { status: 'ACTIVE' as AlertStatus }),
  })

  // Filter items
  const items = itemsData?.data || []
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.productSku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.standName?.toLowerCase().includes(searchQuery.toLowerCase())

    if (showLowStockOnly && !item.isLowStock) return false
    if (showOutOfStockOnly && !item.isOutOfStock) return false

    return matchesSearch
  })

  const summary = summaryData?.data
  const alerts = alertsData?.data || []

  const handleAdjustStock = (item: InventoryItem) => {
    setSelectedItem(item)
    setAdjustModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventaire</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez les stocks et niveaux d'inventaire du festival
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/festivals/${festivalId}/inventory/count`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ClipboardList className="h-5 w-5" />
            Inventaire
          </Link>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Produits suivis</p>
              <p className="text-2xl font-bold text-gray-900">{summary?.totalItems || 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Stock total</p>
              <p className="text-2xl font-bold text-gray-900">{summary?.totalQuantity || 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
              <TrendingDown className="h-5 w-5 text-yellow-600" />
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
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Rupture</p>
              <p className="text-2xl font-bold text-red-600">{summary?.outOfStockCount || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Alertes actives</h2>
            <Link
              href={`/festivals/${festivalId}/inventory/alerts`}
              className="text-sm text-primary hover:underline"
            >
              Voir tout
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.slice(0, 3).map((alert) => (
              <LowStockAlert key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex gap-4 border-b">
        <Link
          href={`/festivals/${festivalId}/inventory`}
          className="border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary"
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
            placeholder="Rechercher un produit..."
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
          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                showLowStockOnly || showOutOfStockOnly
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Filter className="h-4 w-4" />
              Filtres
              {(showLowStockOnly || showOutOfStockOnly) && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                  {(showLowStockOnly ? 1 : 0) + (showOutOfStockOnly ? 1 : 0)}
                </span>
              )}
              <ChevronDown className="h-4 w-4" />
            </button>

            {filterMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setFilterMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border bg-white p-4 shadow-lg">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showLowStockOnly}
                        onChange={(e) => {
                          setShowLowStockOnly(e.target.checked)
                          if (e.target.checked) setShowOutOfStockOnly(false)
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">Stock bas uniquement</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showOutOfStockOnly}
                        onChange={(e) => {
                          setShowOutOfStockOnly(e.target.checked)
                          if (e.target.checked) setShowLowStockOnly(false)
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">Rupture uniquement</span>
                    </label>
                  </div>

                  {(showLowStockOnly || showOutOfStockOnly) && (
                    <button
                      onClick={() => {
                        setShowLowStockOnly(false)
                        setShowOutOfStockOnly(false)
                      }}
                      className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Reinitialiser
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stock table */}
      <StockTable
        items={filteredItems}
        isLoading={itemsLoading}
        onAdjustStock={handleAdjustStock}
        festivalId={festivalId}
      />

      {/* Results count */}
      {!itemsLoading && filteredItems.length > 0 && (
        <p className="text-sm text-gray-500">
          {filteredItems.length} produit{filteredItems.length > 1 ? 's' : ''} affiche{filteredItems.length > 1 ? 's' : ''}
          {searchQuery && ` pour "${searchQuery}"`}
        </p>
      )}

      {/* Adjust stock modal */}
      {adjustModalOpen && selectedItem && (
        <StockAdjustForm
          item={selectedItem}
          onClose={() => {
            setAdjustModalOpen(false)
            setSelectedItem(null)
          }}
          onSuccess={() => {
            setAdjustModalOpen(false)
            setSelectedItem(null)
            queryClient.invalidateQueries({ queryKey: ['inventory-items', festivalId] })
            queryClient.invalidateQueries({ queryKey: ['inventory-summary', festivalId] })
          }}
        />
      )}
    </div>
  )
}
