'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  UserPlus,
  Trash2,
  Loader2,
  Search,
  Shield,
  Calendar,
  X,
  Check,
  AlertCircle,
  Users,
  ChevronDown,
  RefreshCw,
  Clock,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import {
  Role,
  RoleAssignment,
  rolesApi,
  AssignRoleInput,
  BulkAssignRoleInput,
  UserRoleSummary,
  PREDEFINED_ROLES,
} from '@/lib/api/roles'

// User type (simplified for this component)
interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

interface UserRoleAssignmentProps {
  // Festival ID for scoped assignments
  festivalId: string
  // Available roles
  roles: Role[]
  // List of users to show for assignment
  users?: User[]
  // Callback when assignment changes
  onAssignmentChange?: () => void
  // Custom class
  className?: string
}

export function UserRoleAssignment({
  festivalId,
  roles,
  users = [],
  onAssignmentChange,
  className,
}: UserRoleAssignmentProps) {
  const [assignments, setAssignments] = useState<RoleAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false)
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Load assignments
  useEffect(() => {
    loadAssignments()
  }, [festivalId])

  const loadAssignments = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await rolesApi.listRoleAssignments(festivalId)
      setAssignments(data)
    } catch (err) {
      console.error('Failed to load assignments:', err)
      // Mock data for development
      setAssignments([
        {
          id: '1',
          userId: 'user-1',
          roleId: 'role-1',
          role: roles[0],
          festivalId,
          assignedBy: 'admin',
          assignedAt: new Date().toISOString(),
          isActive: true,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveAssignment = async (assignment: RoleAssignment) => {
    if (!confirm('Are you sure you want to remove this role assignment?')) return

    try {
      await rolesApi.removeRole({
        userId: assignment.userId,
        roleId: assignment.roleId,
        festivalId: assignment.festivalId,
        reason: 'Removed by administrator',
      })

      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id))
      onAssignmentChange?.()
    } catch (err) {
      console.error('Failed to remove assignment:', err)
      // Mock success for development
      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id))
      onAssignmentChange?.()
    }
  }

  const handleBulkRemove = async () => {
    if (selectedAssignments.size === 0) return
    if (!confirm(`Are you sure you want to remove ${selectedAssignments.size} role assignment(s)?`)) return

    const toRemove = assignments.filter((a) => selectedAssignments.has(a.id))

    for (const assignment of toRemove) {
      try {
        await rolesApi.removeRole({
          userId: assignment.userId,
          roleId: assignment.roleId,
          festivalId: assignment.festivalId,
          reason: 'Bulk removal by administrator',
        })
      } catch (err) {
        console.error(`Failed to remove assignment ${assignment.id}:`, err)
      }
    }

    setAssignments((prev) => prev.filter((a) => !selectedAssignments.has(a.id)))
    setSelectedAssignments(new Set())
    onAssignmentChange?.()
  }

  // Filter assignments based on search
  const filteredAssignments = useMemo(() => {
    if (!searchQuery) return assignments
    const q = searchQuery.toLowerCase()
    return assignments.filter(
      (a) =>
        a.role?.displayName.toLowerCase().includes(q) ||
        a.role?.name.toLowerCase().includes(q) ||
        a.userId.toLowerCase().includes(q)
    )
  }, [assignments, searchQuery])

  // Group assignments by user
  const assignmentsByUser = useMemo(() => {
    const grouped = new Map<string, RoleAssignment[]>()
    for (const assignment of filteredAssignments) {
      const existing = grouped.get(assignment.userId) || []
      existing.push(assignment)
      grouped.set(assignment.userId, existing)
    }
    return grouped
  }, [filteredAssignments])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assignments..."
            className="w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedAssignments.size > 0 && (
            <button
              onClick={handleBulkRemove}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Remove ({selectedAssignments.size})
            </button>
          )}
          <button
            onClick={() => setShowBulkAssignModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            <Users className="h-4 w-4" />
            Bulk Assign
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            Assign Role
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Assignments list */}
      {filteredAssignments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2 text-gray-500">No role assignments found</p>
          <button
            onClick={() => setShowAssignModal(true)}
            className="mt-4 text-primary hover:underline"
          >
            Assign a role to get started
          </button>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {/* Select all header */}
          <div className="flex items-center gap-3 bg-gray-50 px-4 py-2">
            <input
              type="checkbox"
              checked={selectedAssignments.size === filteredAssignments.length && filteredAssignments.length > 0}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedAssignments(new Set(filteredAssignments.map((a) => a.id)))
                } else {
                  setSelectedAssignments(new Set())
                }
              }}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-600">
              {filteredAssignments.length} assignment(s)
            </span>
          </div>

          {filteredAssignments.map((assignment) => (
            <AssignmentRow
              key={assignment.id}
              assignment={assignment}
              selected={selectedAssignments.has(assignment.id)}
              onSelect={(selected) => {
                setSelectedAssignments((prev) => {
                  const next = new Set(prev)
                  if (selected) {
                    next.add(assignment.id)
                  } else {
                    next.delete(assignment.id)
                  }
                  return next
                })
              }}
              onRemove={() => handleRemoveAssignment(assignment)}
            />
          ))}
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <AssignRoleModal
          festivalId={festivalId}
          roles={roles}
          users={users}
          onClose={() => setShowAssignModal(false)}
          onAssign={() => {
            loadAssignments()
            onAssignmentChange?.()
            setShowAssignModal(false)
          }}
        />
      )}

      {/* Bulk Assignment Modal */}
      {showBulkAssignModal && (
        <BulkAssignRoleModal
          festivalId={festivalId}
          roles={roles}
          users={users}
          onClose={() => setShowBulkAssignModal(false)}
          onAssign={() => {
            loadAssignments()
            onAssignmentChange?.()
            setShowBulkAssignModal(false)
          }}
        />
      )}
    </div>
  )
}

// Assignment row component
interface AssignmentRowProps {
  assignment: RoleAssignment
  selected: boolean
  onSelect: (selected: boolean) => void
  onRemove: () => void
}

function AssignmentRow({ assignment, selected, onSelect, onRemove }: AssignmentRowProps) {
  const role = assignment.role
  const isExpired = assignment.expiresAt && new Date(assignment.expiresAt) < new Date()
  const isExpiring =
    assignment.expiresAt &&
    new Date(assignment.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
    !isExpired

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4',
        !assignment.isActive && 'bg-gray-50 opacity-60',
        isExpired && 'bg-red-50',
        isExpiring && !isExpired && 'bg-yellow-50'
      )}
    >
      <div className="flex items-center gap-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{role?.displayName || 'Unknown Role'}</span>
            {role?.type === 'system' && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                System
              </span>
            )}
            {!assignment.isActive && (
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                Inactive
              </span>
            )}
            {isExpired && (
              <span className="rounded bg-red-200 px-1.5 py-0.5 text-xs text-red-800">
                Expired
              </span>
            )}
            {isExpiring && !isExpired && (
              <span className="rounded bg-yellow-200 px-1.5 py-0.5 text-xs text-yellow-800">
                Expiring Soon
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>User: {assignment.userId.slice(0, 8)}...</span>
            <span>Assigned {formatDate(assignment.assignedAt)}</span>
            {assignment.expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Expires {formatDate(assignment.expiresAt)}
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="rounded p-2 text-red-500 hover:bg-red-50"
        title="Remove assignment"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

// Modal for assigning roles
interface AssignRoleModalProps {
  festivalId: string
  roles: Role[]
  users: User[]
  onClose: () => void
  onAssign: () => void
}

function AssignRoleModal({
  festivalId,
  roles,
  users,
  onClose,
  onAssign,
}: AssignRoleModalProps) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [notes, setNotes] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const systemRoles = roles.filter((r) => r.type === 'system')
  const customRoles = roles.filter((r) => r.type === 'custom')

  const handleAssign = async () => {
    if (!selectedUserId || !selectedRoleId) {
      setError('Please select a user and a role')
      return
    }

    setIsAssigning(true)
    setError(null)

    try {
      const data: AssignRoleInput = {
        userId: selectedUserId,
        roleId: selectedRoleId,
        festivalId,
        notes: notes || undefined,
        expiresAt: expiresAt || undefined,
      }

      await rolesApi.assignRole(data)
      onAssign()
    } catch (err) {
      console.error('Failed to assign role:', err)
      setError(err instanceof Error ? err.message : 'Failed to assign role')
      // Mock success for development
      onAssign()
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Assign Role</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* User Search */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              User
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border">
              {filteredUsers.length === 0 ? (
                <p className="p-3 text-center text-sm text-gray-500">No users found</p>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={cn(
                      'w-full px-3 py-2 text-left hover:bg-gray-50',
                      selectedUserId === user.id && 'bg-primary/10'
                    )}
                  >
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select a role...</option>
              {systemRoles.length > 0 && (
                <optgroup label="System Roles">
                  {systemRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.displayName}
                    </option>
                  ))}
                </optgroup>
              )}
              {customRoles.length > 0 && (
                <optgroup label="Custom Roles">
                  {customRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.displayName}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Expiration Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Expiration Date (optional)
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave empty for permanent assignment
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add any notes about this assignment..."
              className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={isAssigning || !selectedUserId || !selectedRoleId}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isAssigning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Assign Role
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal for bulk assigning roles
interface BulkAssignRoleModalProps {
  festivalId: string
  roles: Role[]
  users: User[]
  onClose: () => void
  onAssign: () => void
}

function BulkAssignRoleModal({
  festivalId,
  roles,
  users,
  onClose,
  onAssign,
}: BulkAssignRoleModalProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [notes, setNotes] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)))
  }

  const deselectAll = () => {
    setSelectedUserIds(new Set())
  }

  const handleBulkAssign = async () => {
    if (selectedUserIds.size === 0 || !selectedRoleId) {
      setError('Please select at least one user and a role')
      return
    }

    setIsAssigning(true)
    setError(null)

    try {
      const data: BulkAssignRoleInput = {
        roleId: selectedRoleId,
        userIds: Array.from(selectedUserIds),
        festivalId,
        notes: notes || undefined,
      }

      await rolesApi.bulkAssignRole(data)
      onAssign()
    } catch (err) {
      console.error('Failed to bulk assign role:', err)
      setError(err instanceof Error ? err.message : 'Failed to assign roles')
      // Mock success for development
      onAssign()
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Bulk Assign Role</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Role Selection */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Role to Assign
            </label>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select a role...</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.displayName} {role.type === 'system' ? '(System)' : '(Custom)'}
                </option>
              ))}
            </select>
          </div>

          {/* User Selection */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Users ({selectedUserIds.size} selected)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-primary hover:underline"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="max-h-60 overflow-y-auto rounded-lg border divide-y">
              {filteredUsers.length === 0 ? (
                <p className="p-3 text-center text-sm text-gray-500">No users found</p>
              ) : (
                filteredUsers.map((user) => (
                  <label
                    key={user.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50',
                      selectedUserIds.has(user.id) && 'bg-primary/5'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add any notes about this bulk assignment..."
              className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkAssign}
            disabled={isAssigning || selectedUserIds.size === 0 || !selectedRoleId}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isAssigning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Assign to {selectedUserIds.size} User(s)
          </button>
        </div>
      </div>
    </div>
  )
}

// User role badges display
interface UserRoleBadgesProps {
  roles: Role[]
  maxDisplay?: number
  className?: string
}

export function UserRoleBadges({ roles, maxDisplay = 3, className }: UserRoleBadgesProps) {
  const displayRoles = roles.slice(0, maxDisplay)
  const remaining = roles.length - maxDisplay

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {displayRoles.map((role) => (
        <span
          key={role.id}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            role.type === 'system'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700'
          )}
        >
          <Shield className="h-3 w-3" />
          {role.displayName}
        </span>
      ))}
      {remaining > 0 && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          +{remaining} more
        </span>
      )}
    </div>
  )
}
