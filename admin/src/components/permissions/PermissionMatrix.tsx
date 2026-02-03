'use client'

import { useState, useMemo } from 'react'
import { Check, X, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Resource,
  Action,
  Permission,
  ALL_RESOURCES,
  ALL_ACTIONS,
  RESOURCE_LABELS,
  ACTION_LABELS,
} from '@/lib/api/roles'

interface PermissionMatrixProps {
  // Permissions that are currently enabled
  enabledPermissions: Permission[]
  // Available permissions to choose from
  availablePermissions: Permission[]
  // Callback when permissions change
  onPermissionsChange?: (permissionIds: string[]) => void
  // Whether the matrix is read-only
  readOnly?: boolean
  // Whether to show only relevant actions for each resource
  showOnlyRelevant?: boolean
  // Custom class name
  className?: string
}

export function PermissionMatrix({
  enabledPermissions,
  availablePermissions,
  onPermissionsChange,
  readOnly = false,
  showOnlyRelevant = false,
  className,
}: PermissionMatrixProps) {
  // Build a map of resource:action -> permission for quick lookup
  const permissionMap = useMemo(() => {
    const map = new Map<string, Permission>()
    availablePermissions.forEach((p) => {
      map.set(`${p.resource}:${p.action}`, p)
    })
    return map
  }, [availablePermissions])

  // Build a set of enabled permission IDs
  const enabledIds = useMemo(() => {
    return new Set(enabledPermissions.map((p) => p.id))
  }, [enabledPermissions])

  // Determine which resources and actions to show
  const visibleResources = useMemo(() => {
    if (!showOnlyRelevant) return ALL_RESOURCES

    const resources = new Set<Resource>()
    availablePermissions.forEach((p) => resources.add(p.resource))
    return ALL_RESOURCES.filter((r) => resources.has(r))
  }, [availablePermissions, showOnlyRelevant])

  const visibleActions = useMemo(() => {
    if (!showOnlyRelevant) return ALL_ACTIONS

    const actions = new Set<Action>()
    availablePermissions.forEach((p) => actions.add(p.action))
    return ALL_ACTIONS.filter((a) => actions.has(a))
  }, [availablePermissions, showOnlyRelevant])

  // Toggle a permission
  const togglePermission = (resource: Resource, action: Action) => {
    if (readOnly || !onPermissionsChange) return

    const key = `${resource}:${action}`
    const permission = permissionMap.get(key)
    if (!permission) return

    const newIds = new Set(enabledIds)
    if (newIds.has(permission.id)) {
      newIds.delete(permission.id)
    } else {
      newIds.add(permission.id)
    }

    onPermissionsChange(Array.from(newIds))
  }

  // Toggle all permissions for a resource
  const toggleResourceRow = (resource: Resource) => {
    if (readOnly || !onPermissionsChange) return

    const resourcePermissions = availablePermissions.filter((p) => p.resource === resource)
    const allEnabled = resourcePermissions.every((p) => enabledIds.has(p.id))

    const newIds = new Set(enabledIds)
    resourcePermissions.forEach((p) => {
      if (allEnabled) {
        newIds.delete(p.id)
      } else {
        newIds.add(p.id)
      }
    })

    onPermissionsChange(Array.from(newIds))
  }

  // Toggle all permissions for an action
  const toggleActionColumn = (action: Action) => {
    if (readOnly || !onPermissionsChange) return

    const actionPermissions = availablePermissions.filter((p) => p.action === action)
    const allEnabled = actionPermissions.every((p) => enabledIds.has(p.id))

    const newIds = new Set(enabledIds)
    actionPermissions.forEach((p) => {
      if (allEnabled) {
        newIds.delete(p.id)
      } else {
        newIds.add(p.id)
      }
    })

    onPermissionsChange(Array.from(newIds))
  }

  // Get cell status
  const getCellStatus = (
    resource: Resource,
    action: Action
  ): 'enabled' | 'disabled' | 'unavailable' => {
    const key = `${resource}:${action}`
    const permission = permissionMap.get(key)
    if (!permission) return 'unavailable'
    return enabledIds.has(permission.id) ? 'enabled' : 'disabled'
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700">
              Resource
            </th>
            {visibleActions.map((action) => (
              <th
                key={action}
                className={cn(
                  'px-3 py-3 text-center font-semibold text-gray-700',
                  !readOnly && 'cursor-pointer hover:bg-gray-100'
                )}
                onClick={() => toggleActionColumn(action)}
              >
                {ACTION_LABELS[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleResources.map((resource, idx) => (
            <tr
              key={resource}
              className={cn(idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}
            >
              <td
                className={cn(
                  'sticky left-0 z-10 px-4 py-3 font-medium text-gray-900',
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                  !readOnly && 'cursor-pointer hover:bg-gray-100'
                )}
                onClick={() => toggleResourceRow(resource)}
              >
                {RESOURCE_LABELS[resource]}
              </td>
              {visibleActions.map((action) => {
                const status = getCellStatus(resource, action)
                return (
                  <td
                    key={`${resource}:${action}`}
                    className={cn(
                      'px-3 py-3 text-center',
                      status !== 'unavailable' && !readOnly && 'cursor-pointer hover:bg-gray-100'
                    )}
                    onClick={() => status !== 'unavailable' && togglePermission(resource, action)}
                  >
                    <PermissionCell status={status} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Cell component
function PermissionCell({ status }: { status: 'enabled' | 'disabled' | 'unavailable' }) {
  if (status === 'unavailable') {
    return (
      <div className="flex justify-center">
        <Minus className="h-4 w-4 text-gray-300" />
      </div>
    )
  }

  if (status === 'enabled') {
    return (
      <div className="flex justify-center">
        <div className="rounded-full bg-green-100 p-1">
          <Check className="h-4 w-4 text-green-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <div className="rounded-full bg-gray-100 p-1">
        <X className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  )
}

// Compact permission list for displaying in cards
interface PermissionListProps {
  permissions: Permission[]
  maxDisplay?: number
  className?: string
}

export function PermissionList({ permissions, maxDisplay = 5, className }: PermissionListProps) {
  const [showAll, setShowAll] = useState(false)

  const displayPermissions = showAll ? permissions : permissions.slice(0, maxDisplay)
  const hasMore = permissions.length > maxDisplay

  return (
    <div className={cn('space-y-1', className)}>
      {displayPermissions.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-2 text-sm text-gray-600"
        >
          <Check className="h-3 w-3 text-green-500" />
          <span>
            {RESOURCE_LABELS[p.resource]}: {ACTION_LABELS[p.action]}
          </span>
        </div>
      ))}
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-sm text-primary hover:underline"
        >
          +{permissions.length - maxDisplay} more permissions
        </button>
      )}
      {showAll && hasMore && (
        <button
          onClick={() => setShowAll(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          Show less
        </button>
      )}
    </div>
  )
}

// Permission badge component
interface PermissionBadgeProps {
  resource: Resource
  action: Action
  className?: string
}

export function PermissionBadge({ resource, action, className }: PermissionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700',
        className
      )}
    >
      {RESOURCE_LABELS[resource]}:{ACTION_LABELS[action]}
    </span>
  )
}
