'use client'

import { type Funnel } from '@/lib/api/stats'
import { formatNumber, cn } from '@/lib/utils'

interface FunnelChartProps {
  funnel: Funnel
  showPercentages?: boolean
}

export function FunnelChart({ funnel, showPercentages = true }: FunnelChartProps) {
  const maxCount = Math.max(...funnel.steps.map((s) => s.count))

  const getColor = (index: number, total: number) => {
    const colors = [
      'bg-blue-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-rose-500',
    ]
    return colors[Math.min(index, colors.length - 1)]
  }

  const getBarWidth = (count: number) => {
    if (maxCount === 0) return 100
    return (count / maxCount) * 100
  }

  return (
    <div className="space-y-4">
      {funnel.steps.map((step, index) => {
        const width = getBarWidth(step.count)
        const isFirst = index === 0
        const dropOff = isFirst ? 0 : 100 - step.percentage

        return (
          <div key={step.name} className="relative">
            {/* Connection line */}
            {index > 0 && (
              <div className="absolute -top-2 left-1/2 h-2 w-px bg-gray-300" />
            )}

            <div className="flex items-center gap-4">
              {/* Step number */}
              <div
                className={cn(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
                  getColor(index, funnel.steps.length)
                )}
              >
                {index + 1}
              </div>

              {/* Bar and info */}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{step.name}</span>
                  <span className="text-sm text-gray-600">
                    {formatNumber(step.count)} utilisateurs
                  </span>
                </div>

                {/* Funnel bar */}
                <div className="mt-1 h-10 overflow-hidden rounded-lg bg-gray-100">
                  <div
                    className={cn(
                      'flex h-full items-center justify-center transition-all duration-500',
                      getColor(index, funnel.steps.length)
                    )}
                    style={{ width: `${width}%` }}
                  >
                    {showPercentages && width > 15 && (
                      <span className="text-sm font-medium text-white">
                        {step.percentage.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Drop-off indicator */}
                {index > 0 && dropOff > 0 && (
                  <div className="mt-1 flex items-center gap-1">
                    <div className="h-1 flex-1 rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-red-400"
                        style={{ width: `${dropOff}%` }}
                      />
                    </div>
                    <span className="text-xs text-red-600">-{dropOff.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Summary */}
      <div className="mt-6 flex items-center justify-center gap-8 rounded-lg bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-sm text-gray-500">Entree</p>
          <p className="text-xl font-bold text-blue-600">
            {formatNumber(funnel.totalStarted)}
          </p>
        </div>
        <div className="text-3xl text-gray-300">→</div>
        <div className="text-center">
          <p className="text-sm text-gray-500">Sortie</p>
          <p className="text-xl font-bold text-green-600">
            {formatNumber(funnel.totalCompleted)}
          </p>
        </div>
        <div className="text-3xl text-gray-300">=</div>
        <div className="text-center">
          <p className="text-sm text-gray-500">Conversion</p>
          <p className="text-xl font-bold text-purple-600">
            {funnel.conversionRate.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  )
}
