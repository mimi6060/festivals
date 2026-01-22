'use client'

import { useState, useEffect } from 'react'
import {
  CreditCard,
  CheckCircle,
  Ban,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Activity,
  RefreshCw,
} from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

interface NFCStatsData {
  totalBracelets: number
  activeBracelets: number
  unassignedBracelets: number
  blockedBracelets: number
  lostBracelets: number
  totalTransactions: number
  totalVolume: number
  todayTransactions: number
  todayVolume: number
}

interface NFCStatsProps {
  festivalId: string
  className?: string
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: {
    value: number
    label: string
  }
  color?: 'default' | 'green' | 'red' | 'orange' | 'blue' | 'purple'
}

const colorClasses = {
  default: 'bg-gray-100 text-gray-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  orange: 'bg-orange-100 text-orange-600',
  blue: 'bg-blue-100 text-blue-600',
  purple: 'bg-purple-100 text-purple-600',
}

function StatCard({ title, value, icon, trend, color = 'default' }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className={cn('rounded-full p-2', colorClasses[color])}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <TrendingUp
            className={cn(
              'h-4 w-4',
              trend.value >= 0 ? 'text-green-500' : 'text-red-500'
            )}
          />
          <span
            className={cn(
              'text-sm font-medium',
              trend.value >= 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend.value >= 0 ? '+' : ''}
            {trend.value}%
          </span>
          <span className="text-sm text-gray-500">{trend.label}</span>
        </div>
      )}
    </div>
  )
}

export default function NFCStats({ festivalId, className }: NFCStatsProps) {
  const [stats, setStats] = useState<NFCStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [festivalId])

  const loadStats = async () => {
    setLoading(true)
    setError(null)

    try {
      // API call would go here
      // const response = await nfcApi.getStats(festivalId)
      // setStats(response)

      // Mock data
      setStats({
        totalBracelets: 10000,
        activeBracelets: 5234,
        unassignedBracelets: 4523,
        blockedBracelets: 156,
        lostBracelets: 87,
        totalTransactions: 45678,
        totalVolume: 234567.50,
        todayTransactions: 1234,
        todayVolume: 12345.50,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-6">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="mt-3 h-8 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('rounded-lg border bg-red-50 p-6', className)}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <div>
            <p className="font-medium text-red-900">Erreur de chargement</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={loadStats}
            className="ml-auto rounded-lg border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  if (!stats) return null

  const activationRate = Math.round((stats.activeBracelets / stats.totalBracelets) * 100)

  return (
    <div className={cn('space-y-6', className)}>
      {/* Bracelets Stats */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-3">Bracelets</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total bracelets"
            value={formatNumber(stats.totalBracelets)}
            icon={<CreditCard className="h-5 w-5" />}
          />
          <StatCard
            title="Actifs"
            value={formatNumber(stats.activeBracelets)}
            icon={<CheckCircle className="h-5 w-5" />}
            color="green"
            trend={{ value: activationRate, label: 'du total' }}
          />
          <StatCard
            title="Non assignes"
            value={formatNumber(stats.unassignedBracelets)}
            icon={<CreditCard className="h-5 w-5" />}
          />
          <StatCard
            title="Bloques"
            value={formatNumber(stats.blockedBracelets)}
            icon={<Ban className="h-5 w-5" />}
            color="red"
          />
          <StatCard
            title="Perdus"
            value={formatNumber(stats.lostBracelets)}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="orange"
          />
        </div>
      </div>

      {/* Transactions Stats */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-3">Transactions</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total transactions"
            value={formatNumber(stats.totalTransactions)}
            icon={<Activity className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            title="Volume total"
            value={formatCurrency(stats.totalVolume)}
            icon={<DollarSign className="h-5 w-5" />}
            color="purple"
          />
          <StatCard
            title="Transactions aujourd'hui"
            value={formatNumber(stats.todayTransactions)}
            icon={<TrendingUp className="h-5 w-5" />}
            color="green"
          />
          <StatCard
            title="Volume aujourd'hui"
            value={formatCurrency(stats.todayVolume)}
            icon={<DollarSign className="h-5 w-5" />}
            color="green"
          />
        </div>
      </div>

      {/* Activation Progress */}
      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-gray-900">Taux d'activation</h3>
            <p className="text-sm text-gray-500">
              {formatNumber(stats.activeBracelets)} bracelets actifs sur {formatNumber(stats.totalBracelets)}
            </p>
          </div>
          <span className="text-2xl font-bold text-green-600">{activationRate}%</span>
        </div>
        <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div
              className="bg-green-500"
              style={{ width: `${(stats.activeBracelets / stats.totalBracelets) * 100}%` }}
            />
            <div
              className="bg-red-500"
              style={{ width: `${(stats.blockedBracelets / stats.totalBracelets) * 100}%` }}
            />
            <div
              className="bg-orange-500"
              style={{ width: `${(stats.lostBracelets / stats.totalBracelets) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-6 mt-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-gray-600">Actifs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-gray-300" />
            <span className="text-gray-600">Non assignes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-gray-600">Bloques</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-orange-500" />
            <span className="text-gray-600">Perdus</span>
          </div>
        </div>
      </div>
    </div>
  )
}
