'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  List,
  Grid,
  Plus,
  FileText,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Plane,
  Hotel,
} from 'lucide-react'

// Types
interface Performance {
  id: string
  festivalId: string
  festivalName: string
  festivalLogo?: string
  stageId: string
  stageName: string
  date: string
  startTime: string
  endTime: string
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED'
  setDuration: number
  soundcheckTime?: string
  loadInTime?: string
  travelInfo?: {
    arrivalDate: string
    departureDate: string
    hotel?: string
    flight?: string
  }
  notes?: string
}

interface AvailabilitySlot {
  id: string
  startDate: string
  endDate: string
  status: 'AVAILABLE' | 'TENTATIVE' | 'UNAVAILABLE' | 'BOOKED'
  notes?: string
}

// Mock data
const mockPerformances: Performance[] = [
  {
    id: '1',
    festivalId: 'f1',
    festivalName: 'Summer Fest 2026',
    stageId: 's1',
    stageName: 'Main Stage',
    date: '2026-06-15',
    startTime: '21:00',
    endTime: '22:30',
    status: 'CONFIRMED',
    setDuration: 90,
    soundcheckTime: '17:00',
    loadInTime: '14:00',
    travelInfo: {
      arrivalDate: '2026-06-14',
      departureDate: '2026-06-16',
      hotel: 'Grand Hotel Paris',
      flight: 'AF1234 - Seattle to Paris',
    },
    notes: 'Headline slot - Full production',
  },
  {
    id: '2',
    festivalId: 'f2',
    festivalName: 'Electric Dreams',
    stageId: 's2',
    stageName: 'Electronic Arena',
    date: '2026-07-20',
    startTime: '23:00',
    endTime: '01:00',
    status: 'PENDING',
    setDuration: 120,
    soundcheckTime: '19:00',
    notes: 'Waiting for contract signature',
  },
  {
    id: '3',
    festivalId: 'f3',
    festivalName: 'Sunset Festival',
    stageId: 's3',
    stageName: 'Main Stage',
    date: '2026-08-13',
    startTime: '22:00',
    endTime: '23:30',
    status: 'CONFIRMED',
    setDuration: 90,
    travelInfo: {
      arrivalDate: '2026-08-12',
      departureDate: '2026-08-14',
      hotel: 'Ibiza Beach Resort',
    },
  },
]

const mockAvailability: AvailabilitySlot[] = [
  { id: 'a1', startDate: '2026-06-01', endDate: '2026-06-30', status: 'AVAILABLE' },
  { id: 'a2', startDate: '2026-07-15', endDate: '2026-07-25', status: 'TENTATIVE', notes: 'Possible studio session' },
  { id: 'a3', startDate: '2026-08-01', endDate: '2026-08-31', status: 'AVAILABLE' },
  { id: 'a4', startDate: '2026-09-01', endDate: '2026-09-15', status: 'UNAVAILABLE', notes: 'Album recording' },
]

export default function ArtistSchedulePage() {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 5, 1)) // June 2026
  const [selectedPerformance, setSelectedPerformance] = useState<Performance | null>(null)

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateStr))
  }

  const formatShortDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(dateStr))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'CANCELLED':
        return 'bg-red-100 text-red-700 border-red-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getDaysUntil = (dateStr: string) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diffTime = date.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Calendar helpers
  const getMonthDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: { date: Date; isCurrentMonth: boolean }[] = []

    // Add previous month days
    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    for (let i = startPadding; i > 0; i--) {
      days.push({
        date: new Date(year, month, 1 - i),
        isCurrentMonth: false,
      })
    }

    // Add current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      })
    }

    // Add next month days
    const endPadding = 42 - days.length
    for (let i = 1; i <= endPadding; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      })
    }

    return days
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return mockPerformances.filter((p) => p.date === dateStr)
  }

  const getAvailabilityForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return mockAvailability.find(
      (a) => dateStr >= a.startDate && dateStr <= a.endDate
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon Planning</h1>
          <p className="mt-1 text-sm text-gray-500">
            Consultez vos performances et gerez vos disponibilites
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border bg-white p-1">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <List className="h-4 w-4" />
              Liste
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                viewMode === 'calendar' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <Grid className="h-4 w-4" />
              Calendrier
            </button>
          </div>
          <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Plus className="h-4 w-4" />
            Disponibilites
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        /* List View */
        <div className="space-y-4">
          {mockPerformances.length === 0 ? (
            <div className="rounded-xl border bg-white p-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune performance</h3>
              <p className="text-sm text-gray-500">
                Vous n'avez pas encore de performances programmees.
              </p>
            </div>
          ) : (
            mockPerformances
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((performance) => (
                <div
                  key={performance.id}
                  onClick={() => setSelectedPerformance(performance)}
                  className="rounded-xl border bg-white overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex">
                    {/* Date Column */}
                    <div className="w-24 shrink-0 bg-gradient-to-br from-purple-600 to-pink-600 text-white p-4 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">
                        {new Date(performance.date).getDate()}
                      </span>
                      <span className="text-sm opacity-90">
                        {new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(
                          new Date(performance.date)
                        )}
                      </span>
                      <span className="text-xs mt-1 opacity-75">
                        {new Date(performance.date).getFullYear()}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">
                              {performance.festivalName}
                            </h3>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                                getStatusColor(performance.status)
                              )}
                            >
                              {performance.status === 'CONFIRMED' && (
                                <CheckCircle className="h-3 w-3" />
                              )}
                              {performance.status === 'PENDING' && (
                                <AlertCircle className="h-3 w-3" />
                              )}
                              {performance.status === 'CONFIRMED' && 'Confirme'}
                              {performance.status === 'PENDING' && 'En attente'}
                              {performance.status === 'CANCELLED' && 'Annule'}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {performance.startTime} - {performance.endTime}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {performance.stageName}
                            </span>
                            <span>{performance.setDuration} min</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-purple-600">
                            J-{getDaysUntil(performance.date)}
                          </span>
                        </div>
                      </div>

                      {/* Travel Info */}
                      {performance.travelInfo && (
                        <div className="mt-3 flex flex-wrap gap-3 text-sm">
                          {performance.travelInfo.hotel && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <Hotel className="h-4 w-4" />
                              {performance.travelInfo.hotel}
                            </span>
                          )}
                          {performance.travelInfo.flight && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <Plane className="h-4 w-4" />
                              {performance.travelInfo.flight}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      ) : (
        /* Calendar View */
        <div className="rounded-xl border bg-white overflow-hidden">
          {/* Month Navigation */}
          <div className="flex items-center justify-between border-b p-4">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="rounded-lg p-2 hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
                currentMonth
              )}
            </h2>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="rounded-lg p-2 hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="p-4">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {getMonthDays().map(({ date, isCurrentMonth }, index) => {
                const events = getEventsForDate(date)
                const availability = getAvailabilityForDate(date)
                const isToday =
                  date.toDateString() === new Date().toDateString()

                return (
                  <div
                    key={index}
                    className={cn(
                      'min-h-[100px] rounded-lg border p-2 transition-colors',
                      isCurrentMonth ? 'bg-white' : 'bg-gray-50',
                      isToday && 'ring-2 ring-primary',
                      availability?.status === 'UNAVAILABLE' && 'bg-red-50',
                      availability?.status === 'TENTATIVE' && 'bg-yellow-50'
                    )}
                  >
                    <div
                      className={cn(
                        'text-sm font-medium mb-1',
                        isCurrentMonth ? 'text-gray-900' : 'text-gray-400',
                        isToday && 'text-primary'
                      )}
                    >
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {events.map((event) => (
                        <div
                          key={event.id}
                          onClick={() => setSelectedPerformance(event)}
                          className={cn(
                            'text-xs rounded px-1.5 py-0.5 truncate cursor-pointer',
                            event.status === 'CONFIRMED' && 'bg-green-100 text-green-700',
                            event.status === 'PENDING' && 'bg-yellow-100 text-yellow-700'
                          )}
                        >
                          {event.festivalName}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="border-t p-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-200" />
              <span className="text-gray-600">Confirme</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200" />
              <span className="text-gray-600">En attente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-50 border border-red-200" />
              <span className="text-gray-600">Indisponible</span>
            </div>
          </div>
        </div>
      )}

      {/* Availability Section */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Mes disponibilites</h2>
          <button className="text-sm text-primary hover:underline">Gerer</button>
        </div>
        <div className="space-y-3">
          {mockAvailability.map((slot) => (
            <div
              key={slot.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-3',
                slot.status === 'AVAILABLE' && 'border-green-200 bg-green-50',
                slot.status === 'TENTATIVE' && 'border-yellow-200 bg-yellow-50',
                slot.status === 'UNAVAILABLE' && 'border-red-200 bg-red-50',
                slot.status === 'BOOKED' && 'border-blue-200 bg-blue-50'
              )}
            >
              <div className="flex items-center gap-3">
                <Calendar
                  className={cn(
                    'h-5 w-5',
                    slot.status === 'AVAILABLE' && 'text-green-600',
                    slot.status === 'TENTATIVE' && 'text-yellow-600',
                    slot.status === 'UNAVAILABLE' && 'text-red-600',
                    slot.status === 'BOOKED' && 'text-blue-600'
                  )}
                />
                <div>
                  <p className="font-medium text-gray-900">
                    {formatShortDate(slot.startDate)} - {formatShortDate(slot.endDate)}
                  </p>
                  {slot.notes && <p className="text-sm text-gray-500">{slot.notes}</p>}
                </div>
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  slot.status === 'AVAILABLE' && 'text-green-700',
                  slot.status === 'TENTATIVE' && 'text-yellow-700',
                  slot.status === 'UNAVAILABLE' && 'text-red-700',
                  slot.status === 'BOOKED' && 'text-blue-700'
                )}
              >
                {slot.status === 'AVAILABLE' && 'Disponible'}
                {slot.status === 'TENTATIVE' && 'Provisoire'}
                {slot.status === 'UNAVAILABLE' && 'Indisponible'}
                {slot.status === 'BOOKED' && 'Reserve'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Detail Modal */}
      {selectedPerformance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 text-white p-6 rounded-t-xl">
              <h2 className="text-xl font-bold">{selectedPerformance.festivalName}</h2>
              <p className="text-purple-200 mt-1">{formatDate(selectedPerformance.date)}</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium',
                  getStatusColor(selectedPerformance.status)
                )}
              >
                {selectedPerformance.status === 'CONFIRMED' && <CheckCircle className="h-4 w-4" />}
                {selectedPerformance.status === 'PENDING' && <AlertCircle className="h-4 w-4" />}
                {selectedPerformance.status === 'CONFIRMED' && 'Confirme'}
                {selectedPerformance.status === 'PENDING' && 'En attente'}
                {selectedPerformance.status === 'CANCELLED' && 'Annule'}
              </span>

              {/* Details */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Horaires</p>
                  <p className="text-lg font-bold">
                    {selectedPerformance.startTime} - {selectedPerformance.endTime}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Scene</p>
                  <p className="text-lg font-bold">{selectedPerformance.stageName}</p>
                </div>
                {selectedPerformance.soundcheckTime && (
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Soundcheck</p>
                    <p className="text-lg font-bold">{selectedPerformance.soundcheckTime}</p>
                  </div>
                )}
                {selectedPerformance.loadInTime && (
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Load-in</p>
                    <p className="text-lg font-bold">{selectedPerformance.loadInTime}</p>
                  </div>
                )}
              </div>

              {/* Travel Info */}
              {selectedPerformance.travelInfo && (
                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-900 mb-3">Informations voyage</h3>
                  <div className="space-y-2">
                    {selectedPerformance.travelInfo.hotel && (
                      <div className="flex items-center gap-3 text-sm">
                        <Hotel className="h-4 w-4 text-gray-400" />
                        <span>{selectedPerformance.travelInfo.hotel}</span>
                      </div>
                    )}
                    {selectedPerformance.travelInfo.flight && (
                      <div className="flex items-center gap-3 text-sm">
                        <Plane className="h-4 w-4 text-gray-400" />
                        <span>{selectedPerformance.travelInfo.flight}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>
                        Arrivee: {formatShortDate(selectedPerformance.travelInfo.arrivalDate)} -
                        Depart: {formatShortDate(selectedPerformance.travelInfo.departureDate)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedPerformance.notes && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <p className="text-sm text-yellow-700">{selectedPerformance.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setSelectedPerformance(null)}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Fermer
                </button>
                <button className="flex items-center justify-center gap-2 flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-white hover:bg-primary/90">
                  <FileText className="h-4 w-4" />
                  Voir le contrat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
