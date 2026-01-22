'use client'

import { useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
  Legend,
} from 'recharts'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { DailyRevenue, WeeklyRevenue, MonthlyRevenue } from '@/lib/api/finance'
import { TrendingUp, TrendingDown, Minus, BarChart3, LineChart as LineIcon, AreaChart as AreaIcon } from 'lucide-react'

type ChartType = 'bar' | 'line' | 'area'
type DataPoint = DailyRevenue | WeeklyRevenue | MonthlyRevenue

interface RevenueChartProps {
  data: DataPoint[]
  loading?: boolean
  title?: string
  subtitle?: string
  period?: 'day' | 'week' | 'month'
  showFees?: boolean
  showRefunds?: boolean
  showTransactions?: boolean
  height?: number
  defaultChartType?: ChartType
  className?: string
}

function formatDate(dataPoint: DataPoint, period: 'day' | 'week' | 'month'): string {
  if (period === 'day' && 'date' in dataPoint) {
    return new Date(dataPoint.date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }
  if (period === 'week' && 'weekStart' in dataPoint) {
    const start = new Date(dataPoint.weekStart)
    const end = new Date(dataPoint.weekEnd)
    return `${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}`
  }
  if (period === 'month' && 'month' in dataPoint) {
    const date = new Date(dataPoint.year, parseInt(dataPoint.month) - 1)
    return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
  }
  return ''
}

function CustomTooltip({
  active,
  payload,
  label,
  showFees,
  showRefunds,
  showTransactions,
}: TooltipProps<number, string> & {
  showFees?: boolean
  showRefunds?: boolean
  showTransactions?: boolean
}) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="rounded-lg border bg-white p-4 shadow-lg">
        <p className="mb-2 font-medium text-gray-900">{label}</p>
        <div className="space-y-1 text-sm">
          <p className="flex items-center justify-between gap-8">
            <span className="text-gray-600">Revenus:</span>
            <span className="font-medium text-green-600">{formatCurrency(data.revenue)}</span>
          </p>
          {showFees && (
            <p className="flex items-center justify-between gap-8">
              <span className="text-gray-600">Frais plateforme:</span>
              <span className="font-medium text-orange-600">-{formatCurrency(data.fees)}</span>
            </p>
          )}
          {showRefunds && data.refunds > 0 && (
            <p className="flex items-center justify-between gap-8">
              <span className="text-gray-600">Remboursements:</span>
              <span className="font-medium text-red-600">-{formatCurrency(data.refunds)}</span>
            </p>
          )}
          {showTransactions && (
            <p className="flex items-center justify-between gap-8 border-t pt-1 mt-1">
              <span className="text-gray-600">Transactions:</span>
              <span className="font-medium">{formatNumber(data.transactions)}</span>
            </p>
          )}
          {showFees && (
            <p className="flex items-center justify-between gap-8 border-t pt-1 mt-1">
              <span className="text-gray-600">Net:</span>
              <span className="font-bold text-gray-900">
                {formatCurrency(data.revenue - data.fees - (data.refunds || 0))}
              </span>
            </p>
          )}
        </div>
      </div>
    )
  }
  return null
}

function LoadingSkeleton({ height }: { height: number }) {
  return (
    <div className="flex items-end gap-2 p-4" style={{ height }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 animate-pulse rounded-t bg-gray-200"
          style={{ height: `${Math.random() * 60 + 40}%` }}
        />
      ))}
    </div>
  )
}

export function RevenueChart({
  data,
  loading = false,
  title = 'Revenus',
  subtitle,
  period = 'day',
  showFees = true,
  showRefunds = true,
  showTransactions = true,
  height = 350,
  defaultChartType = 'bar',
  className,
}: RevenueChartProps) {
  const [chartType, setChartType] = useState<ChartType>(defaultChartType)
  const [showMetric, setShowMetric] = useState<'revenue' | 'transactions' | 'fees'>('revenue')

  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      formattedLabel: formatDate(item, period),
      netRevenue: item.revenue - item.fees - (item.refunds || 0),
    }))
  }, [data, period])

  const stats = useMemo(() => {
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0)
    const totalFees = data.reduce((sum, item) => sum + item.fees, 0)
    const totalRefunds = data.reduce((sum, item) => sum + (item.refunds || 0), 0)
    const totalTransactions = data.reduce((sum, item) => sum + item.transactions, 0)
    const netRevenue = totalRevenue - totalFees - totalRefunds

    // Calculate trend (compare last half to first half)
    const midPoint = Math.floor(data.length / 2)
    const firstHalfRevenue = data.slice(0, midPoint).reduce((sum, item) => sum + item.revenue, 0)
    const secondHalfRevenue = data.slice(midPoint).reduce((sum, item) => sum + item.revenue, 0)
    const trend = firstHalfRevenue > 0 ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 : 0

    return {
      totalRevenue,
      totalFees,
      totalRefunds,
      totalTransactions,
      netRevenue,
      trend,
      averageTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
    }
  }, [data])

  const getTrendIcon = () => {
    if (stats.trend > 5) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (stats.trend < -5) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const chartTypeButtons = [
    { type: 'bar' as ChartType, icon: BarChart3, label: 'Barres' },
    { type: 'line' as ChartType, icon: LineIcon, label: 'Ligne' },
    { type: 'area' as ChartType, icon: AreaIcon, label: 'Aire' },
  ]

  const metricOptions = [
    { value: 'revenue' as const, label: 'Revenus' },
    { value: 'transactions' as const, label: 'Transactions' },
    { value: 'fees' as const, label: 'Frais' },
  ]

  const renderChart = () => {
    const commonProps = {
      data: formattedData,
      margin: { top: 10, right: 10, left: 10, bottom: 10 },
    }

    const xAxisProps = {
      dataKey: 'formattedLabel',
      axisLine: false,
      tickLine: false,
      tick: { fontSize: 12, fill: '#6b7280' },
    }

    const yAxisProps = {
      axisLine: false,
      tickLine: false,
      tick: { fontSize: 12, fill: '#6b7280' },
      tickFormatter: (value: number) =>
        showMetric === 'transactions' ? formatNumber(value) : `${(value / 1000).toFixed(0)}k`,
    }

    const tooltipContent = (
      <CustomTooltip
        showFees={showFees}
        showRefunds={showRefunds}
        showTransactions={showTransactions}
      />
    )

    const dataKey = showMetric === 'transactions' ? 'transactions' : showMetric === 'fees' ? 'fees' : 'revenue'
    const color = showMetric === 'transactions' ? '#3b82f6' : showMetric === 'fees' ? '#f59e0b' : '#10b981'

    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={tooltipContent} cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={50} />
          {showMetric === 'revenue' && showFees && (
            <Bar dataKey="fees" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={50} />
          )}
        </BarChart>
      )
    }

    if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={tooltipContent} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
          {showMetric === 'revenue' && showFees && (
            <Line
              type="monotone"
              dataKey="fees"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', strokeWidth: 2 }}
              strokeDasharray="5 5"
            />
          )}
        </LineChart>
      )
    }

    return (
      <AreaChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={tooltipContent} />
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorRevenue)"
        />
        {showMetric === 'revenue' && showFees && (
          <Area
            type="monotone"
            dataKey="fees"
            stroke="#f59e0b"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorFees)"
          />
        )}
      </AreaChart>
    )
  }

  return (
    <div className={cn('rounded-lg border bg-white shadow-sm', className)}>
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {/* Metric selector */}
            <select
              value={showMetric}
              onChange={(e) => setShowMetric(e.target.value as typeof showMetric)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {metricOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Chart type selector */}
            <div className="flex rounded-lg border border-gray-300">
              {chartTypeButtons.map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setChartType(type)}
                  title={label}
                  className={cn(
                    'p-2 transition-colors first:rounded-l-lg last:rounded-r-lg',
                    chartType === type
                      ? 'bg-primary text-white'
                      : 'text-gray-500 hover:bg-gray-50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 border-b px-6 py-4 sm:grid-cols-4">
          <div>
            <p className="text-sm text-gray-500">Total revenus</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Frais plateforme (1%)</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.totalFees)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Net</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(stats.netRevenue)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tendance</p>
            <p className="flex items-center gap-1 text-xl font-bold">
              {getTrendIcon()}
              <span
                className={cn(
                  stats.trend > 5 ? 'text-green-600' : stats.trend < -5 ? 'text-red-600' : 'text-gray-600'
                )}
              >
                {stats.trend > 0 ? '+' : ''}
                {stats.trend.toFixed(1)}%
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="p-6">
        {loading ? (
          <LoadingSkeleton height={height} />
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center" style={{ height }}>
            <p className="text-gray-500">Aucune donnee disponible</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer stats */}
      {!loading && data.length > 0 && (
        <div className="border-t bg-gray-50 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600">
            <span>
              <strong>{formatNumber(stats.totalTransactions)}</strong> transactions
            </span>
            <span>
              Panier moyen: <strong>{formatCurrency(stats.averageTransaction)}</strong>
            </span>
            {stats.totalRefunds > 0 && (
              <span className="text-red-600">
                Remboursements: <strong>{formatCurrency(stats.totalRefunds)}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Simple mini chart for dashboards
interface MiniRevenueChartProps {
  data: { value: number }[]
  color?: string
  height?: number
  className?: string
}

export function MiniRevenueChart({
  data,
  color = '#10b981',
  height = 60,
  className,
}: MiniRevenueChartProps) {
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="miniColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#miniColor)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
