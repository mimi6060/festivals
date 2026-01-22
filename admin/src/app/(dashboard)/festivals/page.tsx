'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Calendar, MapPin, MoreVertical, Eye, Settings, Archive } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { festivalsApi, FestivalListParams } from '@/lib/api/festivals'
import { Festival } from '@/types/api'
import { useFestivalStore } from '@/stores/festivalStore'

const statusConfig: Record<Festival['status'], { label: string; className: string }> = {
  DRAFT: {
    label: 'Brouillon',
    className: 'bg-gray-100 text-gray-800',
  },
  ACTIVE: {
    label: 'Actif',
    className: 'bg-green-100 text-green-800',
  },
  COMPLETED: {
    label: 'Terminé',
    className: 'bg-blue-100 text-blue-800',
  },
  ARCHIVED: {
    label: 'Archivé',
    className: 'bg-red-100 text-red-800',
  },
}

function StatusBadge({ status }: { status: Festival['status'] }) {
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  )
}

export default function FestivalsPage() {
  const router = useRouter()
  const { festivals, setFestivals, setCurrentFestival } = useFestivalStore()
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Festival['status'] | ''>('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const perPage = 10

  useEffect(() => {
    loadFestivals()
  }, [page, statusFilter])

  const loadFestivals = async () => {
    setIsLoading(true)
    try {
      const params: FestivalListParams = {
        page,
        perPage,
        sortBy: 'startDate',
        sortOrder: 'desc',
      }
      if (statusFilter) {
        params.status = statusFilter
      }
      if (searchQuery) {
        params.search = searchQuery
      }

      const response = await festivalsApi.list(params)
      setFestivals(response.festivals)
      setTotal(response.total)
    } catch (error) {
      console.error('Failed to load festivals:', error)
      // Mock data for development
      setFestivals([
        {
          id: '1',
          name: 'Summer Fest 2026',
          slug: 'summer-fest-2026',
          description: 'The biggest summer festival',
          startDate: '2026-06-15',
          endDate: '2026-06-17',
          location: 'Brussels, Belgium',
          timezone: 'Europe/Brussels',
          currencyName: 'Griffons',
          exchangeRate: 0.1,
          status: 'ACTIVE',
          settings: {},
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Winter Beats 2025',
          slug: 'winter-beats-2025',
          description: 'Electronic music festival',
          startDate: '2025-12-20',
          endDate: '2025-12-22',
          location: 'Paris, France',
          timezone: 'Europe/Paris',
          currencyName: 'Tokens',
          exchangeRate: 0.5,
          status: 'COMPLETED',
          settings: {},
          createdAt: '2025-06-01T00:00:00Z',
          updatedAt: '2025-12-23T00:00:00Z',
        },
        {
          id: '3',
          name: 'Spring Garden 2026',
          slug: 'spring-garden-2026',
          description: 'Nature-inspired music experience',
          startDate: '2026-04-10',
          endDate: '2026-04-12',
          location: 'Amsterdam, Netherlands',
          timezone: 'Europe/Amsterdam',
          currencyName: 'Petals',
          exchangeRate: 0.25,
          status: 'DRAFT',
          settings: {},
          createdAt: '2026-01-15T00:00:00Z',
          updatedAt: '2026-01-15T00:00:00Z',
        },
      ])
      setTotal(3)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadFestivals()
  }

  const handleFestivalClick = (festival: Festival) => {
    setCurrentFestival(festival)
    router.push(`/festivals/${festival.id}`)
  }

  const handleArchive = async (festivalId: string) => {
    try {
      await festivalsApi.archive(festivalId)
      loadFestivals()
    } catch (error) {
      console.error('Failed to archive festival:', error)
    }
    setOpenMenuId(null)
  }

  const filteredFestivals = festivals.filter((festival) => {
    const matchesSearch =
      !searchQuery ||
      festival.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      festival.location.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || festival.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Festivals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez vos festivals et événements
          </p>
        </div>
        <Link
          href="/festivals/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
        >
          <Plus className="h-5 w-5" />
          Nouveau festival
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un festival..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border pl-10 pr-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
          >
            Rechercher
          </button>
        </form>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as Festival['status'] | '')
              setPage(1)
            }}
            className="rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Tous les statuts</option>
            <option value="DRAFT">Brouillon</option>
            <option value="ACTIVE">Actif</option>
            <option value="COMPLETED">Terminé</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Festival
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Dates
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Monnaie
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  Chargement...
                </td>
              </tr>
            ) : filteredFestivals.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  Aucun festival trouvé
                </td>
              </tr>
            ) : (
              filteredFestivals.map((festival) => (
                <tr
                  key={festival.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleFestivalClick(festival)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{festival.name}</div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin className="h-3 w-3" />
                        {festival.location}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-gray-900">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {formatDate(festival.startDate)} - {formatDate(festival.endDate)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={festival.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="text-gray-900">{festival.currencyName}</div>
                      <div className="text-gray-500">
                        1 {festival.currencyName} = {festival.exchangeRate} EUR
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block text-left">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === festival.id ? null : festival.id)
                        }}
                        className="rounded p-1 hover:bg-gray-100"
                      >
                        <MoreVertical className="h-5 w-5 text-gray-400" />
                      </button>

                      {openMenuId === festival.id && (
                        <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                          <div className="py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleFestivalClick(festival)
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <Eye className="h-4 w-4" />
                              Voir le tableau de bord
                            </button>
                            <Link
                              href={`/festivals/${festival.id}/settings`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <Settings className="h-4 w-4" />
                              Paramètres
                            </Link>
                            {festival.status !== 'ARCHIVED' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleArchive(festival.id)
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                              >
                                <Archive className="h-4 w-4" />
                                Archiver
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t bg-white px-6 py-3">
            <div className="text-sm text-gray-500">
              Affichage de {(page - 1) * perPage + 1} à{' '}
              {Math.min(page * perPage, total)} sur {total} résultats
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {openMenuId && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setOpenMenuId(null)}
        />
      )}
    </div>
  )
}
