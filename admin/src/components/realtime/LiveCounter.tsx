'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface LiveCounterProps {
  /** Current value to display */
  value: number
  /** Previous value for change calculation */
  previousValue?: number
  /** Format type */
  format?: 'number' | 'currency' | 'percent' | 'compact' | 'custom'
  /** Currency code for currency format */
  currency?: string
  /** Custom formatter function */
  formatter?: (value: number) => string
  /** Animation duration in milliseconds */
  animationDuration?: number
  /** Easing function */
  easing?: 'linear' | 'ease-out' | 'ease-in-out' | 'spring'
  /** Show change indicator (+/-) */
  showChange?: boolean
  /** Show trend arrow */
  showTrend?: boolean
  /** Decimal places for numbers */
  decimals?: number
  /** Prefix to display before number */
  prefix?: string
  /** Suffix to display after number */
  suffix?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Highlight on change */
  highlightOnChange?: boolean
  /** Highlight color */
  highlightColor?: 'green' | 'blue' | 'yellow'
  /** Additional CSS classes */
  className?: string
}

const SIZE_CLASSES = {
  sm: 'text-lg font-semibold',
  md: 'text-2xl font-bold',
  lg: 'text-3xl font-bold',
  xl: 'text-4xl font-bold tracking-tight',
}

const TREND_SIZE_CLASSES = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
}

const HIGHLIGHT_CLASSES = {
  green: 'text-green-600',
  blue: 'text-blue-600',
  yellow: 'text-yellow-600',
}

// Easing functions
const easingFunctions = {
  linear: (t: number) => t,
  'ease-out': (t: number) => 1 - Math.pow(1 - t, 4),
  'ease-in-out': (t: number) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  spring: (t: number) => {
    const c4 = (2 * Math.PI) / 3
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  },
}

/**
 * Format a number based on the specified format type
 */
function formatValue(
  value: number,
  format: LiveCounterProps['format'],
  options: {
    currency?: string
    decimals?: number
    formatter?: (value: number) => string
  }
): string {
  const { currency = 'EUR', decimals = 0, formatter } = options

  if (formatter) {
    return formatter(value)
  }

  switch (format) {
    case 'currency':
      return formatCurrency(value, currency)
    case 'percent':
      return `${value.toFixed(decimals)}%`
    case 'compact':
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`
      }
      return formatNumber(Math.round(value))
    case 'number':
    default:
      return decimals > 0
        ? value.toLocaleString('fr-FR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : formatNumber(Math.round(value))
  }
}

/**
 * LiveCounter component - Animated number counter with optional formatting
 *
 * Smoothly animates between number values, perfect for real-time statistics.
 */
export function LiveCounter({
  value,
  previousValue,
  format = 'number',
  currency = 'EUR',
  formatter,
  animationDuration = 500,
  easing = 'ease-out',
  showChange = false,
  showTrend = false,
  decimals = 0,
  prefix,
  suffix,
  size = 'md',
  highlightOnChange = true,
  highlightColor = 'green',
  className,
}: LiveCounterProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)

  const animationRef = useRef<number | null>(null)
  const startValueRef = useRef(value)
  const startTimeRef = useRef(0)
  const prevValueRef = useRef(value)

  // Calculate change
  const change = useMemo(() => {
    const prev = previousValue ?? prevValueRef.current
    return value - prev
  }, [value, previousValue])

  const changePercent = useMemo(() => {
    const prev = previousValue ?? prevValueRef.current
    if (prev === 0) return 0
    return ((value - prev) / Math.abs(prev)) * 100
  }, [value, previousValue])

  // Get trend direction
  const trend = useMemo(() => {
    if (change > 0) return 'up'
    if (change < 0) return 'down'
    return 'neutral'
  }, [change])

  // Animate value changes
  useEffect(() => {
    if (value === displayValue && value === prevValueRef.current) {
      return
    }

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    setIsAnimating(true)
    startValueRef.current = displayValue
    startTimeRef.current = performance.now()

    const easingFn = easingFunctions[easing]

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / animationDuration, 1)

      const easedProgress = easingFn(progress)
      const currentValue =
        startValueRef.current + (value - startValueRef.current) * easedProgress

      setDisplayValue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
        animationRef.current = null
        prevValueRef.current = value
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, animationDuration, easing])

  // Format the displayed value
  const formattedValue = useMemo(
    () => formatValue(displayValue, format, { currency, decimals, formatter }),
    [displayValue, format, currency, decimals, formatter]
  )

  // Format the change value
  const formattedChange = useMemo(() => {
    const absChange = Math.abs(change)
    return formatValue(absChange, format, { currency, decimals, formatter })
  }, [change, format, currency, decimals, formatter])

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <div className={cn('inline-flex flex-col', className)}>
      {/* Main value */}
      <div className="flex items-baseline gap-1">
        {prefix && (
          <span className={cn(SIZE_CLASSES[size], 'opacity-60')}>{prefix}</span>
        )}
        <span
          className={cn(
            SIZE_CLASSES[size],
            'tabular-nums transition-all',
            highlightOnChange &&
              isAnimating &&
              change !== 0 &&
              HIGHLIGHT_CLASSES[highlightColor],
            highlightOnChange && isAnimating && 'scale-105'
          )}
        >
          {formattedValue}
        </span>
        {suffix && (
          <span className={cn(SIZE_CLASSES[size], 'opacity-60')}>{suffix}</span>
        )}
      </div>

      {/* Change indicator */}
      {(showChange || showTrend) && change !== 0 && (
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-sm',
            trend === 'up' && 'text-green-600',
            trend === 'down' && 'text-red-600',
            trend === 'neutral' && 'text-gray-500'
          )}
        >
          {showTrend && (
            <TrendIcon className={TREND_SIZE_CLASSES[size]} />
          )}
          {showChange && (
            <span>
              {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
              {formattedChange}
              {changePercent !== 0 && (
                <span className="ml-1 opacity-75">
                  ({changePercent > 0 ? '+' : ''}
                  {changePercent.toFixed(1)}%)
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * CurrencyCounter - Specialized counter for currency values
 */
export interface CurrencyCounterProps {
  value: number
  previousValue?: number
  currency?: string
  showChange?: boolean
  showTrend?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function CurrencyCounter({
  value,
  previousValue,
  currency = 'EUR',
  showChange = false,
  showTrend = false,
  size = 'md',
  className,
}: CurrencyCounterProps) {
  return (
    <LiveCounter
      value={value}
      previousValue={previousValue}
      format="currency"
      currency={currency}
      showChange={showChange}
      showTrend={showTrend}
      size={size}
      decimals={2}
      className={className}
    />
  )
}

/**
 * CompactCounter - Counter with compact number formatting (K, M)
 */
export interface CompactCounterProps {
  value: number
  previousValue?: number
  showChange?: boolean
  showTrend?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  suffix?: string
  className?: string
}

export function CompactCounter({
  value,
  previousValue,
  showChange = false,
  showTrend = false,
  size = 'md',
  suffix,
  className,
}: CompactCounterProps) {
  return (
    <LiveCounter
      value={value}
      previousValue={previousValue}
      format="compact"
      showChange={showChange}
      showTrend={showTrend}
      size={size}
      suffix={suffix}
      className={className}
    />
  )
}

/**
 * PercentCounter - Counter for percentage values
 */
export interface PercentCounterProps {
  value: number
  previousValue?: number
  decimals?: number
  showChange?: boolean
  showTrend?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function PercentCounter({
  value,
  previousValue,
  decimals = 1,
  showChange = false,
  showTrend = false,
  size = 'md',
  className,
}: PercentCounterProps) {
  return (
    <LiveCounter
      value={value}
      previousValue={previousValue}
      format="percent"
      decimals={decimals}
      showChange={showChange}
      showTrend={showTrend}
      size={size}
      className={className}
    />
  )
}

/**
 * TimerCounter - Counter that displays time in HH:MM:SS format
 */
export interface TimerCounterProps {
  /** Time in seconds */
  seconds: number
  /** Show hours even if zero */
  showHours?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Additional CSS classes */
  className?: string
}

export function TimerCounter({
  seconds,
  showHours = true,
  size = 'md',
  className,
}: TimerCounterProps) {
  const formatted = useMemo(() => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    const pad = (n: number) => n.toString().padStart(2, '0')

    if (showHours || hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    }
    return `${pad(mins)}:${pad(secs)}`
  }, [seconds, showHours])

  return (
    <span
      className={cn(
        SIZE_CLASSES[size],
        'tabular-nums font-mono',
        className
      )}
    >
      {formatted}
    </span>
  )
}

/**
 * Hook for animated counter value
 */
export function useAnimatedValue(
  value: number,
  options: {
    duration?: number
    easing?: keyof typeof easingFunctions
  } = {}
) {
  const { duration = 500, easing = 'ease-out' } = options
  const [displayValue, setDisplayValue] = useState(value)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (value === displayValue) return

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const startValue = displayValue
    const startTime = performance.now()
    const easingFn = easingFunctions[easing]

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easingFn(progress)
      const currentValue = startValue + (value - startValue) * easedProgress

      setDisplayValue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        animationRef.current = null
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration, easing])

  return displayValue
}
