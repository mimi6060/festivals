'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Heart,
  Music,
  Clock,
  MapPin,
  Calendar,
  ChevronRight,
  Trash2,
  Bell,
  BellOff,
  Filter,
} from 'lucide-react'

// Types
interface FavoriteArtist {
  id: string
  artistId: string
  artistName: string
  artistGenre: string
  artistPhoto?: string
  festivalId: string
  festivalName: string
  addedAt: string
  nextPerformance?: {
    id: string
    startTime: string
    endTime: string
    stageName: string
    stageColor: string
  }
}

interface Festival {
  id: string
  name: string
  startDate: string
  endDate: string
  location: string
}

// Mock data - in production would come from API
const mockFestivals: Festival[] = [
  {
    id: '1',
    name: 'Summer Fest 2026',
    startDate: '2026-06-15',
    endDate: '2026-06-17',
    location: 'Paris',
  },
  {
    id: '2',
    name: 'Electro Beach 2026',
    startDate: '2026-07-20',
    endDate: '2026-07-22',
    location: 'Nice',
  },
]

const mockFavorites: FavoriteArtist[] = [
  {
    id: 'fav-1',
    artistId: '1',
    artistName: 'The Midnight',
    artistGenre: 'Synthwave',
    festivalId: '1',
    festivalName: 'Summer Fest 2026',
    addedAt: '2026-01-15T10:30:00',
    nextPerformance: {
      id: 'perf-1',
      startTime: '2026-06-15T20:00:00',
      endTime: '2026-06-15T21:30:00',
      stageName: 'Main Stage',
      stageColor: '#8B5CF6',
    },
  },
  {
    id: 'fav-2',
    artistId: '2',
    artistName: 'ODESZA',
    artistGenre: 'Electronic',
    festivalId: '1',
    festivalName: 'Summer Fest 2026',
    addedAt: '2026-01-10T14:20:00',
    nextPerformance: {
      id: 'perf-2',
      startTime: '2026-06-16T22:00:00',
      endTime: '2026-06-17T00:00:00',
      stageName: 'Main Stage',
      stageColor: '#8B5CF6',
    },
  },
  {
    id: 'fav-3',
    artistId: '3',
    artistName: 'Disclosure',
    artistGenre: 'House / UK Garage',
    festivalId: '1',
    festivalName: 'Summer Fest 2026',
    addedAt: '2026-01-08T09:15:00',
  },
  {
    id: 'fav-4',
    artistId: '4',
    artistName: 'Bonobo',
    artistGenre: 'Downtempo',
    festivalId: '2',
    festivalName: 'Electro Beach 2026',
    addedAt: '2026-01-20T16:45:00',
    nextPerformance: {
      id: 'perf-4',
      startTime: '2026-07-21T21:00:00',
      endTime: '2026-07-21T23:00:00',
      stageName: 'Beach Stage',
      stageColor: '#3B82F6',
    },
  },
]

// Helper functions
function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(dateStr))
}

function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function getTimeUntil(dateStr: string): string {
  const now = new Date()
  const target = new Date(dateStr)
  const diffMs = target.getTime() - now.getTime()

  if (diffMs < 0) return 'Termine'

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days > 30) {
    const months = Math.floor(days / 30)
    return `Dans ${months} mois`
  }
  if (days > 0) return `Dans ${days} jour${days > 1 ? 's' : ''}`

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours > 0) return `Dans ${hours}h`

  const mins = Math.floor(diffMs / (1000 * 60))
  return `Dans ${mins} min`
}

// Favorite Artist Card Component
interface FavoriteArtistCardProps {
  favorite: FavoriteArtist
  onRemove: (id: string) => void
}

function FavoriteArtistCard({ favorite, onRemove }: FavoriteArtistCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <div className="flex">
          {/* Artist Image */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <Music className="h-8 w-8 text-white/50" />
          </div>

          {/* Content */}
          <div className="flex-1 p-4 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/festival/${favorite.festivalId}/artist/${favorite.artistId}`}
                  className="font-semibold text-gray-900 hover:text-primary transition-colors truncate block"
                >
                  {favorite.artistName}
                </Link>
                <p className="text-sm text-gray-500">{favorite.artistGenre}</p>
              </div>

              {/* Remove button */}
              {showConfirm ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowConfirm(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onRemove(favorite.id)}
                  >
                    Retirer
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Festival info */}
            <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              <span>{favorite.festivalName}</span>
            </div>

            {/* Next performance */}
            {favorite.nextPerformance ? (
              <div className="mt-3 p-2 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: favorite.nextPerformance.stageColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-medium">
                        {formatDate(favorite.nextPerformance.startTime)} -{' '}
                        {formatTime(favorite.nextPerformance.startTime)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({getTimeUntil(favorite.nextPerformance.startTime)})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      <span>{favorite.nextPerformance.stageName}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-400 italic">
                Pas de concert programme
              </p>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

export default function AccountFavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteArtist[]>(mockFavorites)
  const [selectedFestival, setSelectedFestival] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  // Filter favorites by festival
  const filteredFavorites = useMemo(() => {
    if (!selectedFestival) return favorites
    return favorites.filter((f) => f.festivalId === selectedFestival)
  }, [favorites, selectedFestival])

  // Group favorites by festival
  const favoritesByFestival = useMemo(() => {
    const grouped: Record<string, FavoriteArtist[]> = {}
    for (const fav of favorites) {
      if (!grouped[fav.festivalId]) {
        grouped[fav.festivalId] = []
      }
      grouped[fav.festivalId].push(fav)
    }
    return grouped
  }, [favorites])

  // Get unique festivals from favorites
  const uniqueFestivals = useMemo(() => {
    const festivalIds = [...new Set(favorites.map((f) => f.festivalId))]
    return mockFestivals.filter((f) => festivalIds.includes(f.id))
  }, [favorites])

  // Get upcoming favorites (sorted by next performance)
  const upcomingFavorites = useMemo(() => {
    return filteredFavorites
      .filter((f) => f.nextPerformance)
      .sort(
        (a, b) =>
          new Date(a.nextPerformance!.startTime).getTime() -
          new Date(b.nextPerformance!.startTime).getTime()
      )
      .slice(0, 5)
  }, [filteredFavorites])

  const handleRemoveFavorite = async (id: string) => {
    setLoading(true)
    try {
      // In production, this would call the API
      // await fetch(`/api/favorites/${id}`, { method: 'DELETE' })
      setFavorites((prev) => prev.filter((f) => f.id !== id))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleNotifications = async () => {
    // In production, this would update notification preferences
    setNotificationsEnabled(!notificationsEnabled)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes artistes favoris</h1>
          <p className="text-gray-600 mt-1">
            {favorites.length} artiste{favorites.length !== 1 ? 's' : ''} dans vos favoris
          </p>
        </div>

        {/* Notification toggle */}
        <Button
          variant={notificationsEnabled ? 'primary' : 'outline'}
          onClick={handleToggleNotifications}
          leftIcon={notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        >
          {notificationsEnabled ? 'Notifications actives' : 'Notifications desactivees'}
        </Button>
      </div>

      {favorites.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Aucun artiste favori
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Parcourez le programme des festivals et ajoutez vos artistes preferes
              pour recevoir des notifications avant leurs concerts.
            </p>
            <Link href="/festivals">
              <Button variant="primary">Decouvrir les festivals</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Upcoming favorites */}
          {upcomingFavorites.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Prochains concerts
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingFavorites.map((favorite) => (
                  <Link
                    key={favorite.id}
                    href={`/festival/${favorite.festivalId}/artist/${favorite.artistId}`}
                    className="block"
                  >
                    <Card className="h-full hover:shadow-md transition-shadow">
                      <CardBody>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-2 h-12 rounded-full shrink-0"
                            style={{ backgroundColor: favorite.nextPerformance!.stageColor }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {favorite.artistName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatDate(favorite.nextPerformance!.startTime)} -{' '}
                              {formatTime(favorite.nextPerformance!.startTime)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                              {getTimeUntil(favorite.nextPerformance!.startTime)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          <span>
                            {favorite.nextPerformance!.stageName} - {favorite.festivalName}
                          </span>
                        </div>
                      </CardBody>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Festival filter */}
          {uniqueFestivals.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-gray-400" />
              <button
                onClick={() => setSelectedFestival(null)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  !selectedFestival
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Tous ({favorites.length})
              </button>
              {uniqueFestivals.map((festival) => (
                <button
                  key={festival.id}
                  onClick={() => setSelectedFestival(festival.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                    selectedFestival === festival.id
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {festival.name} ({favoritesByFestival[festival.id]?.length || 0})
                </button>
              ))}
            </div>
          )}

          {/* All favorites */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Tous vos favoris
            </h2>
            <div className="space-y-4">
              {filteredFavorites.map((favorite) => (
                <FavoriteArtistCard
                  key={favorite.id}
                  favorite={favorite}
                  onRemove={handleRemoveFavorite}
                />
              ))}
            </div>
          </section>

          {/* Notification info */}
          <Card>
            <CardBody>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 shrink-0">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Notifications de concerts
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Vous recevrez une notification 15 minutes et 5 minutes avant chaque
                    concert de vos artistes favoris. Assurez-vous d'avoir active les
                    notifications push dans les parametres de votre appareil.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
