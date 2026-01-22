import { api } from '../api'
import { Festival } from '@/types/api'

// Festival types for API operations
export interface CreateFestivalInput {
  name: string
  description?: string
  startDate: string
  endDate: string
  location: string
  timezone: string
  currencyName: string
  exchangeRate: number
}

export interface UpdateFestivalInput extends Partial<CreateFestivalInput> {
  status?: Festival['status']
  settings?: Record<string, unknown>
  stripeAccountId?: string
}

export interface FestivalStats {
  ticketsSold: number
  totalRevenue: number
  walletsCreated: number
  activeUsers: number
  todayEntries: number
  activeStaff: number
}

export interface FestivalBranding {
  logo?: string
  primaryColor?: string
  secondaryColor?: string
  bannerImage?: string
}

export interface FestivalPolicies {
  refundPolicy: 'auto' | 'manual' | 'none'
  reentryPolicy: 'single' | 'multiple'
  minAge?: number
  maxCapacity?: number
}

export interface FestivalListParams {
  page?: number
  perPage?: number
  search?: string
  status?: Festival['status']
  sortBy?: 'name' | 'startDate' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface FestivalListResponse {
  festivals: Festival[]
  total: number
  page: number
  perPage: number
}

// API functions
export const festivalsApi = {
  // List all festivals with filtering/pagination
  list: async (params?: FestivalListParams): Promise<FestivalListResponse> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.perPage) searchParams.set('perPage', params.perPage.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder)

    const query = searchParams.toString()
    return api.get<FestivalListResponse>(`/api/v1/festivals${query ? `?${query}` : ''}`)
  },

  // Get a single festival by ID
  get: async (id: string): Promise<Festival> => {
    return api.get<Festival>(`/api/v1/festivals/${id}`)
  },

  // Create a new festival
  create: async (data: CreateFestivalInput): Promise<Festival> => {
    return api.post<Festival>('/api/v1/festivals', data)
  },

  // Update a festival
  update: async (id: string, data: UpdateFestivalInput): Promise<Festival> => {
    return api.patch<Festival>(`/api/v1/festivals/${id}`, data)
  },

  // Delete a festival (soft delete - sets status to ARCHIVED)
  delete: async (id: string): Promise<void> => {
    return api.delete<void>(`/api/v1/festivals/${id}`)
  },

  // Get festival statistics
  getStats: async (id: string): Promise<FestivalStats> => {
    return api.get<FestivalStats>(`/api/v1/festivals/${id}/stats`)
  },

  // Update festival status
  updateStatus: async (id: string, status: Festival['status']): Promise<Festival> => {
    return api.patch<Festival>(`/api/v1/festivals/${id}/status`, { status })
  },

  // Activate a festival (set status to ACTIVE)
  activate: async (id: string): Promise<Festival> => {
    return api.post<Festival>(`/api/v1/festivals/${id}/activate`)
  },

  // Archive a festival (set status to ARCHIVED)
  archive: async (id: string): Promise<Festival> => {
    return api.post<Festival>(`/api/v1/festivals/${id}/archive`)
  },

  // Complete a festival (set status to COMPLETED)
  complete: async (id: string): Promise<Festival> => {
    return api.post<Festival>(`/api/v1/festivals/${id}/complete`)
  },

  // Update branding settings
  updateBranding: async (id: string, branding: FestivalBranding): Promise<Festival> => {
    return api.patch<Festival>(`/api/v1/festivals/${id}/branding`, branding)
  },

  // Update policies
  updatePolicies: async (id: string, policies: FestivalPolicies): Promise<Festival> => {
    return api.patch<Festival>(`/api/v1/festivals/${id}/policies`, policies)
  },

  // Upload logo
  uploadLogo: async (id: string, file: File): Promise<{ url: string }> => {
    const formData = new FormData()
    formData.append('logo', file)

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/v1/festivals/${id}/logo`,
      {
        method: 'POST',
        body: formData,
        credentials: 'include',
      }
    )

    if (!response.ok) {
      throw new Error('Failed to upload logo')
    }

    const data = await response.json()
    return data.data ?? data
  },

  // Connect Stripe account
  connectStripe: async (id: string): Promise<{ url: string }> => {
    return api.post<{ url: string }>(`/api/v1/festivals/${id}/stripe/connect`)
  },

  // Disconnect Stripe account
  disconnectStripe: async (id: string): Promise<void> => {
    return api.delete<void>(`/api/v1/festivals/${id}/stripe`)
  },

  // Get Stripe account status
  getStripeStatus: async (id: string): Promise<{ connected: boolean; accountId?: string; status?: string }> => {
    return api.get<{ connected: boolean; accountId?: string; status?: string }>(
      `/api/v1/festivals/${id}/stripe/status`
    )
  },
}
