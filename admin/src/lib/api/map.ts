import { api } from '../api'

export type POIType =
  | 'STAGE'
  | 'BAR'
  | 'FOOD'
  | 'TOILET'
  | 'FIRST_AID'
  | 'ENTRANCE'
  | 'EXIT'
  | 'CHARGING'
  | 'CAMPING'
  | 'VIP'
  | 'INFO'
  | 'ATM'
  | 'PARKING'
  | 'MERCH'
  | 'SECURITY'
  | 'WATER'
  | 'SMOKING'
  | 'LOCKERS'
  | 'LOST_FOUND'
  | 'ACCESSIBILITY'
  | 'OTHER'

export type POIStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED' | 'BUSY'

export type ZoneType =
  | 'GENERAL'
  | 'VIP'
  | 'CAMPING'
  | 'PARKING'
  | 'BACKSTAGE'
  | 'RESTRICTED'
  | 'FOOD'
  | 'STAGE'

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface MapSettings {
  showTraffic?: boolean
  show3dBuildings?: boolean
  showSatellite?: boolean
  customTileUrl?: string
  overlayImageUrl?: string
  overlayOpacity?: number
  enableClustering?: boolean
  clusterRadius?: number
}

export interface MapConfig {
  id: string
  festivalId: string
  centerLat: number
  centerLng: number
  defaultZoom: number
  minZoom: number
  maxZoom: number
  bounds?: {
    northLat: number
    southLat: number
    eastLng: number
    westLng: number
  }
  styleUrl: string
  settings: MapSettings
  createdAt: string
  updatedAt: string
}

export interface POIMetadata {
  phoneNumber?: string
  website?: string
  tags?: string[]
  amenities?: string[]
  waitTime?: number
  queueLength?: number
  lastUpdated?: string
  externalId?: string
  navigationNotes?: string
}

export interface POI {
  id: string
  festivalId: string
  name: string
  description: string
  type: POIType
  status: POIStatus
  latitude: number
  longitude: number
  iconUrl?: string
  imageUrl?: string
  color?: string
  standId?: string
  stageId?: string
  zoneId?: string
  openingHours?: string
  capacity?: number
  isAccessible: boolean
  isFeatured: boolean
  sortOrder: number
  metadata: POIMetadata
  createdAt: string
  updatedAt: string
}

export interface ZoneMetadata {
  accessRules?: string
  allowedTickets?: string[]
  maxOccupancy?: number
  currentOccupancy?: number
  features?: string[]
}

export interface Zone {
  id: string
  festivalId: string
  name: string
  description: string
  type: ZoneType
  color: string
  fillColor: string
  fillOpacity: number
  borderColor: string
  borderWidth: number
  coordinates: Coordinate[]
  centerLat: number
  centerLng: number
  capacity?: number
  isRestricted: boolean
  requiresPass: boolean
  isVisible: boolean
  sortOrder: number
  metadata: ZoneMetadata
  createdAt: string
  updatedAt: string
}

export interface FullMapData {
  config?: MapConfig
  pois: POI[]
  zones: Zone[]
}

export interface CreatePOIRequest {
  name: string
  description?: string
  type: POIType
  latitude: number
  longitude: number
  iconUrl?: string
  imageUrl?: string
  color?: string
  standId?: string
  stageId?: string
  zoneId?: string
  openingHours?: string
  capacity?: number
  isAccessible?: boolean
  isFeatured?: boolean
  sortOrder?: number
  metadata?: POIMetadata
}

export interface UpdatePOIRequest {
  name?: string
  description?: string
  type?: POIType
  status?: POIStatus
  latitude?: number
  longitude?: number
  iconUrl?: string
  imageUrl?: string
  color?: string
  standId?: string
  stageId?: string
  zoneId?: string
  openingHours?: string
  capacity?: number
  isAccessible?: boolean
  isFeatured?: boolean
  sortOrder?: number
  metadata?: POIMetadata
}

export interface CreateZoneRequest {
  name: string
  description?: string
  type: ZoneType
  color?: string
  fillColor?: string
  fillOpacity?: number
  borderColor?: string
  borderWidth?: number
  coordinates: Coordinate[]
  centerLat?: number
  centerLng?: number
  capacity?: number
  isRestricted?: boolean
  requiresPass?: boolean
  isVisible?: boolean
  sortOrder?: number
  metadata?: ZoneMetadata
}

export interface UpdateZoneRequest {
  name?: string
  description?: string
  type?: ZoneType
  color?: string
  fillColor?: string
  fillOpacity?: number
  borderColor?: string
  borderWidth?: number
  coordinates?: Coordinate[]
  centerLat?: number
  centerLng?: number
  capacity?: number
  isRestricted?: boolean
  requiresPass?: boolean
  isVisible?: boolean
  sortOrder?: number
  metadata?: ZoneMetadata
}

export interface CreateMapConfigRequest {
  centerLat: number
  centerLng: number
  defaultZoom?: number
  minZoom?: number
  maxZoom?: number
  boundsNorthLat?: number
  boundsSouthLat?: number
  boundsEastLng?: number
  boundsWestLng?: number
  styleUrl?: string
  settings?: MapSettings
}

export interface POIFilters {
  type?: POIType
  status?: POIStatus
  zoneId?: string
  accessible?: boolean
  featured?: boolean
  search?: string
}

export interface ZoneFilters {
  type?: ZoneType
  restricted?: boolean
  visible?: boolean
  search?: string
}

export const mapApi = {
  // Full map data
  getFullMap: (festivalId: string): Promise<FullMapData> =>
    api.get(`/festivals/${festivalId}/map`),

  // Map config
  getConfig: (festivalId: string): Promise<MapConfig> =>
    api.get(`/festivals/${festivalId}/map/config`),

  createOrUpdateConfig: (
    festivalId: string,
    config: CreateMapConfigRequest
  ): Promise<MapConfig> =>
    api.put(`/festivals/${festivalId}/map/config`, config),

  updateConfig: (
    festivalId: string,
    config: Partial<MapConfig>
  ): Promise<MapConfig> =>
    api.patch(`/festivals/${festivalId}/map/config`, config),

  // POIs
  listPOIs: (festivalId: string, filters?: POIFilters): Promise<POI[]> => {
    const params = new URLSearchParams()
    if (filters?.type) params.append('type', filters.type)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.zoneId) params.append('zoneId', filters.zoneId)
    if (filters?.accessible !== undefined)
      params.append('accessible', String(filters.accessible))
    if (filters?.featured !== undefined)
      params.append('featured', String(filters.featured))
    if (filters?.search) params.append('search', filters.search)

    const query = params.toString()
    return api.get(`/festivals/${festivalId}/map/pois${query ? `?${query}` : ''}`)
  },

  getPOI: (festivalId: string, poiId: string): Promise<POI> =>
    api.get(`/festivals/${festivalId}/map/pois/${poiId}`),

  createPOI: (festivalId: string, data: CreatePOIRequest): Promise<POI> =>
    api.post(`/festivals/${festivalId}/map/pois`, data),

  updatePOI: (
    festivalId: string,
    poiId: string,
    data: UpdatePOIRequest
  ): Promise<POI> =>
    api.patch(`/festivals/${festivalId}/map/pois/${poiId}`, data),

  deletePOI: (festivalId: string, poiId: string): Promise<void> =>
    api.delete(`/festivals/${festivalId}/map/pois/${poiId}`),

  bulkCreatePOIs: (
    festivalId: string,
    data: CreatePOIRequest[]
  ): Promise<POI[]> =>
    api.post(`/festivals/${festivalId}/map/pois/bulk`, data),

  // Zones
  listZones: (festivalId: string, filters?: ZoneFilters): Promise<Zone[]> => {
    const params = new URLSearchParams()
    if (filters?.type) params.append('type', filters.type)
    if (filters?.restricted !== undefined)
      params.append('restricted', String(filters.restricted))
    if (filters?.visible !== undefined) params.append('visible', String(filters.visible))
    if (filters?.search) params.append('search', filters.search)

    const query = params.toString()
    return api.get(`/festivals/${festivalId}/map/zones${query ? `?${query}` : ''}`)
  },

  getZone: (festivalId: string, zoneId: string): Promise<Zone> =>
    api.get(`/festivals/${festivalId}/map/zones/${zoneId}`),

  createZone: (festivalId: string, data: CreateZoneRequest): Promise<Zone> =>
    api.post(`/festivals/${festivalId}/map/zones`, data),

  updateZone: (
    festivalId: string,
    zoneId: string,
    data: UpdateZoneRequest
  ): Promise<Zone> =>
    api.patch(`/festivals/${festivalId}/map/zones/${zoneId}`, data),

  deleteZone: (festivalId: string, zoneId: string): Promise<void> =>
    api.delete(`/festivals/${festivalId}/map/zones/${zoneId}`),
}

export default mapApi
