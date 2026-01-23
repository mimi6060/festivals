'use client'

import { Zap, Clock, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PricingRule, formatDiscount, formatTimeRange } from '@/lib/api/pricing'

interface ActiveDiscountBadgeProps {
  rule: PricingRule
  className?: string
  showDetails?: boolean
}

export function ActiveDiscountBadge({
  rule,
  className,
  showDetails = false,
}: ActiveDiscountBadgeProps) {
  if (!rule.isCurrentlyActive || !rule.active) {
    return null
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-3 py-1 text-xs font-medium text-white shadow-sm',
        className
      )}
    >
      <Zap className="h-3 w-3" />
      <span>{rule.name}</span>
      {showDetails && (
        <>
          <span className="mx-1 opacity-60">|</span>
          <span>{formatDiscount(rule)}</span>
        </>
      )}
    </div>
  )
}

interface ActiveDiscountsListProps {
  rules: PricingRule[]
  className?: string
}

export function ActiveDiscountsList({ rules, className }: ActiveDiscountsListProps) {
  const activeRules = rules.filter((r) => r.isCurrentlyActive && r.active)

  if (activeRules.length === 0) {
    return (
      <div className={cn('rounded-lg border border-dashed p-4 text-center', className)}>
        <Clock className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm text-gray-500">No active discounts right now</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-green-700">
        <TrendingDown className="h-4 w-4" />
        <span>
          {activeRules.length} discount{activeRules.length > 1 ? 's' : ''} currently
          active
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {activeRules.map((rule) => (
          <ActiveDiscountBadge key={rule.id} rule={rule} showDetails />
        ))}
      </div>
    </div>
  )
}

interface PriceDisplayProps {
  originalPrice: number
  discountedPrice: number
  discount: number
  currencySymbol?: string
  className?: string
}

export function PriceDisplay({
  originalPrice,
  discountedPrice,
  discount,
  currencySymbol = '$',
  className,
}: PriceDisplayProps) {
  const hasDiscount = discount > 0

  if (!hasDiscount) {
    return (
      <span className={cn('font-medium', className)}>
        {currencySymbol}
        {(originalPrice / 100).toFixed(2)}
      </span>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm text-gray-400 line-through">
        {currencySymbol}
        {(originalPrice / 100).toFixed(2)}
      </span>
      <span className="font-medium text-green-600">
        {currencySymbol}
        {(discountedPrice / 100).toFixed(2)}
      </span>
      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
        -{currencySymbol}
        {(discount / 100).toFixed(2)}
      </span>
    </div>
  )
}
