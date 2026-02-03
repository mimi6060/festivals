'use client'

import * as React from 'react'
import { FileSpreadsheet, FileJson, FileText, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExportFormat, EXPORT_FORMATS } from '@/lib/api/export'

const iconMap: Record<ExportFormat, React.ComponentType<{ className?: string }>> = {
  csv: FileText,
  xlsx: FileSpreadsheet,
  json: FileJson,
}

export interface FormatSelectorProps {
  value?: ExportFormat
  onChange?: (value: ExportFormat) => void
  disabled?: boolean
  className?: string
}

export function FormatSelector({
  value,
  onChange,
  disabled,
  className,
}: FormatSelectorProps) {
  const formats = Object.entries(EXPORT_FORMATS) as [ExportFormat, typeof EXPORT_FORMATS[ExportFormat]][]

  return (
    <div className={cn('space-y-3', className)}>
      <label className="block text-sm font-medium text-gray-700">
        Select export format
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
        {formats.map(([format, meta]) => {
          const Icon = iconMap[format]
          const isSelected = value === format

          return (
            <button
              key={format}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(format)}
              className={cn(
                'relative flex flex-1 items-center gap-3 rounded-lg border-2 p-4 text-left transition-all',
                'hover:border-blue-300 hover:bg-blue-50/50',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'font-medium',
                      isSelected ? 'text-blue-900' : 'text-gray-900'
                    )}
                  >
                    {meta.label}
                  </span>
                  {isSelected && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'mt-0.5 text-xs',
                    isSelected ? 'text-blue-700' : 'text-gray-500'
                  )}
                >
                  {meta.extension}
                </p>
              </div>
            </button>
          )
        })}
      </div>
      {value && (
        <p className="text-sm text-gray-500">
          {EXPORT_FORMATS[value].description}
        </p>
      )}
    </div>
  )
}

export default FormatSelector
