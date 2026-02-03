import { api } from '../api'

// Report Types
export type ReportType = 'transactions' | 'sales' | 'tickets' | 'staff'
export type ReportFormat = 'csv' | 'xlsx' | 'pdf'
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'

export interface Report {
  id: string
  festivalId: string
  type: ReportType
  format: ReportFormat
  name: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  dateFrom: string
  dateTo: string
  downloadUrl: string | null
  fileSize: number | null
  generatedAt: string | null
  expiresAt: string | null
  createdAt: string
  createdBy: string
  createdByName: string
}

export interface ScheduledReport {
  id: string
  festivalId: string
  type: ReportType
  format: ReportFormat
  name: string
  frequency: ScheduleFrequency
  dayOfWeek?: number // 0-6 for weekly
  dayOfMonth?: number // 1-31 for monthly
  time: string // HH:mm format
  recipients: string[]
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GenerateReportInput {
  type: ReportType
  format: ReportFormat
  dateFrom: string
  dateTo: string
  name?: string
}

export interface CreateScheduledReportInput {
  type: ReportType
  format: ReportFormat
  name: string
  frequency: ScheduleFrequency
  dayOfWeek?: number
  dayOfMonth?: number
  time: string
  recipients: string[]
  enabled?: boolean
}

export interface UpdateScheduledReportInput {
  name?: string
  format?: ReportFormat
  frequency?: ScheduleFrequency
  dayOfWeek?: number
  dayOfMonth?: number
  time?: string
  recipients?: string[]
  enabled?: boolean
}

export interface ReportListParams {
  type?: ReportType
  status?: string
  page?: number
  limit?: number
}

export interface PaginatedReports {
  data: Report[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Report type metadata for UI
export const REPORT_TYPES: Record<ReportType, { label: string; description: string }> = {
  transactions: {
    label: 'Transactions',
    description: 'All wallet transactions including purchases, top-ups, and refunds',
  },
  sales: {
    label: 'Sales',
    description: 'Sales by stand, product, and time period with revenue breakdown',
  },
  tickets: {
    label: 'Tickets',
    description: 'Ticket sales, check-ins, and attendee information',
  },
  staff: {
    label: 'Staff',
    description: 'Staff activity, shifts, and transaction summaries',
  },
}

export const REPORT_FORMATS: Record<ReportFormat, { label: string; mimeType: string }> = {
  csv: { label: 'CSV', mimeType: 'text/csv' },
  xlsx: { label: 'Excel (XLSX)', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  pdf: { label: 'PDF', mimeType: 'application/pdf' },
}

export const SCHEDULE_FREQUENCIES: Record<ScheduleFrequency, { label: string; description: string }> = {
  daily: { label: 'Daily', description: 'Every day at the specified time' },
  weekly: { label: 'Weekly', description: 'Once a week on the specified day' },
  monthly: { label: 'Monthly', description: 'Once a month on the specified day' },
}

// API functions
export const reportsApi = {
  // Generate a new report
  generate: (festivalId: string, data: GenerateReportInput) =>
    api.post<Report>(`/api/v1/festivals/${festivalId}/reports`, data),

  // List all reports for a festival
  list: (festivalId: string, params?: ReportListParams) => {
    const searchParams = new URLSearchParams()
    if (params?.type) searchParams.set('type', params.type)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return api.get<PaginatedReports>(
      `/api/v1/festivals/${festivalId}/reports${query ? `?${query}` : ''}`
    )
  },

  // Get a specific report
  get: (festivalId: string, reportId: string) =>
    api.get<Report>(`/api/v1/festivals/${festivalId}/reports/${reportId}`),

  // Download a report (returns download URL)
  download: (festivalId: string, reportId: string) =>
    api.get<{ url: string }>(`/api/v1/festivals/${festivalId}/reports/${reportId}/download`),

  // Delete a report
  delete: (festivalId: string, reportId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/reports/${reportId}`),

  // Scheduled Reports
  listScheduled: (festivalId: string) =>
    api.get<ScheduledReport[]>(`/api/v1/festivals/${festivalId}/reports/scheduled`),

  getScheduled: (festivalId: string, scheduledId: string) =>
    api.get<ScheduledReport>(`/api/v1/festivals/${festivalId}/reports/scheduled/${scheduledId}`),

  createScheduled: (festivalId: string, data: CreateScheduledReportInput) =>
    api.post<ScheduledReport>(`/api/v1/festivals/${festivalId}/reports/scheduled`, data),

  updateScheduled: (festivalId: string, scheduledId: string, data: UpdateScheduledReportInput) =>
    api.patch<ScheduledReport>(`/api/v1/festivals/${festivalId}/reports/scheduled/${scheduledId}`, data),

  deleteScheduled: (festivalId: string, scheduledId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/reports/scheduled/${scheduledId}`),

  toggleScheduled: (festivalId: string, scheduledId: string, enabled: boolean) =>
    api.patch<ScheduledReport>(`/api/v1/festivals/${festivalId}/reports/scheduled/${scheduledId}`, { enabled }),
}

// React Query helpers
export const reportsQueryKeys = {
  all: ['reports'] as const,
  list: (festivalId: string, params?: ReportListParams) =>
    [...reportsQueryKeys.all, 'list', festivalId, params] as const,
  detail: (festivalId: string, reportId: string) =>
    [...reportsQueryKeys.all, 'detail', festivalId, reportId] as const,
  scheduled: (festivalId: string) =>
    [...reportsQueryKeys.all, 'scheduled', festivalId] as const,
  scheduledDetail: (festivalId: string, scheduledId: string) =>
    [...reportsQueryKeys.all, 'scheduled', festivalId, scheduledId] as const,
}
