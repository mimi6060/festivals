'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { standsApi, Stand, StandCategory } from '@/lib/api/stands'
import { StandCard, StandCardSkeleton } from '@/components/stands/StandCard'
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Filter,
  X,
  Beer,
  UtensilsCrossed,
  ShoppingBag,
  Wallet,
  Info,
  Heart,
  Shield,
  ChevronDown,
} from 'lucide-react'

const categories: { value: StandCategory | 'ALL'; label: string; icon: typeof Beer }[] = [
  { value: 'ALL', label: 'Tous', icon: LayoutGrid },
  { value: 'BAR', label: 'Bar', icon: Beer },
  { value: 'FOOD', label: 'Restauration', icon: UtensilsCrossed },
  { value: 'MERCHANDISE', label: 'Boutique', icon: ShoppingBag },
  { value: 'RECHARGE', label: 'Recharge', icon: Wallet },
  { value: 'INFO', label: 'Information', icon: Info },
  { value: 'MEDICAL', label: 'Medical', icon: Heart },
  { value: 'SECURITY', label: 'Securite', icon: Shield },
]

export default function StandsListPage() {
  const params = useParams()
  const festivalId = params.id as string
  const queryClient = useQueryClient()

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<StandCategory | 'ALL'>('ALL')
  const [showActiveOnly, setShowActiveOnly] = useState(false)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)

  // Fetch stands
  const { data, isLoading, error } = useQuery({
    queryKey: ['stands', festivalId, selectedCategory, showActiveOnly],
    queryFn: () =>
      standsApi.list(festivalId, {
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        isActive: showActiveOnly ? true : undefined,
      }),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (standId: string) => standsApi.delete(festivalId, standId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stands', festivalId] })
    },
  })

  // Filter stands by search query
  const filteredStands = data?.stands.filter((stand) =>
    stand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stand.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  // Stats
  const stats = {
    total: data?.stands.length || 0,
    active: data?.stands.filter((s) => s.isActive).length || 0,
    byCategory: categories.slice(1).map((cat) => ({
      ...cat,
      count: data?.stands.filter((s) => s.category === cat.value).length || 0,
    })),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stands</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez les stands et points de vente du festival
          </p>
        </div>
        <Link
          href={`/festivals/${festivalId}/stands/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
        >
          <Plus className="h-5 w-5" />
          Nouveau stand
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Total stands</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Stands actifs</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Bars & Restauration</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {(stats.byCategory.find((c) => c.value === 'BAR')?.count || 0) +
              (stats.byCategory.find((c) => c.value === 'FOOD')?.count || 0)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Points de recharge</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {stats.byCategory.find((c) => c.value === 'RECHARGE')?.count || 0}
          </p>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col gap-4 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un stand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border py-2 pl-10 pr-4 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Category filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                selectedCategory !== 'ALL' || showActiveOnly
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Filter className="h-4 w-4" />
              Filtres
              {(selectedCategory !== 'ALL' || showActiveOnly) && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                  {(selectedCategory !== 'ALL' ? 1 : 0) + (showActiveOnly ? 1 : 0)}
                </span>
              )}
              <ChevronDown className="h-4 w-4" />
            </button>

            {filterMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setFilterMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border bg-white p-4 shadow-lg">
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Categorie
                    </label>
                    <div className="space-y-1">
                      {categories.map((category) => {
                        const Icon = category.icon
                        return (
                          <button
                            key={category.value}
                            onClick={() => setSelectedCategory(category.value)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                              selectedCategory === category.value
                                ? 'bg-primary/10 text-primary'
                                : 'text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {category.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showActiveOnly}
                        onChange={(e) => setShowActiveOnly(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">Actifs uniquement</span>
                    </label>
                  </div>

                  {(selectedCategory !== 'ALL' || showActiveOnly) && (
                    <button
                      onClick={() => {
                        setSelectedCategory('ALL')
                        setShowActiveOnly(false)
                      }}
                      className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Reinitialiser les filtres
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex rounded-lg border border-gray-300">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-l-lg p-2 transition-colors',
                viewMode === 'grid'
                  ? 'bg-primary text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              )}
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'rounded-r-lg p-2 transition-colors',
                viewMode === 'table'
                  ? 'bg-primary text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              )}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Active filters display */}
      {(selectedCategory !== 'ALL' || showActiveOnly) && (
        <div className="flex flex-wrap gap-2">
          {selectedCategory !== 'ALL' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
              {categories.find((c) => c.value === selectedCategory)?.label}
              <button
                onClick={() => setSelectedCategory('ALL')}
                className="ml-1 hover:text-primary/70"
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          )}
          {showActiveOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
              Actifs uniquement
              <button
                onClick={() => setShowActiveOnly(false)}
                className="ml-1 hover:text-green-500"
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Erreur lors du chargement des stands</p>
          <p className="mt-1 text-sm">{(error as Error).message}</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <StandCardSkeleton key={i} viewMode="grid" />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Stand</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Categorie</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Emplacement</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <StandCardSkeleton key={i} viewMode="table" />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredStands.length === 0 && (
        <div className="rounded-lg border bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <ShoppingBag className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            {searchQuery || selectedCategory !== 'ALL'
              ? 'Aucun stand trouve'
              : 'Aucun stand'}
          </h3>
          <p className="mb-6 text-gray-500">
            {searchQuery || selectedCategory !== 'ALL'
              ? 'Essayez de modifier vos filtres de recherche'
              : 'Commencez par creer votre premier stand'}
          </p>
          {!searchQuery && selectedCategory === 'ALL' && (
            <Link
              href={`/festivals/${festivalId}/stands/new`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
            >
              <Plus className="h-5 w-5" />
              Creer un stand
            </Link>
          )}
        </div>
      )}

      {/* Stands grid/table */}
      {!isLoading && !error && filteredStands.length > 0 && (
        viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredStands.map((stand) => (
              <StandCard
                key={stand.id}
                stand={stand}
                festivalId={festivalId}
                onDelete={(standId) => deleteMutation.mutate(standId)}
                viewMode="grid"
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Stand</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Categorie</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Emplacement</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStands.map((stand) => (
                  <StandCard
                    key={stand.id}
                    stand={stand}
                    festivalId={festivalId}
                    onDelete={(standId) => deleteMutation.mutate(standId)}
                    viewMode="table"
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Results count */}
      {!isLoading && filteredStands.length > 0 && (
        <p className="text-sm text-gray-500">
          {filteredStands.length} stand{filteredStands.length > 1 ? 's' : ''} affiche{filteredStands.length > 1 ? 's' : ''}
          {searchQuery && ` pour "${searchQuery}"`}
        </p>
      )}
    </div>
  )
}
