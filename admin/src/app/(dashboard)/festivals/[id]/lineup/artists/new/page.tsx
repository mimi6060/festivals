'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Save,
  Upload,
  Music,
  Instagram,
  Globe,
  Twitter,
  Youtube,
  Loader2,
  X,
  Plus,
} from 'lucide-react'

// Spotify and SoundCloud icons as simple components
const SpotifyIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
)

const SoundCloudIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.099-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c.014.057.045.094.09.094s.089-.037.099-.094l.19-1.308-.19-1.334c-.01-.057-.045-.09-.09-.09m1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.104.106.104.061 0 .12-.044.12-.104l.24-2.458-.24-2.563c0-.06-.059-.104-.12-.104m.945-.089c-.075 0-.135.06-.15.135l-.193 2.64.21 2.544c.016.077.075.138.149.138.075 0 .135-.061.15-.138l.24-2.544-.24-2.64c-.015-.075-.075-.135-.15-.135m.93-.112c-.09 0-.149.075-.165.164l-.18 2.76.195 2.52c.016.09.075.164.165.164.089 0 .164-.074.164-.164l.21-2.52-.225-2.76c-.016-.089-.075-.164-.165-.164m.964-.015c-.104 0-.179.09-.194.194l-.165 2.745.18 2.49c.015.104.089.18.194.18s.179-.076.195-.18l.21-2.49-.21-2.745c-.016-.104-.09-.194-.195-.194m1.051.105c-.119 0-.21.104-.225.209l-.15 2.655.165 2.46c.015.119.106.209.225.209.12 0 .21-.09.225-.209l.18-2.46-.165-2.655c-.015-.105-.105-.209-.225-.209m1.021.314c-.135 0-.239.105-.254.24l-.135 2.355.15 2.43c.015.135.119.24.254.24.135 0 .239-.105.254-.24l.166-2.43-.166-2.355c-.015-.135-.119-.24-.254-.24m1.065.239c-.149 0-.269.12-.284.27l-.12 2.116.135 2.4c.015.15.135.27.284.27.15 0 .27-.12.285-.27l.149-2.4-.149-2.116c-.015-.15-.135-.27-.285-.27m1.095.196c-.164 0-.299.135-.314.3l-.105 1.92.12 2.37c.015.165.15.3.314.3.165 0 .3-.135.315-.3l.135-2.37-.135-1.92c-.015-.165-.15-.3-.315-.3m1.11.09c-.18 0-.33.15-.345.33l-.09 1.83.105 2.34c.015.18.165.33.345.33.18 0 .33-.15.345-.33l.12-2.34-.12-1.83c-.015-.18-.165-.33-.345-.33m1.125.09c-.195 0-.36.165-.375.36l-.075 1.74.09 2.31c.015.195.18.36.375.36s.36-.165.375-.36l.105-2.31-.105-1.74c-.015-.195-.18-.36-.375-.36m1.155.045c-.21 0-.385.18-.4.39l-.06 1.695.075 2.28c.015.21.19.39.4.39.209 0 .384-.18.399-.39l.09-2.28-.09-1.695c-.015-.21-.19-.39-.4-.39m1.17.09c-.224 0-.405.18-.42.405l-.045 1.62.06 2.25c.015.225.196.405.42.405.225 0 .405-.18.42-.405l.075-2.25-.075-1.62c-.015-.225-.195-.405-.42-.405m1.185.09c-.24 0-.435.195-.45.435l-.03 1.515.045 2.22c.015.24.21.435.45.435.24 0 .435-.195.45-.435l.06-2.22-.06-1.515c-.015-.24-.21-.435-.45-.435m1.5-2.58c-.27 0-.49.216-.505.48l-.12 4.11.135 2.19c.015.27.225.48.48.48.27 0 .48-.21.495-.48l.15-2.19-.15-4.11c-.015-.264-.24-.48-.495-.48m1.215.044c-.285 0-.51.24-.525.525l-.12 4.05.135 2.16c.015.285.24.525.525.525.27 0 .51-.24.525-.525l.15-2.16-.15-4.05c-.015-.285-.255-.525-.54-.525M24 11.85c0-1.95-1.575-3.54-3.54-3.54-.525 0-1.035.105-1.5.315-.315-3.48-3.255-6.21-6.855-6.21-1.26 0-2.475.33-3.54.915-.39.195-.495.42-.495.84v11.385c0 .42.3.765.72.81.03.015 11.4.015 11.67.015 1.95 0 3.54-1.575 3.54-3.54" />
  </svg>
)

interface SocialLinks {
  instagram: string
  spotify: string
  soundcloud: string
  website: string
  twitter: string
  youtube: string
}

interface ArtistFormData {
  name: string
  bio: string
  genre: string
  type: 'DJ' | 'BAND' | 'SOLO' | ''
  guestQuota: number
  socialLinks: SocialLinks
}

const initialFormData: ArtistFormData = {
  name: '',
  bio: '',
  genre: '',
  type: '',
  guestQuota: 0,
  socialLinks: {
    instagram: '',
    spotify: '',
    soundcloud: '',
    website: '',
    twitter: '',
    youtube: '',
  },
}

const genreSuggestions = [
  'Electronic',
  'House',
  'Techno',
  'Rock',
  'Pop',
  'Hip-Hop',
  'R&B',
  'Jazz',
  'Folk',
  'Metal',
  'Indie',
  'Ambient',
  'Downtempo',
  'Drum & Bass',
  'Dubstep',
  'Funk',
  'Soul',
  'Reggae',
  'World',
  'Classical',
]

export default function NewArtistPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string

  const [formData, setFormData] = useState<ArtistFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof ArtistFormData, string>>>({})

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof ArtistFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSocialLinkChange = (platform: keyof SocialLinks, value: string) => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [platform]: value },
    }))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // TODO: Implement actual file upload to storage service
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImagePreview(null)
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ArtistFormData, string>> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis'
    }

    if (!formData.type) {
      newErrors.type = 'Le type est requis'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // TODO: Implement actual API call
      // await artistsApi.create(festivalId, formData)

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      router.push(`/festivals/${festivalId}/lineup/artists`)
    } catch (error) {
      console.error('Error creating artist:', error)
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
            <Link href={`/festivals/${festivalId}/lineup/artists`} className="hover:text-primary">
              Artistes
            </Link>
            <span>/</span>
            <span>Nouveau</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Ajouter un artiste</h1>
        </div>
        <Link
          href={`/festivals/${festivalId}/lineup/artists`}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Informations de base</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nom de l&apos;artiste <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ex: The Midnight"
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-1',
                    errors.name
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : 'focus:border-primary focus:ring-primary'
                  )}
                />
                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-1',
                      errors.type
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'focus:border-primary focus:ring-primary'
                    )}
                  >
                    <option value="">Selectionner un type</option>
                    <option value="DJ">DJ</option>
                    <option value="BAND">Groupe</option>
                    <option value="SOLO">Solo</option>
                  </select>
                  {errors.type && <p className="mt-1 text-sm text-red-500">{errors.type}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Genre</label>
                  <input
                    type="text"
                    name="genre"
                    value={formData.genre}
                    onChange={handleInputChange}
                    placeholder="Ex: Electronic, House, Rock..."
                    list="genre-suggestions"
                    className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <datalist id="genre-suggestions">
                    {genreSuggestions.map((genre) => (
                      <option key={genre} value={genre} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Biographie</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Decrivez l'artiste, son parcours, son style..."
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Quota d&apos;invites
                </label>
                <input
                  type="number"
                  name="guestQuota"
                  value={formData.guestQuota}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Nombre d&apos;invitations gratuites pour l&apos;artiste
                </p>
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Liens sociaux</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Instagram className="h-4 w-4 text-pink-600" />
                  Instagram
                </label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 bg-gray-50 px-3 text-sm text-gray-500">
                    instagram.com/
                  </span>
                  <input
                    type="text"
                    value={formData.socialLinks.instagram}
                    onChange={(e) => handleSocialLinkChange('instagram', e.target.value)}
                    placeholder="username"
                    className="flex-1 rounded-r-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <SpotifyIcon />
                  <span className="text-green-600">Spotify</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 bg-gray-50 px-3 text-sm text-gray-500">
                    open.spotify.com/artist/
                  </span>
                  <input
                    type="text"
                    value={formData.socialLinks.spotify}
                    onChange={(e) => handleSocialLinkChange('spotify', e.target.value)}
                    placeholder="artist-id"
                    className="flex-1 rounded-r-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <SoundCloudIcon />
                  <span className="text-orange-500">SoundCloud</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 bg-gray-50 px-3 text-sm text-gray-500">
                    soundcloud.com/
                  </span>
                  <input
                    type="text"
                    value={formData.socialLinks.soundcloud}
                    onChange={(e) => handleSocialLinkChange('soundcloud', e.target.value)}
                    placeholder="username"
                    className="flex-1 rounded-r-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Twitter className="h-4 w-4 text-blue-500" />
                  Twitter / X
                </label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 bg-gray-50 px-3 text-sm text-gray-500">
                    x.com/
                  </span>
                  <input
                    type="text"
                    value={formData.socialLinks.twitter}
                    onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
                    placeholder="username"
                    className="flex-1 rounded-r-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Youtube className="h-4 w-4 text-red-600" />
                  YouTube
                </label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 bg-gray-50 px-3 text-sm text-gray-500">
                    youtube.com/@
                  </span>
                  <input
                    type="text"
                    value={formData.socialLinks.youtube}
                    onChange={(e) => handleSocialLinkChange('youtube', e.target.value)}
                    placeholder="channel"
                    className="flex-1 rounded-r-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Globe className="h-4 w-4 text-gray-600" />
                  Site web
                </label>
                <input
                  type="url"
                  value={formData.socialLinks.website}
                  onChange={(e) => handleSocialLinkChange('website', e.target.value)}
                  placeholder="https://example.com"
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Image Upload */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Photo de l&apos;artiste</h2>

            {imagePreview ? (
              <div className="relative">
                <div className="aspect-square overflow-hidden rounded-lg">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12 transition-colors hover:border-primary">
                <div className="rounded-full bg-gray-100 p-3">
                  <Upload className="h-6 w-6 text-gray-400" />
                </div>
                <p className="mt-2 text-sm font-medium text-gray-700">
                  Cliquez pour uploader
                </p>
                <p className="text-xs text-gray-500">PNG, JPG jusqu&apos;a 5MB</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}

            <p className="mt-3 text-xs text-gray-500">
              Format recommande: carre, minimum 400x400 pixels
            </p>
          </div>

          {/* Preview Card */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Apercu</h2>

            <div className="overflow-hidden rounded-lg border">
              <div className="aspect-square bg-gradient-to-br from-purple-500 to-blue-600 relative">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Music className="h-16 w-16 text-white/50" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {formData.name || 'Nom de l\'artiste'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formData.genre || 'Genre musical'}
                    </p>
                  </div>
                  {formData.type && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        formData.type === 'DJ' && 'bg-blue-100 text-blue-700',
                        formData.type === 'BAND' && 'bg-purple-100 text-purple-700',
                        formData.type === 'SOLO' && 'bg-green-100 text-green-700'
                      )}
                    >
                      {formData.type === 'DJ' && 'DJ'}
                      {formData.type === 'BAND' && 'Groupe'}
                      {formData.type === 'SOLO' && 'Solo'}
                    </span>
                  )}
                </div>
                {formData.bio && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{formData.bio}</p>
                )}
              </div>
            </div>
          </div>

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
                  Enregistrer l&apos;artiste
                </>
              )}
            </button>
            <Link
              href={`/festivals/${festivalId}/lineup/artists`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
