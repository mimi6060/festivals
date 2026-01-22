'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Save,
  Loader2,
  Music,
  MapPin,
  Calendar,
  Clock,
  Search,
  Check,
  AlertCircle,
} from 'lucide-react'

// Mock data for demonstration
const mockFestival = {
  id: '1',
  name: 'Summer Fest 2026',
  startDate: '2026-06-15',
  endDate: '2026-06-17',
}

const mockArtists = [
  { id: '1', name: 'The Midnight', genre: 'Synthwave', type: 'BAND' },
  { id: '2', name: 'ODESZA', genre: 'Electronic', type: 'DJ' },
  { id: '3', name: 'Disclosure', genre: 'House / UK Garage', type: 'DJ' },
  { id: '4', name: 'Khruangbin', genre: 'Psychedelic / Funk', type: 'BAND' },
  { id: '5', name: 'Bonobo', genre: 'Downtempo / Electronic', type: 'SOLO' },
  { id: '6', name: 'Jungle', genre: 'Funk / Soul', type: 'BAND' },
  { id: '7', name: 'Kaytranada', genre: 'House / R&B', type: 'DJ' },
  { id: '8', name: 'Floating Points', genre: 'Electronic / Ambient', type: 'SOLO' },
]

const mockStages = [
  { id: '1', name: 'Main Stage', capacity: 15000 },
  { id: '2', name: 'Electronic Tent', capacity: 5000 },
  { id: '3', name: 'Acoustic Garden', capacity: 2000 },
  { id: '4', name: 'Discovery Stage', capacity: 1000 },
]

// Existing performances for conflict detection
const existingPerformances = [
  { artistId: '1', stageId: '1', startTime: '2026-06-15T18:00', endTime: '2026-06-15T19:30' },
  { artistId: '2', stageId: '1', startTime: '2026-06-15T20:00', endTime: '2026-06-15T22:00' },
  { artistId: '3', stageId: '2', startTime: '2026-06-15T19:00', endTime: '2026-06-15T21:00' },
]

interface PerformanceFormData {
  artistId: string
  stageId: string
  date: string
  startTime: string
  endTime: string
  status: 'PENDING' | 'CONFIRMED'
}

const initialFormData: PerformanceFormData = {
  artistId: '',
  stageId: '',
  date: '',
  startTime: '',
  endTime: '',
  status: 'PENDING',
}

// Helper to generate time slots
function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let hour = 14; hour <= 23; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`)
    slots.push(`${hour.toString().padStart(2, '0')}:30`)
  }
  // Add slots after midnight
  for (let hour = 0; hour <= 3; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`)
    slots.push(`${hour.toString().padStart(2, '0')}:30`)
  }
  return slots
}

// Helper to generate dates between start and end
function getDatesInRange(startDate: string, endDate: string): { value: string; label: string }[] {
  const dates: { value: string; label: string }[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)

  while (current <= end) {
    const value = current.toISOString().split('T')[0]
    const label = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(current)
    dates.push({ value, label })
    current.setDate(current.getDate() + 1)
  }

  return dates
}

// Calculate duration between two times
function calculateDuration(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return ''

  const [startHour, startMin] = startTime.split(':').map(Number)
  let [endHour, endMin] = endTime.split(':').map(Number)

  // Handle crossing midnight
  if (endHour < startHour) {
    endHour += 24
  }

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  const durationMinutes = endMinutes - startMinutes

  if (durationMinutes <= 0) return ''

  const hours = Math.floor(durationMinutes / 60)
  const minutes = durationMinutes % 60

  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h${minutes.toString().padStart(2, '0')}`
}

export default function NewPerformancePage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string

  const [formData, setFormData] = useState<PerformanceFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [artistSearch, setArtistSearch] = useState('')
  const [isArtistDropdownOpen, setIsArtistDropdownOpen] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof PerformanceFormData, string>>>({})

  const festivalDates = useMemo(
    () => getDatesInRange(mockFestival.startDate, mockFestival.endDate),
    []
  )

  const timeSlots = useMemo(() => generateTimeSlots(), [])

  // Filter artists based on search
  const filteredArtists = useMemo(() => {
    if (!artistSearch) return mockArtists
    return mockArtists.filter(
      (artist) =>
        artist.name.toLowerCase().includes(artistSearch.toLowerCase()) ||
        artist.genre?.toLowerCase().includes(artistSearch.toLowerCase())
    )
  }, [artistSearch])

  // Get selected artist and stage
  const selectedArtist = mockArtists.find((a) => a.id === formData.artistId)
  const selectedStage = mockStages.find((s) => s.id === formData.stageId)

  // Check for conflicts
  const conflicts = useMemo(() => {
    if (!formData.date || !formData.startTime || !formData.endTime || !formData.stageId) {
      return []
    }

    const newStart = new Date(`${formData.date}T${formData.startTime}`)
    const newEnd = new Date(`${formData.date}T${formData.endTime}`)

    // Handle crossing midnight
    if (newEnd <= newStart) {
      newEnd.setDate(newEnd.getDate() + 1)
    }

    return existingPerformances.filter((p) => {
      // Same stage conflict
      if (p.stageId === formData.stageId) {
        const existingStart = new Date(p.startTime)
        const existingEnd = new Date(p.endTime)

        // Check overlap
        if (newStart < existingEnd && newEnd > existingStart) {
          return true
        }
      }

      // Same artist conflict
      if (p.artistId === formData.artistId && formData.artistId) {
        const existingStart = new Date(p.startTime)
        const existingEnd = new Date(p.endTime)

        if (newStart < existingEnd && newEnd > existingStart) {
          return true
        }
      }

      return false
    })
  }, [formData])

  const duration = calculateDuration(formData.startTime, formData.endTime)

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof PerformanceFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const selectArtist = (artistId: string) => {
    setFormData((prev) => ({ ...prev, artistId }))
    setArtistSearch('')
    setIsArtistDropdownOpen(false)
    if (errors.artistId) {
      setErrors((prev) => ({ ...prev, artistId: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof PerformanceFormData, string>> = {}

    if (!formData.artistId) {
      newErrors.artistId = 'Selectionnez un artiste'
    }

    if (!formData.stageId) {
      newErrors.stageId = 'Selectionnez une scene'
    }

    if (!formData.date) {
      newErrors.date = 'Selectionnez une date'
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Selectionnez une heure de debut'
    }

    if (!formData.endTime) {
      newErrors.endTime = 'Selectionnez une heure de fin'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    if (conflicts.length > 0) {
      // Show warning but allow submission
      const confirmSubmit = window.confirm(
        'Des conflits ont ete detectes. Voulez-vous quand meme ajouter cette performance ?'
      )
      if (!confirmSubmit) return
    }

    setIsSubmitting(true)

    try {
      // TODO: Implement actual API call
      // await performancesApi.create(festivalId, {
      //   artistId: formData.artistId,
      //   stageId: formData.stageId,
      //   startTime: `${formData.date}T${formData.startTime}:00`,
      //   endTime: `${formData.date}T${formData.endTime}:00`,
      //   status: formData.status,
      // })

      console.log('Creating performance:', formData)

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      router.push(`/festivals/${festivalId}/lineup`)
    } catch (error) {
      console.error('Error creating performance:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href={`/festivals/${festivalId}/lineup`} className="hover:text-primary">
              Lineup
            </Link>
            <span>/</span>
            <span>Nouvelle performance</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Ajouter une performance</h1>
        </div>
        <Link
          href={`/festivals/${festivalId}/lineup`}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Artist Selection */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Artiste</h2>

            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Selectionner un artiste <span className="text-red-500">*</span>
              </label>

              {/* Selected artist display */}
              {selectedArtist ? (
                <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                      <Music className="h-5 w-5 text-white/70" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{selectedArtist.name}</div>
                      <div className="text-sm text-gray-500">{selectedArtist.genre}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, artistId: '' }))}
                    className="text-sm text-primary hover:underline"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={artistSearch}
                      onChange={(e) => {
                        setArtistSearch(e.target.value)
                        setIsArtistDropdownOpen(true)
                      }}
                      onFocus={() => setIsArtistDropdownOpen(true)}
                      placeholder="Rechercher un artiste..."
                      className={cn(
                        'w-full rounded-lg border py-2 pl-10 pr-4 focus:outline-none focus:ring-1',
                        errors.artistId
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                          : 'focus:border-primary focus:ring-primary'
                      )}
                    />
                  </div>

                  {/* Dropdown */}
                  {isArtistDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-60 overflow-auto">
                      {filteredArtists.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          Aucun artiste trouve.
                          <Link
                            href={`/festivals/${festivalId}/lineup/artists/new`}
                            className="ml-1 text-primary hover:underline"
                          >
                            Ajouter un artiste
                          </Link>
                        </div>
                      ) : (
                        filteredArtists.map((artist) => (
                          <button
                            key={artist.id}
                            type="button"
                            onClick={() => selectArtist(artist.id)}
                            className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50"
                          >
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                              <Music className="h-4 w-4 text-white/70" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{artist.name}</div>
                              <div className="text-xs text-gray-500">{artist.genre}</div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              {errors.artistId && (
                <p className="mt-1 text-sm text-red-500">{errors.artistId}</p>
              )}
            </div>
          </div>

          {/* Stage Selection */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Scene</h2>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Selectionner une scene <span className="text-red-500">*</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                {mockStages.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, stageId: stage.id }))
                      if (errors.stageId) {
                        setErrors((prev) => ({ ...prev, stageId: undefined }))
                      }
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      formData.stageId === stage.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-lg p-2',
                        formData.stageId === stage.id
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{stage.name}</div>
                      <div className="text-sm text-gray-500">
                        {stage.capacity.toLocaleString()} places
                      </div>
                    </div>
                    {formData.stageId === stage.id && (
                      <Check className="ml-auto h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
              {errors.stageId && (
                <p className="mt-2 text-sm text-red-500">{errors.stageId}</p>
              )}
            </div>
          </div>

          {/* Date & Time */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Date et horaire</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Date <span className="text-red-500">*</span>
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {festivalDates.map((date) => (
                    <button
                      key={date.value}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, date: date.value }))
                        if (errors.date) {
                          setErrors((prev) => ({ ...prev, date: undefined }))
                        }
                      }}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                        formData.date === date.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <Calendar
                        className={cn(
                          'h-4 w-4',
                          formData.date === date.value ? 'text-primary' : 'text-gray-400'
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm capitalize',
                          formData.date === date.value
                            ? 'font-medium text-primary'
                            : 'text-gray-700'
                        )}
                      >
                        {date.label}
                      </span>
                    </button>
                  ))}
                </div>
                {errors.date && <p className="mt-2 text-sm text-red-500">{errors.date}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Heure de debut <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-1',
                      errors.startTime
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'focus:border-primary focus:ring-primary'
                    )}
                  >
                    <option value="">Selectionner</option>
                    {timeSlots.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                  {errors.startTime && (
                    <p className="mt-1 text-sm text-red-500">{errors.startTime}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Heure de fin <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-1',
                      errors.endTime
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'focus:border-primary focus:ring-primary'
                    )}
                  >
                    <option value="">Selectionner</option>
                    {timeSlots.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                  {errors.endTime && (
                    <p className="mt-1 text-sm text-red-500">{errors.endTime}</p>
                  )}
                </div>
              </div>

              {duration && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  Duree: <span className="font-medium">{duration}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Statut</h2>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="PENDING"
                  checked={formData.status === 'PENDING'}
                  onChange={handleInputChange}
                  className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700">En attente</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="CONFIRMED"
                  checked={formData.status === 'CONFIRMED'}
                  onChange={handleInputChange}
                  className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700">Confirme</span>
              </label>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Resume</h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Music className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Artiste</div>
                  <div className="font-medium text-gray-900">
                    {selectedArtist?.name || '-'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Scene</div>
                  <div className="font-medium text-gray-900">
                    {selectedStage?.name || '-'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Date</div>
                  <div className="font-medium text-gray-900 capitalize">
                    {formData.date
                      ? new Intl.DateTimeFormat('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        }).format(new Date(formData.date))
                      : '-'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Horaire</div>
                  <div className="font-medium text-gray-900">
                    {formData.startTime && formData.endTime
                      ? `${formData.startTime} - ${formData.endTime}`
                      : '-'}
                    {duration && (
                      <span className="ml-2 text-sm text-gray-500">({duration})</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t pt-3 mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Statut:</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      formData.status === 'CONFIRMED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    )}
                  >
                    {formData.status === 'CONFIRMED' ? 'Confirme' : 'En attente'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Conflicts Warning */}
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
                <div>
                  <h3 className="font-medium text-yellow-800">Conflits detectes</h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    Des performances existantes chevauchent ce creneau horaire.
                  </p>
                  <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                    {conflicts.map((conflict, index) => {
                      const artist = mockArtists.find((a) => a.id === conflict.artistId)
                      const stage = mockStages.find((s) => s.id === conflict.stageId)
                      return (
                        <li key={index}>
                          {artist?.name} - {stage?.name}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Ajouter la performance
                </>
              )}
            </button>
            <Link
              href={`/festivals/${festivalId}/lineup`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </Link>
          </div>
        </div>
      </form>

      {/* Click outside handler for dropdown */}
      {isArtistDropdownOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsArtistDropdownOpen(false)}
        />
      )}
    </div>
  )
}
