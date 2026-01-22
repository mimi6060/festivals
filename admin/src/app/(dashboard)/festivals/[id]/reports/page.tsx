'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  RefreshCw,
  Settings,
} from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { DateRangePicker } from '@/components/reports/DateRangePicker'
import { ReportCard, ReportCardCompact } from '@/components/reports/ReportCard'
import {
  reportsApi,
  Report,
  ReportType,
  ReportFormat,
  REPORT_TYPES,
  REPORT_FORMATS,
} from '@/lib/api/reports'

const formatOptions = Object.entries(REPORT_FORMATS).map(([value, { label }]) => ({
  value,
  label,
}))

export default function ReportsPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [selectedType, setSelectedType] = useState<ReportType>('transactions')
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('csv')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [generatingQuickReport, setGeneratingQuickReport] = useState<ReportType | null>(null)

  useEffect(() => {
    loadReports()
  }, [festivalId])

  const loadReports = async () => {
    try {
      const response = await reportsApi.list(festivalId, { limit: 10 })
      setReports(response.data)
    } catch (error) {
      console.error('Failed to load reports:', error)
      // Mock data for development
      setReports([
        {
          id: '1',
          festivalId,
          type: 'transactions',
          format: 'csv',
          name: 'Transactions Report - January 2026',
          status: 'completed',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-22',
          downloadUrl: '/reports/transactions-jan-2026.csv',
          fileSize: 245000,
          generatedAt: '2026-01-22T10:30:00Z',
          expiresAt: '2026-02-22T10:30:00Z',
          createdAt: '2026-01-22T10:28:00Z',
          createdBy: 'user-1',
          createdByName: 'Admin User',
        },
        {
          id: '2',
          festivalId,
          type: 'sales',
          format: 'xlsx',
          name: 'Sales Report - Last Week',
          status: 'completed',
          dateFrom: '2026-01-15',
          dateTo: '2026-01-21',
          downloadUrl: '/reports/sales-week.xlsx',
          fileSize: 128000,
          generatedAt: '2026-01-21T18:00:00Z',
          expiresAt: '2026-02-21T18:00:00Z',
          createdAt: '2026-01-21T17:58:00Z',
          createdBy: 'user-1',
          createdByName: 'Admin User',
        },
        {
          id: '3',
          festivalId,
          type: 'tickets',
          format: 'pdf',
          name: 'Ticket Sales Summary',
          status: 'processing',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-22',
          downloadUrl: null,
          fileSize: null,
          generatedAt: null,
          expiresAt: null,
          createdAt: '2026-01-22T11:00:00Z',
          createdBy: 'user-1',
          createdByName: 'Admin User',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!dateRange?.from || !dateRange?.to) return

    setIsGenerating(true)
    try {
      const report = await reportsApi.generate(festivalId, {
        type: selectedType,
        format: selectedFormat,
        dateFrom: format(dateRange.from, 'yyyy-MM-dd'),
        dateTo: format(dateRange.to, 'yyyy-MM-dd'),
      })
      setReports((prev) => [report, ...prev])
    } catch (error) {
      console.error('Failed to generate report:', error)
      // Mock for development
      const mockReport: Report = {
        id: Date.now().toString(),
        festivalId,
        type: selectedType,
        format: selectedFormat,
        name: `${REPORT_TYPES[selectedType].label} Report`,
        status: 'processing',
        dateFrom: format(dateRange.from, 'yyyy-MM-dd'),
        dateTo: format(dateRange.to, 'yyyy-MM-dd'),
        downloadUrl: null,
        fileSize: null,
        generatedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
        createdByName: 'Admin User',
      }
      setReports((prev) => [mockReport, ...prev])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleQuickGenerate = async (type: ReportType) => {
    setGeneratingQuickReport(type)
    try {
      const today = new Date()
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

      const report = await reportsApi.generate(festivalId, {
        type,
        format: 'csv',
        dateFrom: format(lastWeek, 'yyyy-MM-dd'),
        dateTo: format(today, 'yyyy-MM-dd'),
      })
      setReports((prev) => [report, ...prev])
    } catch (error) {
      console.error('Failed to generate quick report:', error)
      // Mock for development
      const mockReport: Report = {
        id: Date.now().toString(),
        festivalId,
        type,
        format: 'csv',
        name: `${REPORT_TYPES[type].label} Report - Last 7 Days`,
        status: 'processing',
        dateFrom: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        dateTo: format(new Date(), 'yyyy-MM-dd'),
        downloadUrl: null,
        fileSize: null,
        generatedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
        createdByName: 'Admin User',
      }
      setReports((prev) => [mockReport, ...prev])
    } finally {
      setGeneratingQuickReport(null)
    }
  }

  const handleDownload = async (report: Report) => {
    if (!report.downloadUrl) return

    try {
      const { url } = await reportsApi.download(festivalId, report.id)
      window.open(url, '_blank')
    } catch (error) {
      console.error('Failed to download report:', error)
      // For development, just open the mock URL
      window.open(report.downloadUrl, '_blank')
    }
  }

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusIcon = (status: Report['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'processing':
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: Report['status']) => {
    const variants: Record<Report['status'], { variant: 'success' | 'warning' | 'error' | 'default'; label: string }> = {
      completed: { variant: 'success', label: 'Completed' },
      processing: { variant: 'warning', label: 'Processing' },
      pending: { variant: 'default', label: 'Pending' },
      failed: { variant: 'error', label: 'Failed' },
    }
    const { variant, label } = variants[status]
    return <Badge variant={variant}>{label}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="mt-1 text-sm text-gray-500">
              Generate and download festival reports
            </p>
          </div>
        </div>
        <Link href={`/festivals/${festivalId}/reports/scheduled`}>
          <Button variant="outline" leftIcon={<Settings className="h-4 w-4" />}>
            Scheduled Reports
          </Button>
        </Link>
      </div>

      {/* Report Type Cards */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Report Types</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(REPORT_TYPES).map(([type, { label, description }]) => (
            <ReportCard
              key={type}
              type={type as ReportType}
              title={label}
              description={description}
              onQuickGenerate={() => handleQuickGenerate(type as ReportType)}
              isGenerating={generatingQuickReport === type}
            />
          ))}
        </div>
      </div>

      {/* Generate Custom Report */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Custom Report</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Report Type Selection */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Report Type
              </label>
              <div className="space-y-2">
                {Object.entries(REPORT_TYPES).map(([type, { label }]) => (
                  <ReportCardCompact
                    key={type}
                    type={type as ReportType}
                    title={label}
                    selected={selectedType === type}
                    onClick={() => setSelectedType(type as ReportType)}
                  />
                ))}
              </div>
            </div>

            {/* Date Range and Format */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Date Range
                </label>
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="Select date range"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Format
                </label>
                <Select
                  options={formatOptions}
                  value={selectedFormat}
                  onValueChange={(value) => setSelectedFormat(value as ReportFormat)}
                  placeholder="Select format"
                />
              </div>

              {/* Summary */}
              {dateRange?.from && dateRange?.to && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <h4 className="font-medium text-gray-900">Report Summary</h4>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Type:</dt>
                      <dd className="font-medium">{REPORT_TYPES[selectedType].label}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Period:</dt>
                      <dd className="font-medium">
                        {format(dateRange.from, 'd MMM', { locale: fr })} -{' '}
                        {format(dateRange.to, 'd MMM yyyy', { locale: fr })}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Format:</dt>
                      <dd className="font-medium">{REPORT_FORMATS[selectedFormat].label}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <div className="flex flex-col justify-end">
              <Button
                variant="primary"
                size="lg"
                onClick={handleGenerate}
                disabled={!dateRange?.from || !dateRange?.to || isGenerating}
                loading={isGenerating}
                className="w-full"
                leftIcon={<FileText className="h-5 w-5" />}
              >
                Generate Report
              </Button>
              <p className="mt-2 text-center text-xs text-gray-500">
                Report will be available for download once generated
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Reports</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadReports}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">No reports generated yet</p>
              <p className="text-sm text-gray-400">
                Generate your first report using the form above
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(report.status)}
                    <div>
                      <p className="font-medium text-gray-900">{report.name}</p>
                      <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(report.dateFrom), 'd MMM', { locale: fr })} -{' '}
                          {format(new Date(report.dateTo), 'd MMM yyyy', { locale: fr })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDateTime(report.createdAt)}
                        </span>
                        <span>{formatFileSize(report.fileSize)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(report.status)}
                    <Badge variant="default">
                      {REPORT_FORMATS[report.format].label}
                    </Badge>
                    {report.status === 'completed' && report.downloadUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(report)}
                        leftIcon={<Download className="h-4 w-4" />}
                      >
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
