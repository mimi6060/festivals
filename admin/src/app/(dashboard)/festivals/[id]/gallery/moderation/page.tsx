'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import {
  Shield,
  ArrowLeft,
  Check,
  X,
  Flag,
  ImageIcon,
  VideoIcon,
  Eye,
  User,
  Calendar,
  MapPin,
  Music,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react'
import { formatDateTime, cn } from '@/lib/utils'

interface MediaItem {
  id: string
  type: 'PHOTO' | 'VIDEO'
  url: string
  thumbnailUrl?: string
  originalName: string
  uploaderName?: string
  uploaderId: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'
  tags: string[]
  metadata: {
    artistName?: string
    stageName?: string
    day?: number
    description?: string
  }
  createdAt: string
}

export default function ModerationPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const festivalId = params.id as string

  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'grid' | 'review'>('grid')

  // Fetch pending items
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['moderation', festivalId],
    queryFn: async () => {
      // In real app, call API
      return {
        items: [] as MediaItem[],
        total: 0,
      }
    },
  })

  // Moderate mutation
  const moderateMutation = useMutation({
    mutationFn: async ({
      ids,
      status,
    }: {
      ids: string[]
      status: 'APPROVED' | 'REJECTED' | 'FLAGGED'
    }) => {
      // In real app, call API
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation'] })
      queryClient.invalidateQueries({ queryKey: ['admin-gallery'] })
      setSelectedItems([])
    },
  })

  const handleModerate = (status: 'APPROVED' | 'REJECTED' | 'FLAGGED', ids?: string[]) => {
    const itemIds = ids || selectedItems
    if (itemIds.length === 0) return
    moderateMutation.mutate({ ids: itemIds, status })
  }

  const handleApproveAll = () => {
    if (!data?.items.length) return
    if (confirm(`Approuver tous les ${data.items.length} medias en attente ?`)) {
      moderateMutation.mutate({
        ids: data.items.map((i) => i.id),
        status: 'APPROVED',
      })
    }
  }

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === data?.items.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(data?.items.map((i) => i.id) || [])
    }
  }

  const goToNext = () => {
    if (data?.items && currentIndex < data.items.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const currentItem = data?.items[currentIndex]

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
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-yellow-100 p-2">
            <Shield className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Moderation</h1>
            <p className="text-muted-foreground">
              {data?.total || 0} medias en attente de validation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-md border">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'px-3 py-2 text-sm',
                viewMode === 'grid' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
              )}
            >
              Vue grille
            </button>
            <button
              onClick={() => setViewMode('review')}
              className={cn(
                'px-3 py-2 text-sm',
                viewMode === 'review' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
              )}
            >
              Vue review
            </button>
          </div>
          {data?.items && data.items.length > 0 && (
            <button
              onClick={handleApproveAll}
              className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Check className="h-4 w-4" />
              Tout approuver
            </button>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {selectedItems.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg border bg-blue-50 p-4">
          <span className="text-sm font-medium text-blue-700">
            {selectedItems.length} element(s) selectionne(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleModerate('APPROVED')}
              disabled={moderateMutation.isPending}
              className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {moderateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Approuver
            </button>
            <button
              onClick={() => handleModerate('REJECTED')}
              disabled={moderateMutation.isPending}
              className="flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Rejeter
            </button>
            <button
              onClick={() => handleModerate('FLAGGED')}
              disabled={moderateMutation.isPending}
              className="flex items-center gap-1 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              <Flag className="h-4 w-4" />
              Signaler
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16">
          <div className="rounded-full bg-green-100 p-4">
            <Check className="h-12 w-12 text-green-600" />
          </div>
          <h3 className="mt-4 text-lg font-medium">Tout est en ordre!</h3>
          <p className="mt-1 text-gray-500">
            Aucun media en attente de moderation
          </p>
          <Link
            href={`/festivals/${festivalId}/gallery`}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Retour a la galerie
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {data.items.map((item, index) => (
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
                className="absolute left-2 top-2 z-10 rounded bg-white/80 p-1"
              >
                {selectedItems.includes(item.id) ? (
                  <CheckSquare className="h-5 w-5 text-primary" />
                ) : (
                  <Square className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {/* Image */}
              <div
                className="aspect-square cursor-pointer bg-gray-100"
                onClick={() => {
                  setCurrentIndex(index)
                  setViewMode('review')
                }}
              >
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

              {/* Quick actions */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleModerate('APPROVED', [item.id])
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600"
                >
                  <Check className="h-5 w-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleModerate('REJECTED', [item.id])
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                >
                  <X className="h-5 w-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleModerate('FLAGGED', [item.id])
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-600"
                >
                  <Flag className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Review View */
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main image */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="relative aspect-video bg-black">
                {currentItem && (currentItem.thumbnailUrl || currentItem.url) ? (
                  <Image
                    src={currentItem.url}
                    alt={currentItem.originalName}
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="h-24 w-24 text-gray-600" />
                  </div>
                )}

                {/* Navigation */}
                <button
                  onClick={goToPrevious}
                  disabled={currentIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 disabled:opacity-30"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={goToNext}
                  disabled={!data?.items || currentIndex === data.items.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 disabled:opacity-30"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>

                {/* Counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                  {currentIndex + 1} / {data?.items.length}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-4 border-t p-4">
                <button
                  onClick={() => currentItem && handleModerate('APPROVED', [currentItem.id])}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700"
                >
                  <Check className="h-5 w-5" />
                  Approuver
                </button>
                <button
                  onClick={() => currentItem && handleModerate('REJECTED', [currentItem.id])}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-medium text-white hover:bg-red-700"
                >
                  <X className="h-5 w-5" />
                  Rejeter
                </button>
                <button
                  onClick={() => currentItem && handleModerate('FLAGGED', [currentItem.id])}
                  className="flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-3 font-medium text-white hover:bg-orange-700"
                >
                  <Flag className="h-5 w-5" />
                  Signaler
                </button>
              </div>
            </div>
          </div>

          {/* Details panel */}
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Details</h3>
              {currentItem && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500">Uploade par:</span>
                    <span className="font-medium">
                      {currentItem.uploaderName || 'Anonyme'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500">Date:</span>
                    <span>{formatDateTime(currentItem.createdAt)}</span>
                  </div>
                  {currentItem.metadata.stageName && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-500">Scene:</span>
                      <span>{currentItem.metadata.stageName}</span>
                    </div>
                  )}
                  {currentItem.metadata.artistName && (
                    <div className="flex items-center gap-2 text-sm">
                      <Music className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-500">Artiste:</span>
                      <span>{currentItem.metadata.artistName}</span>
                    </div>
                  )}
                  {currentItem.metadata.day && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-500">Jour:</span>
                      <span>Jour {currentItem.metadata.day}</span>
                    </div>
                  )}
                  {currentItem.metadata.description && (
                    <div className="border-t pt-3">
                      <p className="text-sm text-gray-500">Description:</p>
                      <p className="mt-1 text-sm">{currentItem.metadata.description}</p>
                    </div>
                  )}
                  {currentItem.tags.length > 0 && (
                    <div className="border-t pt-3">
                      <p className="text-sm text-gray-500">Tags:</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {currentItem.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Keyboard shortcuts */}
            <div className="rounded-lg border bg-gray-50 p-4">
              <h4 className="text-sm font-medium text-gray-700">
                Raccourcis clavier
              </h4>
              <div className="mt-2 space-y-1 text-sm text-gray-500">
                <p>
                  <kbd className="rounded bg-gray-200 px-1.5 py-0.5">A</kbd> Approuver
                </p>
                <p>
                  <kbd className="rounded bg-gray-200 px-1.5 py-0.5">R</kbd> Rejeter
                </p>
                <p>
                  <kbd className="rounded bg-gray-200 px-1.5 py-0.5">F</kbd> Signaler
                </p>
                <p>
                  <kbd className="rounded bg-gray-200 px-1.5 py-0.5">←</kbd>{' '}
                  <kbd className="rounded bg-gray-200 px-1.5 py-0.5">→</kbd> Navigation
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
