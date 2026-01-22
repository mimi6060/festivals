'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Map,
  Clock,
  DollarSign,
  Users,
  Activity,
} from 'lucide-react'
import { HeatmapOverlay } from '@/components/analytics/HeatmapOverlay'
import { analyticsApi, analyticsQueryKeys, type Heatmap } from '@/lib/api/stats'
import { formatNumber, formatCurrency, cn } from '@/lib/utils'

type HeatmapType = 'LOCATION' | 'TIME' | 'SPENDING' | 'TRAFFIC' | 'ENGAGEMENT'

const heatmapTypes: { type: HeatmapType; label: string; icon: typeof Map; description: string }[] = [
  {
    type: 'LOCATION',
    label: 'Localisation',
    icon: Map,
    description: 'Activite par zone du festival',
  },
  {
    type: 'TIME',
    label: 'Temporel',
    icon: Clock,
    description: 'Activite par jour et heure',
  },
  {
    type: 'SPENDING',
    label: 'Depenses',
    icon: DollarSign,
    description: 'Revenus par stand',
  },
  {
    type: 'TRAFFIC',
    label: 'Traffic',
    icon: Users,
    description: 'Flux de visiteurs',
  },
  {
    type: 'ENGAGEMENT',
    label: 'Engagement',
    icon: Activity,
    description: 'Niveau d\'interaction',
  },
]

export default function HeatmapsPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [selectedType, setSelectedType] = useState<HeatmapType>('TIME')
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d')

  const getDateRange = () => {
    const end = new Date()
    const start = new Date()
    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7)
        break
      case '30d':
        start.setDate(start.getDate() - 30)
        break
      case '90d':
        start.setDate(start.getDate() - 90)
        break
    }
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    }
  }

  const { startDate, endDate } = getDateRange()

  // Fetch heatmap data
  const { data: heatmap, isLoading } = useQuery({
    queryKey: [...analyticsQueryKeys.heatmap(festivalId, selectedType), dateRange],
    queryFn: () => analyticsApi.getHeatmap(festivalId, selectedType, startDate, endDate),
  })

  const selectedTypeInfo = heatmapTypes.find((t) => t.type === selectedType)

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
          <h1 className="text-2xl font-bold">Cartes de Chaleur</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border bg-white p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  dateRange === range
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {range === '7d' ? '7 jours' : range === '30d' ? '30 jours' : '90 jours'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Type Selector */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {heatmapTypes.map((type) => (
          <button
            key={type.type}
            onClick={() => setSelectedType(type.type)}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-4 transition-all',
              selectedType === type.type
                ? 'border-primary bg-primary/5'
                : 'hover:border-gray-300'
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                selectedType === type.type ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
              )}
            >
              <type.icon className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold">{type.label}</p>
              <p className="text-xs text-gray-500">{type.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Heatmap Display */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            {selectedTypeInfo && <selectedTypeInfo.icon className="h-5 w-5 text-primary" />}
            <h3 className="text-lg font-semibold">{heatmap?.name || 'Carte de chaleur'}</h3>
          </div>
          {heatmap?.description && (
            <p className="mt-1 text-sm text-gray-600">{heatmap.description}</p>
          )}
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : heatmap && heatmap.points.length > 0 ? (
            <div>
              <HeatmapOverlay heatmap={heatmap} />

              {/* Statistics */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-sm text-gray-600">Minimum</p>
                  <p className="text-lg font-bold">
                    {heatmap.unit === 'EUR'
                      ? formatCurrency(heatmap.minValue * 100)
                      : formatNumber(heatmap.minValue)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-sm text-gray-600">Maximum</p>
                  <p className="text-lg font-bold">
                    {heatmap.unit === 'EUR'
                      ? formatCurrency(heatmap.maxValue * 100)
                      : formatNumber(heatmap.maxValue)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-sm text-gray-600">Points de donnees</p>
                  <p className="text-lg font-bold">{formatNumber(heatmap.points.length)}</p>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-gray-700">Legende</p>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-full rounded bg-gradient-to-r from-blue-100 via-yellow-300 via-orange-400 to-red-600" />
                </div>
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <span>Faible</span>
                  <span>Moyen</span>
                  <span>Eleve</span>
                </div>
              </div>

              {/* Top Locations (for non-time heatmaps) */}
              {selectedType !== 'TIME' && heatmap.points.some((p) => p.label) && (
                <div className="mt-6">
                  <h4 className="mb-3 font-semibold">Top Localisations</h4>
                  <div className="space-y-2">
                    {heatmap.points
                      .filter((p) => p.label)
                      .sort((a, b) => b.value - a.value)
                      .slice(0, 5)
                      .map((point, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                        >
                          <div className="flex items-center gap-3">
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
                            <span className="font-medium">{point.label}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">
                              {heatmap.unit === 'EUR'
                                ? formatCurrency(point.value * 100)
                                : formatNumber(point.value)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatNumber(point.count)} {heatmap.unit}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-96 items-center justify-center">
              <div className="text-center">
                <Map className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  Pas de donnees disponibles
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Les donnees de carte de chaleur apparaitront lorsque des evenements seront enregistres
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
