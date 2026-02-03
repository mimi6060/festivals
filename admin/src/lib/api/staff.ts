import { api } from '../api'

// Types
export type StaffRole = 'ORGANIZER' | 'MANAGER' | 'OPERATOR' | 'SECURITY' | 'MEDICAL' | 'VOLUNTEER'

export type StaffStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'REMOVED'

export type ShiftStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export interface StaffMember {
  id: string
  festivalId: string
  userId: string
  user: {
    id: string
    name: string
    email: string
    phone?: string
    avatarUrl?: string
  }
  role: StaffRole
  status: StaffStatus
  assignedStands: AssignedStand[]
  invitedBy?: string
  invitedAt: string
  acceptedAt?: string
  notes?: string
  emergencyContact?: {
    name: string
    phone: string
    relationship: string
  }
  createdAt: string
  updatedAt: string
}

export interface AssignedStand {
  standId: string
  standName: string
  standCategory: string
  assignedAt: string
}

export interface Shift {
  id: string
  festivalId: string
  staffId: string
  staff?: StaffMember
  standId?: string
  stand?: {
    id: string
    name: string
    category: string
  }
  date: string
  startTime: string
  endTime: string
  breakDuration: number // in minutes
  status: ShiftStatus
  notes?: string
  checkInTime?: string
  checkOutTime?: string
  templateId?: string
  createdAt: string
  updatedAt: string
}

export interface ShiftTemplate {
  id: string
  festivalId: string
  name: string
  description?: string
  startTime: string
  endTime: string
  breakDuration: number
  role?: StaffRole
  standId?: string
  stand?: {
    id: string
    name: string
    category: string
  }
  color: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface StaffStats {
  totalStaff: number
  activeStaff: number
  pendingInvitations: number
  staffByRole: Record<StaffRole, number>
  shiftsToday: number
  shiftsThisWeek: number
  averageHoursPerWeek: number
}

export interface StaffPerformance {
  staffId: string
  totalShifts: number
  completedShifts: number
  noShowCount: number
  totalHoursWorked: number
  averageShiftLength: number
  punctualityRate: number // percentage of on-time check-ins
  transactionsProcessed?: number
  totalRevenue?: number
  rating?: number
  recentShifts: Shift[]
}

// Request types
export interface InviteStaffRequest {
  email: string
  name?: string
  role: StaffRole
  standIds?: string[]
  notes?: string
}

export interface UpdateStaffRequest {
  role?: StaffRole
  status?: StaffStatus
  notes?: string
  emergencyContact?: {
    name: string
    phone: string
    relationship: string
  }
}

export interface CreateShiftRequest {
  staffId: string
  standId?: string
  date: string
  startTime: string
  endTime: string
  breakDuration?: number
  notes?: string
  templateId?: string
}

export interface UpdateShiftRequest {
  staffId?: string
  standId?: string
  date?: string
  startTime?: string
  endTime?: string
  breakDuration?: number
  status?: ShiftStatus
  notes?: string
}

export interface BulkCreateShiftsRequest {
  shifts: CreateShiftRequest[]
}

export interface CreateShiftTemplateRequest {
  name: string
  description?: string
  startTime: string
  endTime: string
  breakDuration?: number
  role?: StaffRole
  standId?: string
  color: string
}

export interface UpdateShiftTemplateRequest {
  name?: string
  description?: string
  startTime?: string
  endTime?: string
  breakDuration?: number
  role?: StaffRole
  standId?: string
  color?: string
  isActive?: boolean
}

export interface AssignStandsRequest {
  standIds: string[]
}

// Response types
export interface StaffListResponse {
  staff: StaffMember[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

export interface ShiftListResponse {
  shifts: Shift[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

export interface ShiftTemplateListResponse {
  templates: ShiftTemplate[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

// Query keys
export const staffQueryKeys = {
  all: (festivalId: string) => ['festivals', festivalId, 'staff'] as const,
  list: (festivalId: string, params?: Record<string, unknown>) =>
    [...staffQueryKeys.all(festivalId), 'list', params] as const,
  detail: (festivalId: string, staffId: string) =>
    [...staffQueryKeys.all(festivalId), 'detail', staffId] as const,
  performance: (festivalId: string, staffId: string) =>
    [...staffQueryKeys.all(festivalId), 'performance', staffId] as const,
  stats: (festivalId: string) =>
    [...staffQueryKeys.all(festivalId), 'stats'] as const,
  shifts: (festivalId: string, params?: Record<string, unknown>) =>
    [...staffQueryKeys.all(festivalId), 'shifts', params] as const,
  staffShifts: (festivalId: string, staffId: string, params?: Record<string, unknown>) =>
    [...staffQueryKeys.all(festivalId), 'staffShifts', staffId, params] as const,
  templates: (festivalId: string) =>
    [...staffQueryKeys.all(festivalId), 'templates'] as const,
}

// Helper functions
export function getRoleLabel(role: StaffRole): string {
  const labels: Record<StaffRole, string> = {
    ORGANIZER: 'Organisateur',
    MANAGER: 'Manager',
    OPERATOR: 'Operateur',
    SECURITY: 'Securite',
    MEDICAL: 'Medical',
    VOLUNTEER: 'Benevole',
  }
  return labels[role] || role
}

export function getRoleColor(role: StaffRole): { bg: string; text: string } {
  const colors: Record<StaffRole, { bg: string; text: string }> = {
    ORGANIZER: { bg: 'bg-purple-100', text: 'text-purple-700' },
    MANAGER: { bg: 'bg-blue-100', text: 'text-blue-700' },
    OPERATOR: { bg: 'bg-green-100', text: 'text-green-700' },
    SECURITY: { bg: 'bg-slate-100', text: 'text-slate-700' },
    MEDICAL: { bg: 'bg-red-100', text: 'text-red-700' },
    VOLUNTEER: { bg: 'bg-amber-100', text: 'text-amber-700' },
  }
  return colors[role] || { bg: 'bg-gray-100', text: 'text-gray-700' }
}

export function getStatusLabel(status: StaffStatus): string {
  const labels: Record<StaffStatus, string> = {
    PENDING: 'En attente',
    ACTIVE: 'Actif',
    INACTIVE: 'Inactif',
    REMOVED: 'Retire',
  }
  return labels[status] || status
}

export function getShiftStatusLabel(status: ShiftStatus): string {
  const labels: Record<ShiftStatus, string> = {
    SCHEDULED: 'Planifie',
    IN_PROGRESS: 'En cours',
    COMPLETED: 'Termine',
    CANCELLED: 'Annule',
    NO_SHOW: 'Absent',
  }
  return labels[status] || status
}

export function getShiftStatusColor(status: ShiftStatus): { bg: string; text: string } {
  const colors: Record<ShiftStatus, { bg: string; text: string }> = {
    SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700' },
    IN_PROGRESS: { bg: 'bg-green-100', text: 'text-green-700' },
    COMPLETED: { bg: 'bg-gray-100', text: 'text-gray-700' },
    CANCELLED: { bg: 'bg-orange-100', text: 'text-orange-700' },
    NO_SHOW: { bg: 'bg-red-100', text: 'text-red-700' },
  }
  return colors[status] || { bg: 'bg-gray-100', text: 'text-gray-700' }
}

// API functions
export const staffApi = {
  // Staff management
  list: (festivalId: string, params?: {
    role?: StaffRole
    status?: StaffStatus
    search?: string
    standId?: string
    page?: number
    perPage?: number
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.role) searchParams.set('role', params.role)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.standId) searchParams.set('standId', params.standId)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('perPage', String(params.perPage))
    const query = searchParams.toString()
    return api.get<StaffListResponse>(`/api/v1/festivals/${festivalId}/staff${query ? `?${query}` : ''}`)
  },

  get: (festivalId: string, staffId: string) =>
    api.get<StaffMember>(`/api/v1/festivals/${festivalId}/staff/${staffId}`),

  invite: (festivalId: string, data: InviteStaffRequest) =>
    api.post<StaffMember>(`/api/v1/festivals/${festivalId}/staff/invite`, data),

  update: (festivalId: string, staffId: string, data: UpdateStaffRequest) =>
    api.patch<StaffMember>(`/api/v1/festivals/${festivalId}/staff/${staffId}`, data),

  remove: (festivalId: string, staffId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/staff/${staffId}`),

  resendInvitation: (festivalId: string, staffId: string) =>
    api.post<void>(`/api/v1/festivals/${festivalId}/staff/${staffId}/resend-invitation`),

  // Stand assignments
  assignStands: (festivalId: string, staffId: string, data: AssignStandsRequest) =>
    api.post<StaffMember>(`/api/v1/festivals/${festivalId}/staff/${staffId}/stands`, data),

  removeStand: (festivalId: string, staffId: string, standId: string) =>
    api.delete<StaffMember>(`/api/v1/festivals/${festivalId}/staff/${staffId}/stands/${standId}`),

  // Stats and performance
  getStats: (festivalId: string) =>
    api.get<StaffStats>(`/api/v1/festivals/${festivalId}/staff/stats`),

  getPerformance: (festivalId: string, staffId: string, params?: {
    startDate?: string
    endDate?: string
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    const query = searchParams.toString()
    return api.get<StaffPerformance>(`/api/v1/festivals/${festivalId}/staff/${staffId}/performance${query ? `?${query}` : ''}`)
  },

  // Shifts
  listShifts: (festivalId: string, params?: {
    staffId?: string
    standId?: string
    date?: string
    startDate?: string
    endDate?: string
    status?: ShiftStatus
    page?: number
    perPage?: number
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.staffId) searchParams.set('staffId', params.staffId)
    if (params?.standId) searchParams.set('standId', params.standId)
    if (params?.date) searchParams.set('date', params.date)
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('perPage', String(params.perPage))
    const query = searchParams.toString()
    return api.get<ShiftListResponse>(`/api/v1/festivals/${festivalId}/shifts${query ? `?${query}` : ''}`)
  },

  getShift: (festivalId: string, shiftId: string) =>
    api.get<Shift>(`/api/v1/festivals/${festivalId}/shifts/${shiftId}`),

  createShift: (festivalId: string, data: CreateShiftRequest) =>
    api.post<Shift>(`/api/v1/festivals/${festivalId}/shifts`, data),

  updateShift: (festivalId: string, shiftId: string, data: UpdateShiftRequest) =>
    api.patch<Shift>(`/api/v1/festivals/${festivalId}/shifts/${shiftId}`, data),

  deleteShift: (festivalId: string, shiftId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/shifts/${shiftId}`),

  bulkCreateShifts: (festivalId: string, data: BulkCreateShiftsRequest) =>
    api.post<{ created: number; shifts: Shift[] }>(`/api/v1/festivals/${festivalId}/shifts/bulk`, data),

  checkIn: (festivalId: string, shiftId: string) =>
    api.post<Shift>(`/api/v1/festivals/${festivalId}/shifts/${shiftId}/check-in`),

  checkOut: (festivalId: string, shiftId: string) =>
    api.post<Shift>(`/api/v1/festivals/${festivalId}/shifts/${shiftId}/check-out`),

  // Shift Templates
  listTemplates: (festivalId: string) =>
    api.get<ShiftTemplateListResponse>(`/api/v1/festivals/${festivalId}/shift-templates`),

  getTemplate: (festivalId: string, templateId: string) =>
    api.get<ShiftTemplate>(`/api/v1/festivals/${festivalId}/shift-templates/${templateId}`),

  createTemplate: (festivalId: string, data: CreateShiftTemplateRequest) =>
    api.post<ShiftTemplate>(`/api/v1/festivals/${festivalId}/shift-templates`, data),

  updateTemplate: (festivalId: string, templateId: string, data: UpdateShiftTemplateRequest) =>
    api.patch<ShiftTemplate>(`/api/v1/festivals/${festivalId}/shift-templates/${templateId}`, data),

  deleteTemplate: (festivalId: string, templateId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/shift-templates/${templateId}`),

  applyTemplate: (festivalId: string, templateId: string, data: {
    staffIds: string[]
    dates: string[]
  }) =>
    api.post<{ created: number; shifts: Shift[] }>(`/api/v1/festivals/${festivalId}/shift-templates/${templateId}/apply`, data),
}
