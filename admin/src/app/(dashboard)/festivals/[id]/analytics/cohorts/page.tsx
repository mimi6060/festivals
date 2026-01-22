'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { CohortTable } from '@/components/analytics/CohortTable'
import { analyticsApi, analyticsQueryKeys, type CohortAnalysis } from '@/lib/api/stats'
import { formatNumber, formatCurrency, cn } from '@/lib/utils'

export default function CohortsPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [cohortType, setCohortType] = useState<string>('first_activity')
  const [period, setPeriod] = useState<string>('WEEKLY')

  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Fetch cohort analysis
  const { data: analysis, isLoading } = useQuery({
    queryKey: [...analyticsQueryKeys.cohorts(festivalId, cohortType), period],
    queryFn: () => analyticsApi.getCohortAnalysis(festivalId, cohortType, period, startDate, endDate),
  })

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600 bg-green-50'
      case 'declining':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/analytics`}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux Analytics
          </Link>
          <h1 className="text-2xl font-bold">Analyse de Cohortes</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Cohort Type Selector */}
          <select
            value={cohortType}
            onChange={(e) => setCohortType(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="first_activity">Premiere activite</option>
            <option value="ticket_purchase">Achat de billet</option>
            <option value="revenue">Revenue</option>
            <option value="spending">Depenses</option>
          </select>

          {/* Period Selector */}
          <div className="flex rounded-lg border bg-white p-1">
            {[
              { value: 'DAILY', label: 'Jour' },
              { value: 'WEEKLY', label: 'Semaine' },
              { value: 'MONTHLY', label: 'Mois' },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  period === p.value
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : analysis ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Total Utilisateurs</p>
              </div>
              <p className="mt-2 text-2xl font-bold">{formatNumber(analysis.summary.totalUsers)}</p>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm text-muted-foreground">Retention Moyenne</p>
              <p className="mt-2 text-2xl font-bold">
                {analysis.summary.averageRetention.toFixed(1)}%
              </p>
              <div
                className={cn(
                  'mt-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  getTrendColor(analysis.summary.trendDirection)
                )}
              >
                {getTrendIcon(analysis.summary.trendDirection)}
                <span className="capitalize">{analysis.summary.trendDirection}</span>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm text-muted-foreground">Valeur Vie Client (LTV)</p>
              <p className="mt-2 text-2xl font-bold">
                {formatCurrency(analysis.summary.averageLifetimeValue)}
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm text-muted-foreground">Meilleure Cohorte</p>
              <p className="mt-2 text-2xl font-bold">{analysis.summary.bestCohort || '-'}</p>
              <p className="text-xs text-gray-500">
                Pire: {analysis.summary.worstCohort || '-'}
              </p>
            </div>
          </div>

          {/* Cohort Table */}
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold">{analysis.name}</h3>
              {analysis.description && (
                <p className="mt-1 text-sm text-gray-600">{analysis.description}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Groupe par: {analysis.groupBy} | Metrique: {analysis.metric} | Periode: {analysis.period}
              </p>
            </div>
            <div className="p-6">
              {analysis.cohorts.length > 0 ? (
                <CohortTable cohorts={analysis.cohorts} period={analysis.period} />
              ) : (
                <div className="flex h-48 items-center justify-center">
                  <p className="text-gray-500">Pas assez de donnees pour l'analyse de cohortes</p>
                </div>
              )}
            </div>
          </div>

          {/* Insights */}
          {analysis.cohorts.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Retention Trends */}
              <div className="rounded-lg border bg-card shadow-sm">
                <div className="border-b px-6 py-4">
                  <h3 className="font-semibold">Tendances de Retention</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {analysis.cohorts.slice(0, 5).map((cohort) => {
                      const lastRetention =
                        cohort.retentionCurve[cohort.retentionCurve.length - 1] || 0
                      return (
                        <div key={cohort.id} className="flex items-center gap-4">
                          <div className="w-24 text-sm font-medium">{cohort.name}</div>
                          <div className="flex-1">
                            <div className="h-4 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  lastRetention > 50
                                    ? 'bg-green-500'
                                    : lastRetention > 25
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                )}
                                style={{ width: `${lastRetention}%` }}
                              />
                            </div>
                          </div>
                          <div className="w-16 text-right text-sm font-medium">
                            {lastRetention.toFixed(0)}%
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* LTV by Cohort */}
              <div className="rounded-lg border bg-card shadow-sm">
                <div className="border-b px-6 py-4">
                  <h3 className="font-semibold">Valeur par Cohorte</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {analysis.cohorts
                      .slice(0, 5)
                      .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
                      .map((cohort, index) => (
                        <div key={cohort.id} className="flex items-center gap-4">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                              index === 0
                                ? 'bg-yellow-100 text-yellow-700'
                                : index === 1
                                  ? 'bg-gray-200 text-gray-700'
                                  : index === 2
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{cohort.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatNumber(cohort.cohortSize)} utilisateurs
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(cohort.lifetimeValue)}</p>
                            <p className="text-sm text-gray-500">LTV moyen</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-lg border bg-gray-50">
          <div className="text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              Pas de donnees de cohortes
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Les donnees d'analyse de cohortes apparaitront lorsque des utilisateurs seront actifs
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
