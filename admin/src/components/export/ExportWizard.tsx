'use client'

import * as React from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { DateRangePicker } from '@/components/reports/DateRangePicker'
import { DataTypeSelector } from './DataTypeSelector'
import { FormatSelector } from './FormatSelector'
import { ExportProgress } from './ExportProgress'
import {
  ExportDataType,
  ExportFormat,
  ExportJob,
  CreateExportInput,
  EXPORT_DATA_TYPES,
  EXPORT_FORMATS,
} from '@/lib/api/export'

export type WizardStep = 'data-type' | 'date-range' | 'format' | 'review' | 'progress'

interface StepConfig {
  id: WizardStep
  title: string
  description: string
}

const steps: StepConfig[] = [
  {
    id: 'data-type',
    title: 'Data Type',
    description: 'Select what to export',
  },
  {
    id: 'date-range',
    title: 'Date Range',
    description: 'Choose time period',
  },
  {
    id: 'format',
    title: 'Format',
    description: 'Select file format',
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Confirm export settings',
  },
]

export interface ExportWizardProps {
  festivalId: string
  onSubmit: (data: CreateExportInput) => Promise<ExportJob>
  onPollStatus?: (jobId: string) => Promise<ExportJob>
  onDownload?: (jobId: string) => Promise<{ url: string }>
  onCancel?: (jobId: string) => Promise<void>
  className?: string
}

export function ExportWizard({
  festivalId,
  onSubmit,
  onPollStatus,
  onDownload,
  onCancel,
  className,
}: ExportWizardProps) {
  const [currentStep, setCurrentStep] = React.useState<WizardStep>('data-type')
  const [dataType, setDataType] = React.useState<ExportDataType | undefined>()
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>()
  const [exportFormat, setExportFormat] = React.useState<ExportFormat | undefined>()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [exportJob, setExportJob] = React.useState<ExportJob | null>(null)
  const [isPolling, setIsPolling] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null)

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  const canProceed = React.useMemo(() => {
    switch (currentStep) {
      case 'data-type':
        return !!dataType
      case 'date-range':
        return !!dateRange?.from && !!dateRange?.to
      case 'format':
        return !!exportFormat
      case 'review':
        return true
      default:
        return false
    }
  }, [currentStep, dataType, dateRange, exportFormat])

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id)
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id)
    }
  }

  const startPolling = React.useCallback((jobId: string) => {
    if (!onPollStatus) return

    const poll = async () => {
      try {
        setIsPolling(true)
        const status = await onPollStatus(jobId)
        setExportJob(status)

        if (status.status === 'completed' || status.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
        }
      } catch (err) {
        console.error('Polling error:', err)
      } finally {
        setIsPolling(false)
      }
    }

    // Initial poll
    poll()

    // Start interval
    pollingIntervalRef.current = setInterval(poll, 2000)
  }, [onPollStatus])

  React.useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  const handleSubmit = async () => {
    if (!dataType || !dateRange?.from || !dateRange?.to || !exportFormat) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const input: CreateExportInput = {
        dataType,
        format: exportFormat,
        dateFrom: format(dateRange.from, 'yyyy-MM-dd'),
        dateTo: format(dateRange.to, 'yyyy-MM-dd'),
      }

      const job = await onSubmit(input)
      setExportJob(job)
      setCurrentStep('progress')

      // Start polling for status updates
      if (job.status === 'pending' || job.status === 'processing') {
        startPolling(job.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start export')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownload = async () => {
    if (!exportJob || !onDownload) return

    try {
      const { url } = await onDownload(exportJob.id)
      window.open(url, '_blank')
    } catch (err) {
      console.error('Download error:', err)
    }
  }

  const handleCancelExport = async () => {
    if (!exportJob || !onCancel) return

    try {
      await onCancel(exportJob.id)
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      handleNewExport()
    } catch (err) {
      console.error('Cancel error:', err)
    }
  }

  const handleNewExport = () => {
    setExportJob(null)
    setDataType(undefined)
    setDateRange(undefined)
    setExportFormat(undefined)
    setCurrentStep('data-type')
    setError(null)
  }

  const handleRetry = () => {
    handleSubmit()
  }

  // Progress view
  if (currentStep === 'progress') {
    return (
      <Card className={className}>
        <CardBody>
          <ExportProgress
            exportJob={exportJob}
            isPolling={isPolling}
            onDownload={handleDownload}
            onRetry={handleRetry}
            onCancel={onCancel ? handleCancelExport : undefined}
            onNewExport={handleNewExport}
          />
        </CardBody>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Progress Steps */}
      <nav aria-label="Progress">
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const isComplete = index < currentStepIndex
            const isCurrent = step.id === currentStep

            return (
              <li
                key={step.id}
                className={cn(
                  'relative',
                  index !== steps.length - 1 && 'flex-1 pr-8 sm:pr-20'
                )}
              >
                <div className="flex items-center">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isComplete
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : isCurrent
                        ? 'border-blue-600 bg-white text-blue-600'
                        : 'border-gray-300 bg-white text-gray-500'
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">{index + 1}</span>
                    )}
                  </div>
                  {index !== steps.length - 1 && (
                    <div
                      className={cn(
                        'absolute left-10 top-5 h-0.5 w-full -translate-y-1/2',
                        isComplete ? 'bg-blue-600' : 'bg-gray-200'
                      )}
                    />
                  )}
                </div>
                <div className="mt-2">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isCurrent ? 'text-blue-600' : 'text-gray-500'
                    )}
                  >
                    {step.title}
                  </span>
                  <p className="text-xs text-gray-400 hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Step Content */}
      <Card>
        <CardBody className="min-h-[300px]">
          {currentStep === 'data-type' && (
            <DataTypeSelector
              value={dataType}
              onChange={setDataType}
            />
          )}

          {currentStep === 'date-range' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Select date range for export
              </label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="Select date range"
              />
              {dateRange?.from && dateRange?.to && (
                <p className="text-sm text-gray-500">
                  Export will include data from{' '}
                  <strong>{format(dateRange.from, 'PPP')}</strong> to{' '}
                  <strong>{format(dateRange.to, 'PPP')}</strong>
                </p>
              )}
            </div>
          )}

          {currentStep === 'format' && (
            <FormatSelector
              value={exportFormat}
              onChange={setExportFormat}
            />
          )}

          {currentStep === 'review' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Review Export Settings</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Please review your export configuration before starting.
                </p>
              </div>

              <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex justify-between px-4 py-4">
                  <dt className="text-sm font-medium text-gray-500">Data Type</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {dataType && EXPORT_DATA_TYPES[dataType].label}
                  </dd>
                </div>
                <div className="flex justify-between px-4 py-4">
                  <dt className="text-sm font-medium text-gray-500">Date Range</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {dateRange?.from && dateRange?.to && (
                      <>
                        {format(dateRange.from, 'MMM d, yyyy')} -{' '}
                        {format(dateRange.to, 'MMM d, yyyy')}
                      </>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between px-4 py-4">
                  <dt className="text-sm font-medium text-gray-500">Format</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {exportFormat && EXPORT_FORMATS[exportFormat].label}{' '}
                    <span className="text-gray-500">
                      ({exportFormat && EXPORT_FORMATS[exportFormat].extension})
                    </span>
                  </dd>
                </div>
              </dl>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStepIndex === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {currentStep !== 'review' ? (
          <Button
            variant="primary"
            onClick={handleNext}
            disabled={!canProceed}
          >
            Continue
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Export...
              </>
            ) : (
              'Start Export'
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

export default ExportWizard
