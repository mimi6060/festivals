'use client'

import { type Heatmap } from '@/lib/api/stats'
import { formatNumber, cn } from '@/lib/utils'

interface HeatmapOverlayProps {
  heatmap: Heatmap
  showLabels?: boolean
}

export function HeatmapOverlay({ heatmap, showLabels = true }: HeatmapOverlayProps) {
  // For TIME type heatmaps, render as a grid (hours x days)
  if (heatmap.type === 'TIME' || heatmap.type === 'ENGAGEMENT') {
    return <TimeHeatmap heatmap={heatmap} showLabels={showLabels} />
  }

  // For LOCATION, SPENDING, TRAFFIC types, render as a list (simplified)
  return <LocationHeatmap heatmap={heatmap} showLabels={showLabels} />
}

// Time-based heatmap (hours x days of week)
function TimeHeatmap({
  heatmap,
  showLabels,
}: {
  heatmap: Heatmap
  showLabels: boolean
}) {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Create a 2D grid of values
  const grid: (number | null)[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(null)
  )

  // Fill the grid with values
  heatmap.points.forEach((point) => {
    const day = Math.round(point.y)
    const hour = Math.round(point.x)
    if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
      grid[day][hour] = point.value
    }
  })

  // Get color intensity based on value
  const getColor = (value: number | null) => {
    if (value === null) return 'bg-gray-50'

    const range = heatmap.maxValue - heatmap.minValue
    if (range === 0) return 'bg-blue-200'

    const normalized = (value - heatmap.minValue) / range

    if (normalized > 0.9) return 'bg-red-600'
    if (normalized > 0.75) return 'bg-orange-500'
    if (normalized > 0.6) return 'bg-yellow-400'
    if (normalized > 0.4) return 'bg-yellow-300'
    if (normalized > 0.25) return 'bg-green-300'
    if (normalized > 0.1) return 'bg-blue-200'
    return 'bg-blue-100'
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Hour headers */}
        <div className="flex">
          <div className="w-12" /> {/* Empty corner */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="w-8 flex-shrink-0 text-center text-xs text-gray-500"
            >
              {hour.toString().padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {days.map((day, dayIndex) => (
          <div key={day} className="flex items-center">
            {/* Day label */}
            <div className="w-12 flex-shrink-0 pr-2 text-right text-xs font-medium text-gray-600">
              {day}
            </div>

            {/* Hour cells */}
            {hours.map((hour) => {
              const value = grid[dayIndex][hour]
              return (
                <div
                  key={`${dayIndex}-${hour}`}
                  className={cn(
                    'h-6 w-8 flex-shrink-0 border border-white transition-colors',
                    getColor(value)
                  )}
                  title={
                    value !== null
                      ? `${day} ${hour}:00 - ${formatNumber(value)} ${heatmap.unit}`
                      : `${day} ${hour}:00 - Pas de donnees`
                  }
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// Location-based heatmap (rendered as sorted list with bars)
function LocationHeatmap({
  heatmap,
  showLabels,
}: {
  heatmap: Heatmap
  showLabels: boolean
}) {
  const sortedPoints = [...heatmap.points]
    .filter((p) => p.label)
    .sort((a, b) => b.value - a.value)

  const maxValue = Math.max(...sortedPoints.map((p) => p.value))

  // Get color based on value percentage
  const getBarColor = (value: number) => {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0

    if (percentage > 80) return 'bg-red-500'
    if (percentage > 60) return 'bg-orange-500'
    if (percentage > 40) return 'bg-yellow-500'
    if (percentage > 20) return 'bg-green-500'
    return 'bg-blue-500'
  }

  return (
    <div className="space-y-3">
      {sortedPoints.slice(0, 10).map((point, index) => {
        const width = maxValue > 0 ? (point.value / maxValue) * 100 : 0

        return (
          <div key={point.locationId || index} className="flex items-center gap-4">
            {/* Rank */}
            <div
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold',
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

            {/* Label and bar */}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{point.label}</span>
                <span className="text-sm text-gray-600">
                  {heatmap.unit === 'EUR'
                    ? `${point.value.toFixed(2)} EUR`
                    : formatNumber(point.value)}
                </span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn('h-full rounded-full transition-all', getBarColor(point.value))}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}

      {sortedPoints.length === 0 && (
        <div className="flex h-48 items-center justify-center text-gray-500">
          Pas de donnees de localisation disponibles
        </div>
      )}

      {sortedPoints.length > 10 && (
        <p className="text-center text-sm text-gray-500">
          + {sortedPoints.length - 10} autres localisations
        </p>
      )}
    </div>
  )
}
