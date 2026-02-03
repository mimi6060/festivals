'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  RefreshCw,
  Download,
  FileText,
  Activity,
  AlertTriangle,
  Users,
  Loader2,
} from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { useFestivalStore } from '@/stores/festivalStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AuditFilters } from '@/components/audit/AuditFilters'
import { AuditLogTable } from '@/components/audit/AuditLogTable'
import { AuditLogDetail } from '@/components/audit/AuditLogDetail'
import {
  auditApi,
  auditQueryKeys,
  AuditLog,
  AuditLogFilters,
  generateCSVContent,
  downloadCSV,
} from '@/lib/api/audit'

export default function AuditLogsPage() {
  const params = useParams()
  const festivalId = params.id as string
  const { currentFestival } = useFestivalStore()

  // State
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    perPage: 20,
  })
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [sortColumn, setSortColumn] = useState<string | null>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('desc')

  // Fetch audit logs
  const {
    data: logsData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: auditQueryKeys.logsWithFilters(festivalId, filters),
    queryFn: () => auditApi.getLogs(festivalId, filters),
    placeholderData: (previousData) => previousData,
  })

  // Fetch audit stats
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: auditQueryKeys.stats(festivalId),
    queryFn: () => auditApi.getStats(festivalId),
  })

  // Mock users for filter (in a real app, this would come from an API)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])

  useEffect(() => {
    // Mock users data - replace with actual API call
    setUsers([
      { id: 'user-1', name: 'Admin User', email: 'admin@festival.com' },
      { id: 'user-2', name: 'John Doe', email: 'john@festival.com' },
      { id: 'user-3', name: 'Jane Smith', email: 'jane@festival.com' },
    ])
  }, [])

  const logs = logsData?.data || []
  const meta = logsData?.meta || { total: 0, page: 1, perPage: 20, totalPages: 1 }

  // Mock stats if not available
  const stats = statsData || {
    totalLogs: meta.total || 0,
    logsToday: 0,
    criticalLogs: 0,
    topActions: [],
    topUsers: [],
  }

  const handleFiltersChange = useCallback((newFilters: AuditLogFilters) => {
    setFilters(newFilters)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const handleSort = useCallback(
    (column: string, direction: 'asc' | 'desc' | null) => {
      setSortColumn(column)
      setSortDirection(direction)
      // In a real implementation, you would pass sort params to the API
      // For now, we'll handle sorting client-side or ignore it
    },
    []
  )

  const handleViewDetail = useCallback((log: AuditLog) => {
    setSelectedLog(log)
    setIsDetailOpen(true)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false)
    setTimeout(() => setSelectedLog(null), 200)
  }, [])

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      // Fetch all logs with current filters (without pagination)
      const allLogsResponse = await auditApi.getLogs(festivalId, {
        ...filters,
        page: 1,
        perPage: 10000, // Get all logs
      })

      const csvContent = generateCSVContent(allLogsResponse.data)
      const filename = `audit-logs-${festivalId}-${new Date().toISOString().split('T')[0]}.csv`
      downloadCSV(csvContent, filename)
    } catch (error) {
      console.error('Failed to export audit logs:', error)
      // Show error toast in real app
    } finally {
      setIsExporting(false)
    }
  }, [festivalId, filters])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/settings`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
            <p className="mt-1 text-sm text-gray-500">
              {currentFestival?.name || 'Festival'} - Historique des actions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')}
            />
            Actualiser
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={handleExport}
            disabled={isExporting || logs.length === 0}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total logs</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoadingStats ? (
                  <span className="inline-block h-8 w-16 animate-pulse rounded bg-gray-200" />
                ) : (
                  formatNumber(stats.totalLogs)
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Aujourd'hui</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoadingStats ? (
                  <span className="inline-block h-8 w-12 animate-pulse rounded bg-gray-200" />
                ) : (
                  formatNumber(stats.logsToday)
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Evenements critiques</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoadingStats ? (
                  <span className="inline-block h-8 w-12 animate-pulse rounded bg-gray-200" />
                ) : (
                  formatNumber(stats.criticalLogs)
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Utilisateurs actifs</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoadingStats ? (
                  <span className="inline-block h-8 w-12 animate-pulse rounded bg-gray-200" />
                ) : (
                  formatNumber(stats.topUsers?.length || 0)
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <AuditFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          users={users}
        />
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {meta.total} log{meta.total !== 1 ? 's' : ''} trouve
          {meta.total !== 1 ? 's' : ''}
        </p>
        {filters.search ||
        (filters.action && filters.action.length > 0) ||
        (filters.resource && filters.resource.length > 0) ||
        filters.actorId ||
        filters.startDate ? (
          <p className="text-sm text-gray-500">
            Filtres actifs
          </p>
        ) : null}
      </div>

      {/* Table */}
      <AuditLogTable
        logs={logs}
        isLoading={isLoading}
        totalItems={meta.total}
        currentPage={meta.page}
        totalPages={meta.totalPages}
        pageSize={meta.perPage}
        onPageChange={handlePageChange}
        onViewDetail={handleViewDetail}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyMessage={
          filters.search ||
          (filters.action && filters.action.length > 0) ||
          (filters.resource && filters.resource.length > 0)
            ? 'Aucun log correspondant aux filtres'
            : 'Aucun log enregistre'
        }
      />

      {/* Detail Modal */}
      <AuditLogDetail
        log={selectedLog}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
      />
    </div>
  )
}
