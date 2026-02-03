'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { OrderCard, OrderCardSkeleton, OrderRow } from '@/components/account/OrderCard'
import { accountApi, UserOrder } from '@/lib/api/account'
import {
  ShoppingBag,
  Search,
  Filter,
  X,
  List,
  Grid,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const statusFilters = [
  { value: '', label: 'Toutes' },
  { value: 'COMPLETED', label: 'Completees' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'REFUNDED', label: 'Remboursees' },
  { value: 'CANCELLED', label: 'Annulees' },
]

export default function OrdersPage() {
  const [orders, setOrders] = useState<UserOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  useEffect(() => {
    loadOrders()
  }, [statusFilter, page])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const response = await accountApi.getMyOrders({
        status: statusFilter || undefined,
        page,
        limit,
      })
      setOrders(response.data)
      setTotalPages(response.pagination.totalPages)
      setTotal(response.pagination.total)
    } catch (err) {
      console.error('Failed to load orders:', err)
      setError('Impossible de charger vos commandes. Veuillez reessayer.')
    } finally {
      setLoading(false)
    }
  }

  // Filter orders by search query
  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      order.orderNumber.toLowerCase().includes(query) ||
      order.festivalName.toLowerCase().includes(query) ||
      order.items.some((item) => item.name.toLowerCase().includes(query))
    )
  })

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-red-700">{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            setError(null)
            loadOrders()
          }}
        >
          Reessayer
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mes commandes</h1>
        <p className="text-gray-600 mt-1">
          Consultez l'historique de vos achats et telechargez vos factures
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <ShoppingBag className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total commandes</p>
              <p className="text-xl font-bold text-gray-900">{total}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une commande..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {statusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center rounded-lg border border-gray-300 p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && viewMode === 'grid' && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      )}

      {loading && viewMode === 'list' && (
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b px-4 py-3">
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="h-4 w-16 rounded bg-gray-200" />
                <div className="h-4 w-20 rounded bg-gray-200" />
                <div className="h-6 w-20 rounded-full bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredOrders.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || statusFilter ? 'Aucune commande trouvee' : 'Aucune commande'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || statusFilter
                ? 'Essayez de modifier vos filtres'
                : 'Vos commandes apparaitront ici apres vos achats'}
            </p>
          </CardBody>
        </Card>
      )}

      {/* Orders grid */}
      {!loading && filteredOrders.length > 0 && viewMode === 'grid' && (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Orders table */}
      {!loading && filteredOrders.length > 0 && viewMode === 'list' && (
        <div className="rounded-lg border bg-white overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Commande</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Festival</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Articles</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Total</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-gray-500">
            Page {page} sur {totalPages} ({total} commande{total > 1 ? 's' : ''})
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              leftIcon={<ChevronLeft className="h-4 w-4" />}
            >
              Precedent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
