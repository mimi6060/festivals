'use client'

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, BarChart3, Clock, Zap, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DailyUsage {
  date: string
  requestCount: number
  bandwidth: number
  errorCount: number
}

interface EndpointStats {
  endpoint: string
  method: string
  requestCount: number
  avgResponseTime: number
  errorRate: number
}

interface UsageChartProps {
  apiKeyId: string
  dailyUsage: DailyUsage[]
  topEndpoints: EndpointStats[]
  totalRequests: number
  totalBandwidth: number
  avgResponseTime: number
  successRate: number
  period: 'day' | 'week' | 'month'
  onPeriodChange: (period: 'day' | 'week' | 'month') => void
}

export function UsageChart({
  apiKeyId,
  dailyUsage,
  topEndpoints,
  totalRequests,
  totalBandwidth,
  avgResponseTime,
  successRate,
  period,
  onPeriodChange,
}: UsageChartProps) {
  const maxRequests = useMemo(() => {
    return Math.max(...dailyUsage.map((d) => d.requestCount), 1)
  }, [dailyUsage])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB'
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB'
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return bytes + ' B'
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-100 text-green-700'
      case 'POST':
        return 'bg-blue-100 text-blue-700'
      case 'PATCH':
        return 'bg-yellow-100 text-yellow-700'
      case 'DELETE':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Statistiques d'utilisation</h2>
        <div className="flex rounded-lg border bg-white p-1">
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                period === p
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {p === 'day' ? 'Jour' : p === 'week' ? 'Semaine' : 'Mois'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-blue-100 p-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <span className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12%
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold">{formatNumber(totalRequests)}</p>
          <p className="text-sm text-gray-500">Requetes totales</p>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-purple-100 p-2">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold">{formatBytes(totalBandwidth)}</p>
          <p className="text-sm text-gray-500">Bande passante</p>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-yellow-100 p-2">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold">{avgResponseTime.toFixed(0)}ms</p>
          <p className="text-sm text-gray-500">Temps moyen</p>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-green-100 p-2">
              <AlertCircle className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold">{successRate.toFixed(1)}%</p>
          <p className="text-sm text-gray-500">Taux de succes</p>
        </div>
      </div>

      {/* Usage Chart */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="font-medium text-gray-900 mb-4">Requetes par jour</h3>
        {dailyUsage.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-500">
            Aucune donnee pour cette periode
          </div>
        ) : (
          <div className="h-48">
            <div className="flex h-full items-end gap-1">
              {dailyUsage.map((day, index) => {
                const height = (day.requestCount / maxRequests) * 100
                const errorHeight = day.errorCount > 0
                  ? (day.errorCount / day.requestCount) * height
                  : 0

                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center group"
                  >
                    <div className="w-full relative flex flex-col justify-end" style={{ height: '180px' }}>
                      {/* Bar */}
                      <div
                        className="w-full bg-blue-500 rounded-t-sm relative transition-all hover:bg-blue-600"
                        style={{ height: `${height}%`, minHeight: day.requestCount > 0 ? '4px' : '0' }}
                      >
                        {/* Error portion */}
                        {errorHeight > 0 && (
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-red-500 rounded-t-sm"
                            style={{ height: `${errorHeight}%` }}
                          />
                        )}
                      </div>

                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          <p className="font-medium">{formatDate(day.date)}</p>
                          <p>{formatNumber(day.requestCount)} requetes</p>
                          {day.errorCount > 0 && (
                            <p className="text-red-400">{day.errorCount} erreurs</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Date label */}
                    <span className="text-xs text-gray-400 mt-2 truncate w-full text-center">
                      {index % 3 === 0 || dailyUsage.length <= 7
                        ? formatDate(day.date)
                        : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span>Requetes reussies</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded" />
            <span>Erreurs</span>
          </div>
        </div>
      </div>

      {/* Top Endpoints */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="font-medium text-gray-900 mb-4">Endpoints les plus utilises</h3>
        {topEndpoints.length === 0 ? (
          <p className="text-gray-500">Aucune donnee disponible</p>
        ) : (
          <div className="space-y-3">
            {topEndpoints.map((endpoint, index) => {
              const widthPercent = (endpoint.requestCount / topEndpoints[0].requestCount) * 100

              return (
                <div key={`${endpoint.method}-${endpoint.endpoint}`} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-bold',
                        getMethodColor(endpoint.method)
                      )}>
                        {endpoint.method}
                      </span>
                      <code className="text-gray-600 truncate max-w-xs">{endpoint.endpoint}</code>
                    </div>
                    <div className="flex items-center gap-4 text-gray-500">
                      <span>{formatNumber(endpoint.requestCount)} req</span>
                      <span>{endpoint.avgResponseTime.toFixed(0)}ms</span>
                      {endpoint.errorRate > 0 && (
                        <span className="text-red-500">{endpoint.errorRate.toFixed(1)}% err</span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
