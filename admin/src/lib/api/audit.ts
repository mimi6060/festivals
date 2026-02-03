import { api } from '../api'

// Types
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'role_assigned'
  | 'role_removed'
  | 'permission_changed'
  | 'settings_changed'
  | 'ticket_scanned'
  | 'refund_processed'
  | 'payment_received'
  | 'user_invited'
  | 'user_removed'
  | 'export'
  | 'import'

export type AuditResource =
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
  | 'role'
  | 'settings'
  | 'security'
  | 'notification'
  | 'media'
  | 'order'
  | 'nfc'

export interface AuditLogUser {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

export interface AuditLog {
  id: string
  festivalId: string
  action: AuditAction
  resource: AuditResource
  resourceId?: string
  resourceName?: string
  actorId: string
  actor?: AuditLogUser
  targetUserId?: string
  targetUser?: AuditLogUser
  description: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  changes?: Array<{
    field: string
    oldValue: unknown
    newValue: unknown
  }>
  metadata?: {
    ipAddress?: string
    userAgent?: string
    location?: string
    sessionId?: string
  }
  severity: 'info' | 'warning' | 'critical'
  createdAt: string
}

export interface AuditLogFilters {
  action?: AuditAction[]
  resource?: AuditResource[]
  actorId?: string
  targetUserId?: string
  startDate?: string
  endDate?: string
  severity?: ('info' | 'warning' | 'critical')[]
  search?: string
  page?: number
  perPage?: number
}

export interface PaginatedAuditLogsResponse {
  data: AuditLog[]
  meta: {
    total: number
    page: number
    perPage: number
    totalPages: number
  }
}

export interface AuditStats {
  totalLogs: number
  logsToday: number
  criticalLogs: number
  topActions: Array<{ action: AuditAction; count: number }>
  topUsers: Array<{ user: AuditLogUser; count: number }>
}

// API functions
export const auditApi = {
  // Get paginated audit logs for a festival
  getLogs: (festivalId: string, filters?: AuditLogFilters) => {
    const params = new URLSearchParams()

    if (filters?.action?.length) params.set('action', filters.action.join(','))
    if (filters?.resource?.length) params.set('resource', filters.resource.join(','))
    if (filters?.actorId) params.set('actor_id', filters.actorId)
    if (filters?.targetUserId) params.set('target_user_id', filters.targetUserId)
    if (filters?.startDate) params.set('start_date', filters.startDate)
    if (filters?.endDate) params.set('end_date', filters.endDate)
    if (filters?.severity?.length) params.set('severity', filters.severity.join(','))
    if (filters?.search) params.set('search', filters.search)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))

    const query = params.toString()
    return api.get<PaginatedAuditLogsResponse>(
      `/api/v1/festivals/${festivalId}/audit-logs${query ? `?${query}` : ''}`
    )
  },

  // Get a single audit log entry
  getLog: (festivalId: string, logId: string) =>
    api.get<AuditLog>(`/api/v1/festivals/${festivalId}/audit-logs/${logId}`),

  // Get audit statistics
  getStats: (festivalId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    const query = params.toString()
    return api.get<AuditStats>(
      `/api/v1/festivals/${festivalId}/audit-logs/stats${query ? `?${query}` : ''}`
    )
  },

  // Export audit logs to CSV
  exportToCSV: (festivalId: string, filters?: AuditLogFilters) => {
    const params = new URLSearchParams()

    if (filters?.action?.length) params.set('action', filters.action.join(','))
    if (filters?.resource?.length) params.set('resource', filters.resource.join(','))
    if (filters?.actorId) params.set('actor_id', filters.actorId)
    if (filters?.targetUserId) params.set('target_user_id', filters.targetUserId)
    if (filters?.startDate) params.set('start_date', filters.startDate)
    if (filters?.endDate) params.set('end_date', filters.endDate)
    if (filters?.severity?.length) params.set('severity', filters.severity.join(','))
    if (filters?.search) params.set('search', filters.search)
    params.set('format', 'csv')

    const query = params.toString()
    return api.get<Blob>(
      `/api/v1/festivals/${festivalId}/audit-logs/export${query ? `?${query}` : ''}`
    )
  },

  // Get user activity summary
  getUserActivity: (festivalId: string, userId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    const query = params.toString()
    return api.get<AuditLog[]>(
      `/api/v1/festivals/${festivalId}/audit-logs/user/${userId}${query ? `?${query}` : ''}`
    )
  },
}

// Query keys for React Query
export const auditQueryKeys = {
  all: ['audit'] as const,
  logs: (festivalId: string) => [...auditQueryKeys.all, 'logs', festivalId] as const,
  logsWithFilters: (festivalId: string, filters: AuditLogFilters) =>
    [...auditQueryKeys.logs(festivalId), filters] as const,
  log: (festivalId: string, logId: string) =>
    [...auditQueryKeys.all, 'log', festivalId, logId] as const,
  stats: (festivalId: string) => [...auditQueryKeys.all, 'stats', festivalId] as const,
  userActivity: (festivalId: string, userId: string) =>
    [...auditQueryKeys.all, 'userActivity', festivalId, userId] as const,
}

// Helper constants
export const AUDIT_ACTIONS: AuditAction[] = [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'role_assigned',
  'role_removed',
  'permission_changed',
  'settings_changed',
  'ticket_scanned',
  'refund_processed',
  'payment_received',
  'user_invited',
  'user_removed',
  'export',
  'import',
]

export const AUDIT_RESOURCES: AuditResource[] = [
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
  'role',
  'settings',
  'security',
  'notification',
  'media',
  'order',
  'nfc',
]

// Helper functions
export function getActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    create: 'Creation',
    update: 'Modification',
    delete: 'Suppression',
    login: 'Connexion',
    logout: 'Deconnexion',
    role_assigned: 'Role attribue',
    role_removed: 'Role retire',
    permission_changed: 'Permission modifiee',
    settings_changed: 'Parametres modifies',
    ticket_scanned: 'Billet scanne',
    refund_processed: 'Remboursement traite',
    payment_received: 'Paiement recu',
    user_invited: 'Utilisateur invite',
    user_removed: 'Utilisateur retire',
    export: 'Export',
    import: 'Import',
  }
  return labels[action] || action
}

export function getResourceLabel(resource: AuditResource): string {
  const labels: Record<AuditResource, string> = {
    festival: 'Festival',
    stand: 'Stand',
    product: 'Produit',
    ticket: 'Billet',
    lineup: 'Programmation',
    wallet: 'Portefeuille',
    transaction: 'Transaction',
    refund: 'Remboursement',
    user: 'Utilisateur',
    staff: 'Personnel',
    role: 'Role',
    settings: 'Parametres',
    security: 'Securite',
    notification: 'Notification',
    media: 'Media',
    order: 'Commande',
    nfc: 'NFC',
  }
  return labels[resource] || resource
}

export function getActionColor(action: AuditAction): string {
  const colors: Record<AuditAction, string> = {
    create: 'green',
    update: 'blue',
    delete: 'red',
    login: 'gray',
    logout: 'gray',
    role_assigned: 'purple',
    role_removed: 'orange',
    permission_changed: 'purple',
    settings_changed: 'yellow',
    ticket_scanned: 'blue',
    refund_processed: 'orange',
    payment_received: 'green',
    user_invited: 'blue',
    user_removed: 'red',
    export: 'gray',
    import: 'gray',
  }
  return colors[action] || 'gray'
}

export function getSeverityLabel(severity: 'info' | 'warning' | 'critical'): string {
  const labels = {
    info: 'Info',
    warning: 'Attention',
    critical: 'Critique',
  }
  return labels[severity]
}

export function getSeverityColor(severity: 'info' | 'warning' | 'critical'): string {
  const colors = {
    info: 'gray',
    warning: 'yellow',
    critical: 'red',
  }
  return colors[severity]
}

// Generate CSV content from audit logs
export function generateCSVContent(logs: AuditLog[]): string {
  const headers = [
    'Date',
    'Action',
    'Resource',
    'Description',
    'Utilisateur',
    'Email',
    'Severite',
    'IP',
  ]

  const rows = logs.map((log) => [
    new Date(log.createdAt).toLocaleString('fr-FR'),
    getActionLabel(log.action),
    getResourceLabel(log.resource),
    log.description,
    log.actor?.name || log.actorId,
    log.actor?.email || '',
    getSeverityLabel(log.severity),
    log.metadata?.ipAddress || '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  return csvContent
}

// Download CSV file
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
