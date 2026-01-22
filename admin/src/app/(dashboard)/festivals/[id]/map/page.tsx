'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Map,
  MapPin,
  Layers,
  Settings,
  Plus,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { mapApi, MapConfig, POI, Zone } from '@/lib/api/map'
import MapEditor from '@/components/map/MapEditor'

const poiTypeLabels: Record<string, string> = {
  STAGE: 'Scenes',
  BAR: 'Bars',
  FOOD: 'Restauration',
  TOILET: 'Toilettes',
  FIRST_AID: 'Secours',
  ENTRANCE: 'Entrees',
  EXIT: 'Sorties',
  CHARGING: 'Recharge',
  CAMPING: 'Camping',
  VIP: 'VIP',
  INFO: 'Info',
  ATM: 'Distributeurs',
  PARKING: 'Parking',
  MERCH: 'Boutique',
  SECURITY: 'Securite',
}

const poiTypeColors: Record<string, string> = {
  STAGE: '#8B5CF6',
  BAR: '#EAB308',
  FOOD: '#F97316',
  TOILET: '#3B82F6',
  FIRST_AID: '#EF4444',
  ENTRANCE: '#22C55E',
  EXIT: '#22C55E',
  CHARGING: '#84CC16',
  CAMPING: '#14B8A6',
  VIP: '#A855F7',
  INFO: '#06B6D4',
  ATM: '#0EA5E9',
  PARKING: '#6B7280',
  MERCH: '#EC4899',
  SECURITY: '#F59E0B',
}

export default function MapEditorPage() {
  const params = useParams()
  const festivalId = params.id as string
  const queryClient = useQueryClient()

  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [showZones, setShowZones] = useState(true)
  const [showPOIs, setShowPOIs] = useState(true)
  const [activeTab, setActiveTab] = useState<'pois' | 'zones' | 'settings'>('pois')

  // Fetch map data
  const { data: mapData, isLoading, error, refetch } = useQuery({
    queryKey: ['map', festivalId],
    queryFn: () => mapApi.getFullMap(festivalId),
  })

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: (config: Partial<MapConfig>) =>
      mapApi.updateConfig(festivalId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map', festivalId] })
    },
  })

  // Count POIs by type
  const poiCounts = mapData?.pois?.reduce((acc, poi) => {
    acc[poi.type] = (acc[poi.type] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  // Group POIs by type
  const poisByType = mapData?.pois?.reduce((acc, poi) => {
    if (!acc[poi.type]) acc[poi.type] = []
    acc[poi.type].push(poi)
    return acc
  }, {} as Record<string, POI[]>) || {}

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-500">Chargement de la carte...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900">Erreur</h2>
          <p className="text-gray-500">Impossible de charger les donnees de la carte</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 overflow-y-auto border-r bg-white">
        {/* Header */}
        <div className="border-b p-4">
          <h1 className="text-xl font-bold text-gray-900">Editeur de carte</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez les points d&apos;interet et les zones
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 border-b p-4">
          <div className="rounded-lg bg-indigo-50 p-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              <span className="text-2xl font-bold text-indigo-600">
                {mapData?.pois?.length || 0}
              </span>
            </div>
            <p className="mt-1 text-xs text-indigo-600">Points d&apos;interet</p>
          </div>
          <div className="rounded-lg bg-purple-50 p-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-600" />
              <span className="text-2xl font-bold text-purple-600">
                {mapData?.zones?.length || 0}
              </span>
            </div>
            <p className="mt-1 text-xs text-purple-600">Zones</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('pois')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'pois'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            POIs
          </button>
          <button
            onClick={() => setActiveTab('zones')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'zones'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Zones
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'settings'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Config
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'pois' && (
            <div className="space-y-4">
              {/* Add POI button */}
              <Link
                href={`/festivals/${festivalId}/map/pois?action=new`}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-primary hover:text-primary"
              >
                <Plus className="h-5 w-5" />
                Ajouter un POI
              </Link>

              {/* Visibility toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Afficher les POIs
                </span>
                <button
                  onClick={() => setShowPOIs(!showPOIs)}
                  className={`rounded-full p-1 ${
                    showPOIs ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {showPOIs ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>

              {/* POIs by type */}
              <div className="space-y-2">
                {Object.entries(poisByType).map(([type, pois]) => (
                  <div key={type} className="rounded-lg border">
                    <Link
                      href={`/festivals/${festivalId}/map/pois?type=${type}`}
                      className="flex items-center justify-between p-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: poiTypeColors[type] || '#6B7280' }}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {poiTypeLabels[type] || type}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {pois.length}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </Link>
                  </div>
                ))}
              </div>

              {/* Link to full POI management */}
              <Link
                href={`/festivals/${festivalId}/map/pois`}
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              >
                Voir tous les POIs
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {activeTab === 'zones' && (
            <div className="space-y-4">
              {/* Add Zone button */}
              <button className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-primary hover:text-primary">
                <Plus className="h-5 w-5" />
                Ajouter une zone
              </button>

              {/* Visibility toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Afficher les zones
                </span>
                <button
                  onClick={() => setShowZones(!showZones)}
                  className={`rounded-full p-1 ${
                    showZones ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {showZones ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>

              {/* Zones list */}
              <div className="space-y-2">
                {mapData?.zones?.map((zone) => (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZone(zone)}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      selectedZone?.id === zone.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-4 w-4 rounded"
                        style={{ backgroundColor: zone.fillColor || zone.color }}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{zone.name}</p>
                        <p className="text-xs text-gray-500">{zone.type}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {(!mapData?.zones || mapData.zones.length === 0) && (
                  <p className="text-center text-sm text-gray-500 py-4">
                    Aucune zone definie
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Configuration de la carte</h3>

              {mapData?.config ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Centre (Latitude)
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={mapData.config.centerLat}
                      readOnly
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Centre (Longitude)
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={mapData.config.centerLng}
                      readOnly
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Zoom par defaut
                    </label>
                    <input
                      type="number"
                      value={mapData.config.defaultZoom}
                      readOnly
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Zoom min
                      </label>
                      <input
                        type="number"
                        value={mapData.config.minZoom}
                        readOnly
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Zoom max
                      </label>
                      <input
                        type="number"
                        value={mapData.config.maxZoom}
                        readOnly
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <button className="w-full rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90">
                    <Settings className="mr-2 inline-block h-4 w-4" />
                    Modifier la configuration
                  </button>
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 p-4 text-amber-800">
                  <p className="text-sm">
                    Aucune configuration de carte. Cliquez sur la carte pour definir le
                    centre.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapEditor
          festivalId={festivalId}
          config={mapData?.config || null}
          pois={showPOIs ? mapData?.pois || [] : []}
          zones={showZones ? mapData?.zones || [] : []}
          selectedPOI={selectedPOI}
          selectedZone={selectedZone}
          onSelectPOI={setSelectedPOI}
          onSelectZone={setSelectedZone}
          onConfigChange={(config) => saveConfigMutation.mutate(config)}
        />
      </div>
    </div>
  )
}
