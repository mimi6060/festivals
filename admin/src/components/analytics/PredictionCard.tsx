'use client'

import { type Prediction } from '@/lib/api/stats'
import { formatNumber, formatCurrency, cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react'

interface PredictionCardProps {
  prediction: Prediction
  icon: LucideIcon
  color: 'green' | 'blue' | 'purple' | 'orange'
}

const colorClasses = {
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
    text: 'text-green-900',
    subtext: 'text-green-700',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    text: 'text-blue-900',
    subtext: 'text-blue-700',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600',
    text: 'text-purple-900',
    subtext: 'text-purple-700',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-600',
    text: 'text-orange-900',
    subtext: 'text-orange-700',
  },
}

export function PredictionCard({ prediction, icon: Icon, color }: PredictionCardProps) {
  const colors = colorClasses[color]

  const formatValue = (value: number, unit: string) => {
    if (unit === 'EUR' || unit === 'cents') {
      return formatCurrency(value)
    }
    return formatNumber(Math.round(value))
  }

  const getTrendIcon = () => {
    switch (prediction.trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getConfidenceColor = () => {
    switch (prediction.confidenceLevel) {
      case 'high':
        return 'bg-green-100 text-green-700'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700'
      case 'low':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className={cn('rounded-lg border p-6', colors.bg, colors.border)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-lg',
              colors.iconBg
            )}
          >
            <Icon className={cn('h-6 w-6', colors.iconText)} />
          </div>
          <div>
            <h3 className={cn('font-semibold', colors.text)}>{prediction.name}</h3>
            {prediction.description && (
              <p className={cn('text-sm', colors.subtext)}>{prediction.description}</p>
            )}
          </div>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            getConfidenceColor()
          )}
        >
          {(prediction.confidence * 100).toFixed(0)}% confiance
        </span>
      </div>

      {/* Main prediction value */}
      <div className="mt-6">
        <p className={cn('text-3xl font-bold', colors.text)}>
          {formatValue(prediction.predictedValue, prediction.unit)}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Intervalle: {formatValue(prediction.lowerBound, prediction.unit)} -{' '}
            {formatValue(prediction.upperBound, prediction.unit)}
          </span>
        </div>
      </div>

      {/* Trend indicator */}
      <div className="mt-4 flex items-center gap-2">
        {getTrendIcon()}
        <span
          className={cn(
            'text-sm font-medium',
            prediction.trend === 'up'
              ? 'text-green-600'
              : prediction.trend === 'down'
                ? 'text-red-600'
                : 'text-gray-600'
          )}
        >
          {prediction.percentChange > 0 ? '+' : ''}
          {prediction.percentChange.toFixed(1)}% vs periode precedente
        </span>
      </div>

      {/* Factors */}
      {prediction.factors.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-xs font-medium text-gray-500">Facteurs contributifs</p>
          <div className="mt-2 space-y-2">
            {prediction.factors.slice(0, 3).map((factor, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{factor.name}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        factor.impact > 0 ? 'bg-green-500' : 'bg-red-500'
                      )}
                      style={{ width: `${Math.abs(factor.impact) * 100}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      factor.impact > 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {factor.impact > 0 ? '+' : ''}
                    {(factor.impact * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical comparison mini chart (simplified) */}
      {prediction.historical.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-xs font-medium text-gray-500">Historique</p>
          <div className="mt-2 flex items-end gap-1">
            {prediction.historical.slice(-7).map((point, index) => {
              const maxHistorical = Math.max(
                ...prediction.historical.map((p) => p.value)
              )
              const height = maxHistorical > 0 ? (point.value / maxHistorical) * 40 : 0

              return (
                <div
                  key={index}
                  className="flex-1 rounded-t bg-gray-300"
                  style={{ height: `${Math.max(height, 4)}px` }}
                  title={`${point.label || point.date}: ${formatValue(point.value, prediction.unit)}`}
                />
              )
            })}
            <div
              className={cn('flex-1 rounded-t', colors.iconBg)}
              style={{ height: '40px' }}
              title={`Prediction: ${formatValue(prediction.predictedValue, prediction.unit)}`}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-400">
            <span>Historique</span>
            <span>Prevu</span>
          </div>
        </div>
      )}
    </div>
  )
}
