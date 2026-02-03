import { api } from '../api'

// Types
export interface TicketType {
  id: string
  festivalId: string
  name: string
  description: string
  price: number
  quantity: number | null // null means unlimited
  sold: number
  checkedIn: number
  status: 'DRAFT' | 'ON_SALE' | 'SOLD_OUT' | 'CLOSED'
  validFrom: string
  validUntil: string
  benefits: string[]
  settings: TicketTypeSettings
  createdAt: string
  updatedAt: string
}

export interface TicketTypeSettings {
  allowReentry: boolean
  initialTopUpAmount: number
  transferable: boolean
  transferDeadline: string | null
  maxTransfers: number
  requiresId: boolean
}

export interface Ticket {
  id: string
  ticketTypeId: string
  ticketTypeName: string
  code: string
  status: 'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED'
  holderName: string | null
  holderEmail: string | null
  purchasedAt: string
  checkedInAt: string | null
  checkedInBy: string | null
  transferredFrom: string | null
  walletId: string | null
}

export interface ScanResult {
  id: string
  ticketId: string
  ticketCode: string
  ticketTypeName: string
  holderName: string | null
  action: 'ENTRY' | 'EXIT' | 'REENTRY'
  status: 'SUCCESS' | 'ALREADY_USED' | 'INVALID' | 'EXPIRED' | 'CANCELLED'
  message: string
  scannedAt: string
  scannedBy: string
}

export interface ScanStats {
  totalEntriesToday: number
  totalExitsToday: number
  currentlyInside: number
  totalScansToday: number
  successRate: number
}

export interface CreateTicketTypeInput {
  name: string
  description: string
  price: number
  quantity: number | null
  validFrom: string
  validUntil: string
  benefits: string[]
  settings: TicketTypeSettings
}

export interface UpdateTicketTypeInput {
  name?: string
  description?: string
  price?: number
  quantity?: number | null
  status?: 'DRAFT' | 'ON_SALE' | 'SOLD_OUT' | 'CLOSED'
  validFrom?: string
  validUntil?: string
  benefits?: string[]
  settings?: Partial<TicketTypeSettings>
}

export interface TicketListParams {
  ticketTypeId?: string
  status?: string
  search?: string
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// API functions
export const ticketsApi = {
  // Ticket Types
  listTicketTypes: (festivalId: string) =>
    api.get<TicketType[]>(`/api/v1/festivals/${festivalId}/ticket-types`),

  getTicketType: (festivalId: string, typeId: string) =>
    api.get<TicketType>(`/api/v1/festivals/${festivalId}/ticket-types/${typeId}`),

  createTicketType: (festivalId: string, data: CreateTicketTypeInput) =>
    api.post<TicketType>(`/api/v1/festivals/${festivalId}/ticket-types`, data),

  updateTicketType: (festivalId: string, typeId: string, data: UpdateTicketTypeInput) =>
    api.patch<TicketType>(`/api/v1/festivals/${festivalId}/ticket-types/${typeId}`, data),

  deleteTicketType: (festivalId: string, typeId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/ticket-types/${typeId}`),

  // Individual Tickets
  listTickets: (festivalId: string, params?: TicketListParams) => {
    const searchParams = new URLSearchParams()
    if (params?.ticketTypeId) searchParams.set('ticketTypeId', params.ticketTypeId)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return api.get<PaginatedResponse<Ticket>>(
      `/api/v1/festivals/${festivalId}/tickets${query ? `?${query}` : ''}`
    )
  },

  getTicket: (festivalId: string, ticketId: string) =>
    api.get<Ticket>(`/api/v1/festivals/${festivalId}/tickets/${ticketId}`),

  cancelTicket: (festivalId: string, ticketId: string, reason: string) =>
    api.post<Ticket>(`/api/v1/festivals/${festivalId}/tickets/${ticketId}/cancel`, { reason }),

  // Scanning
  scanTicket: (festivalId: string, code: string, action: 'ENTRY' | 'EXIT' = 'ENTRY') =>
    api.post<ScanResult>(`/api/v1/festivals/${festivalId}/tickets/scan`, { code, action }),

  getRecentScans: (festivalId: string, limit = 20) =>
    api.get<ScanResult[]>(`/api/v1/festivals/${festivalId}/tickets/scans?limit=${limit}`),

  getScanStats: (festivalId: string) =>
    api.get<ScanStats>(`/api/v1/festivals/${festivalId}/tickets/scans/stats`),

  // Check-in stats for a ticket type
  getTicketTypeStats: (festivalId: string, typeId: string) =>
    api.get<{
      total: number
      sold: number
      checkedIn: number
      cancelled: number
      revenue: number
    }>(`/api/v1/festivals/${festivalId}/ticket-types/${typeId}/stats`),
}
