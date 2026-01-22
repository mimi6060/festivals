'use client'

import * as React from 'react'
import { FileText, FileSpreadsheet, Receipt, Users, Play, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { ReportType } from '@/lib/api/reports'

export interface ReportCardProps {
  type: ReportType
  title: string
  description: string
  onQuickGenerate?: () => void
  isGenerating?: boolean
  disabled?: boolean
  className?: string
}

const reportIcons: Record<ReportType, React.ElementType> = {
  transactions: Receipt,
  sales: FileSpreadsheet,
  tickets: FileText,
  staff: Users,
}

const reportColors: Record<ReportType, { bg: string; icon: string; border: string }> = {
  transactions: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    border: 'border-purple-200',
  },
  sales: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    border: 'border-green-200',
  },
  tickets: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    border: 'border-blue-200',
  },
  staff: {
    bg: 'bg-orange-50',
    icon: 'text-orange-600',
    border: 'border-orange-200',
  },
}

export function ReportCard({
  type,
  title,
  description,
  onQuickGenerate,
  isGenerating = false,
  disabled = false,
  className,
}: ReportCardProps) {
  const Icon = reportIcons[type]
  const colors = reportColors[type]

  return (
    <Card
      hoverable
      className={cn(
        'cursor-pointer transition-all duration-200',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <CardBody className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
            colors.bg
          )}
        >
          <Icon className={cn('h-6 w-6', colors.icon)} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{description}</p>

          {onQuickGenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                if (!disabled && !isGenerating) {
                  onQuickGenerate()
                }
              }}
              disabled={disabled || isGenerating}
              className="mt-3"
              leftIcon={
                isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )
              }
            >
              {isGenerating ? 'Generating...' : 'Quick Generate'}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

// Compact version for list views
export interface ReportCardCompactProps {
  type: ReportType
  title: string
  selected?: boolean
  onClick?: () => void
  className?: string
}

export function ReportCardCompact({
  type,
  title,
  selected = false,
  onClick,
  className,
}: ReportCardCompactProps) {
  const Icon = reportIcons[type]
  const colors = reportColors[type]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all duration-200',
        'hover:border-gray-300 hover:bg-gray-50',
        selected
          ? cn('border-2', colors.border, colors.bg)
          : 'border-gray-200 bg-white',
        className
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          colors.bg
        )}
      >
        <Icon className={cn('h-5 w-5', colors.icon)} />
      </div>
      <span className="font-medium text-gray-900">{title}</span>
    </button>
  )
}

export default ReportCard
