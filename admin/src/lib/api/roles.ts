import { api } from '../api'

// Types
export type Resource =
  | 'festival'
  | 'stand'
  | 'product'
  | 'ticket'
  | 'lineup'
  | 'wallet'
  | 'transaction'
  | 'refund'
  | 'user'
  | 'staff'
  | 'report'
  | 'security'
  | 'settings'
  | 'role'
  | 'audit'
  | 'notification'
  | 'media'

export type Action =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'list'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject'
  | 'scan'
  | 'process'

export type Scope = 'global' | 'festival' | 'stand' | 'own'

export type RoleType = 'system' | 'custom'

export type PredefinedRoleName =
  | 'SUPER_ADMIN'
  | 'FESTIVAL_OWNER'
  | 'FESTIVAL_ADMIN'
  | 'FINANCE_MANAGER'
  | 'LINEUP_MANAGER'
  | 'SECURITY_MANAGER'
  | 'CASHIER'
  | 'SCANNER'
  | 'VIEWER'

export interface Permission {
  id: string
  resource: Resource
  action: Action
  scope: Scope
  description: string
}

export interface Role {
  id: string
  name: string
  displayName: string
  description: string
  type: RoleType
  festivalId?: string
  permissions: Permission[]
  isActive: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

export interface RoleAssignment {
  id: string
  userId: string
  roleId: string
  role?: Role
  festivalId?: string
  standId?: string
  assignedBy: string
  assignedAt: string
  expiresAt?: string
  isActive: boolean
  notes?: string
}

export interface UserPermissions {
  userId: string
  festivalId?: string
  roles: Role[]
  permissions: Permission[]
  effectiveAt: string
}

export interface PermissionMatrix {
  resources: Resource[]
  actions: Action[]
  permissions: Record<string, Record<string, boolean>>
}

export interface AuditLog {
  id: string
  action: string
  actorId: string
  targetUserId?: string
  roleId?: string
  festivalId?: string
  resource?: Resource
  resourceId?: string
  oldValue?: string
  newValue?: string
  ipAddress?: string
  reason?: string
  createdAt: string
}

// Request types
export interface CreateRoleInput {
  name: string
  displayName: string
  description?: string
  festivalId?: string
  permissionIds: string[]
  priority?: number
}

export interface UpdateRoleInput {
  displayName?: string
  description?: string
  permissionIds?: string[]
  isActive?: boolean
  priority?: number
}

export interface AssignRoleInput {
  userId: string
  roleId: string
  festivalId?: string
  standId?: string
  expiresAt?: string
  notes?: string
}

export interface RemoveRoleInput {
  userId: string
  roleId: string
  festivalId?: string
  reason?: string
}

export interface CheckPermissionInput {
  userId: string
  resource: Resource
  action: Action
  festivalId?: string
  standId?: string
}

// API functions
export const rolesApi = {
  // Permission operations
  listPermissions: () => api.get<Permission[]>('/api/v1/rbac/permissions'),

  listPermissionsByResource: (resource: Resource) =>
    api.get<Permission[]>(`/api/v1/rbac/permissions?resource=${resource}`),

  // Role operations
  listRoles: (festivalId?: string) =>
    api.get<Role[]>(`/api/v1/rbac/roles${festivalId ? `?festivalId=${festivalId}` : ''}`),

  listSystemRoles: () => api.get<Role[]>('/api/v1/rbac/roles/system'),

  listCustomRoles: (festivalId: string) =>
    api.get<Role[]>(`/api/v1/rbac/roles/custom?festivalId=${festivalId}`),

  getRole: (roleId: string) => api.get<Role>(`/api/v1/rbac/roles/${roleId}`),

  createRole: (data: CreateRoleInput) => api.post<Role>('/api/v1/rbac/roles', data),

  updateRole: (roleId: string, data: UpdateRoleInput) =>
    api.patch<Role>(`/api/v1/rbac/roles/${roleId}`, data),

  deleteRole: (roleId: string) => api.delete<void>(`/api/v1/rbac/roles/${roleId}`),

  // Role assignment operations
  listRoleAssignments: (festivalId: string) =>
    api.get<RoleAssignment[]>(`/api/v1/festivals/${festivalId}/role-assignments`),

  getUserRoles: (userId: string, festivalId?: string) =>
    api.get<Role[]>(`/api/v1/rbac/users/${userId}/roles${festivalId ? `?festivalId=${festivalId}` : ''}`),

  assignRole: (data: AssignRoleInput) =>
    api.post<RoleAssignment>('/api/v1/rbac/role-assignments', data),

  removeRole: (data: RemoveRoleInput) =>
    api.delete<void>('/api/v1/rbac/role-assignments'),

  // Permission check operations
  getUserPermissions: (userId: string, festivalId?: string) =>
    api.get<UserPermissions>(
      `/api/v1/rbac/users/${userId}/permissions${festivalId ? `?festivalId=${festivalId}` : ''}`
    ),

  getPermissionMatrix: (userId: string, festivalId?: string) =>
    api.get<PermissionMatrix>(
      `/api/v1/rbac/users/${userId}/permission-matrix${festivalId ? `?festivalId=${festivalId}` : ''}`
    ),

  checkPermission: (data: CheckPermissionInput) =>
    api.post<{ allowed: boolean }>('/api/v1/rbac/check-permission', data),

  // Audit log operations
  listAuditLogs: (params: {
    festivalId?: string
    actorId?: string
    targetUserId?: string
    action?: string
    startDate?: string
    endDate?: string
    offset?: number
    limit?: number
  }) => {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, String(value))
      }
    })
    return api.get<{ logs: AuditLog[]; total: number }>(
      `/api/v1/rbac/audit-logs?${queryParams.toString()}`
    )
  },
}

// Helper constants
export const ALL_RESOURCES: Resource[] = [
  'festival',
  'stand',
  'product',
  'ticket',
  'lineup',
  'wallet',
  'transaction',
  'refund',
  'user',
  'staff',
  'report',
  'security',
  'settings',
  'role',
  'audit',
  'notification',
  'media',
]

export const ALL_ACTIONS: Action[] = [
  'create',
  'read',
  'update',
  'delete',
  'list',
  'export',
  'import',
  'approve',
  'reject',
  'scan',
  'process',
]

export const PREDEFINED_ROLES: Record<PredefinedRoleName, { displayName: string; description: string }> = {
  SUPER_ADMIN: {
    displayName: 'Super Admin',
    description: 'Full platform access - can manage all festivals and system settings',
  },
  FESTIVAL_OWNER: {
    displayName: 'Festival Owner',
    description: 'Owner of a festival - full access to their festival',
  },
  FESTIVAL_ADMIN: {
    displayName: 'Festival Admin',
    description: 'Administrator for a festival - almost full access except ownership transfer',
  },
  FINANCE_MANAGER: {
    displayName: 'Finance Manager',
    description: 'Manages finances, transactions, refunds, and reports',
  },
  LINEUP_MANAGER: {
    displayName: 'Lineup Manager',
    description: 'Manages festival lineup and scheduling',
  },
  SECURITY_MANAGER: {
    displayName: 'Security Manager',
    description: 'Manages security, access control, and scanning',
  },
  CASHIER: {
    displayName: 'Cashier',
    description: 'Can process sales and view basic information',
  },
  SCANNER: {
    displayName: 'Scanner',
    description: 'Can scan tickets and check entries',
  },
  VIEWER: {
    displayName: 'Viewer',
    description: 'Read-only access to festival information',
  },
}

// Resource display names
export const RESOURCE_LABELS: Record<Resource, string> = {
  festival: 'Festival',
  stand: 'Stands',
  product: 'Products',
  ticket: 'Tickets',
  lineup: 'Lineup',
  wallet: 'Wallets',
  transaction: 'Transactions',
  refund: 'Refunds',
  user: 'Users',
  staff: 'Staff',
  report: 'Reports',
  security: 'Security',
  settings: 'Settings',
  role: 'Roles',
  audit: 'Audit',
  notification: 'Notifications',
  media: 'Media',
}

// Action display names
export const ACTION_LABELS: Record<Action, string> = {
  create: 'Create',
  read: 'Read',
  update: 'Update',
  delete: 'Delete',
  list: 'List',
  export: 'Export',
  import: 'Import',
  approve: 'Approve',
  reject: 'Reject',
  scan: 'Scan',
  process: 'Process',
}
