'use client'

import { type Cohort } from '@/lib/api/stats'
import { formatNumber, cn } from '@/lib/utils'

interface CohortTableProps {
  cohorts: Cohort[]
  period: string
}

export function CohortTable({ cohorts, period }: CohortTableProps) {
  // Find the maximum number of periods across all cohorts
  const maxPeriods = Math.max(...cohorts.map((c) => c.metrics.length))

  // Generate period headers
  const periodHeaders: string[] = []
  for (let i = 0; i < maxPeriods; i++) {
    if (period === 'DAILY') {
      periodHeaders.push(`J${i}`)
    } else if (period === 'WEEKLY') {
      periodHeaders.push(`S${i}`)
    } else {
      periodHeaders.push(`M${i}`)
    }
  }

  // Get color based on retention rate
  const getRetentionColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-600 text-white'
    if (rate >= 60) return 'bg-green-500 text-white'
    if (rate >= 40) return 'bg-green-400 text-white'
    if (rate >= 20) return 'bg-yellow-400 text-gray-900'
    if (rate >= 10) return 'bg-orange-400 text-white'
    if (rate > 0) return 'bg-red-400 text-white'
    return 'bg-gray-100 text-gray-400'
  }

  // Get opacity based on retention rate for gradient effect
  const getRetentionOpacity = (rate: number) => {
    const opacity = Math.min(rate / 100, 1)
    return `rgba(16, 185, 129, ${opacity})`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Cohorte
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
              Taille
            </th>
            {periodHeaders.map((header, index) => (
              <th
                key={header}
                className="px-4 py-3 text-center text-sm font-semibold text-gray-900"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {cohorts.map((cohort) => (
            <tr key={cohort.id} className="hover:bg-gray-50">
              <td className="sticky left-0 z-10 bg-white px-4 py-3">
                <span className="font-medium text-gray-900">{cohort.name}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-sm text-gray-600">
                  {formatNumber(cohort.cohortSize)}
                </span>
              </td>
              {periodHeaders.map((_, index) => {
                const metric = cohort.metrics[index]
                const rate = metric?.retentionRate || 0

                return (
                  <td key={index} className="px-2 py-3">
                    {metric ? (
                      <div
                        className={cn(
                          'mx-auto flex h-10 w-16 items-center justify-center rounded text-xs font-medium transition-colors',
                          getRetentionColor(rate)
                        )}
                        title={`${formatNumber(metric.count)} utilisateurs (${rate.toFixed(1)}%)`}
                      >
                        {rate.toFixed(0)}%
                      </div>
                    ) : (
                      <div className="mx-auto h-10 w-16 rounded bg-gray-50" />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs">
        <span className="text-gray-500">Retention:</span>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-red-400" />
          <span>0-10%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-orange-400" />
          <span>10-20%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-yellow-400" />
          <span>20-40%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-green-400" />
          <span>40-60%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-green-500" />
          <span>60-80%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-green-600" />
          <span>80-100%</span>
        </div>
      </div>
    </div>
  )
}
