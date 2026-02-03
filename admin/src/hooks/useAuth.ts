'use client'

import { useUser, UserProfile } from '@auth0/nextjs-auth0/client'
import { useCallback, useMemo } from 'react'
import { UserRole } from '@/lib/api/users'

// Permission types for role-based access control
export type Permission =
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'users:ban'
  | 'festivals:read'
  | 'festivals:write'
  | 'festivals:delete'
  | 'tickets:read'
  | 'tickets:write'
  | 'tickets:scan'
  | 'orders:read'
  | 'orders:write'
  | 'orders:refund'
  | 'wallets:read'
  | 'wallets:write'
  | 'wallets:refund'
  | 'staff:read'
  | 'staff:write'
  | 'staff:manage'
  | 'reports:read'
  | 'reports:export'
  | 'settings:read'
  | 'settings:write'
  | 'impersonate'

// Role to permissions mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  ADMIN: [
    'users:read', 'users:write', 'users:delete', 'users:ban',
    'festivals:read', 'festivals:write', 'festivals:delete',
    'tickets:read', 'tickets:write', 'tickets:scan',
    'orders:read', 'orders:write', 'orders:refund',
    'wallets:read', 'wallets:write', 'wallets:refund',
    'staff:read', 'staff:write', 'staff:manage',
    'reports:read', 'reports:export',
    'settings:read', 'settings:write',
    'impersonate',
  ],
  ORGANIZER: [
    'users:read',
    'festivals:read', 'festivals:write',
    'tickets:read', 'tickets:write', 'tickets:scan',
    'orders:read', 'orders:write', 'orders:refund',
    'wallets:read', 'wallets:write', 'wallets:refund',
    'staff:read', 'staff:write', 'staff:manage',
    'reports:read', 'reports:export',
    'settings:read', 'settings:write',
  ],
  MANAGER: [
    'users:read',
    'festivals:read',
    'tickets:read', 'tickets:scan',
    'orders:read', 'orders:write',
    'wallets:read', 'wallets:write',
    'staff:read', 'staff:write',
    'reports:read',
    'settings:read',
  ],
  STAFF: [
    'tickets:read', 'tickets:scan',
    'orders:read',
    'wallets:read', 'wallets:write',
  ],
  FESTIVALIER: [
    'tickets:read',
    'orders:read',
    'wallets:read',
  ],
}

// Mock user for development mode when Auth0 is not configured
const DEV_MOCK_USER: AuthUser = {
  id: 'dev-user-1',
  auth0Id: 'dev|mock-user',
  email: 'dev@festival.local',
  name: 'Dev User',
  picture: undefined,
  roles: ['ADMIN'],
  isDevMode: true,
}

// Extended user interface with roles
export interface AuthUser {
  id: string
  auth0Id: string
  email: string
  name: string
  picture?: string
  roles: UserRole[]
  isDevMode?: boolean
}

// Auth hook return type
export interface UseAuthReturn {
  // User state
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  isDevMode: boolean
  error: Error | undefined

  // Role checking helpers
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
  hasAllRoles: (roles: UserRole[]) => boolean
  isAdmin: () => boolean
  isOrganizer: () => boolean
  isStaff: () => boolean

  // Permission checking helpers
  hasPermission: (permission: Permission) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
  hasAllPermissions: (permissions: Permission[]) => boolean
  canImpersonate: () => boolean

  // Auth actions
  logout: () => void
  loginUrl: string
  logoutUrl: string
}

// Check if Auth0 is configured (client-side check)
function isAuth0Configured(): boolean {
  // In the browser, we can't directly check env vars
  // Instead, we check if the Auth0 provider is working
  // by seeing if useUser returns meaningful data or errors
  return typeof window !== 'undefined'
}

// Custom hook that wraps Auth0's useUser with role checking
export function useAuth(): UseAuthReturn {
  const { user: auth0User, isLoading: auth0Loading, error: auth0Error } = useUser()

  // Determine if we're in dev mode (Auth0 not configured)
  const isDevMode = useMemo(() => {
    // If we have an Auth0 error about configuration, we're in dev mode
    if (auth0Error?.message?.includes('configuration')) {
      return true
    }
    // Check if the mock header indicates dev mode
    if (typeof window !== 'undefined') {
      // In development without Auth0, middleware sets this header
      // We can also check for the absence of Auth0 session
      return !auth0User && !auth0Loading && !auth0Error
    }
    return false
  }, [auth0User, auth0Loading, auth0Error])

  // Transform Auth0 user to our AuthUser format
  const user = useMemo((): AuthUser | null => {
    // In dev mode without Auth0, return mock user
    if (isDevMode && !auth0Loading) {
      return DEV_MOCK_USER
    }

    if (!auth0User) return null

    // Extract roles from Auth0 user metadata or custom claims
    const roles = extractRolesFromAuth0User(auth0User)

    return {
      id: auth0User.sub || '',
      auth0Id: auth0User.sub || '',
      email: auth0User.email || '',
      name: auth0User.name || auth0User.nickname || '',
      picture: auth0User.picture,
      roles,
      isDevMode: false,
    }
  }, [auth0User, isDevMode, auth0Loading])

  // Role checking functions
  const hasRole = useCallback(
    (role: UserRole): boolean => {
      if (!user) return false
      return user.roles.includes(role)
    },
    [user]
  )

  const hasAnyRole = useCallback(
    (roles: UserRole[]): boolean => {
      if (!user) return false
      return roles.some((role) => user.roles.includes(role))
    },
    [user]
  )

  const hasAllRoles = useCallback(
    (roles: UserRole[]): boolean => {
      if (!user) return false
      return roles.every((role) => user.roles.includes(role))
    },
    [user]
  )

  const isAdmin = useCallback(() => hasRole('ADMIN'), [hasRole])
  const isOrganizer = useCallback(() => hasAnyRole(['ADMIN', 'ORGANIZER']), [hasAnyRole])
  const isStaff = useCallback(
    () => hasAnyRole(['ADMIN', 'ORGANIZER', 'MANAGER', 'STAFF']),
    [hasAnyRole]
  )

  // Permission checking functions
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false
      // Admin has all permissions
      if (user.roles.includes('ADMIN')) return true
      // Check if any of user's roles grant this permission
      return user.roles.some((role) => rolePermissions[role]?.includes(permission))
    },
    [user]
  )

  const hasAnyPermission = useCallback(
    (permissions: Permission[]): boolean => {
      return permissions.some((permission) => hasPermission(permission))
    },
    [hasPermission]
  )

  const hasAllPermissions = useCallback(
    (permissions: Permission[]): boolean => {
      return permissions.every((permission) => hasPermission(permission))
    },
    [hasPermission]
  )

  const canImpersonate = useCallback(() => hasPermission('impersonate'), [hasPermission])

  // Auth actions
  const logout = useCallback(() => {
    if (isDevMode) {
      // In dev mode, just reload to clear any local state
      window.location.href = '/login'
      return
    }
    // Use Auth0 logout
    window.location.href = '/api/auth/logout'
  }, [isDevMode])

  return {
    user,
    isLoading: auth0Loading,
    isAuthenticated: !!user,
    isDevMode,
    error: auth0Error,

    hasRole,
    hasAnyRole,
    hasAllRoles,
    isAdmin,
    isOrganizer,
    isStaff,

    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canImpersonate,

    logout,
    loginUrl: '/api/auth/login',
    logoutUrl: '/api/auth/logout',
  }
}

// Helper to extract roles from Auth0 user object
function extractRolesFromAuth0User(auth0User: UserProfile): UserRole[] {
  // Roles can be stored in different places depending on Auth0 configuration:
  // 1. Custom namespace claim (recommended)
  // 2. app_metadata.roles
  // 3. user_metadata.roles

  const customNamespace = 'https://festival.app/roles'

  // Check custom namespace claim first
  if (auth0User[customNamespace]) {
    const roles = auth0User[customNamespace] as string[]
    return roles.filter(isValidRole)
  }

  // Check standard roles claim
  if (auth0User['roles']) {
    const roles = auth0User['roles'] as string[]
    return roles.filter(isValidRole)
  }

  // Check app_metadata
  const appMetadata = auth0User['app_metadata'] as Record<string, unknown> | undefined
  if (appMetadata?.roles) {
    const roles = appMetadata.roles as string[]
    return roles.filter(isValidRole)
  }

  // Default to FESTIVALIER if no roles found
  return ['FESTIVALIER']
}

// Type guard for valid roles
function isValidRole(role: string): role is UserRole {
  return ['ADMIN', 'ORGANIZER', 'MANAGER', 'STAFF', 'FESTIVALIER'].includes(role)
}

// Export a context provider for the auth state (optional, for global access)
export { DEV_MOCK_USER }
