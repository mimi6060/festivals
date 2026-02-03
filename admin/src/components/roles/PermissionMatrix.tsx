'use client'

import { useState, useMemo } from 'react'
import { Check, X, Minus, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PermissionString,
  ALL_RESOURCES,
  RESOURCE_ACTIONS,
  RESOURCE_LABELS,
  ACTION_LABELS,
  createPermissionString,
  parsePermissionString,
  PERMISSION_GROUPS,
  PermissionGroup,
} from '@/lib/api/roles'

interface PermissionMatrixProps {
  // Enabled permission strings
  enabledPermissions: PermissionString[]
  // Callback when permissions change
  onPermissionsChange?: (permissions: PermissionString[]) => void
  // Whether the matrix is read-only
  readOnly?: boolean
  // Show only resources that have some permissions available
  showOnlyRelevant?: boolean
  // Custom class name
  className?: string
  // Display mode
  mode?: 'matrix' | 'groups' | 'list'
}

export function PermissionMatrix({
  enabledPermissions,
  onPermissionsChange,
  readOnly = false,
  showOnlyRelevant = false,
  className,
  mode = 'matrix',
}: PermissionMatrixProps) {
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set())

  // Build a set of enabled permissions for quick lookup
  const enabledSet = useMemo(() => new Set(enabledPermissions), [enabledPermissions])

  // Determine visible resources based on mode
  const visibleResources = useMemo(() => {
    if (!showOnlyRelevant) return ALL_RESOURCES
    return ALL_RESOURCES.filter((r) => {
      const actions = RESOURCE_ACTIONS[r] || []
      return actions.length > 0
    })
  }, [showOnlyRelevant])

  // Toggle a permission
  const togglePermission = (permission: PermissionString) => {
    if (readOnly || !onPermissionsChange) return

    const newSet = new Set(enabledSet)
    if (newSet.has(permission)) {
      newSet.delete(permission)
    } else {
      newSet.add(permission)
    }

    onPermissionsChange(Array.from(newSet))
  }

  // Toggle all permissions for a resource
  const toggleResourcePermissions = (resource: string) => {
    if (readOnly || !onPermissionsChange) return

    const actions = RESOURCE_ACTIONS[resource] || []
    const resourcePerms = actions.map((a) => createPermissionString(resource, a))
    const allEnabled = resourcePerms.every((p) => enabledSet.has(p))

    const newSet = new Set(enabledSet)
    resourcePerms.forEach((p) => {
      if (allEnabled) {
        newSet.delete(p)
      } else {
        newSet.add(p)
      }
    })

    onPermissionsChange(Array.from(newSet))
  }

  // Toggle expanded state for a resource (in list mode)
  const toggleExpanded = (resource: string) => {
    setExpandedResources((prev) => {
      const next = new Set(prev)
      if (next.has(resource)) {
        next.delete(resource)
      } else {
        next.add(resource)
      }
      return next
    })
  }

  // Check if resource is fully selected
  const isResourceFullySelected = (resource: string) => {
    const actions = RESOURCE_ACTIONS[resource] || []
    return actions.every((a) => enabledSet.has(createPermissionString(resource, a)))
  }

  // Check if resource is partially selected
  const isResourcePartiallySelected = (resource: string) => {
    const actions = RESOURCE_ACTIONS[resource] || []
    const selected = actions.filter((a) => enabledSet.has(createPermissionString(resource, a)))
    return selected.length > 0 && selected.length < actions.length
  }

  if (mode === 'groups') {
    return (
      <PermissionGroupsView
        enabledPermissions={enabledSet}
        onToggle={togglePermission}
        readOnly={readOnly}
        className={className}
      />
    )
  }

  if (mode === 'list') {
    return (
      <PermissionListView
        resources={visibleResources}
        enabledPermissions={enabledSet}
        expandedResources={expandedResources}
        onToggle={togglePermission}
        onToggleResource={toggleResourcePermissions}
        onToggleExpanded={toggleExpanded}
        readOnly={readOnly}
        className={className}
      />
    )
  }

  // Default: Matrix view
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700">
              Resource
            </th>
            {['read', 'write', 'create', 'delete', 'list', 'export', 'import', 'process'].map((action) => (
              <th
                key={action}
                className="px-3 py-3 text-center font-semibold text-gray-700 whitespace-nowrap"
              >
                {ACTION_LABELS[action as keyof typeof ACTION_LABELS] || action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleResources.map((resource, idx) => {
            const actions = RESOURCE_ACTIONS[resource] || []
            const isFullySelected = isResourceFullySelected(resource)
            const isPartiallySelected = isResourcePartiallySelected(resource)

            return (
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
                  onClick={() => toggleResourcePermissions(resource)}
                >
                  <div className="flex items-center gap-2">
                    {!readOnly && (
                      <input
                        type="checkbox"
                        checked={isFullySelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isPartiallySelected
                        }}
                        onChange={() => toggleResourcePermissions(resource)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    )}
                    {RESOURCE_LABELS[resource] || resource}
                  </div>
                </td>
                {['read', 'write', 'create', 'delete', 'list', 'export', 'import', 'process'].map((action) => {
                  const perm = createPermissionString(resource, action)
                  const isAvailable = actions.includes(action as any)
                  const isEnabled = enabledSet.has(perm)

                  return (
                    <td
                      key={`${resource}:${action}`}
                      className={cn(
                        'px-3 py-3 text-center',
                        isAvailable && !readOnly && 'cursor-pointer hover:bg-gray-100'
                      )}
                      onClick={() => isAvailable && togglePermission(perm)}
                    >
                      <PermissionCell
                        status={!isAvailable ? 'unavailable' : isEnabled ? 'enabled' : 'disabled'}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
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

// Permission Groups View
interface PermissionGroupsViewProps {
  enabledPermissions: Set<PermissionString>
  onToggle: (perm: PermissionString) => void
  readOnly?: boolean
  className?: string
}

function PermissionGroupsView({
  enabledPermissions,
  onToggle,
  readOnly,
  className,
}: PermissionGroupsViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['festivals_management']))

  const toggleGroupExpanded = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const toggleAllInGroup = (group: PermissionGroup) => {
    if (readOnly) return

    const allSelected = group.permissions.every((p) => enabledPermissions.has(p))
    group.permissions.forEach((p) => {
      if (allSelected === enabledPermissions.has(p)) {
        onToggle(p)
      }
    })
  }

  return (
    <div className={cn('space-y-2', className)}>
      {PERMISSION_GROUPS.map((group) => {
        const isExpanded = expandedGroups.has(group.name)
        const selectedCount = group.permissions.filter((p) => enabledPermissions.has(p)).length
        const isFullySelected = selectedCount === group.permissions.length
        const isPartiallySelected = selectedCount > 0 && selectedCount < group.permissions.length

        return (
          <div key={group.name} className="rounded-lg border">
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleGroupExpanded(group.name)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
                <div>
                  <p className="font-medium">{group.displayName}</p>
                  <p className="text-sm text-gray-500">{group.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {selectedCount}/{group.permissions.length}
                </span>
                {!readOnly && (
                  <input
                    type="checkbox"
                    checked={isFullySelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isPartiallySelected
                    }}
                    onChange={() => toggleAllInGroup(group)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t px-3 py-2 bg-gray-50">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.permissions.map((perm) => (
                    <label
                      key={perm}
                      className={cn(
                        'flex items-center gap-2 rounded p-2 text-sm',
                        !readOnly && 'cursor-pointer hover:bg-gray-100'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={enabledPermissions.has(perm)}
                        onChange={() => onToggle(perm)}
                        disabled={readOnly}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="font-mono text-xs">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Permission List View
interface PermissionListViewProps {
  resources: string[]
  enabledPermissions: Set<PermissionString>
  expandedResources: Set<string>
  onToggle: (perm: PermissionString) => void
  onToggleResource: (resource: string) => void
  onToggleExpanded: (resource: string) => void
  readOnly?: boolean
  className?: string
}

function PermissionListView({
  resources,
  enabledPermissions,
  expandedResources,
  onToggle,
  onToggleResource,
  onToggleExpanded,
  readOnly,
  className,
}: PermissionListViewProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {resources.map((resource) => {
        const actions = RESOURCE_ACTIONS[resource] || []
        const isExpanded = expandedResources.has(resource)
        const selectedCount = actions.filter((a) =>
          enabledPermissions.has(createPermissionString(resource, a))
        ).length
        const isFullySelected = selectedCount === actions.length
        const isPartiallySelected = selectedCount > 0 && selectedCount < actions.length

        return (
          <div key={resource} className="rounded-lg border">
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
              onClick={() => onToggleExpanded(resource)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
                <span className="font-medium">{RESOURCE_LABELS[resource] || resource}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {selectedCount}/{actions.length}
                </span>
                {!readOnly && (
                  <input
                    type="checkbox"
                    checked={isFullySelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isPartiallySelected
                    }}
                    onChange={() => onToggleResource(resource)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t px-3 py-2 bg-gray-50">
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {actions.map((action) => {
                    const perm = createPermissionString(resource, action)
                    return (
                      <label
                        key={perm}
                        className={cn(
                          'flex items-center gap-2 rounded p-2 text-sm',
                          !readOnly && 'cursor-pointer hover:bg-gray-100'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={enabledPermissions.has(perm)}
                          onChange={() => onToggle(perm)}
                          disabled={readOnly}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span>{ACTION_LABELS[action as keyof typeof ACTION_LABELS] || action}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Compact permission badges for displaying in lists
interface PermissionBadgesProps {
  permissions: PermissionString[]
  maxDisplay?: number
  className?: string
}

export function PermissionBadges({ permissions, maxDisplay = 5, className }: PermissionBadgesProps) {
  const [showAll, setShowAll] = useState(false)
  const displayPerms = showAll ? permissions : permissions.slice(0, maxDisplay)
  const remaining = permissions.length - maxDisplay

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {displayPerms.map((perm) => (
        <span
          key={perm}
          className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
        >
          {perm}
        </span>
      ))}
      {remaining > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-primary hover:underline"
        >
          +{remaining} more
        </button>
      )}
      {showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(false)}
          className="text-xs text-gray-500 hover:underline"
        >
          Show less
        </button>
      )}
    </div>
  )
}
