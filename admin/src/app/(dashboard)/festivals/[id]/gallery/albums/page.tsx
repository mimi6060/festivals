'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import {
  FolderOpen,
  Plus,
  ImageIcon,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  ArrowLeft,
  Calendar,
  Music,
  MapPin,
  Users,
} from 'lucide-react'
import { formatDateTime, cn } from '@/lib/utils'

interface Album {
  id: string
  name: string
  description: string
  coverUrl?: string
  type: 'GENERAL' | 'DAILY' | 'STAGE' | 'ARTIST' | 'OFFICIAL' | 'USER_CREATED'
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED'
  itemCount: number
  createdAt: string
}

export default function AlbumsPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const festivalId = params.id as string

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null)

  // Fetch albums
  const { data: albumsData, isLoading } = useQuery({
    queryKey: ['admin-albums', festivalId],
    queryFn: async () => {
      // In real app, call API
      return {
        items: [] as Album[],
        total: 0,
      }
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // In real app, call API
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-albums'] })
    },
  })

  const handleDelete = (album: Album) => {
    if (confirm(`Supprimer l'album "${album.name}" ?`)) {
      deleteMutation.mutate(album.id)
    }
  }

  const getTypeIcon = (type: Album['type']) => {
    switch (type) {
      case 'DAILY':
        return <Calendar className="h-4 w-4" />
      case 'STAGE':
        return <MapPin className="h-4 w-4" />
      case 'ARTIST':
        return <Music className="h-4 w-4" />
      case 'OFFICIAL':
        return <FolderOpen className="h-4 w-4" />
      case 'USER_CREATED':
        return <Users className="h-4 w-4" />
      default:
        return <FolderOpen className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: Album['type']) => {
    const labels = {
      GENERAL: 'General',
      DAILY: 'Journalier',
      STAGE: 'Par scene',
      ARTIST: 'Par artiste',
      OFFICIAL: 'Officiel',
      USER_CREATED: 'Utilisateur',
    }
    return labels[type]
  }

  const getVisibilityBadge = (visibility: Album['visibility']) => {
    const styles = {
      PUBLIC: 'bg-green-100 text-green-800',
      PRIVATE: 'bg-red-100 text-red-800',
      UNLISTED: 'bg-gray-100 text-gray-800',
    }
    const labels = {
      PUBLIC: 'Public',
      PRIVATE: 'Prive',
      UNLISTED: 'Non liste',
    }
    return (
      <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', styles[visibility])}>
        {labels[visibility]}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/gallery`}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour a la galerie
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Albums</h1>
          <p className="text-muted-foreground">
            Organisez vos medias en albums thematiques
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Creer un album
        </button>
      </div>

      {/* Quick create buttons */}
      <div className="grid gap-4 sm:grid-cols-4">
        <button
          onClick={() => {
            // Create daily album
          }}
          className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left hover:bg-gray-50"
        >
          <div className="rounded-full bg-blue-100 p-2">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium">Album journalier</p>
            <p className="text-sm text-gray-500">Par jour du festival</p>
          </div>
        </button>
        <button
          onClick={() => {
            // Create stage album
          }}
          className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left hover:bg-gray-50"
        >
          <div className="rounded-full bg-purple-100 p-2">
            <MapPin className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="font-medium">Album par scene</p>
            <p className="text-sm text-gray-500">Par lieu/scene</p>
          </div>
        </button>
        <button
          onClick={() => {
            // Create artist album
          }}
          className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left hover:bg-gray-50"
        >
          <div className="rounded-full bg-green-100 p-2">
            <Music className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium">Album artiste</p>
            <p className="text-sm text-gray-500">Par artiste/groupe</p>
          </div>
        </button>
        <button
          onClick={() => {
            // Create official album
          }}
          className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left hover:bg-gray-50"
        >
          <div className="rounded-full bg-yellow-100 p-2">
            <FolderOpen className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <p className="font-medium">Album officiel</p>
            <p className="text-sm text-gray-500">Photos officielles</p>
          </div>
        </button>
      </div>

      {/* Albums Grid */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg border bg-card">
              <div className="aspect-video animate-pulse bg-gray-200" />
              <div className="p-4">
                <div className="h-5 w-2/3 animate-pulse rounded bg-gray-200" />
                <div className="mt-2 h-4 w-full animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : albumsData?.items.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {albumsData.items.map((album) => (
            <div
              key={album.id}
              className="group overflow-hidden rounded-lg border bg-card"
            >
              {/* Cover */}
              <div className="relative aspect-video bg-gray-100">
                {album.coverUrl ? (
                  <Image
                    src={album.coverUrl}
                    alt={album.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <FolderOpen className="h-16 w-16 text-gray-300" />
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                  <Link
                    href={`/festivals/${festivalId}/gallery/albums/${album.id}`}
                    className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium"
                  >
                    <Eye className="h-4 w-4" />
                    Voir
                  </Link>
                </div>

                {/* Type badge */}
                <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-xs font-medium">
                  {getTypeIcon(album.type)}
                  {getTypeLabel(album.type)}
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{album.name}</h3>
                    {album.description && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {album.description}
                      </p>
                    )}
                  </div>
                  <div className="relative">
                    <button className="rounded p-1 hover:bg-gray-100">
                      <MoreVertical className="h-5 w-5 text-gray-400" />
                    </button>
                    {/* Dropdown menu would go here */}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <ImageIcon className="h-4 w-4" />
                    {album.itemCount} medias
                  </div>
                  {getVisibilityBadge(album.visibility)}
                </div>

                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-gray-400">
                    Cree le {formatDateTime(album.createdAt)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingAlbum(album)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(album)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16">
          <FolderOpen className="h-16 w-16 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium">Aucun album</h3>
          <p className="mt-1 text-gray-500">
            Creez votre premier album pour organiser vos medias
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Creer un album
          </button>
        </div>
      )}

      {/* Create/Edit Modal would go here */}
    </div>
  )
}
