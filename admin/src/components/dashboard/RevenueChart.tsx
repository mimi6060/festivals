'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

export interface RevenueDataPoint {
  date: string
  revenue: number
  transactions: number
}

interface RevenueChartProps {
  data: RevenueDataPoint[]
  loading?: boolean
  title?: string
}

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as RevenueDataPoint
    return (
      <div className="rounded-lg border bg-white p-3 shadow-lg">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-600">
          Revenue: <span className="font-medium">{formatCurrency(data.revenue)}</span>
        </p>
        <p className="text-sm text-gray-600">
          Transactions: <span className="font-medium">{data.transactions}</span>
        </p>
      </div>
    )
  }
  return null
}

function LoadingSkeleton() {
  return (
    <div className="flex h-[300px] items-end gap-2 p-4">
      {Array.from({ length: 7 }).map((_, i) => (
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
  title = 'Revenue (Last 7 Days)',
}: RevenueChartProps) {
  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      formattedDate: new Date(item.date).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
      }),
    }))
  }, [data])

  const totalRevenue = useMemo(() => {
    return data.reduce((sum, item) => sum + item.revenue, 0)
  }, [data])

  const totalTransactions = useMemo(() => {
    return data.reduce((sum, item) => sum + item.transactions, 0)
  }, [data])

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            Daily revenue and transaction volume
          </p>
        </div>
        {!loading && (
          <div className="text-right">
            <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
            <p className="text-sm text-muted-foreground">
              {totalTransactions} transactions
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="formattedDate"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
            <Bar
              dataKey="revenue"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
