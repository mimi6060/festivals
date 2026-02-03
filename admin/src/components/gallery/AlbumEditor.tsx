'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Save,
  Loader2,
  Image as ImageIcon,
  FolderOpen,
  Globe,
  Lock,
  Link as LinkIcon,
  Calendar,
  MapPin,
  Music,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Album {
  id?: string
  name: string
  description: string
  type: 'GENERAL' | 'DAILY' | 'STAGE' | 'ARTIST' | 'OFFICIAL' | 'USER_CREATED'
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED'
  coverUrl?: string
}

interface AlbumEditorProps {
  festivalId: string
  album?: Album
  isOpen: boolean
  onClose: () => void
  onSave?: (album: Album) => void
}

export function AlbumEditor({
  festivalId,
  album,
  isOpen,
  onClose,
  onSave,
}: AlbumEditorProps) {
  const queryClient = useQueryClient()
  const isEditing = !!album?.id

  const [formData, setFormData] = useState<Album>({
    name: '',
    description: '',
    type: 'GENERAL',
    visibility: 'PUBLIC',
  })

  useEffect(() => {
    if (album) {
      setFormData(album)
    } else {
      setFormData({
        name: '',
        description: '',
        type: 'GENERAL',
        visibility: 'PUBLIC',
      })
    }
  }, [album])

  const saveMutation = useMutation({
    mutationFn: async (data: Album) => {
      // In real app, call API
      await new Promise((resolve) => setTimeout(resolve, 500))
      return { ...data, id: data.id || Math.random().toString(36).substr(2, 9) }
    },
    onSuccess: (savedAlbum) => {
      queryClient.invalidateQueries({ queryKey: ['admin-albums'] })
      onSave?.(savedAlbum)
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    saveMutation.mutate(formData)
  }

  const albumTypes = [
    { value: 'GENERAL', label: 'General', icon: FolderOpen },
    { value: 'DAILY', label: 'Journalier', icon: Calendar },
    { value: 'STAGE', label: 'Par scene', icon: MapPin },
    { value: 'ARTIST', label: 'Par artiste', icon: Music },
    { value: 'OFFICIAL', label: 'Officiel', icon: FolderOpen },
    { value: 'USER_CREATED', label: 'Utilisateur', icon: Users },
  ]

  const visibilityOptions = [
    { value: 'PUBLIC', label: 'Public', icon: Globe, description: 'Visible par tous' },
    { value: 'PRIVATE', label: 'Prive', icon: Lock, description: 'Visible uniquement par vous' },
    { value: 'UNLISTED', label: 'Non liste', icon: LinkIcon, description: 'Accessible via lien' },
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Modifier l\'album' : 'Creer un album'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nom de l'album *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Jour 1 - Main Stage"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Decrivez cet album..."
              rows={3}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type d'album
            </label>
            <div className="grid grid-cols-3 gap-2">
              {albumTypes.map((type) => {
                const Icon = type.icon
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.value as Album['type'] })}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors',
                      formData.type === type.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{type.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visibilite
            </label>
            <div className="space-y-2">
              {visibilityOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, visibility: option.value as Album['visibility'] })
                    }
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      formData.visibility === option.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-full p-2',
                        formData.visibility === option.value
                          ? 'bg-primary/10 text-primary'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-gray-500">{option.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image de couverture
            </label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-lg border bg-gray-100">
                {formData.coverUrl ? (
                  <img
                    src={formData.coverUrl}
                    alt="Cover"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">
                  La couverture sera automatiquement definie par la premiere photo de l'album,
                  ou vous pouvez en choisir une manuellement.
                </p>
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                  Choisir une image
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending || !formData.name.trim()}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? 'Enregistrer' : 'Creer l\'album'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Quick album type selector component
export function AlbumTypeSelector({
  value,
  onChange,
}: {
  value: Album['type']
  onChange: (type: Album['type']) => void
}) {
  const types = [
    { value: 'GENERAL', label: 'General', icon: FolderOpen, color: 'bg-gray-100 text-gray-600' },
    { value: 'DAILY', label: 'Jour', icon: Calendar, color: 'bg-blue-100 text-blue-600' },
    { value: 'STAGE', label: 'Scene', icon: MapPin, color: 'bg-purple-100 text-purple-600' },
    { value: 'ARTIST', label: 'Artiste', icon: Music, color: 'bg-green-100 text-green-600' },
    { value: 'OFFICIAL', label: 'Officiel', icon: FolderOpen, color: 'bg-yellow-100 text-yellow-600' },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {types.map((type) => {
        const Icon = type.icon
        const isSelected = value === type.value
        return (
          <button
            key={type.value}
            onClick={() => onChange(type.value as Album['type'])}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              isSelected ? type.color : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            )}
          >
            <Icon className="h-4 w-4" />
            {type.label}
          </button>
        )
      })}
    </div>
  )
}
