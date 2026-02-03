'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapConfig, POI, Zone } from '@/lib/api/map'

const DEFAULT_CENTER: [number, number] = [4.8357, 45.764] // Lyon, France
const DEFAULT_ZOOM = 16
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

interface MapEditorProps {
  festivalId: string
  config: MapConfig | null
  pois: POI[]
  zones: Zone[]
  selectedPOI: POI | null
  selectedZone: Zone | null
  onSelectPOI: (poi: POI | null) => void
  onSelectZone: (zone: Zone | null) => void
  onConfigChange: (config: Partial<MapConfig>) => void
  onPOIMove?: (poiId: string, lat: number, lng: number) => void
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
  WATER: '#3B82F6',
  SMOKING: '#78716C',
  LOCKERS: '#6366F1',
  LOST_FOUND: '#8B5CF6',
  ACCESSIBILITY: '#6366F1',
  OTHER: '#9CA3AF',
}

export default function MapEditor({
  festivalId,
  config,
  pois,
  zones,
  selectedPOI,
  selectedZone,
  onSelectPOI,
  onSelectZone,
  onConfigChange,
  onPOIMove,
}: MapEditorProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map())
  const [mapLoaded, setMapLoaded] = useState(false)
  const [cursorPosition, setCursorPosition] = useState<{ lat: number; lng: number } | null>(
    null
  )

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    const center: [number, number] = config
      ? [config.centerLng, config.centerLat]
      : DEFAULT_CENTER

    const zoom = config?.defaultZoom || DEFAULT_ZOOM

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: config?.styleUrl || MAP_STYLE,
      center,
      zoom,
      minZoom: config?.minZoom || 12,
      maxZoom: config?.maxZoom || 20,
    })

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    // Add scale control
    map.current.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
      'bottom-left'
    )

    // Track cursor position
    map.current.on('mousemove', (e) => {
      setCursorPosition({
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
      })
    })

    map.current.on('load', () => {
      setMapLoaded(true)
    })

    // Cleanup
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Update map config
  useEffect(() => {
    if (!map.current || !mapLoaded || !config) return

    map.current.flyTo({
      center: [config.centerLng, config.centerLat],
      zoom: config.defaultZoom,
      duration: 1000,
    })

    if (config.minZoom) map.current.setMinZoom(config.minZoom)
    if (config.maxZoom) map.current.setMaxZoom(config.maxZoom)
  }, [config, mapLoaded])

  // Render zones
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove existing zone layers and sources
    zones.forEach((zone) => {
      const sourceId = `zone-${zone.id}`
      const layerId = `zone-fill-${zone.id}`
      const borderLayerId = `zone-border-${zone.id}`

      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId)
      }
      if (map.current?.getLayer(borderLayerId)) {
        map.current.removeLayer(borderLayerId)
      }
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId)
      }
    })

    // Add zone polygons
    zones.forEach((zone) => {
      if (!zone.coordinates || zone.coordinates.length < 3) return

      const sourceId = `zone-${zone.id}`
      const layerId = `zone-fill-${zone.id}`
      const borderLayerId = `zone-border-${zone.id}`

      // Convert coordinates to GeoJSON format
      const coordinates = zone.coordinates.map((c) => [c.longitude, c.latitude])
      // Close the polygon
      if (coordinates.length > 0) {
        coordinates.push(coordinates[0])
      }

      const geojson: GeoJSON.Feature = {
        type: 'Feature',
        properties: {
          id: zone.id,
          name: zone.name,
          type: zone.type,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
      }

      map.current?.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
      })

      // Add fill layer
      map.current?.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': zone.fillColor || zone.color,
          'fill-opacity': zone.fillOpacity || 0.3,
        },
      })

      // Add border layer
      map.current?.addLayer({
        id: borderLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': zone.borderColor || zone.color,
          'line-width': zone.borderWidth || 2,
        },
      })

      // Add click handler
      map.current?.on('click', layerId, () => {
        onSelectZone(zone)
      })

      // Change cursor on hover
      map.current?.on('mouseenter', layerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer'
      })

      map.current?.on('mouseleave', layerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = ''
      })
    })
  }, [zones, mapLoaded, onSelectZone])

  // Render POI markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove existing markers
    markers.current.forEach((marker) => marker.remove())
    markers.current.clear()

    // Add markers for each POI
    pois.forEach((poi) => {
      const color = poiTypeColors[poi.type] || '#6B7280'

      // Create marker element
      const el = document.createElement('div')
      el.className = 'poi-marker'
      el.style.cssText = `
        width: 32px;
        height: 32px;
        background-color: ${color};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      `

      // Add inner icon placeholder
      const inner = document.createElement('div')
      inner.style.cssText = `
        width: 8px;
        height: 8px;
        background-color: white;
        border-radius: 50%;
      `
      el.appendChild(inner)

      // Hover effect
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)'
      })
      el.addEventListener('mouseleave', () => {
        el.style.transform = selectedPOI?.id === poi.id ? 'scale(1.2)' : 'scale(1)'
      })

      // Create marker
      const marker = new maplibregl.Marker({
        element: el,
        draggable: true,
      })
        .setLngLat([poi.longitude, poi.latitude])
        .addTo(map.current!)

      // Click handler
      el.addEventListener('click', () => {
        onSelectPOI(poi)
      })

      // Drag handler
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat()
        if (onPOIMove) {
          onPOIMove(poi.id, lngLat.lat, lngLat.lng)
        }
      })

      // Add popup
      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false,
      }).setHTML(`
        <div style="padding: 8px;">
          <strong style="font-size: 14px;">${poi.name}</strong>
          <p style="font-size: 12px; color: #666; margin: 4px 0 0 0;">${poi.type}</p>
        </div>
      `)

      el.addEventListener('mouseenter', () => {
        marker.setPopup(popup)
        popup.addTo(map.current!)
      })

      el.addEventListener('mouseleave', () => {
        popup.remove()
      })

      markers.current.set(poi.id, marker)
    })

    // Highlight selected POI
    if (selectedPOI) {
      const marker = markers.current.get(selectedPOI.id)
      if (marker) {
        const el = marker.getElement()
        el.style.transform = 'scale(1.2)'
        el.style.zIndex = '10'
      }
    }
  }, [pois, selectedPOI, mapLoaded, onSelectPOI, onPOIMove])

  // Center on selected POI
  useEffect(() => {
    if (!map.current || !selectedPOI) return

    map.current.flyTo({
      center: [selectedPOI.longitude, selectedPOI.latitude],
      zoom: Math.max(map.current.getZoom(), 17),
      duration: 500,
    })
  }, [selectedPOI])

  // Center on selected zone
  useEffect(() => {
    if (!map.current || !selectedZone) return

    if (selectedZone.centerLat && selectedZone.centerLng) {
      map.current.flyTo({
        center: [selectedZone.centerLng, selectedZone.centerLat],
        zoom: 16,
        duration: 500,
      })
    }
  }, [selectedZone])

  // Handle click on map to set center
  const handleSetCenter = useCallback(() => {
    if (!cursorPosition) return

    onConfigChange({
      centerLat: cursorPosition.lat,
      centerLng: cursorPosition.lng,
    })
  }, [cursorPosition, onConfigChange])

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />

      {/* Cursor position display */}
      <div className="absolute bottom-4 right-4 rounded-lg bg-white px-3 py-2 shadow-lg">
        <p className="text-xs text-gray-500">Position du curseur</p>
        {cursorPosition ? (
          <p className="font-mono text-sm">
            {cursorPosition.lat.toFixed(6)}, {cursorPosition.lng.toFixed(6)}
          </p>
        ) : (
          <p className="text-sm text-gray-400">-</p>
        )}
      </div>

      {/* Instructions */}
      <div className="absolute left-4 top-4 max-w-xs rounded-lg bg-white p-3 shadow-lg">
        <h4 className="font-medium text-gray-900">Instructions</h4>
        <ul className="mt-2 space-y-1 text-xs text-gray-600">
          <li>Cliquez sur un POI pour le selectionner</li>
          <li>Glissez un POI pour le deplacer</li>
          <li>Cliquez sur une zone pour la selectionner</li>
          <li>Utilisez la molette pour zoomer</li>
        </ul>
      </div>

      {/* Set center button */}
      {!config && cursorPosition && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
          <button
            onClick={handleSetCenter}
            className="rounded-lg bg-primary px-4 py-2 text-white shadow-lg hover:bg-primary/90"
          >
            Definir ce point comme centre
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 rounded-lg bg-white p-3 shadow-lg">
        <h4 className="mb-2 text-xs font-medium text-gray-500">Legende</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {Object.entries(poiTypeColors).slice(0, 8).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-600">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
