import { api } from '../api'

// User role types
export type UserRole = 'ADMIN' | 'ORGANIZER' | 'MANAGER' | 'STAFF' | 'FESTIVALIER'

export type UserStatus = 'ACTIVE' | 'BANNED' | 'SUSPENDED'

// User interface
export interface User {
  id: string
  auth0Id: string
  email: string
  name: string
  phone?: string
  avatarUrl?: string
  roles: UserRole[]
  status: UserStatus
  parentId?: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

// User with extended data for detail view
export interface UserDetail extends User {
  wallets: UserWallet[]
  tickets: UserTicket[]
  activityHistory: UserActivity[]
  festivalRoles: FestivalRole[]
}

// User wallet summary
export interface UserWallet {
  id: string
  festivalId: string
  festivalName: string
  balance: number
  totalRecharges: number
  totalSpent: number
  createdAt: string
  updatedAt: string
}

// User ticket summary
export interface UserTicket {
  id: string
  festivalId: string
  festivalName: string
  type: string
  typeName: string
  qrCode: string
  status: 'VALID' | 'USED' | 'CANCELLED'
  usedAt?: string
  createdAt: string
}

// User activity log entry
export interface UserActivity {
  id: string
  type: 'LOGIN' | 'TICKET_PURCHASE' | 'WALLET_RECHARGE' | 'PAYMENT' | 'REFUND' | 'TICKET_SCAN' | 'ROLE_CHANGE' | 'BAN' | 'UNBAN'
  description: string
  metadata?: Record<string, unknown>
  createdAt: string
}

// User transaction
export interface UserTransaction {
  id: string
  walletId: string
  festivalId: string
  festivalName: string
  type: 'RECHARGE' | 'PAYMENT' | 'REFUND' | 'CANCEL'
  amount: number
  balanceAfter: number
  reference?: string
  standName?: string
  createdAt: string
}

// Festival role assignment
export interface FestivalRole {
  festivalId: string
  festivalName: string
  role: 'ORGANIZER' | 'MANAGER' | 'STAFF'
  assignedStands?: string[]
  assignedAt: string
}

// Festival team member
export interface FestivalTeamMember {
  id: string
  userId: string
  user: User
  festivalId: string
  role: 'ORGANIZER' | 'MANAGER' | 'STAFF'
  assignedStands: AssignedStand[]
  invitedBy?: string
  invitedAt: string
  acceptedAt?: string
  status: 'PENDING' | 'ACTIVE' | 'REMOVED'
}

export interface AssignedStand {
  standId: string
  standName: string
  assignedAt: string
}

// API params
export interface UserListParams {
  page?: number
  perPage?: number
  search?: string
  role?: UserRole
  status?: UserStatus
  sortBy?: 'name' | 'email' | 'createdAt' | 'lastLoginAt'
  sortOrder?: 'asc' | 'desc'
}

export interface UserListResponse {
  users: User[]
  total: number
  page: number
  perPage: number
}

export interface FestivalTeamParams {
  page?: number
  perPage?: number
  search?: string
  role?: 'ORGANIZER' | 'MANAGER' | 'STAFF'
  status?: 'PENDING' | 'ACTIVE' | 'REMOVED'
}

export interface FestivalTeamResponse {
  members: FestivalTeamMember[]
  total: number
  page: number
  perPage: number
}

export interface AddTeamMemberInput {
  email: string
  role: 'ORGANIZER' | 'MANAGER' | 'STAFF'
  standIds?: string[]
}

export interface UpdateTeamMemberInput {
  role?: 'ORGANIZER' | 'MANAGER' | 'STAFF'
  standIds?: string[]
}

// API functions
export const usersApi = {
  // List all users with filtering/pagination
  list: async (params?: UserListParams): Promise<UserListResponse> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.perPage) searchParams.set('perPage', params.perPage.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.role) searchParams.set('role', params.role)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder)

    const query = searchParams.toString()
    return api.get<UserListResponse>(`/api/v1/users${query ? `?${query}` : ''}`)
  },

  // Get a single user by ID
  get: async (id: string): Promise<UserDetail> => {
    return api.get<UserDetail>(`/api/v1/users/${id}`)
  },

  // Search users by email or name
  search: async (query: string, limit = 10): Promise<User[]> => {
    const searchParams = new URLSearchParams({ q: query, limit: limit.toString() })
    return api.get<User[]>(`/api/v1/users/search?${searchParams.toString()}`)
  },

  // Update user role
  updateRole: async (id: string, roles: UserRole[]): Promise<User> => {
    return api.patch<User>(`/api/v1/users/${id}/roles`, { roles })
  },

  // Ban a user
  ban: async (id: string, reason?: string): Promise<User> => {
    return api.post<User>(`/api/v1/users/${id}/ban`, { reason })
  },

  // Unban a user
  unban: async (id: string): Promise<User> => {
    return api.post<User>(`/api/v1/users/${id}/unban`)
  },

  // Get user wallets
  getWallets: async (id: string): Promise<UserWallet[]> => {
    return api.get<UserWallet[]>(`/api/v1/users/${id}/wallets`)
  },

  // Get user tickets
  getTickets: async (id: string): Promise<UserTicket[]> => {
    return api.get<UserTicket[]>(`/api/v1/users/${id}/tickets`)
  },

  // Get user transactions
  getTransactions: async (id: string, params?: { page?: number; perPage?: number }): Promise<{
    transactions: UserTransaction[]
    total: number
    page: number
    perPage: number
  }> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.perPage) searchParams.set('perPage', params.perPage.toString())

    const query = searchParams.toString()
    return api.get(`/api/v1/users/${id}/transactions${query ? `?${query}` : ''}`)
  },

  // Get user activity
  getActivity: async (id: string, params?: { page?: number; perPage?: number }): Promise<{
    activities: UserActivity[]
    total: number
    page: number
    perPage: number
  }> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.perPage) searchParams.set('perPage', params.perPage.toString())

    const query = searchParams.toString()
    return api.get(`/api/v1/users/${id}/activity${query ? `?${query}` : ''}`)
  },
}

// Festival team API functions
export const festivalTeamApi = {
  // List festival team members
  list: async (festivalId: string, params?: FestivalTeamParams): Promise<FestivalTeamResponse> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.perPage) searchParams.set('perPage', params.perPage.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.role) searchParams.set('role', params.role)
    if (params?.status) searchParams.set('status', params.status)

    const query = searchParams.toString()
    return api.get<FestivalTeamResponse>(`/api/v1/festivals/${festivalId}/team${query ? `?${query}` : ''}`)
  },

  // Add team member
  add: async (festivalId: string, data: AddTeamMemberInput): Promise<FestivalTeamMember> => {
    return api.post<FestivalTeamMember>(`/api/v1/festivals/${festivalId}/team`, data)
  },

  // Update team member
  update: async (festivalId: string, memberId: string, data: UpdateTeamMemberInput): Promise<FestivalTeamMember> => {
    return api.patch<FestivalTeamMember>(`/api/v1/festivals/${festivalId}/team/${memberId}`, data)
  },

  // Remove team member
  remove: async (festivalId: string, memberId: string): Promise<void> => {
    return api.delete<void>(`/api/v1/festivals/${festivalId}/team/${memberId}`)
  },

  // Assign stands to team member
  assignStands: async (festivalId: string, memberId: string, standIds: string[]): Promise<FestivalTeamMember> => {
    return api.post<FestivalTeamMember>(`/api/v1/festivals/${festivalId}/team/${memberId}/stands`, { standIds })
  },

  // Remove stand assignment
  removeStand: async (festivalId: string, memberId: string, standId: string): Promise<FestivalTeamMember> => {
    return api.delete<FestivalTeamMember>(`/api/v1/festivals/${festivalId}/team/${memberId}/stands/${standId}`)
  },
}
