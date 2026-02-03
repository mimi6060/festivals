'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Save, Loader2, AlertCircle, Shield, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Role,
  Permission,
  CreateRoleInput,
  UpdateRoleInput,
  rolesApi,
  PREDEFINED_ROLES,
  PredefinedRoleName,
} from '@/lib/api/roles'
import { PermissionMatrix } from './PermissionMatrix'

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
    } else {
      reset({
        name: '',
        displayName: '',
        description: '',
        priority: 0,
        isActive: true,
      })
      setSelectedPermissionIds([])
    }
  }, [role, reset])

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

  // Get enabled permissions for the matrix
  const enabledPermissions = permissions.filter((p) =>
    selectedPermissionIds.includes(p.id)
  )

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

          <div className="space-y-4">
            {/* Name (only for new custom roles) */}
            {isNewRole && (
              <div>
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
                <p className="mt-1 text-xs text-gray-500">
                  Will be converted to uppercase with underscores
                </p>
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

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Describe what this role is for..."
                className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
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
          <h3 className="mb-4 text-lg font-semibold">Permissions</h3>

          {isSystemRole ? (
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-600 mb-4">
                System role permissions (read-only):
              </p>
              <PermissionMatrix
                enabledPermissions={enabledPermissions}
                availablePermissions={permissions}
                readOnly={true}
                showOnlyRelevant={true}
              />
            </div>
          ) : (
            <PermissionMatrix
              enabledPermissions={enabledPermissions}
              availablePermissions={permissions}
              onPermissionsChange={setSelectedPermissionIds}
              readOnly={false}
            />
          )}

          <p className="mt-4 text-sm text-gray-500">
            {selectedPermissionIds.length} permission(s) selected
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
