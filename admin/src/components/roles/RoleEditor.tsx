'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Save, Loader2, AlertCircle, Shield, Info, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Role,
  Permission,
  CreateRoleInput,
  UpdateRoleInput,
  rolesApi,
  PREDEFINED_ROLES,
  PredefinedRoleName,
  PermissionString,
  PermissionGroup,
  PERMISSION_GROUPS,
  ALL_RESOURCES,
  RESOURCE_ACTIONS,
  RESOURCE_LABELS,
  ACTION_LABELS,
  createPermissionString,
} from '@/lib/api/roles'

interface RoleEditorProps {
  // Existing role to edit (null for new role)
  role?: Role | null
  // Festival ID for scoped roles
  festivalId?: string
  // Available permissions
  permissions: Permission[]
  // Callback on save
  onSave?: (role: Role) => void
  // Callback on cancel
  onCancel?: () => void
  // Custom class
  className?: string
}

interface RoleFormData {
  name: string
  displayName: string
  description: string
  priority: number
  isActive: boolean
}

export function RoleEditor({
  role,
  festivalId,
  permissions,
  onSave,
  onCancel,
  className,
}: RoleEditorProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])
  const [selectedPermissionStrings, setSelectedPermissionStrings] = useState<Set<PermissionString>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['festivals_management']))
  const [viewMode, setViewMode] = useState<'groups' | 'matrix'>('groups')

  const isSystemRole = role?.type === 'system'
  const isNewRole = !role

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormData>({
    defaultValues: {
      name: '',
      displayName: '',
      description: '',
      priority: 0,
      isActive: true,
    },
  })

  // Load role data when role changes
  useEffect(() => {
    if (role) {
      reset({
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        priority: role.priority,
        isActive: role.isActive,
      })
      setSelectedPermissionIds(role.permissions.map((p) => p.id))

      // Convert permissions to permission strings
      const permStrings = new Set<PermissionString>()
      role.permissions.forEach((p) => {
        permStrings.add(createPermissionString(p.resource, p.action))
      })
      setSelectedPermissionStrings(permStrings)
    } else {
      reset({
        name: '',
        displayName: '',
        description: '',
        priority: 0,
        isActive: true,
      })
      setSelectedPermissionIds([])
      setSelectedPermissionStrings(new Set())
    }
  }, [role, reset])

  // Toggle a permission group
  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  // Toggle all permissions in a group
  const toggleGroupPermissions = (group: PermissionGroup) => {
    if (isSystemRole) return

    const allSelected = group.permissions.every((p) => selectedPermissionStrings.has(p))

    setSelectedPermissionStrings((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        group.permissions.forEach((p) => next.delete(p))
      } else {
        group.permissions.forEach((p) => next.add(p))
      }
      return next
    })
  }

  // Toggle a single permission
  const togglePermission = (permission: PermissionString) => {
    if (isSystemRole) return

    setSelectedPermissionStrings((prev) => {
      const next = new Set(prev)
      if (next.has(permission)) {
        next.delete(permission)
      } else {
        next.add(permission)
      }
      return next
    })
  }

  // Check if group is fully selected
  const isGroupFullySelected = (group: PermissionGroup) => {
    return group.permissions.every((p) => selectedPermissionStrings.has(p))
  }

  // Check if group is partially selected
  const isGroupPartiallySelected = (group: PermissionGroup) => {
    const selected = group.permissions.filter((p) => selectedPermissionStrings.has(p))
    return selected.length > 0 && selected.length < group.permissions.length
  }

  const onSubmit = async (data: RoleFormData) => {
    setIsSaving(true)
    setError(null)

    try {
      let savedRole: Role

      if (isNewRole) {
        const createData: CreateRoleInput = {
          name: data.name.toUpperCase().replace(/\s+/g, '_'),
          displayName: data.displayName,
          description: data.description,
          festivalId,
          permissionIds: selectedPermissionIds,
          priority: data.priority,
        }
        savedRole = await rolesApi.createRole(createData)
      } else {
        const updateData: UpdateRoleInput = {
          displayName: data.displayName,
          description: data.description,
          isActive: data.isActive,
          priority: data.priority,
        }

        // Only update permissions for custom roles
        if (!isSystemRole) {
          updateData.permissionIds = selectedPermissionIds
        }

        savedRole = await rolesApi.updateRole(role!.id, updateData)
      }

      onSave?.(savedRole)
    } catch (err) {
      console.error('Failed to save role:', err)
      setError(err instanceof Error ? err.message : 'Failed to save role')

      // Mock for development
      const mockRole: Role = {
        id: role?.id || crypto.randomUUID(),
        name: data.name.toUpperCase().replace(/\s+/g, '_'),
        displayName: data.displayName,
        description: data.description,
        type: 'custom',
        festivalId,
        permissions: permissions.filter((p) => selectedPermissionIds.includes(p.id)),
        isActive: data.isActive,
        priority: data.priority,
        createdAt: role?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      onSave?.(mockRole)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* System role warning */}
      {isSystemRole && (
        <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
          <Info className="h-5 w-5 text-blue-500 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">System Role</p>
            <p className="text-sm text-blue-700">
              This is a predefined system role. You can only edit the display name,
              description, and active status. Permissions cannot be modified.
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5" />
            Role Information
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Name (only for new custom roles) */}
            {isNewRole && (
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Role Name (Internal)
                </label>
                <input
                  type="text"
                  {...register('name', {
                    required: 'Role name is required',
                    pattern: {
                      value: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
                      message: 'Use only letters, numbers, and underscores',
                    },
                  })}
                  placeholder="e.g., CUSTOM_MANAGER"
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>
            )}

            {/* Display Name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Display Name
              </label>
              <input
                type="text"
                {...register('displayName', { required: 'Display name is required' })}
                placeholder="e.g., Custom Manager"
                className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {errors.displayName && (
                <p className="mt-1 text-sm text-red-500">{errors.displayName.message}</p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Priority
              </label>
              <input
                type="number"
                {...register('priority', { valueAsNumber: true })}
                min="0"
                max="999"
                className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-gray-500">
                Higher priority roles take precedence (0-999)
              </p>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Describe what this role is for..."
                className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('isActive')}
                id="isActive"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Permissions</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('groups')}
                className={cn(
                  'px-3 py-1 text-sm rounded-lg',
                  viewMode === 'groups'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Groups
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={cn(
                  'px-3 py-1 text-sm rounded-lg',
                  viewMode === 'matrix'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Matrix
              </button>
            </div>
          </div>

          {viewMode === 'groups' ? (
            <div className="space-y-2">
              {PERMISSION_GROUPS.map((group) => {
                const isExpanded = expandedGroups.has(group.name)
                const isFullySelected = isGroupFullySelected(group)
                const isPartiallySelected = isGroupPartiallySelected(group)

                return (
                  <div key={group.name} className="rounded-lg border">
                    <div
                      className={cn(
                        'flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50',
                        isSystemRole && 'cursor-default'
                      )}
                      onClick={() => toggleGroup(group.name)}
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
                          {group.permissions.filter((p) => selectedPermissionStrings.has(p)).length}/{group.permissions.length}
                        </span>
                        {!isSystemRole && (
                          <input
                            type="checkbox"
                            checked={isFullySelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isPartiallySelected
                            }}
                            onChange={() => toggleGroupPermissions(group)}
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
                                !isSystemRole && 'cursor-pointer hover:bg-gray-100'
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissionStrings.has(perm)}
                                onChange={() => togglePermission(perm)}
                                disabled={isSystemRole}
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
          ) : (
            <PermissionMatrixView
              selectedPermissions={selectedPermissionStrings}
              onToggle={togglePermission}
              readOnly={isSystemRole}
            />
          )}

          <p className="mt-4 text-sm text-gray-500">
            {selectedPermissionStrings.size} permission(s) selected
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border px-4 py-2 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isNewRole ? 'Create Role' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Permission Matrix View Component
interface PermissionMatrixViewProps {
  selectedPermissions: Set<PermissionString>
  onToggle: (perm: PermissionString) => void
  readOnly?: boolean
}

function PermissionMatrixView({ selectedPermissions, onToggle, readOnly }: PermissionMatrixViewProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-semibold">
              Resource
            </th>
            {['read', 'write', 'create', 'delete', 'list', 'export'].map((action) => (
              <th key={action} className="px-3 py-2 text-center font-semibold">
                {ACTION_LABELS[action as keyof typeof ACTION_LABELS] || action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {ALL_RESOURCES.map((resource) => {
            const actions = RESOURCE_ACTIONS[resource] || []
            return (
              <tr key={resource} className="hover:bg-gray-50">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">
                  {RESOURCE_LABELS[resource] || resource}
                </td>
                {['read', 'write', 'create', 'delete', 'list', 'export'].map((action) => {
                  const perm = createPermissionString(resource, action)
                  const isAvailable = actions.includes(action as any)
                  const isSelected = selectedPermissions.has(perm)

                  return (
                    <td key={`${resource}-${action}`} className="px-3 py-2 text-center">
                      {isAvailable ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggle(perm)}
                          disabled={readOnly}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
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

// Quick role template selector
interface RoleTemplateSelectorProps {
  onSelect: (template: PredefinedRoleName) => void
  className?: string
}

export function RoleTemplateSelector({ onSelect, className }: RoleTemplateSelectorProps) {
  const templates = Object.entries(PREDEFINED_ROLES) as [
    PredefinedRoleName,
    { displayName: string; description: string }
  ][]

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {templates.map(([name, config]) => (
        <button
          key={name}
          type="button"
          onClick={() => onSelect(name)}
          className="rounded-lg border p-4 text-left hover:border-primary hover:bg-primary/5"
        >
          <h4 className="font-medium text-gray-900">{config.displayName}</h4>
          <p className="mt-1 text-sm text-gray-500">{config.description}</p>
        </button>
      ))}
    </div>
  )
}
