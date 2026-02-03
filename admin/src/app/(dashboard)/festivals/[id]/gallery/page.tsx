'use client'

import { useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import {
  ImageIcon,
  VideoIcon,
  Upload,
  FolderOpen,
  Shield,
  Eye,
  Heart,
  MoreVertical,
  Trash2,
  Download,
  Share2,
  Filter,
  Search,
  Grid,
  List,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react'
import { formatDateTime, formatNumber, cn } from '@/lib/utils'

interface MediaItem {
  id: string
  type: 'PHOTO' | 'VIDEO'
  url: string
  thumbnailUrl?: string
  originalName: string
  size: number
  uploaderName?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'
  viewCount: number
  likeCount: number
  tags: string[]
  metadata: {
    artistName?: string
    stageName?: string
    day?: number
  }
  createdAt: string
}

interface Album {
  id: string
  name: string
  itemCount: number
  coverUrl?: string
}

export default function FestivalGalleryPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const festivalId = params.id as string

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Fetch gallery items
  const { data: galleryData, isLoading: galleryLoading, refetch } = useQuery({
    queryKey: ['admin-gallery', festivalId, filterType, filterStatus],
    queryFn: async () => {
      // In real app, call API
      return {
        items: [] as MediaItem[],
        total: 0,
      }
    },
  })

  // Fetch albums
  const { data: albumsData } = useQuery({
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
    mutationFn: async (ids: string[]) => {
      // In real app, call API
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery'] })
      setSelectedItems([])
    },
  })

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === galleryData?.items.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(galleryData?.items.map((i) => i.id) || [])
    }
  }

  const handleDelete = () => {
    if (selectedItems.length === 0) return
    if (confirm(`Supprimer ${selectedItems.length} element(s) ?`)) {
      deleteMutation.mutate(selectedItems)
    }
  }

  const getStatusBadge = (status: MediaItem['status']) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      FLAGGED: 'bg-orange-100 text-orange-800',
    }
    const labels = {
      PENDING: 'En attente',
      APPROVED: 'Approuve',
      REJECTED: 'Rejete',
      FLAGGED: 'Signale',
    }
    return (
      <span className={cn('px-2 py-1 text-xs font-medium rounded-full', styles[status])}>
        {labels[status]}
      </span>
    )
  }

  const pendingCount = galleryData?.items.filter((i) => i.status === 'PENDING').length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Galerie Photos</h1>
          <p className="text-muted-foreground">
            Gerez les photos et videos du festival
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/festivals/${festivalId}/gallery/moderation`}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
              pendingCount > 0
                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <Shield className="h-4 w-4" />
            Moderation
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-yellow-600 px-2 py-0.5 text-xs text-white">
                {pendingCount}
              </span>
            )}
          </Link>
          <Link
            href={`/festivals/${festivalId}/gallery/albums`}
            className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            <FolderOpen className="h-4 w-4" />
            Albums ({albumsData?.total || 0})
          </Link>
          <button className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">
            <Upload className="h-4 w-4" />
            Uploader
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <ImageIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Photos</p>
              <p className="text-2xl font-bold">
                {galleryData?.items.filter((i) => i.type === 'PHOTO').length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <VideoIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Videos</p>
              <p className="text-2xl font-bold">
                {galleryData?.items.filter((i) => i.type === 'VIDEO').length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2">
              <Eye className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vues totales</p>
              <p className="text-2xl font-bold">
                {formatNumber(
                  galleryData?.items.reduce((sum, i) => sum + i.viewCount, 0) || 0
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2">
              <Heart className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Likes totaux</p>
              <p className="text-2xl font-bold">
                {formatNumber(
                  galleryData?.items.reduce((sum, i) => sum + i.likeCount, 0) || 0
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-md border py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filters */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Tous les types</option>
            <option value="PHOTO">Photos</option>
            <option value="VIDEO">Videos</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="APPROVED">Approuves</option>
            <option value="REJECTED">Rejetes</option>
          </select>

          <button
            onClick={() => refetch()}
            className="rounded-md border p-2 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <>
              <span className="text-sm text-gray-500">
                {selectedItems.length} selectionne(s)
              </span>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-200"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            </>
          )}

          {/* View mode toggle */}
          <div className="flex rounded-md border">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2',
                viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'
              )}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2',
                viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Gallery Content */}
      {galleryLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : galleryData?.items.length ? (
        viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {galleryData.items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'group relative overflow-hidden rounded-lg border bg-card',
                  selectedItems.includes(item.id) && 'ring-2 ring-primary'
                )}
              >
                {/* Selection checkbox */}
                <button
                  onClick={() => toggleSelectItem(item.id)}
                  className="absolute left-2 top-2 z-10 rounded bg-white/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  {selectedItems.includes(item.id) ? (
                    <CheckSquare className="h-5 w-5 text-primary" />
                  ) : (
                    <Square className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {/* Image */}
                <div className="aspect-square bg-gray-100">
                  {item.thumbnailUrl || item.url ? (
                    <Image
                      src={item.thumbnailUrl || item.url}
                      alt={item.originalName}
                      width={300}
                      height={300}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      {item.type === 'VIDEO' ? (
                        <VideoIcon className="h-12 w-12 text-gray-300" />
                      ) : (
                        <ImageIcon className="h-12 w-12 text-gray-300" />
                      )}
                    </div>
                  )}
                </div>

                {/* Type badge */}
                {item.type === 'VIDEO' && (
                  <div className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5">
                    <VideoIcon className="h-4 w-4 text-white" />
                  </div>
                )}

                {/* Info overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span className="text-xs">{item.viewCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        <span className="text-xs">{item.likeCount}</span>
                      </div>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-3 text-left">
                    <button onClick={toggleSelectAll}>
                      {selectedItems.length === galleryData.items.length ? (
                        <CheckSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="p-3 text-left text-sm font-medium">Apercu</th>
                  <th className="p-3 text-left text-sm font-medium">Nom</th>
                  <th className="p-3 text-left text-sm font-medium">Type</th>
                  <th className="p-3 text-left text-sm font-medium">Statut</th>
                  <th className="p-3 text-left text-sm font-medium">Stats</th>
                  <th className="p-3 text-left text-sm font-medium">Date</th>
                  <th className="p-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {galleryData.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="p-3">
                      <button onClick={() => toggleSelectItem(item.id)}>
                        {selectedItems.includes(item.id) ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="h-12 w-12 overflow-hidden rounded bg-gray-100">
                        {item.thumbnailUrl || item.url ? (
                          <Image
                            src={item.thumbnailUrl || item.url}
                            alt={item.originalName}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{item.originalName}</p>
                      {item.uploaderName && (
                        <p className="text-sm text-gray-500">par {item.uploaderName}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1 text-sm">
                        {item.type === 'VIDEO' ? (
                          <VideoIcon className="h-4 w-4" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                        {item.type}
                      </span>
                    </td>
                    <td className="p-3">{getStatusBadge(item.status)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {item.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-4 w-4" />
                          {item.likeCount}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-500">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="p-3">
                      <button className="rounded p-1 hover:bg-gray-100">
                        <MoreVertical className="h-5 w-5 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16">
          <ImageIcon className="h-16 w-16 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium">Aucun media</h3>
          <p className="mt-1 text-gray-500">
            Commencez par uploader des photos ou videos
          </p>
          <button className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
            <Upload className="h-4 w-4" />
            Uploader des medias
          </button>
        </div>
      )}
    </div>
  )
}
