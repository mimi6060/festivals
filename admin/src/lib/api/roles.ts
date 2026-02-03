import { api } from '../api'

// Types
export type Resource =
  | 'festival'
  | 'festivals'
  | 'stand'
  | 'stands'
  | 'product'
  | 'products'
  | 'ticket'
  | 'tickets'
  | 'lineup'
  | 'wallet'
  | 'wallets'
  | 'transaction'
  | 'transactions'
  | 'refund'
  | 'refunds'
  | 'user'
  | 'users'
  | 'staff'
  | 'report'
  | 'reports'
  | 'security'
  | 'settings'
  | 'role'
  | 'roles'
  | 'audit'
  | 'notification'
  | 'notifications'
  | 'media'
  | 'orders'
  | 'inventory'
  | 'nfc'
  | 'api'
  | 'chatbot'
  | 'gallery'
  | 'artists'
  | 'map'

export type Action =
  | 'create'
  | 'read'
  | 'write'
  | 'update'
  | 'delete'
  | 'list'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject'
  | 'scan'
  | 'process'
  | 'topup'
  | 'refund'
  | 'adjust'
  | 'schedule'
  | 'assign'
  | 'finance'
  | 'sales'
  | 'analytics'
  | 'general'
  | 'integrations'
  | 'branding'
  | 'nfc'
  | 'payment'
  | 'roles'
  | 'validate'
  | 'revoke'
  | 'alerts'
  | 'resolve'
  | 'send'
  | 'upload'
  | 'link'
  | 'unlink'
  | 'batch'
  | 'train'
  | 'config'

// Permission string type (e.g., "stands.read", "products.write")
export type PermissionString = `${string}.${string}`

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

// Permission group type
export interface PermissionGroup {
  name: string
  displayName: string
  description: string
  permissions: PermissionString[]
}

// User role summary
export interface UserRoleSummary {
  userId: string
  festivalId?: string
  totalRoles: number
  systemRoles: Role[]
  customRoles: Role[]
  highestPriorityRole?: Role
  totalPermissions: number
  permissionGroups: string[]
  expiringAssignments: RoleAssignment[]
  effectiveAt: string
}

// Role hierarchy node
export interface RoleHierarchyNode {
  role: Role
  children?: RoleHierarchyNode[]
  level: number
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

// Bulk operation inputs
export interface BulkAssignRoleInput {
  roleId: string
  userIds: string[]
  festivalId?: string
  notes?: string
}

export interface BulkRemoveRoleInput {
  roleId: string
  userIds: string[]
  festivalId?: string
  reason?: string
}

export interface AssignMultipleRolesInput {
  userId: string
  roleIds: string[]
  festivalId?: string
  notes?: string
}

export interface ReplaceUserRolesInput {
  userId: string
  roleIds: string[]
  festivalId?: string
  notes?: string
}

export interface CreateCustomRoleInput {
  name: string
  displayName: string
  description?: string
  festivalId: string
  permissionIds?: string[]
  permissionStrings?: PermissionString[]
  inheritsFrom?: string
  priority?: number
}

export interface CloneRoleInput {
  sourceRoleId: string
  festivalId: string
  newName: string
  newDisplayName: string
}

// Bulk operation results
export interface BulkOperationResult<T> {
  successful: T[]
  failed: { item: string; error: string }[]
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

  // ============================================================================
  // Enhanced Permission String Operations
  // ============================================================================

  // Check permission string
  checkPermissionString: (userId: string, permission: PermissionString, festivalId?: string) =>
    api.post<{ allowed: boolean }>('/api/v1/rbac/check-permission-string', {
      userId,
      permission,
      festivalId,
    }),

  // Check multiple permissions
  checkMultiplePermissions: (userId: string, permissions: PermissionString[], festivalId?: string) =>
    api.post<Record<PermissionString, boolean>>('/api/v1/rbac/check-permissions', {
      userId,
      permissions,
      festivalId,
    }),

  // Get effective permissions (as strings)
  getEffectivePermissions: (userId: string, festivalId?: string) =>
    api.get<PermissionString[]>(
      `/api/v1/rbac/users/${userId}/effective-permissions${festivalId ? `?festivalId=${festivalId}` : ''}`
    ),

  // ============================================================================
  // Permission Groups
  // ============================================================================

  // List all permission groups
  listPermissionGroups: () => api.get<PermissionGroup[]>('/api/v1/rbac/permission-groups'),

  // Get a specific permission group
  getPermissionGroup: (name: string) => api.get<PermissionGroup>(`/api/v1/rbac/permission-groups/${name}`),

  // Check if user has a permission group
  hasPermissionGroup: (userId: string, groupName: string, festivalId?: string) =>
    api.get<{ hasGroup: boolean }>(
      `/api/v1/rbac/users/${userId}/has-permission-group/${groupName}${festivalId ? `?festivalId=${festivalId}` : ''}`
    ),

  // ============================================================================
  // Bulk Role Operations
  // ============================================================================

  // Assign role to multiple users
  bulkAssignRole: (data: BulkAssignRoleInput) =>
    api.post<BulkOperationResult<RoleAssignment>>('/api/v1/rbac/bulk/assign-role', data),

  // Remove role from multiple users
  bulkRemoveRole: (data: BulkRemoveRoleInput) =>
    api.post<BulkOperationResult<void>>('/api/v1/rbac/bulk/remove-role', data),

  // Assign multiple roles to a user
  assignMultipleRoles: (data: AssignMultipleRolesInput) =>
    api.post<RoleAssignment[]>('/api/v1/rbac/assign-multiple', data),

  // Replace all user roles
  replaceUserRoles: (data: ReplaceUserRolesInput) =>
    api.post<RoleAssignment[]>('/api/v1/rbac/replace-roles', data),

  // ============================================================================
  // Custom Role Operations
  // ============================================================================

  // Create custom role with permission strings
  createCustomRole: (data: CreateCustomRoleInput) =>
    api.post<Role>('/api/v1/rbac/roles/custom', data),

  // Clone an existing role
  cloneRole: (data: CloneRoleInput) =>
    api.post<Role>('/api/v1/rbac/roles/clone', data),

  // ============================================================================
  // Role Hierarchy
  // ============================================================================

  // Get role hierarchy
  getRoleHierarchy: (festivalId?: string) =>
    api.get<RoleHierarchyNode[]>(
      `/api/v1/rbac/role-hierarchy${festivalId ? `?festivalId=${festivalId}` : ''}`
    ),

  // Get inherited roles for a role
  getInheritedRoles: (roleId: string) =>
    api.get<Role[]>(`/api/v1/rbac/roles/${roleId}/inherited`),

  // ============================================================================
  // User Role Summary
  // ============================================================================

  // Get user role summary
  getUserRoleSummary: (userId: string, festivalId?: string) =>
    api.get<UserRoleSummary>(
      `/api/v1/rbac/users/${userId}/role-summary${festivalId ? `?festivalId=${festivalId}` : ''}`
    ),

  // Get effective roles (including inherited)
  getEffectiveRoles: (userId: string, festivalId?: string) =>
    api.get<Role[]>(
      `/api/v1/rbac/users/${userId}/effective-roles${festivalId ? `?festivalId=${festivalId}` : ''}`
    ),

  // ============================================================================
  // Role Validation
  // ============================================================================

  // Check if actor can assign a role
  canAssignRole: (actorId: string, targetUserId: string, roleId: string, festivalId?: string) =>
    api.post<{ canAssign: boolean; reason?: string }>('/api/v1/rbac/can-assign-role', {
      actorId,
      targetUserId,
      roleId,
      festivalId,
    }),

  // Validate role assignment
  validateRoleAssignment: (userId: string, roleId: string, festivalId?: string) =>
    api.post<{ valid: boolean; error?: string }>('/api/v1/rbac/validate-assignment', {
      userId,
      roleId,
      festivalId,
    }),
}

// Helper constants
export const ALL_RESOURCES: Resource[] = [
  'festivals',
  'stands',
  'products',
  'orders',
  'wallets',
  'staff',
  'reports',
  'settings',
  'tickets',
  'lineup',
  'security',
  'audit',
  'transactions',
  'refunds',
  'notifications',
  'media',
  'map',
  'inventory',
  'nfc',
  'api',
  'users',
  'roles',
  'chatbot',
  'gallery',
  'artists',
]

export const ALL_ACTIONS: Action[] = [
  'read',
  'write',
  'create',
  'delete',
  'list',
  'export',
  'import',
  'process',
  'approve',
  'reject',
  'scan',
  'validate',
  'topup',
  'refund',
  'adjust',
  'schedule',
  'assign',
  'send',
  'upload',
  'link',
  'unlink',
]

// Common actions per resource type
export const RESOURCE_ACTIONS: Record<string, Action[]> = {
  festivals: ['read', 'write', 'delete', 'create', 'list', 'export'],
  stands: ['read', 'write', 'delete', 'create', 'list', 'export', 'import'],
  products: ['read', 'write', 'delete', 'create', 'list', 'export', 'import'],
  orders: ['read', 'write', 'delete', 'create', 'list', 'export', 'process', 'refund'],
  wallets: ['read', 'write', 'delete', 'create', 'list', 'export', 'topup', 'refund', 'adjust'],
  staff: ['read', 'write', 'delete', 'create', 'list', 'export', 'schedule', 'assign'],
  reports: ['read', 'list', 'export', 'create'],
  settings: ['read', 'write'],
  tickets: ['read', 'write', 'delete', 'create', 'list', 'export', 'scan', 'validate'],
  lineup: ['read', 'write', 'delete', 'create', 'list', 'export', 'import'],
  security: ['read', 'write', 'delete', 'create', 'list'],
  audit: ['read', 'list', 'export'],
  transactions: ['read', 'list', 'export', 'create', 'process', 'refund'],
  refunds: ['read', 'list', 'create', 'approve', 'reject', 'process'],
  notifications: ['read', 'write', 'delete', 'create', 'list', 'send'],
  media: ['read', 'write', 'delete', 'create', 'list', 'upload'],
  map: ['read', 'write', 'delete', 'create'],
  inventory: ['read', 'write', 'adjust'],
  nfc: ['read', 'write', 'link', 'unlink'],
  api: ['read', 'write', 'create', 'delete'],
  users: ['read', 'write', 'delete', 'create', 'list', 'export'],
  roles: ['read', 'write', 'delete', 'create', 'list', 'assign'],
  chatbot: ['read', 'write'],
  gallery: ['read', 'write', 'delete', 'upload'],
  artists: ['read', 'write', 'delete', 'create', 'list'],
}

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
export const RESOURCE_LABELS: Record<string, string> = {
  festival: 'Festival',
  festivals: 'Festivals',
  stand: 'Stands',
  stands: 'Stands',
  product: 'Products',
  products: 'Products',
  ticket: 'Tickets',
  tickets: 'Tickets',
  lineup: 'Lineup',
  wallet: 'Wallets',
  wallets: 'Wallets',
  transaction: 'Transactions',
  transactions: 'Transactions',
  refund: 'Refunds',
  refunds: 'Refunds',
  user: 'Users',
  users: 'Users',
  staff: 'Staff',
  report: 'Reports',
  reports: 'Reports',
  security: 'Security',
  settings: 'Settings',
  role: 'Roles',
  roles: 'Roles',
  audit: 'Audit',
  notification: 'Notifications',
  notifications: 'Notifications',
  media: 'Media',
  orders: 'Orders',
  inventory: 'Inventory',
  nfc: 'NFC',
  api: 'API',
  chatbot: 'Chatbot',
  gallery: 'Gallery',
  artists: 'Artists',
  map: 'Map',
}

// Action display names
export const ACTION_LABELS: Record<Action, string> = {
  create: 'Create',
  read: 'Read',
  write: 'Write',
  update: 'Update',
  delete: 'Delete',
  list: 'List',
  export: 'Export',
  import: 'Import',
  approve: 'Approve',
  reject: 'Reject',
  scan: 'Scan',
  process: 'Process',
  topup: 'Top Up',
  refund: 'Refund',
  adjust: 'Adjust',
  schedule: 'Schedule',
  assign: 'Assign',
  finance: 'Finance',
  sales: 'Sales',
  analytics: 'Analytics',
  general: 'General',
  integrations: 'Integrations',
  branding: 'Branding',
  nfc: 'NFC',
  payment: 'Payment',
  roles: 'Roles',
  validate: 'Validate',
  revoke: 'Revoke',
  alerts: 'Alerts',
  resolve: 'Resolve',
  send: 'Send',
  upload: 'Upload',
  link: 'Link',
  unlink: 'Unlink',
  batch: 'Batch',
  train: 'Train',
  config: 'Config',
}

// Permission group definitions for UI
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: 'festivals_management',
    displayName: 'Festival Management',
    description: 'Full control over festival settings',
    permissions: ['festivals.read', 'festivals.write', 'festivals.delete', 'festivals.create', 'festivals.list', 'festivals.export'],
  },
  {
    name: 'stands_management',
    displayName: 'Stands Management',
    description: 'Create, edit, and manage stands',
    permissions: ['stands.read', 'stands.write', 'stands.delete', 'stands.create', 'stands.list', 'stands.export', 'stands.import'],
  },
  {
    name: 'products_management',
    displayName: 'Products Management',
    description: 'Manage products and inventory',
    permissions: ['products.read', 'products.write', 'products.delete', 'products.create', 'products.list', 'products.export', 'products.import'],
  },
  {
    name: 'orders_management',
    displayName: 'Orders Management',
    description: 'Process and manage orders',
    permissions: ['orders.read', 'orders.write', 'orders.create', 'orders.list', 'orders.export', 'orders.process', 'orders.refund'],
  },
  {
    name: 'wallets_management',
    displayName: 'Wallets Management',
    description: 'Manage digital wallets and top-ups',
    permissions: ['wallets.read', 'wallets.write', 'wallets.list', 'wallets.topup', 'wallets.refund', 'wallets.adjust'],
  },
  {
    name: 'staff_management',
    displayName: 'Staff Management',
    description: 'Manage staff members and schedules',
    permissions: ['staff.read', 'staff.write', 'staff.delete', 'staff.create', 'staff.list', 'staff.schedule', 'staff.assign'],
  },
  {
    name: 'reports_access',
    displayName: 'Reports Access',
    description: 'View and export reports',
    permissions: ['reports.read', 'reports.list', 'reports.export'],
  },
  {
    name: 'settings_management',
    displayName: 'Settings Management',
    description: 'Configure festival settings',
    permissions: ['settings.read', 'settings.write'],
  },
  {
    name: 'tickets_management',
    displayName: 'Tickets Management',
    description: 'Manage tickets and access control',
    permissions: ['tickets.read', 'tickets.write', 'tickets.create', 'tickets.list', 'tickets.scan', 'tickets.validate'],
  },
  {
    name: 'security_management',
    displayName: 'Security Management',
    description: 'Manage security and incidents',
    permissions: ['security.read', 'security.write', 'security.create', 'security.list'],
  },
  {
    name: 'cashier_operations',
    displayName: 'Cashier Operations',
    description: 'Basic POS operations',
    permissions: ['products.read', 'products.list', 'orders.create', 'orders.process', 'transactions.create', 'transactions.process'],
  },
  {
    name: 'scanner_operations',
    displayName: 'Scanner Operations',
    description: 'Ticket scanning',
    permissions: ['tickets.read', 'tickets.scan', 'tickets.validate'],
  },
  {
    name: 'viewer_access',
    displayName: 'Viewer Access',
    description: 'Read-only access',
    permissions: ['festivals.read', 'stands.read', 'products.read', 'orders.read', 'reports.read', 'lineup.read'],
  },
]

// Helper function to create permission string
export function createPermissionString(resource: string, action: string): PermissionString {
  return `${resource}.${action}` as PermissionString
}

// Helper function to parse permission string
export function parsePermissionString(permission: PermissionString): { resource: string; action: string } {
  const [resource, action] = permission.split('.')
  return { resource, action }
}

// Get all permission strings for a resource
export function getResourcePermissions(resource: string): PermissionString[] {
  const actions = RESOURCE_ACTIONS[resource] || ['read', 'write', 'delete', 'create', 'list']
  return actions.map(action => createPermissionString(resource, action))
}

// Get all possible permission strings
export function getAllPermissionStrings(): PermissionString[] {
  const permissions: PermissionString[] = []
  for (const resource of ALL_RESOURCES) {
    const actions = RESOURCE_ACTIONS[resource] || ['read', 'write', 'delete', 'create', 'list']
    for (const action of actions) {
      permissions.push(createPermissionString(resource, action))
    }
  }
  return permissions
}
