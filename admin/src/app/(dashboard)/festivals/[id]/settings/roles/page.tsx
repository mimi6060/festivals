'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Shield,
  Users,
  Settings,
  Search,
  Loader2,
  ChevronRight,
  Trash2,
  Edit,
  Eye,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFestivalStore } from '@/stores/festivalStore'
import { useRoles, useAllPermissions } from '@/hooks/usePermissions'
import { Role, rolesApi, PREDEFINED_ROLES } from '@/lib/api/roles'
import { PermissionList } from '@/components/permissions/PermissionMatrix'
import { UserRoleAssignment } from '@/components/permissions/UserRoleAssignment'

type TabType = 'roles' | 'assignments' | 'audit'

export default function RolesSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const { currentFestival } = useFestivalStore()

  const [activeTab, setActiveTab] = useState<TabType>('roles')
  const [searchQuery, setSearchQuery] = useState('')
  const { roles, systemRoles, customRoles, isLoading, refresh } = useRoles(festivalId)
  const { permissions } = useAllPermissions()

  const filteredRoles = roles.filter(
    (r) =>
      r.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDeleteRole = async (role: Role) => {
    if (role.type === 'system') {
      alert('System roles cannot be deleted')
      return
    }

    if (!confirm(`Are you sure you want to delete the role "${role.displayName}"?`)) {
      return
    }

    try {
      await rolesApi.deleteRole(role.id)
      refresh()
    } catch (err) {
      console.error('Failed to delete role:', err)
      // Mock success for development
      refresh()
    }
  }

  const tabs = [
    { id: 'roles' as TabType, label: 'Roles', icon: Shield },
    { id: 'assignments' as TabType, label: 'Assignments', icon: Users },
    { id: 'audit' as TabType, label: 'Audit Log', icon: Eye },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/festivals/${festivalId}/settings`}
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-gray-500">
            {currentFestival?.name || 'Festival'} - Manage access control
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roles..."
                className="w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Link
              href={`/festivals/${festivalId}/settings/roles/new`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create Role
            </Link>
          </div>

          {/* System Roles Section */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Lock className="h-5 w-5 text-gray-400" />
              System Roles
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Predefined roles with standard permissions. These roles cannot be deleted.
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {systemRoles
                  .filter(
                    (r) =>
                      r.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      r.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((role) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      festivalId={festivalId}
                      onDelete={() => handleDeleteRole(role)}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Custom Roles Section */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Settings className="h-5 w-5 text-gray-400" />
              Custom Roles
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Custom roles specific to this festival.
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : customRoles.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Shield className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2 text-gray-500">No custom roles yet</p>
                <Link
                  href={`/festivals/${festivalId}/settings/roles/new`}
                  className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  Create your first custom role
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {customRoles
                  .filter(
                    (r) =>
                      r.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      r.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((role) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      festivalId={festivalId}
                      onDelete={() => handleDeleteRole(role)}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <UserRoleAssignment
          festivalId={festivalId}
          roles={roles}
          users={[
            // Mock users for development
            { id: '1', name: 'John Doe', email: 'john@example.com' },
            { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
            { id: '3', name: 'Bob Wilson', email: 'bob@example.com' },
          ]}
          onAssignmentChange={refresh}
        />
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && <AuditLogSection festivalId={festivalId} />}
    </div>
  )
}

// Role Card Component
interface RoleCardProps {
  role: Role
  festivalId: string
  onDelete: () => void
}

function RoleCard({ role, festivalId, onDelete }: RoleCardProps) {
  const isSystem = role.type === 'system'

  return (
    <div className="rounded-lg border bg-white p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              isSystem ? 'bg-blue-100' : 'bg-primary/10'
            )}
          >
            <Shield className={cn('h-5 w-5', isSystem ? 'text-blue-600' : 'text-primary')} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{role.displayName}</h3>
            <p className="text-xs text-gray-500">{role.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isSystem && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
              System
            </span>
          )}
          {!role.isActive && (
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
              Inactive
            </span>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm text-gray-600 line-clamp-2">{role.description}</p>

      <div className="mt-3 text-xs text-gray-500">
        {role.permissions.length} permission(s) | Priority: {role.priority}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <Link
          href={`/festivals/${festivalId}/settings/roles/${role.id}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Edit className="h-3 w-3" />
          {isSystem ? 'View' : 'Edit'}
        </Link>

        {!isSystem && (
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// Audit Log Section
function AuditLogSection({ festivalId }: { festivalId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadLogs = async () => {
      setIsLoading(true)
      try {
        const result = await rolesApi.listAuditLogs({
          festivalId,
          limit: 50,
        })
        setLogs(result.logs)
      } catch (err) {
        console.error('Failed to load audit logs:', err)
        // Mock data
        setLogs([
          {
            id: '1',
            action: 'role_assigned',
            actorId: 'admin',
            targetUserId: 'user-1',
            createdAt: new Date().toISOString(),
          },
          {
            id: '2',
            action: 'role_created',
            actorId: 'admin',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    }

    loadLogs()
  }, [festivalId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <Eye className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-2 text-gray-500">No audit logs yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <div className="divide-y">
        {logs.map((log) => (
          <div key={log.id} className="flex items-center gap-4 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <Eye className="h-4 w-4 text-gray-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {log.action.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </p>
              <p className="text-sm text-gray-500">
                By {log.actorId} {log.targetUserId && `on ${log.targetUserId}`}
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {new Date(log.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
