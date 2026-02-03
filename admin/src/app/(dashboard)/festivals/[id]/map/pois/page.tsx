'use client'

import { useState, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MapPin,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  Edit,
  Trash2,
  X,
  ChevronDown,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
  Check,
} from 'lucide-react'
import { mapApi, POI, POIType } from '@/lib/api/map'
import POIForm from '@/components/map/POIForm'

const poiTypes: { value: POIType; label: string; color: string }[] = [
  { value: 'STAGE', label: 'Scene', color: '#8B5CF6' },
  { value: 'BAR', label: 'Bar', color: '#EAB308' },
  { value: 'FOOD', label: 'Restauration', color: '#F97316' },
  { value: 'TOILET', label: 'Toilettes', color: '#3B82F6' },
  { value: 'FIRST_AID', label: 'Premiers secours', color: '#EF4444' },
  { value: 'ENTRANCE', label: 'Entree', color: '#22C55E' },
  { value: 'EXIT', label: 'Sortie', color: '#22C55E' },
  { value: 'CHARGING', label: 'Recharge', color: '#84CC16' },
  { value: 'CAMPING', label: 'Camping', color: '#14B8A6' },
  { value: 'VIP', label: 'VIP', color: '#A855F7' },
  { value: 'INFO', label: 'Information', color: '#06B6D4' },
  { value: 'ATM', label: 'Distributeur', color: '#0EA5E9' },
  { value: 'PARKING', label: 'Parking', color: '#6B7280' },
  { value: 'MERCH', label: 'Boutique', color: '#EC4899' },
  { value: 'SECURITY', label: 'Securite', color: '#F59E0B' },
  { value: 'WATER', label: 'Point d\'eau', color: '#3B82F6' },
  { value: 'SMOKING', label: 'Zone fumeur', color: '#78716C' },
  { value: 'LOCKERS', label: 'Consignes', color: '#6366F1' },
  { value: 'LOST_FOUND', label: 'Objets trouves', color: '#8B5CF6' },
  { value: 'ACCESSIBILITY', label: 'Accessibilite', color: '#6366F1' },
  { value: 'OTHER', label: 'Autre', color: '#9CA3AF' },
]

const getTypeInfo = (type: string) => {
  return poiTypes.find((t) => t.value === type) || { label: type, color: '#9CA3AF' }
}

export default function POIsManagementPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const festivalId = params.id as string

  const initialType = searchParams.get('type') as POIType | null
  const showNewForm = searchParams.get('action') === 'new'

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<POIType | 'ALL'>(initialType || 'ALL')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [editingPOI, setEditingPOI] = useState<POI | null>(null)
  const [showForm, setShowForm] = useState(showNewForm)
  const [selectedPOIs, setSelectedPOIs] = useState<string[]>([])

  // Fetch POIs
  const { data: pois, isLoading, error, refetch } = useQuery({
    queryKey: ['pois', festivalId, selectedType],
    queryFn: () =>
      mapApi.listPOIs(festivalId, {
        type: selectedType === 'ALL' ? undefined : selectedType,
      }),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (poiId: string) => mapApi.deletePOI(festivalId, poiId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pois', festivalId] })
      queryClient.invalidateQueries({ queryKey: ['map', festivalId] })
    },
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (poiIds: string[]) => {
      await Promise.all(poiIds.map((id) => mapApi.deletePOI(festivalId, id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pois', festivalId] })
      queryClient.invalidateQueries({ queryKey: ['map', festivalId] })
      setSelectedPOIs([])
    },
  })

  // Filter POIs by search query
  const filteredPOIs = useMemo(() => {
    if (!pois) return []
    if (!searchQuery) return pois

    const query = searchQuery.toLowerCase()
    return pois.filter(
      (poi) =>
        poi.name.toLowerCase().includes(query) ||
        poi.description?.toLowerCase().includes(query)
    )
  }, [pois, searchQuery])

  // Stats
  const stats = useMemo(() => {
    if (!pois) return { total: 0, byType: {} }
    const byType: Record<string, number> = {}
    pois.forEach((poi) => {
      byType[poi.type] = (byType[poi.type] || 0) + 1
    })
    return { total: pois.length, byType }
  }, [pois])

  const handleEditPOI = (poi: POI) => {
    setEditingPOI(poi)
    setShowForm(true)
  }

  const handleDeletePOI = (poiId: string) => {
    if (confirm('Etes-vous sur de vouloir supprimer ce POI ?')) {
      deleteMutation.mutate(poiId)
    }
  }

  const handleBulkDelete = () => {
    if (
      selectedPOIs.length > 0 &&
      confirm(`Supprimer ${selectedPOIs.length} POI(s) ?`)
    ) {
      bulkDeleteMutation.mutate(selectedPOIs)
    }
  }

  const toggleSelectPOI = (poiId: string) => {
    setSelectedPOIs((prev) =>
      prev.includes(poiId) ? prev.filter((id) => id !== poiId) : [...prev, poiId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedPOIs.length === filteredPOIs.length) {
      setSelectedPOIs([])
    } else {
      setSelectedPOIs(filteredPOIs.map((poi) => poi.id))
    }
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingPOI(null)
    router.push(`/festivals/${festivalId}/map/pois`)
  }

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['pois', festivalId] })
    queryClient.invalidateQueries({ queryKey: ['map', festivalId] })
    handleFormClose()
  }

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-gray-500">Erreur lors du chargement des POIs</p>
        <button
          onClick={() => refetch()}
          className="rounded-lg bg-primary px-4 py-2 text-white"
        >
          Reessayer
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/festivals/${festivalId}/map`}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-5 w-5" />
          Retour
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Points d&apos;interet</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez les POIs du festival
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
        >
          <Plus className="h-5 w-5" />
          Nouveau POI
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Total POIs</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Scenes</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">
            {stats.byType['STAGE'] || 0}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Bars & Food</p>
          <p className="mt-1 text-2xl font-bold text-orange-600">
            {(stats.byType['BAR'] || 0) + (stats.byType['FOOD'] || 0)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Services</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {(stats.byType['TOILET'] || 0) +
              (stats.byType['FIRST_AID'] || 0) +
              (stats.byType['INFO'] || 0)}
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
            placeholder="Rechercher un POI..."
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
          {/* Bulk actions */}
          {selectedPOIs.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {selectedPOIs.length} selectionne(s)
              </span>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 hover:bg-red-200"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            </div>
          )}

          {/* Type filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                selectedType !== 'ALL'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              {selectedType === 'ALL' ? 'Type' : getTypeInfo(selectedType).label}
              <ChevronDown className="h-4 w-4" />
            </button>

            {filterMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setFilterMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-56 max-h-80 overflow-y-auto rounded-lg border bg-white p-2 shadow-lg">
                  <button
                    onClick={() => {
                      setSelectedType('ALL')
                      setFilterMenuOpen(false)
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      selectedType === 'ALL'
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Tous les types
                  </button>
                  {poiTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setSelectedType(type.value)
                        setFilterMenuOpen(false)
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                        selectedType === type.value
                          ? 'bg-primary/10 text-primary'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: type.color }}
                      />
                      {type.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex rounded-lg border border-gray-300">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-l-lg p-2 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`rounded-r-lg p-2 transition-colors ${
                viewMode === 'table'
                  ? 'bg-primary text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Active filter */}
      {selectedType !== 'ALL' && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
            {getTypeInfo(selectedType).label}
            <button
              onClick={() => setSelectedType('ALL')}
              className="ml-2 hover:text-primary/70"
            >
              <X className="inline-block h-4 w-4" />
            </button>
          </span>
        </div>
      )}

      {/* Empty state */}
      {filteredPOIs.length === 0 && (
        <div className="rounded-lg border bg-white p-12 text-center">
          <MapPin className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {searchQuery || selectedType !== 'ALL' ? 'Aucun POI trouve' : 'Aucun POI'}
          </h3>
          <p className="mt-2 text-gray-500">
            {searchQuery || selectedType !== 'ALL'
              ? 'Essayez de modifier vos filtres'
              : 'Commencez par ajouter des points d\'interet'}
          </p>
          {!searchQuery && selectedType === 'ALL' && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white"
            >
              <Plus className="h-5 w-5" />
              Ajouter un POI
            </button>
          )}
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && filteredPOIs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPOIs.map((poi) => {
            const typeInfo = getTypeInfo(poi.type)
            return (
              <div
                key={poi.id}
                className={`rounded-lg border bg-white p-4 transition-shadow hover:shadow-md ${
                  selectedPOIs.includes(poi.id) ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleSelectPOI(poi.id)}
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        selectedPOIs.includes(poi.id)
                          ? 'border-primary bg-primary text-white'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedPOIs.includes(poi.id) && <Check className="h-3 w-3" />}
                    </button>
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: typeInfo.color + '20' }}
                    >
                      <MapPin className="h-5 w-5" style={{ color: typeInfo.color }} />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditPOI(poi)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePOI(poi.id)}
                      className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <h3 className="mt-3 font-medium text-gray-900">{poi.name}</h3>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {poi.description || 'Pas de description'}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: typeInfo.color + '20',
                      color: typeInfo.color,
                    }}
                  >
                    {typeInfo.label}
                  </span>
                  {poi.isAccessible && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      PMR
                    </span>
                  )}
                  {poi.isFeatured && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                      Mis en avant
                    </span>
                  )}
                </div>

                <div className="mt-3 text-xs text-gray-400">
                  {poi.latitude.toFixed(6)}, {poi.longitude.toFixed(6)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table view */}
      {viewMode === 'table' && filteredPOIs.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedPOIs.length === filteredPOIs.length &&
                      filteredPOIs.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Nom
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Position
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPOIs.map((poi) => {
                const typeInfo = getTypeInfo(poi.type)
                return (
                  <tr key={poi.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedPOIs.includes(poi.id)}
                        onChange={() => toggleSelectPOI(poi.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded"
                          style={{ backgroundColor: typeInfo.color + '20' }}
                        >
                          <MapPin className="h-4 w-4" style={{ color: typeInfo.color }} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{poi.name}</p>
                          {poi.description && (
                            <p className="text-sm text-gray-500 truncate max-w-xs">
                              {poi.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: typeInfo.color + '20',
                          color: typeInfo.color,
                        }}
                      >
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          poi.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-700'
                            : poi.status === 'CLOSED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {poi.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {poi.latitude.toFixed(4)}, {poi.longitude.toFixed(4)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditPOI(poi)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePOI(poi.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Results count */}
      {filteredPOIs.length > 0 && (
        <p className="text-sm text-gray-500">
          {filteredPOIs.length} POI{filteredPOIs.length > 1 ? 's' : ''} affiche
          {filteredPOIs.length > 1 ? 's' : ''}
          {searchQuery && ` pour "${searchQuery}"`}
        </p>
      )}

      {/* POI Form Modal */}
      {showForm && (
        <POIForm
          festivalId={festivalId}
          poi={editingPOI}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  )
}
