'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Users,
  DollarSign,
  Clock,
  AlertCircle,
  Lightbulb,
  CheckCircle,
} from 'lucide-react'
import { PredictionCard } from '@/components/analytics/PredictionCard'
import { analyticsApi, analyticsQueryKeys, type Predictions, type Recommendation } from '@/lib/api/stats'
import { formatNumber, formatCurrency, formatDateTime, cn } from '@/lib/utils'

const priorityColors = {
  critical: 'border-red-200 bg-red-50 text-red-800',
  high: 'border-orange-200 bg-orange-50 text-orange-800',
  medium: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  low: 'border-blue-200 bg-blue-50 text-blue-800',
}

const priorityLabels = {
  critical: 'Critique',
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
}

const categoryIcons = {
  staffing: Users,
  inventory: Target,
  pricing: DollarSign,
  operations: Clock,
}

export default function PredictionsPage() {
  const params = useParams()
  const festivalId = params.id as string

  // Fetch predictions
  const { data: predictions, isLoading } = useQuery({
    queryKey: analyticsQueryKeys.predictions(festivalId),
    queryFn: () => analyticsApi.getPredictions(festivalId),
  })

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
          <h1 className="text-2xl font-bold">Predictions ML</h1>
        </div>
        {predictions && (
          <p className="text-sm text-gray-500">
            Genere le: {formatDateTime(predictions.generatedAt)}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : predictions ? (
        <>
          {/* Main Predictions */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue Prediction */}
            {predictions.revenue && (
              <PredictionCard
                prediction={predictions.revenue}
                icon={DollarSign}
                color="green"
              />
            )}

            {/* Attendance Prediction */}
            {predictions.attendance && (
              <PredictionCard
                prediction={predictions.attendance}
                icon={Users}
                color="blue"
              />
            )}
          </div>

          {/* Peak Hours */}
          {predictions.peakHours.length > 0 && (
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="border-b px-6 py-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Predictions des Pics d'Affluence
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Periodes prevues de forte affluence
                </p>
              </div>
              <div className="p-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  {predictions.peakHours.map((peak, index) => (
                    <div
                      key={peak.id}
                      className={cn(
                        'rounded-lg border p-4',
                        index === 0
                          ? 'border-red-200 bg-red-50'
                          : index === 1
                            ? 'border-orange-200 bg-orange-50'
                            : 'border-yellow-200 bg-yellow-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            index === 0
                              ? 'text-red-700'
                              : index === 1
                                ? 'text-orange-700'
                                : 'text-yellow-700'
                          )}
                        >
                          {peak.name}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            peak.confidenceLevel === 'high'
                              ? 'bg-green-100 text-green-700'
                              : peak.confidenceLevel === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {(peak.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{peak.description}</p>
                      <p className="mt-2 text-lg font-bold">
                        {formatNumber(peak.predictedValue)} {peak.unit}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stand Demand */}
          {predictions.standDemand.length > 0 && (
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="border-b px-6 py-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Target className="h-5 w-5 text-purple-500" />
                  Previsions de Demande par Stand
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Transactions prevues pour demain
                </p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {predictions.standDemand.map((demand) => (
                    <div
                      key={demand.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-4"
                    >
                      <div>
                        <p className="font-semibold">{demand.name}</p>
                        <p className="text-sm text-gray-600">{demand.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {formatNumber(demand.predictedValue)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatNumber(demand.lowerBound)} - {formatNumber(demand.upperBound)}
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-1">
                          {demand.trend === 'up' ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : demand.trend === 'down' ? (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          ) : (
                            <Minus className="h-3 w-3 text-gray-500" />
                          )}
                          <span
                            className={cn(
                              'text-xs font-medium',
                              demand.trend === 'up'
                                ? 'text-green-600'
                                : demand.trend === 'down'
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                            )}
                          >
                            {demand.percentChange > 0 ? '+' : ''}
                            {demand.percentChange.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {predictions.recommendations.length > 0 && (
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="border-b px-6 py-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Recommandations
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Actions suggerees basees sur l'analyse des donnees
                </p>
              </div>
              <div className="divide-y">
                {predictions.recommendations.map((rec) => {
                  const CategoryIcon = categoryIcons[rec.category as keyof typeof categoryIcons] || Target
                  return (
                    <div key={rec.id} className="p-6">
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                            rec.category === 'staffing'
                              ? 'bg-blue-100 text-blue-600'
                              : rec.category === 'inventory'
                                ? 'bg-green-100 text-green-600'
                                : rec.category === 'pricing'
                                  ? 'bg-purple-100 text-purple-600'
                                  : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          <CategoryIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{rec.title}</h4>
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-xs font-medium',
                                priorityColors[rec.priority]
                              )}
                            >
                              {priorityLabels[rec.priority]}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{rec.description}</p>
                          <div className="mt-3 rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-medium text-gray-500">Impact attendu</p>
                            <p className="text-sm">{rec.impact}</p>
                          </div>
                          {rec.actionItems.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-gray-500">Actions a entreprendre</p>
                              <ul className="mt-2 space-y-1">
                                {rec.actionItems.map((item, index) => (
                                  <li key={index} className="flex items-start gap-2 text-sm">
                                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {rec.deadline && (
                            <p className="mt-3 text-xs text-gray-500">
                              Echeance: {formatDateTime(rec.deadline)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">A propos des predictions</p>
              <p className="mt-1 text-sm text-gray-600">
                Ces predictions sont generees par des modeles d'apprentissage automatique bases sur
                les donnees historiques. Les resultats reels peuvent varier en fonction de
                nombreux facteurs externes. Utilisez ces informations comme guide, pas comme
                certitude.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-lg border bg-gray-50">
          <div className="text-center">
            <Brain className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              Pas de predictions disponibles
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Les predictions apparaitront lorsque suffisamment de donnees seront collectees
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
