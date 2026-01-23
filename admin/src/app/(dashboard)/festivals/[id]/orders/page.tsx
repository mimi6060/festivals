'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { DateRange } from 'react-day-picker'
import {
  Search,
  Download,
  Filter,
  X,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Package,
} from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { ordersApi, type Order, type OrderStatus, type OrderListParams } from '@/lib/api/orders'
import { standsApi, type Stand } from '@/lib/api/stands'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardBody } from '@/components/ui/Card'
import { Table, Pagination } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { DateRangePicker } from '@/components/reports/DateRangePicker'
import { OrderRow } from '@/components/orders/OrderCard'

const statusOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'COMPLETED', label: 'Complete' },
  { value: 'CANCELLED', label: 'Annule' },
  { value: 'REFUNDED', label: 'Rembourse' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partiellement rembourse' },
]

const statusBadgeVariant: Record<OrderStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
  REFUNDED: 'error',
  PARTIALLY_REFUNDED: 'warning',
}

export default function OrdersPage() {
  const params = useParams()
  const festivalId = params.id as string

  // State
  const [orders, setOrders] = React.useState<Order[]>([])
  const [stands, setStands] = React.useState<Stand[]>([])
  const [loading, setLoading] = React.useState(true)
  const [exporting, setExporting] = React.useState(false)
  const [stats, setStats] = React.useState({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    completedOrders: 0,
  })
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [standId, setStandId] = React.useState('')
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>()
  const [showFilters, setShowFilters] = React.useState(false)

  // Fetch stands for filter
  React.useEffect(() => {
    async function fetchStands() {
      try {
        const response = await standsApi.list(festivalId)
        setStands(response.stands)
      } catch (error) {
        console.error('Failed to fetch stands:', error)
      }
    }
    fetchStands()
  }, [festivalId])

  // Fetch orders
  const fetchOrders = React.useCallback(async () => {
    setLoading(true)
    try {
      const params: OrderListParams = {
        page: pagination.page,
        limit: pagination.limit,
      }

      if (search) params.search = search
      if (status) params.status = status as OrderStatus
      if (standId) params.standId = standId
      if (dateRange?.from) params.startDate = format(dateRange.from, 'yyyy-MM-dd')
      if (dateRange?.to) params.endDate = format(dateRange.to, 'yyyy-MM-dd')

      const [ordersResponse, statsResponse] = await Promise.all([
        ordersApi.listOrders(festivalId, params),
        ordersApi.getOrderStats(festivalId, {
          startDate: params.startDate,
          endDate: params.endDate,
        }),
      ])

      setOrders(ordersResponse.data)
      setPagination(ordersResponse.pagination)
      setStats({
        totalOrders: statsResponse.totalOrders,
        totalRevenue: statsResponse.totalRevenue,
        averageOrderValue: statsResponse.averageOrderValue,
        completedOrders: statsResponse.completedOrders,
      })
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }, [festivalId, pagination.page, pagination.limit, search, status, standId, dateRange])

  React.useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Debounced search
  const debouncedSearch = React.useMemo(() => {
    let timeoutId: NodeJS.Timeout
    return (value: string) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setSearch(value)
        setPagination((prev) => ({ ...prev, page: 1 }))
      }, 300)
    }
  }, [])

  // Export to CSV
  const handleExport = async () => {
    setExporting(true)
    try {
      const params: OrderListParams = {}
      if (search) params.search = search
      if (status) params.status = status as OrderStatus
      if (standId) params.standId = standId
      if (dateRange?.from) params.startDate = format(dateRange.from, 'yyyy-MM-dd')
      if (dateRange?.to) params.endDate = format(dateRange.to, 'yyyy-MM-dd')

      const blob = await ordersApi.exportOrders(festivalId, params)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-${festivalId}-${format(new Date(), 'yyyy-MM-dd')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export orders:', error)
    } finally {
      setExporting(false)
    }
  }

  // Clear filters
  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setStandId('')
    setDateRange(undefined)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const hasActiveFilters = search || status || standId || dateRange?.from

  const standOptions = [
    { value: '', label: 'Tous les stands' },
    ...stands.map((stand) => ({ value: stand.id, label: stand.name })),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
          <p className="mt-1 text-gray-500">
            Gerez et suivez toutes les commandes du festival
          </p>
        </div>
        <Button
          variant="outline"
          leftIcon={<Download className="h-4 w-4" />}
          onClick={handleExport}
          loading={exporting}
        >
          Exporter CSV
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total commandes</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(stats.totalOrders)}
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Chiffre d'affaires</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Panier moyen</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.averageOrderValue)}
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
              <Package className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Commandes completees</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(stats.completedOrders)}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4">
            {/* Search and filter toggle */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Rechercher par ID ou client..."
                  leftIcon={<Search className="h-4 w-4" />}
                  defaultValue={search}
                  onChange={(e) => debouncedSearch(e.target.value)}
                />
              </div>
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                leftIcon={<Filter className="h-4 w-4" />}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filtres
                {hasActiveFilters && (
                  <Badge variant="info" size="sm" className="ml-2">
                    Actifs
                  </Badge>
                )}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<X className="h-4 w-4" />}
                  onClick={clearFilters}
                >
                  Effacer
                </Button>
              )}
            </div>

            {/* Extended filters */}
            {showFilters && (
              <div className="grid gap-4 border-t border-gray-200 pt-4 sm:grid-cols-3">
                <Select
                  options={statusOptions}
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value)
                    setPagination((prev) => ({ ...prev, page: 1 }))
                  }}
                  placeholder="Statut"
                />
                <Select
                  options={standOptions}
                  value={standId}
                  onValueChange={(value) => {
                    setStandId(value)
                    setPagination((prev) => ({ ...prev, page: 1 }))
                  }}
                  placeholder="Stand"
                  searchable
                />
                <DateRangePicker
                  value={dateRange}
                  onChange={(range) => {
                    setDateRange(range)
                    setPagination((prev) => ({ ...prev, page: 1 }))
                  }}
                  placeholder="Periode"
                />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Orders table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Stand
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Loading skeleton
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-200" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <ShoppingCart className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 text-gray-500">Aucune commande trouvee</p>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={clearFilters}
                      >
                        Effacer les filtres
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <OrderRow key={order.id} order={order} festivalId={festivalId} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            pageSize={pagination.limit}
            onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          />
        )}
      </Card>
    </div>
  )
}
