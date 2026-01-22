'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Music,
  Instagram,
  Globe,
  ExternalLink,
  MoreVertical,
  Users,
  Grid3X3,
  List,
} from 'lucide-react'

// Mock data for demonstration
const mockArtists = [
  {
    id: '1',
    name: 'The Midnight',
    genre: 'Synthwave',
    type: 'BAND',
    bio: 'A synthwave duo from Los Angeles consisting of Tyler Lyle and Tim McEwan.',
    imageUrl: '/api/placeholder/400/400',
    performanceCount: 2,
    socialLinks: {
      instagram: 'themidnightofficial',
      spotify: 'themidnight',
      website: 'https://themidnightofficial.com',
    },
  },
  {
    id: '2',
    name: 'ODESZA',
    genre: 'Electronic',
    type: 'DJ',
    bio: 'American electronic music duo consisting of Harrison Mills and Clayton Knight.',
    imageUrl: '/api/placeholder/400/400',
    performanceCount: 1,
    socialLinks: {
      instagram: 'odesza',
      spotify: 'odesza',
    },
  },
  {
    id: '3',
    name: 'Disclosure',
    genre: 'House / UK Garage',
    type: 'DJ',
    bio: 'English electronic music duo consisting of brothers Guy and Howard Lawrence.',
    imageUrl: '/api/placeholder/400/400',
    performanceCount: 1,
    socialLinks: {
      instagram: 'disclosure',
      spotify: 'disclosure',
    },
  },
  {
    id: '4',
    name: 'Khruangbin',
    genre: 'Psychedelic / Funk',
    type: 'BAND',
    bio: 'An American musical trio from Houston, Texas, consisting of Laura Lee Ochoa, Mark Speer and Donald Ray Johnson Jr.',
    imageUrl: '/api/placeholder/400/400',
    performanceCount: 1,
    socialLinks: {
      instagram: 'khruangbin',
      website: 'https://khruangbin.com',
    },
  },
  {
    id: '5',
    name: 'Bonobo',
    genre: 'Downtempo / Electronic',
    type: 'SOLO',
    bio: 'Simon Green, known by his stage name Bonobo, is a British musician, producer and DJ.',
    imageUrl: '/api/placeholder/400/400',
    performanceCount: 1,
    socialLinks: {
      instagram: 'si_bonobo',
      spotify: 'bonobo',
    },
  },
  {
    id: '6',
    name: 'Jungle',
    genre: 'Funk / Soul',
    type: 'BAND',
    bio: 'A British soul and funk collective formed in London, founded by Josh Lloyd-Watson and Tom McFarland.',
    imageUrl: '/api/placeholder/400/400',
    performanceCount: 1,
    socialLinks: {
      instagram: 'jungle4eva',
    },
  },
  {
    id: '7',
    name: 'Kaytranada',
    genre: 'House / R&B',
    type: 'DJ',
    bio: 'A Haitian-Canadian record producer and DJ from Montreal.',
    imageUrl: '/api/placeholder/400/400',
    performanceCount: 1,
    socialLinks: {
      instagram: 'kaytranada',
      spotify: 'kaytranada',
    },
  },
  {
    id: '8',
    name: 'Floating Points',
    genre: 'Electronic / Ambient',
    type: 'SOLO',
    bio: 'Sam Shepherd, known by his stage name Floating Points, is an English DJ, musician and neuroscientist.',
    imageUrl: '/api/placeholder/400/400',
    performanceCount: 1,
    socialLinks: {
      instagram: 'floatingpoints',
    },
  },
]

const artistTypeLabels: Record<string, string> = {
  DJ: 'DJ',
  BAND: 'Groupe',
  SOLO: 'Solo',
}

export default function ArtistsPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Filter artists
  const filteredArtists = mockArtists.filter((artist) => {
    const matchesSearch =
      artist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artist.genre?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = !selectedType || artist.type === selectedType
    return matchesSearch && matchesType
  })

  const handleDelete = (artistId: string) => {
    // TODO: Implement actual delete via API
    console.log('Deleting artist:', artistId)
    setDeleteConfirm(null)
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
            <span>Artistes</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Artistes</h1>
        </div>
        <Link
          href={`/festivals/${festivalId}/lineup/artists/new`}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Ajouter un artiste
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Music className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total artistes</p>
              <p className="text-2xl font-bold">{mockArtists.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Groupes</p>
              <p className="text-2xl font-bold">
                {mockArtists.filter((a) => a.type === 'BAND').length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Music className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">DJs</p>
              <p className="text-2xl font-bold">
                {mockArtists.filter((a) => a.type === 'DJ').length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <Music className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Solo</p>
              <p className="text-2xl font-bold">
                {mockArtists.filter((a) => a.type === 'SOLO').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un artiste..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border py-2 pl-10 pr-4 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={selectedType || ''}
              onChange={(e) => setSelectedType(e.target.value || null)}
              className="rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Tous les types</option>
              <option value="DJ">DJ</option>
              <option value="BAND">Groupe</option>
              <option value="SOLO">Solo</option>
            </select>
          </div>
        </div>

        {/* View toggle */}
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

      {/* Artists Grid/List */}
      {filteredArtists.length === 0 ? (
        <div className="rounded-lg border bg-white px-4 py-12 text-center">
          <Music className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Aucun artiste trouve</h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchQuery || selectedType
              ? 'Essayez de modifier vos filtres'
              : 'Commencez par ajouter un artiste a votre lineup'}
          </p>
          <Link
            href={`/festivals/${festivalId}/lineup/artists/new`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Ajouter un artiste
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredArtists.map((artist) => (
            <div
              key={artist.id}
              className="group relative overflow-hidden rounded-lg border bg-white transition-shadow hover:shadow-md"
            >
              {/* Image */}
              <div className="aspect-square bg-gradient-to-br from-purple-500 to-blue-600 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Music className="h-16 w-16 text-white/50" />
                </div>
                {/* Overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    href={`/festivals/${festivalId}/lineup/artists/${artist.id}/edit`}
                    className="rounded-full bg-white p-2 text-gray-700 hover:bg-gray-100"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => setDeleteConfirm(artist.id)}
                    className="rounded-full bg-white p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{artist.name}</h3>
                    <p className="text-sm text-gray-500">{artist.genre}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      artist.type === 'DJ' && 'bg-blue-100 text-blue-700',
                      artist.type === 'BAND' && 'bg-purple-100 text-purple-700',
                      artist.type === 'SOLO' && 'bg-green-100 text-green-700'
                    )}
                  >
                    {artistTypeLabels[artist.type || 'SOLO']}
                  </span>
                </div>

                <p className="mt-2 text-sm text-gray-600 line-clamp-2">{artist.bio}</p>

                {/* Social links */}
                <div className="mt-3 flex items-center gap-2">
                  {artist.socialLinks?.instagram && (
                    <a
                      href={`https://instagram.com/${artist.socialLinks.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200"
                    >
                      <Instagram className="h-4 w-4" />
                    </a>
                  )}
                  {artist.socialLinks?.website && (
                    <a
                      href={artist.socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200"
                    >
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                  <span className="ml-auto text-xs text-gray-500">
                    {artist.performanceCount} performance{artist.performanceCount > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Delete confirmation */}
              {deleteConfirm === artist.id && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 p-4">
                  <p className="text-center text-sm text-gray-600">
                    Supprimer <strong>{artist.name}</strong> ?
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleDelete(artist.id)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Artiste</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Genre</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Performances</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Liens</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredArtists.map((artist) => (
                <tr key={artist.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                        <Music className="h-5 w-5 text-white/70" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{artist.name}</div>
                        <div className="text-sm text-gray-500 line-clamp-1 max-w-xs">
                          {artist.bio}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{artist.genre}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        artist.type === 'DJ' && 'bg-blue-100 text-blue-700',
                        artist.type === 'BAND' && 'bg-purple-100 text-purple-700',
                        artist.type === 'SOLO' && 'bg-green-100 text-green-700'
                      )}
                    >
                      {artistTypeLabels[artist.type || 'SOLO']}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{artist.performanceCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {artist.socialLinks?.instagram && (
                        <a
                          href={`https://instagram.com/${artist.socialLinks.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <Instagram className="h-4 w-4" />
                        </a>
                      )}
                      {artist.socialLinks?.website && (
                        <a
                          href={artist.socialLinks.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/festivals/${festivalId}/lineup/artists/${artist.id}/edit`}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => setDeleteConfirm(artist.id)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
