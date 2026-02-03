'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Download, History, FileText, Clock, CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { CustomTabs, TabPanel } from '@/components/ui/Tabs'
import { ExportWizard } from '@/components/export/ExportWizard'
import {
  exportApi,
  ExportJob,
  ExportStatus,
  EXPORT_DATA_TYPES,
  EXPORT_FORMATS,
  CreateExportInput,
} from '@/lib/api/export'

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const statusConfig: Record<ExportStatus, {
  variant: 'default' | 'success' | 'warning' | 'error' | 'info'
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  pending: { variant: 'warning', label: 'Pending', icon: Clock },
  processing: { variant: 'info', label: 'Processing', icon: Clock },
  completed: { variant: 'success', label: 'Completed', icon: CheckCircle2 },
  failed: { variant: 'error', label: 'Failed', icon: XCircle },
}

interface ExportHistoryTableProps {
  exports: ExportJob[]
  onDownload: (exportId: string) => void
  onDelete: (exportId: string) => void
  isDeleting: string | null
}

function ExportHistoryTable({ exports, onDownload, onDelete, isDeleting }: ExportHistoryTableProps) {
  if (exports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-sm font-medium text-gray-900">No exports yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Start a new export using the wizard above.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Data Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Date Range
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Format
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Size
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Created
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {exports.map((exportJob) => {
            const status = statusConfig[exportJob.status]
            const StatusIcon = status.icon

            return (
              <tr key={exportJob.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900">
                      {EXPORT_DATA_TYPES[exportJob.dataType]?.label || exportJob.dataType}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                  {format(new Date(exportJob.dateFrom), 'MMM d')} -{' '}
                  {format(new Date(exportJob.dateTo), 'MMM d, yyyy')}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <Badge variant="outline">
                    {EXPORT_FORMATS[exportJob.format]?.label || exportJob.format}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <Badge variant={status.variant} dot>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {status.label}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                  {formatFileSize(exportJob.fileSize)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                  {format(new Date(exportJob.createdAt), 'MMM d, yyyy HH:mm')}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {exportJob.status === 'completed' && exportJob.downloadUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownload(exportJob.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(exportJob.id)}
                      loading={isDeleting === exportJob.id}
                      disabled={isDeleting === exportJob.id}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function ExportPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [activeTab, setActiveTab] = React.useState('new-export')
  const [exports, setExports] = React.useState<ExportJob[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null)

  const loadExportHistory = React.useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const response = await exportApi.list(festivalId, { limit: 50 })
      setExports(response.data)
    } catch (error) {
      console.error('Failed to load export history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [festivalId])

  React.useEffect(() => {
    loadExportHistory()
  }, [loadExportHistory])

  const handleSubmit = async (data: CreateExportInput): Promise<ExportJob> => {
    const job = await exportApi.create(festivalId, data)
    return job
  }

  const handlePollStatus = async (jobId: string): Promise<ExportJob> => {
    const job = await exportApi.get(festivalId, jobId)
    // Update the exports list if the job completes
    if (job.status === 'completed' || job.status === 'failed') {
      loadExportHistory()
    }
    return job
  }

  const handleDownload = async (jobId: string): Promise<{ url: string }> => {
    const response = await exportApi.download(festivalId, jobId)
    return response
  }

  const handleCancel = async (jobId: string): Promise<void> => {
    await exportApi.cancel(festivalId, jobId)
    loadExportHistory()
  }

  const handleDelete = async (exportId: string) => {
    setIsDeleting(exportId)
    try {
      await exportApi.delete(festivalId, exportId)
      setExports((prev) => prev.filter((e) => e.id !== exportId))
    } catch (error) {
      console.error('Failed to delete export:', error)
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDownloadFromHistory = async (exportId: string) => {
    try {
      const response = await exportApi.download(festivalId, exportId)
      window.open(response.url, '_blank')
    } catch (error) {
      console.error('Failed to download export:', error)
    }
  }

  const tabs = [
    { value: 'new-export', label: 'New Export', icon: <Download className="h-4 w-4" /> },
    { value: 'history', label: 'Export History', icon: <History className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Export</h1>
        <p className="mt-1 text-sm text-gray-500">
          Export festival data in various formats for reporting and analysis.
        </p>
      </div>

      {/* Tabs */}
      <CustomTabs
        tabs={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
        variant="underline"
      >
        <TabPanel value="new-export">
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Create New Export</CardTitle>
              <CardDescription>
                Follow the wizard to configure and generate your data export.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExportWizard
                festivalId={festivalId}
                onSubmit={handleSubmit}
                onPollStatus={handlePollStatus}
                onDownload={handleDownload}
                onCancel={handleCancel}
              />
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value="history">
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Export History</CardTitle>
                <CardDescription>
                  View and download your previous exports.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadExportHistory}
                loading={isLoadingHistory}
              >
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingHistory && exports.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                </div>
              ) : (
                <ExportHistoryTable
                  exports={exports}
                  onDownload={handleDownloadFromHistory}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                />
              )}
            </CardContent>
          </Card>
        </TabPanel>
      </CustomTabs>
    </div>
  )
}
