'use client'

import { useMemo, useEffect, useRef, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts'
import { cn, formatCurrency } from '@/lib/utils'
import { TrendingUp, Activity } from 'lucide-react'
import type { RevenuePoint, StatsUpdate } from '@/hooks/useWebSocket'

interface LiveRevenueChartProps {
  revenuePoints: RevenuePoint[]
  currentStats?: StatsUpdate | null
  loading?: boolean
  className?: string
  title?: string
  animate?: boolean
}

interface ChartDataPoint {
  time: string
  revenue: number
  label: string
  timestamp: number
}

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartDataPoint
    return (
      <div className="rounded-lg border bg-white p-3 shadow-lg">
        <p className="font-medium text-gray-900">{data.label || label}</p>
        <p className="text-sm text-gray-600">
          Revenue: <span className="font-medium">{formatCurrency(data.revenue)}</span>
        </p>
      </div>
    )
  }
  return null
}

function LoadingSkeleton() {
  return (
    <div className="flex h-[250px] items-end gap-1 p-4">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 animate-pulse rounded-t bg-gray-200"
          style={{ height: `${Math.random() * 60 + 20}%` }}
        />
      ))}
    </div>
  )
}

function AnimatedCounter({
  value,
  duration = 500,
}: {
  value: number
  duration?: number
}) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValueRef = useRef(value)

  useEffect(() => {
    if (value === prevValueRef.current) return

    const startValue = prevValueRef.current
    const endValue = value
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentValue = startValue + (endValue - startValue) * easeOutQuart

      setDisplayValue(currentValue)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
    prevValueRef.current = value
  }, [value, duration])

  return <span>{formatCurrency(displayValue)}</span>
}

export function LiveRevenue({
  revenuePoints,
  currentStats,
  loading = false,
  className,
  title = 'Revenue en temps reel',
  animate = true,
}: LiveRevenueChartProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const prevRevenueRef = useRef<number>(0)

  // Convert revenue points to chart data
  const chartData = useMemo((): ChartDataPoint[] => {
    if (revenuePoints.length === 0) {
      // Generate placeholder data for empty state
      const now = Date.now()
      return Array.from({ length: 20 }).map((_, i) => ({
        time: new Date(now - (19 - i) * 60000).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        revenue: 0,
        label: '',
        timestamp: now - (19 - i) * 60000,
      }))
    }

    return revenuePoints.map((point) => {
      const date = new Date(point.timestamp)
      return {
        time: date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        revenue: point.revenue,
        label: point.label,
        timestamp: date.getTime(),
      }
    })
  }, [revenuePoints])

  // Calculate stats
  const totalRevenue = useMemo(() => {
    if (currentStats) return currentStats.total_revenue
    if (revenuePoints.length === 0) return 0
    return revenuePoints[revenuePoints.length - 1]?.revenue || 0
  }, [currentStats, revenuePoints])

  const revenueChange = useMemo(() => {
    if (currentStats) return currentStats.revenue_change
    if (revenuePoints.length < 2) return 0
    const latest = revenuePoints[revenuePoints.length - 1]?.revenue || 0
    const previous = revenuePoints[revenuePoints.length - 2]?.revenue || 0
    if (previous === 0) return 0
    return ((latest - previous) / previous) * 100
  }, [currentStats, revenuePoints])

  // Animate on revenue change
  useEffect(() => {
    if (totalRevenue !== prevRevenueRef.current && animate) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 1000)
      prevRevenueRef.current = totalRevenue
      return () => clearTimeout(timer)
    }
  }, [totalRevenue, animate])

  // Determine Y-axis domain
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 1000]
    const revenues = chartData.map((d) => d.revenue).filter((r) => r > 0)
    if (revenues.length === 0) return [0, 1000]
    const max = Math.max(...revenues)
    const min = Math.min(...revenues)
    const padding = (max - min) * 0.1 || max * 0.1
    return [Math.max(0, min - padding), max + padding]
  }, [chartData])

  return (
    <div className={cn('rounded-lg border bg-card shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" />
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            Evolution du chiffre d'affaires
          </p>
        </div>
        <div className="text-right">
          <div
            className={cn(
              'text-2xl font-bold transition-transform',
              isAnimating && 'scale-110 text-green-600'
            )}
          >
            <AnimatedCounter value={totalRevenue} />
          </div>
          <div
            className={cn(
              'flex items-center justify-end gap-1 text-sm',
              revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            <Activity className="h-3 w-3" />
            <span>
              {revenueChange >= 0 ? '+' : ''}
              {revenueChange.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            >
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={yAxisDomain}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(value) =>
                  value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
                }
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorRevenue)"
                animationDuration={animate ? 300 : 0}
                isAnimationActive={animate}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer Stats */}
      {currentStats && (
        <div className="grid grid-cols-3 gap-4 border-t px-6 py-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="font-semibold">{currentStats.today_transactions}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Volume</p>
            <p className="font-semibold">
              {formatCurrency(currentStats.transaction_volume)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Moy. Panier</p>
            <p className="font-semibold">
              {currentStats.today_transactions > 0
                ? formatCurrency(
                    currentStats.transaction_volume / currentStats.today_transactions
                  )
                : '-'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
