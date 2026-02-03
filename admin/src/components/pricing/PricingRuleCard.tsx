'use client'

import { useState } from 'react'
import {
  Clock,
  Calendar,
  Percent,
  DollarSign,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PricingRule,
  formatDiscount,
  formatTimeRange,
  formatDaysOfWeek,
} from '@/lib/api/pricing'

interface PricingRuleCardProps {
  rule: PricingRule
  onEdit: (rule: PricingRule) => void
  onDelete: (rule: PricingRule) => void
  onToggleActive: (rule: PricingRule, active: boolean) => void
  productName?: string
}

export function PricingRuleCard({
  rule,
  onEdit,
  onDelete,
  onToggleActive,
  productName,
}: PricingRuleCardProps) {
  const [isToggling, setIsToggling] = useState(false)

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      await onToggleActive(rule, !rule.active)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-4 transition-all hover:shadow-md',
        !rule.active && 'opacity-60',
        rule.isCurrentlyActive && rule.active && 'border-green-300 bg-green-50'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              rule.discountType === 'PERCENTAGE'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-green-100 text-green-600'
            )}
          >
            {rule.discountType === 'PERCENTAGE' ? (
              <Percent className="h-5 w-5" />
            ) : (
              <DollarSign className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{rule.name}</h3>
            <p className="text-sm font-medium text-primary">
              {formatDiscount(rule)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rule.isCurrentlyActive && rule.active && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Active Now
            </span>
          )}
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={cn(
              'rounded p-1 transition-colors',
              rule.active
                ? 'text-green-600 hover:bg-green-50'
                : 'text-gray-400 hover:bg-gray-50'
            )}
            title={rule.active ? 'Disable rule' : 'Enable rule'}
          >
            {rule.active ? (
              <ToggleRight className="h-5 w-5" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {rule.description && (
        <p className="mt-2 text-sm text-gray-600">{rule.description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-500">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          <span>{formatTimeRange(rule.startTime, rule.endTime)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          <span>{formatDaysOfWeek(rule.daysOfWeek)}</span>
        </div>
        {(rule.productId || productName) && (
          <div className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            <span>{productName || 'Specific product'}</span>
          </div>
        )}
        {!rule.productId && !productName && (
          <div className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            <span>All products</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <span className="text-xs text-gray-400">
          Priority: {rule.priority}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(rule)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            <Edit className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => onDelete(rule)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
