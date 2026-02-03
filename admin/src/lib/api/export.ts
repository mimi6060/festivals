import { api } from '../api'

// Export Types
export type ExportDataType = 'orders' | 'transactions' | 'users' | 'tickets'
export type ExportFormat = 'csv' | 'xlsx' | 'json'
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ExportJob {
  id: string
  festivalId: string
  dataType: ExportDataType
  format: ExportFormat
  status: ExportStatus
  dateFrom: string
  dateTo: string
  filters?: ExportFilters
  progress: number
  totalRecords: number | null
  processedRecords: number
  downloadUrl: string | null
  fileSize: number | null
  fileName: string | null
  errorMessage: string | null
  expiresAt: string | null
  createdAt: string
  completedAt: string | null
  createdBy: string
  createdByName: string
}

export interface ExportFilters {
  status?: string
  standId?: string
  ticketTypeId?: string
  paymentMethod?: string
}

export interface CreateExportInput {
  dataType: ExportDataType
  format: ExportFormat
  dateFrom: string
  dateTo: string
  filters?: ExportFilters
}

export interface ExportListParams {
  dataType?: ExportDataType
  status?: ExportStatus
  page?: number
  limit?: number
}

export interface PaginatedExports {
  data: ExportJob[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Data type metadata for UI
export const EXPORT_DATA_TYPES: Record<ExportDataType, {
  label: string
  description: string
  icon: string
}> = {
  orders: {
    label: 'Orders',
    description: 'All orders with items, totals, and payment details',
    icon: 'shopping-cart',
  },
  transactions: {
    label: 'Transactions',
    description: 'Wallet transactions including top-ups, purchases, and refunds',
    icon: 'credit-card',
  },
  users: {
    label: 'Users',
    description: 'Attendee information and registration details',
    icon: 'users',
  },
  tickets: {
    label: 'Tickets',
    description: 'Ticket sales, check-ins, and attendee assignments',
    icon: 'ticket',
  },
}

export const EXPORT_FORMATS: Record<ExportFormat, {
  label: string
  description: string
  mimeType: string
  extension: string
}> = {
  csv: {
    label: 'CSV',
    description: 'Comma-separated values, compatible with Excel and spreadsheet apps',
    mimeType: 'text/csv',
    extension: '.csv',
  },
  xlsx: {
    label: 'Excel',
    description: 'Microsoft Excel format with formatting and multiple sheets',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
  json: {
    label: 'JSON',
    description: 'Machine-readable format for data integration and APIs',
    mimeType: 'application/json',
    extension: '.json',
  },
}

// API functions
export const exportApi = {
  // Create a new export job
  create: (festivalId: string, data: CreateExportInput) =>
    api.post<ExportJob>(`/api/v1/festivals/${festivalId}/exports`, data),

  // List export jobs
  list: (festivalId: string, params?: ExportListParams) => {
    const searchParams = new URLSearchParams()
    if (params?.dataType) searchParams.set('dataType', params.dataType)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return api.get<PaginatedExports>(
      `/api/v1/festivals/${festivalId}/exports${query ? `?${query}` : ''}`
    )
  },

  // Get a specific export job
  get: (festivalId: string, exportId: string) =>
    api.get<ExportJob>(`/api/v1/festivals/${festivalId}/exports/${exportId}`),

  // Get export job status (for polling)
  getStatus: (festivalId: string, exportId: string) =>
    api.get<Pick<ExportJob, 'id' | 'status' | 'progress' | 'processedRecords' | 'totalRecords' | 'downloadUrl' | 'errorMessage'>>(
      `/api/v1/festivals/${festivalId}/exports/${exportId}/status`
    ),

  // Get download URL
  download: (festivalId: string, exportId: string) =>
    api.get<{ url: string; expiresAt: string }>(
      `/api/v1/festivals/${festivalId}/exports/${exportId}/download`
    ),

  // Cancel an export job
  cancel: (festivalId: string, exportId: string) =>
    api.post<ExportJob>(`/api/v1/festivals/${festivalId}/exports/${exportId}/cancel`),

  // Delete an export job
  delete: (festivalId: string, exportId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/exports/${exportId}`),
}

// React Query helpers
export const exportQueryKeys = {
  all: ['exports'] as const,
  list: (festivalId: string, params?: ExportListParams) =>
    [...exportQueryKeys.all, 'list', festivalId, params] as const,
  detail: (festivalId: string, exportId: string) =>
    [...exportQueryKeys.all, 'detail', festivalId, exportId] as const,
  status: (festivalId: string, exportId: string) =>
    [...exportQueryKeys.all, 'status', festivalId, exportId] as const,
}
