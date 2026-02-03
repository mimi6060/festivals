import { api } from '../api'
import type { Artist, Stage, Slot } from '@/types/api'

// Extended Artist type with additional fields for the admin dashboard
export interface ArtistWithDetails extends Artist {
  bio?: string
  genre?: string
  imageUrl?: string
  socialLinks?: {
    instagram?: string
    spotify?: string
    soundcloud?: string
    website?: string
    twitter?: string
    youtube?: string
  }
}

// Extended Stage type with additional fields
export interface StageWithDetails extends Stage {
  description?: string
  type?: 'MAIN' | 'SECONDARY' | 'TENT' | 'OUTDOOR' | 'INDOOR'
  isActive: boolean
}

// Performance/Slot with artist and stage details
export interface PerformanceWithDetails extends Slot {
  artist?: ArtistWithDetails
  stage?: StageWithDetails
  duration?: number // in minutes
}

// Request/Response types
export interface CreateArtistRequest {
  name: string
  bio?: string
  genre?: string
  type?: 'DJ' | 'BAND' | 'SOLO'
  imageUrl?: string
  socialLinks?: ArtistWithDetails['socialLinks']
  guestQuota?: number
  rider?: Record<string, unknown>
}

export interface UpdateArtistRequest extends Partial<CreateArtistRequest> {}

export interface CreateStageRequest {
  name: string
  capacity?: number
  description?: string
  type?: StageWithDetails['type']
  location?: { lat: number; lng: number }
}

export interface UpdateStageRequest extends Partial<CreateStageRequest> {
  isActive?: boolean
}

export interface CreatePerformanceRequest {
  artistId: string
  stageId: string
  startTime: string // ISO 8601 date string
  endTime: string // ISO 8601 date string
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
}

export interface UpdatePerformanceRequest extends Partial<CreatePerformanceRequest> {}

export interface LineupFilters {
  date?: string
  stageId?: string
  artistId?: string
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
}

// API functions for Artists
export const artistsApi = {
  list: (festivalId: string) =>
    api.get<ArtistWithDetails[]>(`/admin/festivals/${festivalId}/artists`),

  get: (festivalId: string, artistId: string) =>
    api.get<ArtistWithDetails>(`/admin/festivals/${festivalId}/artists/${artistId}`),

  create: (festivalId: string, data: CreateArtistRequest) =>
    api.post<ArtistWithDetails>(`/admin/festivals/${festivalId}/artists`, data),

  update: (festivalId: string, artistId: string, data: UpdateArtistRequest) =>
    api.patch<ArtistWithDetails>(`/admin/festivals/${festivalId}/artists/${artistId}`, data),

  delete: (festivalId: string, artistId: string) =>
    api.delete<void>(`/admin/festivals/${festivalId}/artists/${artistId}`),
}

// API functions for Stages
export const stagesApi = {
  list: (festivalId: string) =>
    api.get<StageWithDetails[]>(`/admin/festivals/${festivalId}/stages`),

  get: (festivalId: string, stageId: string) =>
    api.get<StageWithDetails>(`/admin/festivals/${festivalId}/stages/${stageId}`),

  create: (festivalId: string, data: CreateStageRequest) =>
    api.post<StageWithDetails>(`/admin/festivals/${festivalId}/stages`, data),

  update: (festivalId: string, stageId: string, data: UpdateStageRequest) =>
    api.patch<StageWithDetails>(`/admin/festivals/${festivalId}/stages/${stageId}`, data),

  delete: (festivalId: string, stageId: string) =>
    api.delete<void>(`/admin/festivals/${festivalId}/stages/${stageId}`),
}

// API functions for Performances (Slots)
export const performancesApi = {
  list: (festivalId: string, filters?: LineupFilters) => {
    const params = new URLSearchParams()
    if (filters?.date) params.append('date', filters.date)
    if (filters?.stageId) params.append('stageId', filters.stageId)
    if (filters?.artistId) params.append('artistId', filters.artistId)
    if (filters?.status) params.append('status', filters.status)

    const queryString = params.toString()
    const endpoint = `/admin/festivals/${festivalId}/performances${queryString ? `?${queryString}` : ''}`
    return api.get<PerformanceWithDetails[]>(endpoint)
  },

  get: (festivalId: string, performanceId: string) =>
    api.get<PerformanceWithDetails>(`/admin/festivals/${festivalId}/performances/${performanceId}`),

  create: (festivalId: string, data: CreatePerformanceRequest) =>
    api.post<PerformanceWithDetails>(`/admin/festivals/${festivalId}/performances`, data),

  update: (festivalId: string, performanceId: string, data: UpdatePerformanceRequest) =>
    api.patch<PerformanceWithDetails>(`/admin/festivals/${festivalId}/performances/${performanceId}`, data),

  delete: (festivalId: string, performanceId: string) =>
    api.delete<void>(`/admin/festivals/${festivalId}/performances/${performanceId}`),

  // Bulk operations
  bulkUpdateStatus: (festivalId: string, performanceIds: string[], status: 'PENDING' | 'CONFIRMED' | 'CANCELLED') =>
    api.post<void>(`/admin/festivals/${festivalId}/performances/bulk-status`, { performanceIds, status }),

  // Get lineup for a specific day
  getByDay: (festivalId: string, date: string) =>
    api.get<PerformanceWithDetails[]>(`/admin/festivals/${festivalId}/lineup?date=${date}`),
}

// Combined lineup API
export const lineupApi = {
  artists: artistsApi,
  stages: stagesApi,
  performances: performancesApi,

  // Get full lineup overview with all stages and performances for a day
  getDayOverview: async (festivalId: string, date: string) => {
    const [stages, performances] = await Promise.all([
      stagesApi.list(festivalId),
      performancesApi.getByDay(festivalId, date),
    ])
    return { stages, performances }
  },

  // Get all data for lineup management
  getFullLineup: async (festivalId: string) => {
    const [artists, stages, performances] = await Promise.all([
      artistsApi.list(festivalId),
      stagesApi.list(festivalId),
      performancesApi.list(festivalId),
    ])
    return { artists, stages, performances }
  },
}

export default lineupApi
