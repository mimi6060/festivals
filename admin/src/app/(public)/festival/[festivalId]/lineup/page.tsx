'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  MapPin,
  Music,
  Search,
  Filter,
  Grid3X3,
  List,
} from 'lucide-react'

// Mock data - in production this would come from the API
const mockFestival = {
  id: '1',
  name: 'Summer Fest 2026',
  startDate: '2026-06-15',
  endDate: '2026-06-17',
}

const mockStages = [
  { id: '1', name: 'Main Stage', capacity: 15000, type: 'MAIN', color: '#8B5CF6' },
  { id: '2', name: 'Electronic Tent', capacity: 5000, type: 'TENT', color: '#3B82F6' },
  { id: '3', name: 'Acoustic Garden', capacity: 2000, type: 'OUTDOOR', color: '#10B981' },
  { id: '4', name: 'Discovery Stage', capacity: 1000, type: 'SECONDARY', color: '#F59E0B' },
]

const mockPerformances = [
  { id: '1', artistId: '1', artistName: 'The Midnight', artistGenre: 'Synthwave', artistPhoto: '/api/placeholder/200/200', stageId: '1', startTime: '2026-06-15T18:00:00', endTime: '2026-06-15T19:30:00' },
  { id: '2', artistId: '2', artistName: 'ODESZA', artistGenre: 'Electronic', artistPhoto: '/api/placeholder/200/200', stageId: '1', startTime: '2026-06-15T20:00:00', endTime: '2026-06-15T22:00:00' },
  { id: '3', artistId: '3', artistName: 'Disclosure', artistGenre: 'House', artistPhoto: '/api/placeholder/200/200', stageId: '2', startTime: '2026-06-15T19:00:00', endTime: '2026-06-15T21:00:00' },
  { id: '4', artistId: '4', artistName: 'Khruangbin', artistGenre: 'Psychedelic', artistPhoto: '/api/placeholder/200/200', stageId: '3', startTime: '2026-06-15T17:00:00', endTime: '2026-06-15T18:30:00' },
  { id: '5', artistId: '5', artistName: 'Bonobo', artistGenre: 'Downtempo', artistPhoto: '/api/placeholder/200/200', stageId: '2', startTime: '2026-06-15T22:00:00', endTime: '2026-06-16T00:00:00' },
  { id: '6', artistId: '6', artistName: 'Jungle', artistGenre: 'Funk / Soul', artistPhoto: '/api/placeholder/200/200', stageId: '1', startTime: '2026-06-16T19:00:00', endTime: '2026-06-16T20:30:00' },
  { id: '7', artistId: '7', artistName: 'Kaytranada', artistGenre: 'House / R&B', artistPhoto: '/api/placeholder/200/200', stageId: '2', startTime: '2026-06-16T21:00:00', endTime: '2026-06-16T23:00:00' },
  { id: '8', artistId: '8', artistName: 'Floating Points', artistGenre: 'Electronic', artistPhoto: '/api/placeholder/200/200', stageId: '4', startTime: '2026-06-15T20:00:00', endTime: '2026-06-15T22:00:00' },
]

// Check if user is logged in (mock - in production use auth context)
const useAuth = () => {
  return {
    isLoggedIn: true, // Mock - would come from auth context
    userId: 'user-1',
  }
}

// Favorites hook (mock - in production would sync with backend)
const useFavorites = (festivalId: string) => {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const toggleFavorite = async (artistId: string) => {
    setLoading(true)
    try {
      // In production, this would call the API:
      // await fetch(`/api/festivals/${festivalId}/artists/${artistId}/favorite`, { method: favorites.has(artistId) ? 'DELETE' : 'POST' })
      setFavorites((prev) => {
        const next = new Set(prev)
        if (next.has(artistId)) {
          next.delete(artistId)
        } else {
          next.add(artistId)
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  const isFavorite = (artistId: string) => favorites.has(artistId)

  return { favorites, toggleFavorite, isFavorite, loading }
}

// Helper functions
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

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// Favorite Button Component
interface FavoriteButtonProps {
  artistId: string
  isFavorite: boolean
  onToggle: (artistId: string) => void
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

function FavoriteButton({
  artistId,
  isFavorite,
  onToggle,
  loading = false,
  size = 'md',
  showLabel = false,
}: FavoriteButtonProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  }

  if (showLabel) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggle(artistId)
        }}
        disabled={loading}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
          isFavorite
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-red-50 text-red-600 hover:bg-red-100',
          loading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Heart
          className={cn('transition-transform', isFavorite && 'scale-110')}
          size={iconSizes[size]}
          fill={isFavorite ? 'currentColor' : 'none'}
        />
        <span>{isFavorite ? 'Favori' : 'Ajouter aux favoris'}</span>
      </button>
    )
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle(artistId)
      }}
      disabled={loading}
      className={cn(
        'rounded-full flex items-center justify-center transition-all',
        sizeClasses[size],
        isFavorite
          ? 'bg-red-500 text-white hover:bg-red-600'
          : 'bg-white/90 text-gray-600 hover:bg-red-50 hover:text-red-500',
        loading && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Heart
        className={cn('transition-transform', isFavorite && 'scale-110')}
        size={iconSizes[size]}
        fill={isFavorite ? 'currentColor' : 'none'}
      />
    </button>
  )
}

// Artist Card Component
interface ArtistCardProps {
  performance: (typeof mockPerformances)[0]
  stage: (typeof mockStages)[0]
  isFavorite: boolean
  onToggleFavorite: (artistId: string) => void
  isLoggedIn: boolean
}

function ArtistCard({
  performance,
  stage,
  isFavorite,
  onToggleFavorite,
  isLoggedIn,
}: ArtistCardProps) {
  return (
    <Link
      href={`/festival/${mockFestival.id}/artist/${performance.artistId}`}
      className="block group"
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        {/* Image */}
        <div className="relative aspect-square bg-gradient-to-br from-purple-500 to-blue-600">
          <div className="absolute inset-0 flex items-center justify-center">
            <Music className="h-16 w-16 text-white/50" />
          </div>
          {/* Favorite button - only show if logged in */}
          {isLoggedIn && (
            <div className="absolute top-2 right-2">
              <FavoriteButton
                artistId={performance.artistId}
                isFavorite={isFavorite}
                onToggle={onToggleFavorite}
                size="sm"
              />
            </div>
          )}
          {/* Stage badge */}
          <div
            className="absolute bottom-2 left-2 px-2 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: stage.color }}
          >
            {stage.name}
          </div>
        </div>

        {/* Content */}
        <CardBody className="p-4">
          <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
            {performance.artistName}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{performance.artistGenre}</p>

          <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                {formatTime(performance.startTime)} - {formatTime(performance.endTime)}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  )
}

// Performance Row Component (for list view)
interface PerformanceRowProps {
  performance: (typeof mockPerformances)[0]
  stage: (typeof mockStages)[0]
  isFavorite: boolean
  onToggleFavorite: (artistId: string) => void
  isLoggedIn: boolean
}

function PerformanceRow({
  performance,
  stage,
  isFavorite,
  onToggleFavorite,
  isLoggedIn,
}: PerformanceRowProps) {
  return (
    <Link
      href={`/festival/${mockFestival.id}/artist/${performance.artistId}`}
      className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
    >
      {/* Time */}
      <div className="text-center w-20 shrink-0">
        <div className="text-lg font-bold text-gray-900">{formatTime(performance.startTime)}</div>
        <div className="text-xs text-gray-500">{formatTime(performance.endTime)}</div>
      </div>

      {/* Stage color indicator */}
      <div
        className="w-1.5 h-12 rounded-full shrink-0"
        style={{ backgroundColor: stage.color }}
      />

      {/* Artist info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{performance.artistName}</h3>
        <p className="text-sm text-gray-500">{performance.artistGenre}</p>
      </div>

      {/* Stage name */}
      <div className="hidden sm:block text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          <span>{stage.name}</span>
        </div>
      </div>

      {/* Favorite button */}
      {isLoggedIn && (
        <FavoriteButton
          artistId={performance.artistId}
          isFavorite={isFavorite}
          onToggle={onToggleFavorite}
          size="sm"
        />
      )}
    </Link>
  )
}

export default function PublicLineupPage() {
  const params = useParams()
  const festivalId = params.festivalId as string

  const { isLoggedIn } = useAuth()
  const { toggleFavorite, isFavorite, loading: favoritesLoading } = useFavorites(festivalId)

  const festivalDates = useMemo(
    () => getDatesInRange(mockFestival.startDate, mockFestival.endDate),
    []
  )

  const [selectedDate, setSelectedDate] = useState(festivalDates[0])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)

  // Filter performances
  const filteredPerformances = useMemo(() => {
    return mockPerformances
      .filter((p) => p.startTime.startsWith(selectedDate))
      .filter((p) => !selectedStage || p.stageId === selectedStage)
      .filter(
        (p) =>
          !searchQuery ||
          p.artistName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.artistGenre.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter((p) => !showOnlyFavorites || isFavorite(p.artistId))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [selectedDate, selectedStage, searchQuery, showOnlyFavorites, isFavorite])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Programme</h1>
              <p className="text-gray-600">{mockFestival.name}</p>
            </div>

            {/* View toggle and favorites filter */}
            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <button
                  onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    showOnlyFavorites
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  <Heart size={16} fill={showOnlyFavorites ? 'currentColor' : 'none'} />
                  <span className="hidden sm:inline">Mes favoris</span>
                </button>
              )}

              <div className="flex items-center gap-1 rounded-lg border bg-white p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'rounded-md p-2 transition-colors',
                    viewMode === 'grid'
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'rounded-md p-2 transition-colors',
                    viewMode === 'list'
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Day Selector */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
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

            <div className="flex gap-2 overflow-x-auto">
              {festivalDates.map((date, index) => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap',
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
      </div>

      {/* Filters */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un artiste..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border py-2 pl-10 pr-4 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Stage filter */}
            <select
              value={selectedStage || ''}
              onChange={(e) => setSelectedStage(e.target.value || null)}
              className="rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Toutes les scenes</option>
              {mockStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredPerformances.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <Music className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Aucun resultat</h3>
              <p className="text-sm text-gray-500 mt-2">
                {showOnlyFavorites
                  ? "Vous n'avez pas encore de favoris pour cette journee"
                  : 'Essayez de modifier vos filtres'}
              </p>
              {showOnlyFavorites && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowOnlyFavorites(false)}
                >
                  Voir tous les artistes
                </Button>
              )}
            </CardBody>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPerformances.map((performance) => {
              const stage = mockStages.find((s) => s.id === performance.stageId)!
              return (
                <ArtistCard
                  key={performance.id}
                  performance={performance}
                  stage={stage}
                  isFavorite={isFavorite(performance.artistId)}
                  onToggleFavorite={toggleFavorite}
                  isLoggedIn={isLoggedIn}
                />
              )
            })}
          </div>
        ) : (
          <Card>
            <div className="divide-y">
              {filteredPerformances.map((performance) => {
                const stage = mockStages.find((s) => s.id === performance.stageId)!
                return (
                  <PerformanceRow
                    key={performance.id}
                    performance={performance}
                    stage={stage}
                    isFavorite={isFavorite(performance.artistId)}
                    onToggleFavorite={toggleFavorite}
                    isLoggedIn={isLoggedIn}
                  />
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Login prompt for non-logged-in users */}
      {!isLoggedIn && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Connectez-vous pour sauvegarder vos favoris</p>
              <p className="text-sm text-gray-500">
                Recevez des notifications quand vos artistes preferes sont sur le point de jouer
              </p>
            </div>
            <Link href="/login">
              <Button variant="primary">Se connecter</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
