'use client'

import * as React from 'react'
import { Loader2, CheckCircle2, XCircle, Download, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ExportJob, ExportStatus, EXPORT_DATA_TYPES, EXPORT_FORMATS } from '@/lib/api/export'

export interface ExportProgressProps {
  exportJob: ExportJob | null
  isPolling?: boolean
  onDownload?: () => void
  onRetry?: () => void
  onCancel?: () => void
  onNewExport?: () => void
  className?: string
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatNumber(num: number | null): string {
  if (num === null) return '-'
  return new Intl.NumberFormat().format(num)
}

const statusConfig: Record<ExportStatus, {
  icon: React.ComponentType<{ className?: string }>
  label: string
  color: string
  bgColor: string
}> = {
  pending: {
    icon: Loader2,
    label: 'Preparing export...',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  processing: {
    icon: Loader2,
    label: 'Processing...',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Export completed',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  failed: {
    icon: XCircle,
    label: 'Export failed',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
}

export function ExportProgress({
  exportJob,
  isPolling = false,
  onDownload,
  onRetry,
  onCancel,
  onNewExport,
  className,
}: ExportProgressProps) {
  if (!exportJob) {
    return null
  }

  const status = statusConfig[exportJob.status]
  const StatusIcon = status.icon
  const isLoading = exportJob.status === 'pending' || exportJob.status === 'processing'
  const isComplete = exportJob.status === 'completed'
  const isFailed = exportJob.status === 'failed'

  const dataTypeLabel = EXPORT_DATA_TYPES[exportJob.dataType]?.label || exportJob.dataType
  const formatLabel = EXPORT_FORMATS[exportJob.format]?.label || exportJob.format

  return (
    <div className={cn('space-y-6', className)}>
      {/* Status Header */}
      <div className={cn('rounded-lg p-6', status.bgColor)}>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full',
              isLoading ? 'bg-blue-100' : isComplete ? 'bg-green-100' : 'bg-red-100'
            )}
          >
            <StatusIcon
              className={cn(
                'h-6 w-6',
                status.color,
                isLoading && 'animate-spin'
              )}
            />
          </div>
          <div className="flex-1">
            <h3 className={cn('text-lg font-semibold', status.color)}>
              {status.label}
            </h3>
            <p className="text-sm text-gray-600">
              Exporting {dataTypeLabel} as {formatLabel}
            </p>
          </div>
          {isLoading && isPolling && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Updating...</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isLoading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium text-gray-900">{exportJob.progress}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${exportJob.progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {formatNumber(exportJob.processedRecords)} of {formatNumber(exportJob.totalRecords)} records
            </span>
            {exportJob.totalRecords && exportJob.processedRecords > 0 && (
              <span>
                ~{Math.round((exportJob.totalRecords - exportJob.processedRecords) / (exportJob.processedRecords / 10))}s remaining
              </span>
            )}
          </div>
        </div>
      )}

      {/* Export Details */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h4 className="font-medium text-gray-900">Export Details</h4>
        </div>
        <dl className="divide-y divide-gray-100">
          <div className="flex justify-between px-4 py-3">
            <dt className="text-sm text-gray-500">Data Type</dt>
            <dd className="text-sm font-medium text-gray-900">{dataTypeLabel}</dd>
          </div>
          <div className="flex justify-between px-4 py-3">
            <dt className="text-sm text-gray-500">Format</dt>
            <dd className="text-sm font-medium text-gray-900">{formatLabel}</dd>
          </div>
          <div className="flex justify-between px-4 py-3">
            <dt className="text-sm text-gray-500">Date Range</dt>
            <dd className="text-sm font-medium text-gray-900">
              {new Date(exportJob.dateFrom).toLocaleDateString()} - {new Date(exportJob.dateTo).toLocaleDateString()}
            </dd>
          </div>
          {exportJob.totalRecords !== null && (
            <div className="flex justify-between px-4 py-3">
              <dt className="text-sm text-gray-500">Total Records</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formatNumber(exportJob.totalRecords)}
              </dd>
            </div>
          )}
          {isComplete && exportJob.fileSize !== null && (
            <div className="flex justify-between px-4 py-3">
              <dt className="text-sm text-gray-500">File Size</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formatFileSize(exportJob.fileSize)}
              </dd>
            </div>
          )}
          {isComplete && exportJob.fileName && (
            <div className="flex justify-between px-4 py-3">
              <dt className="text-sm text-gray-500">File Name</dt>
              <dd className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                {exportJob.fileName}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Error Message */}
      {isFailed && exportJob.errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            <strong>Error:</strong> {exportJob.errorMessage}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {isLoading && onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel Export
          </Button>
        )}
        {isFailed && onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Export
          </Button>
        )}
        {(isComplete || isFailed) && onNewExport && (
          <Button variant="secondary" onClick={onNewExport}>
            Start New Export
          </Button>
        )}
        {isComplete && exportJob.downloadUrl && onDownload && (
          <Button variant="primary" onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download File
          </Button>
        )}
      </div>
    </div>
  )
}

export default ExportProgress
