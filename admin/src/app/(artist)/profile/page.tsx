'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  User,
  Music,
  Globe,
  Instagram,
  Twitter,
  Youtube,
  Link as LinkIcon,
  Camera,
  Save,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  MapPin,
  Mail,
  Phone,
} from 'lucide-react'

// Types
interface ArtistPhoto {
  url: string
  caption?: string
  isPrimary?: boolean
}

interface ArtistProfile {
  id: string
  name: string
  stageName: string
  bio: string
  shortBio: string
  genre: string
  subGenres: string[]
  country: string
  city: string
  profileImageUrl: string
  coverImageUrl: string
  photos: ArtistPhoto[]
  socialLinks: {
    website?: string
    instagram?: string
    twitter?: string
    youtube?: string
    spotify?: string
    soundcloud?: string
  }
  contactInfo: {
    email?: string
    phone?: string
    bookingEmail?: string
    managerName?: string
    managerEmail?: string
    managerPhone?: string
  }
  musicLinks: {
    spotify?: string
    appleMusic?: string
    soundcloud?: string
    bandcamp?: string
  }
  isPublic: boolean
  isVerified: boolean
}

// Mock profile data
const mockProfile: ArtistProfile = {
  id: 'a1',
  name: 'Harrison Mills & Clayton Knight',
  stageName: 'ODESZA',
  bio: "ODESZA is an American electronic music duo from Seattle, Washington, consisting of Harrison Mills and Clayton Knight. They formed in 2012 and have released multiple critically acclaimed albums including 'In Return', 'A Moment Apart', and 'The Last Goodbye'. Known for their melodic electronic sound that blends elements of electronic music with live instrumentation and cinematic soundscapes.",
  shortBio: 'Grammy-nominated electronic duo from Seattle. Creating melodic electronic music since 2012.',
  genre: 'Electronic',
  subGenres: ['Chillwave', 'Indie Electronic', 'Synth-pop'],
  country: 'USA',
  city: 'Seattle',
  profileImageUrl: '',
  coverImageUrl: '',
  photos: [
    { url: '/images/odesza-1.jpg', caption: 'Live at Red Rocks 2023', isPrimary: true },
    { url: '/images/odesza-2.jpg', caption: 'Studio session' },
  ],
  socialLinks: {
    website: 'https://odesza.com',
    instagram: 'odesza',
    twitter: 'oabordered',
    youtube: 'odesza',
    spotify: 'https://open.spotify.com/artist/21mKp7DqtSNHhCAU2ugvUw',
  },
  contactInfo: {
    email: 'info@odesza.com',
    bookingEmail: 'booking@odesza.com',
    managerName: 'Sarah Chen',
    managerEmail: 'sarah@redlightmanagement.com',
  },
  musicLinks: {
    spotify: 'https://open.spotify.com/artist/21mKp7DqtSNHhCAU2ugvUw',
    appleMusic: 'https://music.apple.com/us/artist/odesza/561218638',
    soundcloud: 'https://soundcloud.com/odesza',
  },
  isPublic: true,
  isVerified: true,
}

const genres = [
  'Electronic',
  'House',
  'Techno',
  'Hip Hop',
  'R&B',
  'Pop',
  'Rock',
  'Indie',
  'Jazz',
  'Classical',
  'Folk',
  'Metal',
  'Reggae',
  'Soul',
  'Funk',
  'Ambient',
  'Drum & Bass',
  'Dubstep',
]

export default function ArtistProfilePage() {
  const [profile, setProfile] = useState(mockProfile)
  const [activeTab, setActiveTab] = useState<'basic' | 'social' | 'contact' | 'photos'>('basic')
  const [hasChanges, setHasChanges] = useState(false)
  const [newSubGenre, setNewSubGenre] = useState('')

  const handleFieldChange = (field: string, value: any) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }))
    setHasChanges(true)
  }

  const handleNestedChange = (parent: string, field: string, value: any) => {
    setProfile((prev) => ({
      ...prev,
      [parent]: {
        ...(prev as any)[parent],
        [field]: value,
      },
    }))
    setHasChanges(true)
  }

  const handleAddSubGenre = () => {
    if (newSubGenre && !profile.subGenres.includes(newSubGenre)) {
      setProfile((prev) => ({
        ...prev,
        subGenres: [...prev.subGenres, newSubGenre],
      }))
      setNewSubGenre('')
      setHasChanges(true)
    }
  }

  const handleRemoveSubGenre = (genre: string) => {
    setProfile((prev) => ({
      ...prev,
      subGenres: prev.subGenres.filter((g) => g !== genre),
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    console.log('Saving profile:', profile)
    setHasChanges(false)
    // API call would go here
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon Profil</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez les informations de votre profil artiste public
          </p>
        </div>
        <div className="flex items-center gap-3">
          {profile.isVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
              <Check className="h-4 w-4" />
              Verifie
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              hasChanges
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            <Save className="h-4 w-4" />
            Enregistrer
          </button>
        </div>
      </div>

      {/* Cover & Profile Image */}
      <div className="relative rounded-xl overflow-hidden">
        <div className="h-48 bg-gradient-to-r from-purple-600 to-pink-600 relative">
          {profile.coverImageUrl ? (
            <img
              src={profile.coverImageUrl}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-white hover:bg-white/30 backdrop-blur-sm">
                <Camera className="h-5 w-5" />
                Ajouter une couverture
              </button>
            </div>
          )}
        </div>
        <div className="absolute -bottom-12 left-6">
          <div className="relative">
            <div className="h-24 w-24 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-lg">
              {profile.stageName.charAt(0)}
            </div>
            <button className="absolute -bottom-1 -right-1 rounded-full bg-white p-2 shadow-md hover:bg-gray-100">
              <Camera className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-16 border-b">
        <nav className="flex gap-8">
          {[
            { id: 'basic', label: 'Informations de base', icon: User },
            { id: 'social', label: 'Reseaux sociaux', icon: Globe },
            { id: 'contact', label: 'Contact', icon: Mail },
            { id: 'photos', label: 'Photos', icon: Camera },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Basic Info Tab */}
      {activeTab === 'basic' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {/* Name Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom de scene
              </label>
              <input
                type="text"
                value={profile.stageName}
                onChange={(e) => handleFieldChange('stageName', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom reel (optionnel)
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-gray-500">
                Visible uniquement pour les organisateurs de festivals
              </p>
            </div>

            {/* Location */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pays
                </label>
                <input
                  type="text"
                  value={profile.country}
                  onChange={(e) => handleFieldChange('country', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ville
                </label>
                <input
                  type="text"
                  value={profile.city}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Genre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Genre principal
              </label>
              <select
                value={profile.genre}
                onChange={(e) => handleFieldChange('genre', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {genres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-genres */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sous-genres
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {profile.subGenres.map((genre) => (
                  <span
                    key={genre}
                    className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700"
                  >
                    {genre}
                    <button
                      onClick={() => handleRemoveSubGenre(genre)}
                      className="hover:text-purple-900"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubGenre}
                  onChange={(e) => setNewSubGenre(e.target.value)}
                  placeholder="Ajouter un sous-genre..."
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSubGenre()}
                />
                <button
                  onClick={handleAddSubGenre}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Short Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio courte
              </label>
              <textarea
                rows={2}
                maxLength={150}
                value={profile.shortBio}
                onChange={(e) => handleFieldChange('shortBio', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                placeholder="Une phrase pour decrire votre musique..."
              />
              <p className="mt-1 text-xs text-gray-500">
                {profile.shortBio.length}/150 caracteres
              </p>
            </div>

            {/* Full Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Biographie complete
              </label>
              <textarea
                rows={8}
                value={profile.bio}
                onChange={(e) => handleFieldChange('bio', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                placeholder="Racontez votre histoire..."
              />
            </div>

            {/* Visibility */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Profil public</h4>
                  <p className="text-sm text-gray-500">
                    Votre profil est visible par les organisateurs de festivals
                  </p>
                </div>
                <button
                  onClick={() => handleFieldChange('isPublic', !profile.isPublic)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    profile.isPublic ? 'bg-primary' : 'bg-gray-200'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      profile.isPublic ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Social Tab */}
      {activeTab === 'social' && (
        <div className="max-w-xl space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Globe className="inline h-4 w-4 mr-2" />
              Site web
            </label>
            <input
              type="url"
              value={profile.socialLinks.website || ''}
              onChange={(e) => handleNestedChange('socialLinks', 'website', e.target.value)}
              placeholder="https://votresite.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Instagram className="inline h-4 w-4 mr-2" />
              Instagram
            </label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                @
              </span>
              <input
                type="text"
                value={profile.socialLinks.instagram || ''}
                onChange={(e) => handleNestedChange('socialLinks', 'instagram', e.target.value)}
                placeholder="votrecompte"
                className="flex-1 rounded-r-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Twitter className="inline h-4 w-4 mr-2" />
              Twitter / X
            </label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                @
              </span>
              <input
                type="text"
                value={profile.socialLinks.twitter || ''}
                onChange={(e) => handleNestedChange('socialLinks', 'twitter', e.target.value)}
                placeholder="votrecompte"
                className="flex-1 rounded-r-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Youtube className="inline h-4 w-4 mr-2" />
              YouTube
            </label>
            <input
              type="text"
              value={profile.socialLinks.youtube || ''}
              onChange={(e) => handleNestedChange('socialLinks', 'youtube', e.target.value)}
              placeholder="Nom de la chaine"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Music className="inline h-4 w-4 mr-2" />
              Spotify
            </label>
            <input
              type="url"
              value={profile.musicLinks.spotify || ''}
              onChange={(e) => handleNestedChange('musicLinks', 'spotify', e.target.value)}
              placeholder="https://open.spotify.com/artist/..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <LinkIcon className="inline h-4 w-4 mr-2" />
              SoundCloud
            </label>
            <input
              type="url"
              value={profile.musicLinks.soundcloud || ''}
              onChange={(e) => handleNestedChange('musicLinks', 'soundcloud', e.target.value)}
              placeholder="https://soundcloud.com/..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Contact Tab */}
      {activeTab === 'contact' && (
        <div className="max-w-xl space-y-6">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">
                Ces informations sont visibles uniquement par les organisateurs de festivals qui vous
                contactent.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="inline h-4 w-4 mr-2" />
              Email de contact
            </label>
            <input
              type="email"
              value={profile.contactInfo.email || ''}
              onChange={(e) => handleNestedChange('contactInfo', 'email', e.target.value)}
              placeholder="contact@example.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="inline h-4 w-4 mr-2" />
              Email de booking
            </label>
            <input
              type="email"
              value={profile.contactInfo.bookingEmail || ''}
              onChange={(e) => handleNestedChange('contactInfo', 'bookingEmail', e.target.value)}
              placeholder="booking@example.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Manager / Agent</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="inline h-4 w-4 mr-2" />
                  Nom du manager
                </label>
                <input
                  type="text"
                  value={profile.contactInfo.managerName || ''}
                  onChange={(e) => handleNestedChange('contactInfo', 'managerName', e.target.value)}
                  placeholder="Nom complet"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="inline h-4 w-4 mr-2" />
                  Email du manager
                </label>
                <input
                  type="email"
                  value={profile.contactInfo.managerEmail || ''}
                  onChange={(e) => handleNestedChange('contactInfo', 'managerEmail', e.target.value)}
                  placeholder="manager@example.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="inline h-4 w-4 mr-2" />
                  Telephone du manager
                </label>
                <input
                  type="tel"
                  value={profile.contactInfo.managerPhone || ''}
                  onChange={(e) => handleNestedChange('contactInfo', 'managerPhone', e.target.value)}
                  placeholder="+33 6 00 00 00 00"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <Camera className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 mb-2">Glissez vos photos ici ou</p>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
              Parcourir
            </button>
            <p className="mt-2 text-xs text-gray-500">
              PNG, JPG jusqu'a 10MB. Minimum 1200x800px recommande.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {profile.photos.map((photo, index) => (
              <div
                key={index}
                className="group relative rounded-lg overflow-hidden border aspect-video bg-gray-100"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-medium">
                  Photo {index + 1}
                </div>
                {photo.isPrimary && (
                  <span className="absolute top-2 left-2 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-700 shadow">
                    Photo principale
                  </span>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
                    Definir principale
                  </button>
                  <button className="rounded-lg bg-red-500 p-1.5 text-white hover:bg-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <p className="text-sm text-white">{photo.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
