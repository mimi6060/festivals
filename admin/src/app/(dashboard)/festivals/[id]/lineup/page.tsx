'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Music,
  Edit,
  Trash2,
  GripVertical,
} from 'lucide-react'

// Mock data for demonstration
const mockFestival = {
  id: '1',
  name: 'Summer Fest 2026',
  startDate: '2026-06-15',
  endDate: '2026-06-17',
}

const mockStages = [
  { id: '1', name: 'Main Stage', capacity: 15000, type: 'MAIN' },
  { id: '2', name: 'Electronic Tent', capacity: 5000, type: 'TENT' },
  { id: '3', name: 'Acoustic Garden', capacity: 2000, type: 'OUTDOOR' },
  { id: '4', name: 'Discovery Stage', capacity: 1000, type: 'SECONDARY' },
]

const mockPerformances = [
  { id: '1', artistName: 'The Midnight', stageId: '1', startTime: '2026-06-15T18:00:00', endTime: '2026-06-15T19:30:00', status: 'CONFIRMED' },
  { id: '2', artistName: 'ODESZA', stageId: '1', startTime: '2026-06-15T20:00:00', endTime: '2026-06-15T22:00:00', status: 'CONFIRMED' },
  { id: '3', artistName: 'Disclosure', stageId: '2', startTime: '2026-06-15T19:00:00', endTime: '2026-06-15T21:00:00', status: 'CONFIRMED' },
  { id: '4', artistName: 'Khruangbin', stageId: '3', startTime: '2026-06-15T17:00:00', endTime: '2026-06-15T18:30:00', status: 'PENDING' },
  { id: '5', artistName: 'Bonobo', stageId: '2', startTime: '2026-06-15T22:00:00', endTime: '2026-06-16T00:00:00', status: 'CONFIRMED' },
  { id: '6', artistName: 'Jungle', stageId: '1', startTime: '2026-06-16T19:00:00', endTime: '2026-06-16T20:30:00', status: 'CONFIRMED' },
  { id: '7', artistName: 'Kaytranada', stageId: '2', startTime: '2026-06-16T21:00:00', endTime: '2026-06-16T23:00:00', status: 'PENDING' },
  { id: '8', artistName: 'Floating Points', stageId: '4', startTime: '2026-06-15T20:00:00', endTime: '2026-06-15T22:00:00', status: 'CONFIRMED' },
]

// Helper function to generate dates between start and end
function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  return dates
}

// Helper function to format date for display
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

// Helper function to format time
function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// Get hour from datetime string
function getHour(dateStr: string): number {
  return new Date(dateStr).getHours()
}

// Calculate duration in hours
function getDurationHours(startTime: string, endTime: string): number {
  const start = new Date(startTime)
  const end = new Date(endTime)
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
}

// Timeline hours to display (14:00 to 02:00 next day)
const TIMELINE_HOURS = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2]

export default function LineupPage() {
  const params = useParams()
  const festivalId = params.id as string

  const festivalDates = useMemo(
    () => getDatesInRange(mockFestival.startDate, mockFestival.endDate),
    []
  )

  const [selectedDate, setSelectedDate] = useState(festivalDates[0])
  const [draggedPerformance, setDraggedPerformance] = useState<string | null>(null)

  // Filter performances for selected date
  const dayPerformances = useMemo(() => {
    return mockPerformances.filter((p) => p.startTime.startsWith(selectedDate))
  }, [selectedDate])

  // Group performances by stage
  const performancesByStage = useMemo(() => {
    const grouped: Record<string, typeof mockPerformances> = {}
    mockStages.forEach((stage) => {
      grouped[stage.id] = dayPerformances.filter((p) => p.stageId === stage.id)
    })
    return grouped
  }, [dayPerformances])

  const handleDragStart = (performanceId: string) => {
    setDraggedPerformance(performanceId)
  }

  const handleDragEnd = () => {
    setDraggedPerformance(null)
  }

  const handleDrop = (stageId: string, hour: number) => {
    if (draggedPerformance) {
      // TODO: Implement actual rescheduling via API
      console.log(`Moving performance ${draggedPerformance} to stage ${stageId} at hour ${hour}`)
      setDraggedPerformance(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-500'
      case 'PENDING':
        return 'bg-yellow-500'
      case 'CANCELLED':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStageColor = (index: number) => {
    const colors = [
      'bg-purple-600 hover:bg-purple-700',
      'bg-blue-600 hover:bg-blue-700',
      'bg-emerald-600 hover:bg-emerald-700',
      'bg-orange-600 hover:bg-orange-700',
    ]
    return colors[index % colors.length]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programme / Lineup</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez le programme et les performances du festival
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/festivals/${festivalId}/lineup/stages`}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <MapPin className="h-4 w-4" />
            Scenes
          </Link>
          <Link
            href={`/festivals/${festivalId}/lineup/artists`}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Music className="h-4 w-4" />
            Artistes
          </Link>
          <Link
            href={`/festivals/${festivalId}/lineup/performances/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Ajouter Performance
          </Link>
        </div>
      </div>

      {/* Day Selector */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              const currentIndex = festivalDates.indexOf(selectedDate)
              if (currentIndex > 0) {
                setSelectedDate(festivalDates[currentIndex - 1])
              }
            }}
            disabled={festivalDates.indexOf(selectedDate) === 0}
            className="rounded-lg p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex gap-2">
            {festivalDates.map((date, index) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  selectedDate === date
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                <div className="text-xs opacity-75">Jour {index + 1}</div>
                <div className="capitalize">{formatDateLabel(date)}</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              const currentIndex = festivalDates.indexOf(selectedDate)
              if (currentIndex < festivalDates.length - 1) {
                setSelectedDate(festivalDates[currentIndex + 1])
              }
            }}
            disabled={festivalDates.indexOf(selectedDate) === festivalDates.length - 1}
            className="rounded-lg p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Stats for the day */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Music className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Performances</p>
              <p className="text-2xl font-bold">{dayPerformances.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Scenes actives</p>
              <p className="text-2xl font-bold">{mockStages.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Confirmes</p>
              <p className="text-2xl font-bold">
                {dayPerformances.filter((p) => p.status === 'CONFIRMED').length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-100 p-2">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-2xl font-bold">
                {dayPerformances.filter((p) => p.status === 'PENDING').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline View */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="border-b bg-gray-50 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Timeline des performances</h2>
          <p className="text-sm text-gray-500">
            Glissez-deposez les performances pour les reprogrammer
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1200px]">
            {/* Time header */}
            <div className="flex border-b bg-gray-50">
              <div className="w-40 shrink-0 border-r px-4 py-2 font-medium text-gray-700">
                Scene
              </div>
              <div className="flex flex-1">
                {TIMELINE_HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 border-r px-2 py-2 text-center text-sm font-medium text-gray-600"
                  >
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Stage rows */}
            {mockStages.map((stage, stageIndex) => (
              <div key={stage.id} className="flex border-b last:border-b-0">
                {/* Stage name */}
                <div className="w-40 shrink-0 border-r bg-gray-50 px-4 py-3">
                  <div className="font-medium text-gray-900">{stage.name}</div>
                  <div className="text-xs text-gray-500">
                    {stage.capacity?.toLocaleString()} places
                  </div>
                </div>

                {/* Timeline cells */}
                <div className="relative flex flex-1 min-h-[80px]">
                  {/* Hour grid lines */}
                  {TIMELINE_HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="flex-1 border-r border-dashed border-gray-200"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(stage.id, hour)}
                    />
                  ))}

                  {/* Performances */}
                  {performancesByStage[stage.id]?.map((performance) => {
                    const startHour = getHour(performance.startTime)
                    const duration = getDurationHours(performance.startTime, performance.endTime)

                    // Calculate position (14:00 = 0%, 02:00 = 100%)
                    let hourOffset = startHour - 14
                    if (startHour < 14) hourOffset = startHour + 10 // Handle after midnight

                    const leftPercent = (hourOffset / TIMELINE_HOURS.length) * 100
                    const widthPercent = (duration / TIMELINE_HOURS.length) * 100

                    return (
                      <div
                        key={performance.id}
                        draggable
                        onDragStart={() => handleDragStart(performance.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          'absolute top-2 bottom-2 rounded-lg px-2 py-1 text-white cursor-move transition-opacity',
                          getStageColor(stageIndex),
                          draggedPerformance === performance.id && 'opacity-50'
                        )}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          minWidth: '100px',
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-1 min-w-0">
                            <GripVertical className="h-3 w-3 shrink-0 opacity-50" />
                            <span className="text-sm font-medium truncate">
                              {performance.artistName}
                            </span>
                          </div>
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full shrink-0 ml-1',
                              getStatusColor(performance.status)
                            )}
                            title={performance.status}
                          />
                        </div>
                        <div className="text-xs opacity-80 mt-0.5">
                          {formatTime(performance.startTime)} - {formatTime(performance.endTime)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance List (Alternative view) */}
      <div className="rounded-lg border bg-white">
        <div className="border-b bg-gray-50 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Liste des performances</h2>
        </div>

        <div className="divide-y">
          {dayPerformances.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              Aucune performance programmee pour ce jour.
              <Link
                href={`/festivals/${festivalId}/lineup/performances/new`}
                className="ml-2 text-primary hover:underline"
              >
                Ajouter une performance
              </Link>
            </div>
          ) : (
            dayPerformances
              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
              .map((performance) => {
                const stage = mockStages.find((s) => s.id === performance.stageId)
                return (
                  <div
                    key={performance.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">
                          {formatTime(performance.startTime)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTime(performance.endTime)}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {performance.artistName}
                        </div>
                        <div className="text-sm text-gray-500">{stage?.name}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-xs font-medium',
                          performance.status === 'CONFIRMED' && 'bg-green-100 text-green-700',
                          performance.status === 'PENDING' && 'bg-yellow-100 text-yellow-700',
                          performance.status === 'CANCELLED' && 'bg-red-100 text-red-700'
                        )}
                      >
                        {performance.status === 'CONFIRMED' && 'Confirme'}
                        {performance.status === 'PENDING' && 'En attente'}
                        {performance.status === 'CANCELLED' && 'Annule'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="rounded-lg p-2 text-gray-400 hover:bg-red-100 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
          )}
        </div>
      </div>
    </div>
  )
}
