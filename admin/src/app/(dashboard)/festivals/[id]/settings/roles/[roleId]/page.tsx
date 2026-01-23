'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useFestivalStore } from '@/stores/festivalStore'
import { useAllPermissions } from '@/hooks/usePermissions'
import { Role, rolesApi } from '@/lib/api/roles'
import { RoleEditor } from '@/components/roles/RoleEditor'

export default function EditRolePage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const roleId = params.roleId as string
  const isNewRole = roleId === 'new'

  const { currentFestival } = useFestivalStore()
  const { permissions, isLoading: permissionsLoading } = useAllPermissions()

  const [role, setRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(!isNewRole)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNewRole) return

    const loadRole = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await rolesApi.getRole(roleId)
        setRole(data)
      } catch (err) {
        console.error('Failed to load role:', err)
        setError('Failed to load role')

        // Mock data for development
        setRole({
          id: roleId,
          name: 'MOCK_ROLE',
          displayName: 'Mock Role',
          description: 'This is a mock role for development',
          type: 'custom',
          festivalId,
          permissions: [],
          isActive: true,
          priority: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadRole()
  }, [roleId, isNewRole, festivalId])

  const handleSave = (savedRole: Role) => {
    router.push(`/festivals/${festivalId}/settings/roles`)
  }

  const handleCancel = () => {
    router.push(`/festivals/${festivalId}/settings/roles`)
  }

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!isNewRole && !role) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{error || 'Role not found'}</p>
        <Link
          href={`/festivals/${festivalId}/settings/roles`}
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to roles
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/festivals/${festivalId}/settings/roles`}
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNewRole ? 'Create Role' : `Edit ${role?.displayName || 'Role'}`}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {currentFestival?.name || 'Festival'} - {isNewRole ? 'Create a new custom role' : 'Modify role settings'}
          </p>
        </div>
      </div>

      {/* Editor */}
      <RoleEditor
        role={isNewRole ? null : role}
        festivalId={festivalId}
        permissions={permissions}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  )
}
