'use client'

import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  change?: {
    value: number
    period?: string
  }
  loading?: boolean
  className?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  change,
  loading = false,
  className,
}: StatCardProps) {
  const getTrendIcon = () => {
    if (!change) return null
    if (change.value > 0) return TrendingUp
    if (change.value < 0) return TrendingDown
    return Minus
  }

  const getTrendColor = () => {
    if (!change) return ''
    if (change.value > 0) return 'text-green-600'
    if (change.value < 0) return 'text-red-600'
    return 'text-gray-500'
  }

  const TrendIcon = getTrendIcon()

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-lg border bg-card p-6 shadow-sm',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {change && (
            <div className={cn('flex items-center gap-1 text-sm', getTrendColor())}>
              {TrendIcon && <TrendIcon className="h-4 w-4" />}
              <span>
                {change.value > 0 ? '+' : ''}
                {change.value.toFixed(1)}%
              </span>
              {change.period && (
                <span className="text-muted-foreground">vs {change.period}</span>
              )}
            </div>
          )}
        </div>
        <div className="rounded-full bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  )
}
