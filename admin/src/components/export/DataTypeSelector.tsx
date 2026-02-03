'use client'

import * as React from 'react'
import { ShoppingCart, CreditCard, Users, Ticket, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExportDataType, EXPORT_DATA_TYPES } from '@/lib/api/export'

const iconMap = {
  'shopping-cart': ShoppingCart,
  'credit-card': CreditCard,
  'users': Users,
  'ticket': Ticket,
}

export interface DataTypeSelectorProps {
  value?: ExportDataType
  onChange?: (value: ExportDataType) => void
  disabled?: boolean
  className?: string
}

export function DataTypeSelector({
  value,
  onChange,
  disabled,
  className,
}: DataTypeSelectorProps) {
  const dataTypes = Object.entries(EXPORT_DATA_TYPES) as [ExportDataType, typeof EXPORT_DATA_TYPES[ExportDataType]][]

  return (
    <div className={cn('space-y-3', className)}>
      <label className="block text-sm font-medium text-gray-700">
        Select data type to export
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {dataTypes.map(([type, meta]) => {
          const Icon = iconMap[meta.icon as keyof typeof iconMap]
          const isSelected = value === type

          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(type)}
              className={cn(
                'relative flex items-start gap-4 rounded-lg border-2 p-4 text-left transition-all',
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
                    'mt-1 text-sm',
                    isSelected ? 'text-blue-700' : 'text-gray-500'
                  )}
                >
                  {meta.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default DataTypeSelector
