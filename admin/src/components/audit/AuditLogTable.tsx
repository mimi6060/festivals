'use client'

import * as React from 'react'
import {
  FileText,
  User,
  Eye,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Table'
import {
  AuditLog,
  getActionLabel,
  getResourceLabel,
  getActionColor,
  getSeverityLabel,
  getSeverityColor,
} from '@/lib/api/audit'

interface AuditLogTableProps {
  logs: AuditLog[]
  isLoading?: boolean
  totalItems?: number
  currentPage: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onViewDetail: (log: AuditLog) => void
  sortColumn?: string | null
  sortDirection?: 'asc' | 'desc' | null
  onSort?: (column: string, direction: 'asc' | 'desc' | null) => void
  emptyMessage?: string
}

type SortField = 'createdAt' | 'action' | 'resource' | 'severity'

export function AuditLogTable({
  logs,
  isLoading = false,
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onViewDetail,
  sortColumn,
  sortDirection,
  onSort,
  emptyMessage = 'Aucun log trouve',
}: AuditLogTableProps) {
  const handleSort = (field: SortField) => {
    if (!onSort) return

    let newDirection: 'asc' | 'desc' | null
    if (sortColumn !== field || sortDirection === null) {
      newDirection = 'desc'
    } else if (sortDirection === 'desc') {
      newDirection = 'asc'
    } else {
      newDirection = null
    }

    onSort(field, newDirection)
  }

  const SortHeader = ({
    field,
    children,
  }: {
    field: SortField
    children: React.ReactNode
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-medium text-gray-500 hover:text-gray-700"
    >
      {children}
      {sortColumn === field ? (
        sortDirection === 'asc' ? (
          <ChevronUp className="h-4 w-4" />
        ) : sortDirection === 'desc' ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )
      ) : (
        <ArrowUpDown className="h-4 w-4 opacity-50" />
      )}
    </button>
  )

  const getActionBadgeVariant = (action: string): 'success' | 'info' | 'error' | 'warning' | 'default' => {
    const color = getActionColor(action as any)
    const mapping: Record<string, 'success' | 'info' | 'error' | 'warning' | 'default'> = {
      green: 'success',
      blue: 'info',
      red: 'error',
      orange: 'warning',
      yellow: 'warning',
      purple: 'info',
      gray: 'default',
    }
    return mapping[color] || 'default'
  }

  const getSeverityBadgeVariant = (severity: string): 'success' | 'info' | 'error' | 'warning' | 'default' => {
    const mapping: Record<string, 'success' | 'info' | 'error' | 'warning' | 'default'> = {
      info: 'default',
      warning: 'warning',
      critical: 'error',
    }
    return mapping[severity] || 'default'
  }

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Resource
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Utilisateur
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Severite
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="px-4 py-4">
                  <div className="h-4 w-28 rounded bg-gray-200" />
                </td>
                <td className="px-4 py-4">
                  <div className="h-6 w-24 rounded bg-gray-200" />
                </td>
                <td className="px-4 py-4">
                  <div className="h-4 w-20 rounded bg-gray-200" />
                </td>
                <td className="px-4 py-4">
                  <div className="h-4 w-48 rounded bg-gray-200" />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gray-200" />
                    <div className="h-4 w-24 rounded bg-gray-200" />
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-6 w-16 rounded bg-gray-200" />
                </td>
                <td className="px-4 py-4">
                  <div className="h-8 w-8 rounded bg-gray-200 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <FileText className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="mb-2 text-lg font-medium text-gray-900">{emptyMessage}</h3>
        <p className="text-gray-500">
          Les actions seront enregistrees ici automatiquement
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {onSort ? (
                    <SortHeader field="createdAt">Date</SortHeader>
                  ) : (
                    'Date'
                  )}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {onSort ? (
                    <SortHeader field="action">Action</SortHeader>
                  ) : (
                    'Action'
                  )}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {onSort ? (
                    <SortHeader field="resource">Resource</SortHeader>
                  ) : (
                    'Resource'
                  )}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Utilisateur
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {onSort ? (
                    <SortHeader field="severity">Severite</SortHeader>
                  ) : (
                    'Severite'
                  )}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className={cn(
                    'hover:bg-gray-50 transition-colors',
                    log.severity === 'critical' && 'bg-red-50 hover:bg-red-100'
                  )}
                >
                  <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={getActionBadgeVariant(log.action)}>
                      {getActionLabel(log.action)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    <div>
                      <span className="font-medium">
                        {getResourceLabel(log.resource)}
                      </span>
                      {log.resourceName && (
                        <span className="text-gray-500 ml-1">
                          ({log.resourceName})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {log.description}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {log.actor?.avatarUrl ? (
                        <img
                          src={log.actor.avatarUrl}
                          alt={log.actor.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                          <User className="h-4 w-4 text-gray-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {log.actor?.name || log.actorId}
                        </p>
                        {log.actor?.email && (
                          <p className="text-xs text-gray-500 truncate">
                            {log.actor.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge
                      variant={getSeverityBadgeVariant(log.severity)}
                      dot={log.severity === 'critical'}
                    >
                      {getSeverityLabel(log.severity)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetail(log)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
        )}
      </div>
    </div>
  )
}

export default AuditLogTable
