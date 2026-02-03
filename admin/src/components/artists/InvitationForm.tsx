'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Search,
  User,
  Music,
  Calendar,
  DollarSign,
  Clock,
  MapPin,
  Send,
  X,
} from 'lucide-react'

interface ArtistSearchResult {
  id: string
  name: string
  stageName?: string
  genre?: string
  profileImageUrl?: string
  city?: string
  country?: string
}

interface InvitationFormProps {
  festivalId: string
  onSubmit: (data: InvitationFormData) => void
  onCancel: () => void
}

interface InvitationFormData {
  artistProfileId: string
  proposedFee?: number
  currency: string
  proposedDate?: string
  proposedStageId?: string
  setDuration?: number
  message: string
  expiresAt?: string
}

// Mock artist search results
const mockArtists: ArtistSearchResult[] = [
  { id: 'a1', name: 'Harrison Clayton', stageName: 'ODESZA', genre: 'Electronic', city: 'Seattle', country: 'USA' },
  { id: 'a2', name: 'Guy Lawrence', stageName: 'Disclosure', genre: 'House', city: 'London', country: 'UK' },
  { id: 'a3', name: 'Kevin Parker', stageName: 'Tame Impala', genre: 'Psychedelic Rock', city: 'Perth', country: 'Australia' },
  { id: 'a4', name: 'Louis Cole', genre: 'Jazz Funk', city: 'Los Angeles', country: 'USA' },
  { id: 'a5', name: 'Bonobo', stageName: 'Bonobo', genre: 'Downtempo', city: 'London', country: 'UK' },
]

// Mock stages
const mockStages = [
  { id: 's1', name: 'Main Stage' },
  { id: 's2', name: 'Electronic Tent' },
  { id: 's3', name: 'Acoustic Garden' },
  { id: 's4', name: 'Discovery Stage' },
]

export function InvitationForm({ festivalId, onSubmit, onCancel }: InvitationFormProps) {
  const [step, setStep] = useState<'search' | 'details'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArtist, setSelectedArtist] = useState<ArtistSearchResult | null>(null)

  const [formData, setFormData] = useState<Omit<InvitationFormData, 'artistProfileId'>>({
    proposedFee: undefined,
    currency: 'EUR',
    proposedDate: '',
    proposedStageId: '',
    setDuration: 60,
    message: '',
    expiresAt: '',
  })

  // Filter artists based on search
  const filteredArtists = searchQuery.length >= 2
    ? mockArtists.filter(
        (a) =>
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.stageName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const handleArtistSelect = (artist: ArtistSearchResult) => {
    setSelectedArtist(artist)
    setStep('details')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedArtist) return

    onSubmit({
      artistProfileId: selectedArtist.id,
      ...formData,
      proposedFee: formData.proposedFee || undefined,
      proposedDate: formData.proposedDate || undefined,
      proposedStageId: formData.proposedStageId || undefined,
      expiresAt: formData.expiresAt || undefined,
    })
  }

  if (step === 'search') {
    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rechercher un artiste
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Nom de l'artiste ou nom de scene..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>

        {searchQuery.length >= 2 && (
          <div className="space-y-2">
            {filteredArtists.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-4">
                Aucun artiste trouve. Verifiez l'orthographe ou invitez-le a creer un profil.
              </p>
            ) : (
              filteredArtists.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => handleArtistSelect(artist)}
                  className="w-full flex items-center gap-4 rounded-lg border p-4 hover:bg-gray-50 hover:border-primary transition-colors text-left"
                >
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium">
                    {artist.stageName?.charAt(0) || artist.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {artist.stageName || artist.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {artist.genre} - {artist.city}, {artist.country}
                    </div>
                  </div>
                  <Music className="h-5 w-5 text-gray-400" />
                </button>
              ))
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Selected Artist */}
      <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium">
          {selectedArtist?.stageName?.charAt(0) || selectedArtist?.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">
            {selectedArtist?.stageName || selectedArtist?.name}
          </div>
          <div className="text-sm text-gray-500">
            {selectedArtist?.genre} - {selectedArtist?.city}, {selectedArtist?.country}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedArtist(null)
            setStep('search')
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Fee and Currency */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="inline h-4 w-4 mr-1" />
            Cachet propose
          </label>
          <input
            type="number"
            placeholder="50000"
            value={formData.proposedFee || ''}
            onChange={(e) => setFormData({ ...formData, proposedFee: Number(e.target.value) || undefined })}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Devise
          </label>
          <select
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>

      {/* Date and Stage */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline h-4 w-4 mr-1" />
            Date proposee
          </label>
          <input
            type="datetime-local"
            value={formData.proposedDate}
            onChange={(e) => setFormData({ ...formData, proposedDate: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="inline h-4 w-4 mr-1" />
            Scene
          </label>
          <select
            value={formData.proposedStageId}
            onChange={(e) => setFormData({ ...formData, proposedStageId: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Selectionner une scene</option>
            {mockStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Set Duration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Clock className="inline h-4 w-4 mr-1" />
          Duree du set (minutes)
        </label>
        <input
          type="number"
          placeholder="60"
          value={formData.setDuration || ''}
          onChange={(e) => setFormData({ ...formData, setDuration: Number(e.target.value) || undefined })}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Expiration Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date d'expiration de l'invitation
        </label>
        <input
          type="date"
          value={formData.expiresAt}
          onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-gray-500">
          L'artiste devra repondre avant cette date
        </p>
      </div>

      {/* Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Message personnalise
        </label>
        <textarea
          rows={4}
          placeholder="Ecrivez un message pour l'artiste..."
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Send className="h-4 w-4" />
          Envoyer l'invitation
        </button>
      </div>
    </form>
  )
}
