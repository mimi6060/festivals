'use client'

import { useState, useEffect, useCallback, useMemo, createContext, useContext, ReactNode } from 'react'
import {
  rolesApi,
  Resource,
  Action,
  Role,
  Permission,
  UserPermissions,
  PermissionMatrix,
} from '@/lib/api/roles'

// Permission context for global access
interface PermissionContextValue {
  permissions: UserPermissions | null
  roles: Role[]
  isLoading: boolean
  error: Error | null
  hasPermission: (resource: Resource, action: Action) => boolean
  hasAnyPermission: (permissions: Array<{ resource: Resource; action: Action }>) => boolean
  hasAllPermissions: (permissions: Array<{ resource: Resource; action: Action }>) => boolean
  hasRole: (roleName: string) => boolean
  hasAnyRole: (roleNames: string[]) => boolean
  isSuperAdmin: () => boolean
  isFestivalOwner: () => boolean
  isFestivalAdmin: () => boolean
  refresh: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextValue | null>(null)

// Hook to get current user's permissions
export function usePermissions(userId?: string, festivalId?: string) {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPermissions = useCallback(async () => {
    if (!userId) {
      setPermissions(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [permsData, matrixData] = await Promise.all([
        rolesApi.getUserPermissions(userId, festivalId),
        rolesApi.getPermissionMatrix(userId, festivalId),
      ])
      setPermissions(permsData)
      setPermissionMatrix(matrixData)
    } catch (err) {
      console.error('Failed to fetch permissions:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch permissions'))

      // Mock data for development
      setPermissions({
        userId,
        festivalId,
        roles: [],
        permissions: [],
        effectiveAt: new Date().toISOString(),
      })
    } finally {
      setIsLoading(false)
    }
  }, [userId, festivalId])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  // Check if user has a specific permission
  const hasPermission = useCallback(
    (resource: Resource, action: Action): boolean => {
      if (!permissions) return false

      // Super admin has all permissions
      const hasSuperAdmin = permissions.roles.some((r) => r.name === 'SUPER_ADMIN')
      if (hasSuperAdmin) return true

      // Check specific permission
      return permissions.permissions.some(
        (p) => p.resource === resource && p.action === action
      )
    },
    [permissions]
  )

  // Check if user has any of the specified permissions
  const hasAnyPermission = useCallback(
    (perms: Array<{ resource: Resource; action: Action }>): boolean => {
      return perms.some((p) => hasPermission(p.resource, p.action))
    },
    [hasPermission]
  )

  // Check if user has all specified permissions
  const hasAllPermissions = useCallback(
    (perms: Array<{ resource: Resource; action: Action }>): boolean => {
      return perms.every((p) => hasPermission(p.resource, p.action))
    },
    [hasPermission]
  )

  // Check if user has a specific role
  const hasRole = useCallback(
    (roleName: string): boolean => {
      if (!permissions) return false
      return permissions.roles.some((r) => r.name === roleName)
    },
    [permissions]
  )

  // Check if user has any of the specified roles
  const hasAnyRole = useCallback(
    (roleNames: string[]): boolean => {
      return roleNames.some((name) => hasRole(name))
    },
    [hasRole]
  )

  // Role-specific checks
  const isSuperAdmin = useCallback(() => hasRole('SUPER_ADMIN'), [hasRole])
  const isFestivalOwner = useCallback(
    () => hasAnyRole(['SUPER_ADMIN', 'FESTIVAL_OWNER']),
    [hasAnyRole]
  )
  const isFestivalAdmin = useCallback(
    () => hasAnyRole(['SUPER_ADMIN', 'FESTIVAL_OWNER', 'FESTIVAL_ADMIN']),
    [hasAnyRole]
  )

  return {
    permissions,
    permissionMatrix,
    roles: permissions?.roles || [],
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    isSuperAdmin,
    isFestivalOwner,
    isFestivalAdmin,
    refresh: fetchPermissions,
  }
}

// Hook to fetch roles list
export function useRoles(festivalId?: string) {
  const [roles, setRoles] = useState<Role[]>([])
  const [systemRoles, setSystemRoles] = useState<Role[]>([])
  const [customRoles, setCustomRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchRoles = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [allRoles, sysRoles] = await Promise.all([
        rolesApi.listRoles(festivalId),
        rolesApi.listSystemRoles(),
      ])

      setRoles(allRoles)
      setSystemRoles(sysRoles)
      setCustomRoles(allRoles.filter((r) => r.type === 'custom'))
    } catch (err) {
      console.error('Failed to fetch roles:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch roles'))

      // Mock data for development
      const mockRoles: Role[] = [
        {
          id: '1',
          name: 'SUPER_ADMIN',
          displayName: 'Super Admin',
          description: 'Full platform access',
          type: 'system',
          permissions: [],
          isActive: true,
          priority: 1000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'FESTIVAL_OWNER',
          displayName: 'Festival Owner',
          description: 'Full festival access',
          type: 'system',
          permissions: [],
          isActive: true,
          priority: 900,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'FESTIVAL_ADMIN',
          displayName: 'Festival Admin',
          description: 'Admin festival access',
          type: 'system',
          permissions: [],
          isActive: true,
          priority: 800,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
      setRoles(mockRoles)
      setSystemRoles(mockRoles)
      setCustomRoles([])
    } finally {
      setIsLoading(false)
    }
  }, [festivalId])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  return {
    roles,
    systemRoles,
    customRoles,
    isLoading,
    error,
    refresh: fetchRoles,
  }
}

// Hook to fetch all permissions
export function useAllPermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchPermissions = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await rolesApi.listPermissions()
        setPermissions(data)
      } catch (err) {
        console.error('Failed to fetch permissions:', err)
        setError(err instanceof Error ? err : new Error('Failed to fetch permissions'))
        setPermissions([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchPermissions()
  }, [])

  // Group permissions by resource
  const permissionsByResource = useMemo(() => {
    const grouped: Record<Resource, Permission[]> = {} as Record<Resource, Permission[]>
    permissions.forEach((p) => {
      if (!grouped[p.resource]) {
        grouped[p.resource] = []
      }
      grouped[p.resource].push(p)
    })
    return grouped
  }, [permissions])

  return {
    permissions,
    permissionsByResource,
    isLoading,
    error,
  }
}

// Hook for checking a specific permission (quick check)
export function useCanAccess(
  userId: string | undefined,
  resource: Resource,
  action: Action,
  festivalId?: string
) {
  const [canAccess, setCanAccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      if (!userId) {
        setCanAccess(false)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const result = await rolesApi.checkPermission({
          userId,
          resource,
          action,
          festivalId,
        })
        setCanAccess(result.allowed)
      } catch (err) {
        console.error('Failed to check permission:', err)
        setCanAccess(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [userId, resource, action, festivalId])

  return { canAccess, isLoading }
}

// Provider component for permission context
interface PermissionProviderProps {
  children: ReactNode
  userId?: string
  festivalId?: string
}

export function PermissionProvider({ children, userId, festivalId }: PermissionProviderProps) {
  const permissionState = usePermissions(userId, festivalId)

  return (
    <PermissionContext.Provider value={permissionState}>
      {children}
    </PermissionContext.Provider>
  )
}

// Hook to use permission context
export function usePermissionContext() {
  const context = useContext(PermissionContext)
  if (!context) {
    throw new Error('usePermissionContext must be used within a PermissionProvider')
  }
  return context
}

// Conditional rendering component
interface RequirePermissionProps {
  resource: Resource
  action: Action
  children: ReactNode
  fallback?: ReactNode
}

export function RequirePermission({
  resource,
  action,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const { hasPermission, isLoading } = usePermissionContext()

  if (isLoading) {
    return null
  }

  return hasPermission(resource, action) ? <>{children}</> : <>{fallback}</>
}

// Role-based conditional rendering
interface RequireRoleProps {
  roles: string[]
  children: ReactNode
  fallback?: ReactNode
  matchAll?: boolean
}

export function RequireRole({
  roles,
  children,
  fallback = null,
  matchAll = false,
}: RequireRoleProps) {
  const { hasRole, hasAnyRole, isLoading } = usePermissionContext()

  if (isLoading) {
    return null
  }

  const hasAccess = matchAll ? roles.every(hasRole) : hasAnyRole(roles)

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
