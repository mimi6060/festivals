'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Search,
  MoreVertical,
  Shield,
  Ban,
  UserCheck,
  Mail,
  Phone,
  Calendar,
  Filter,
  ChevronDown,
  X,
  Users,
  UserCog,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { usersApi, User, UserRole, UserStatus, UserListParams } from '@/lib/api/users'
import { Badge } from '@/components/ui/Badge'
import { UserCard } from '@/components/users/UserCard'

const roleConfig: Record<UserRole, { label: string; className: string; icon: typeof Shield }> = {
  ADMIN: {
    label: 'Administrateur',
    className: 'bg-purple-100 text-purple-800',
    icon: ShieldCheck,
  },
  ORGANIZER: {
    label: 'Organisateur',
    className: 'bg-blue-100 text-blue-800',
    icon: UserCog,
  },
  MANAGER: {
    label: 'Manager',
    className: 'bg-green-100 text-green-800',
    icon: Users,
  },
  STAFF: {
    label: 'Staff',
    className: 'bg-yellow-100 text-yellow-800',
    icon: UserIcon,
  },
  FESTIVALIER: {
    label: 'Festivalier',
    className: 'bg-gray-100 text-gray-800',
    icon: UserIcon,
  },
}

const statusConfig: Record<UserStatus, { label: string; variant: 'success' | 'error' | 'warning' }> = {
  ACTIVE: { label: 'Actif', variant: 'success' },
  BANNED: { label: 'Banni', variant: 'error' },
  SUSPENDED: { label: 'Suspendu', variant: 'warning' },
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const perPage = 20

  useEffect(() => {
    loadUsers()
  }, [page, roleFilter, statusFilter])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const params: UserListParams = {
        page,
        perPage,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }
      if (roleFilter) params.role = roleFilter
      if (statusFilter) params.status = statusFilter
      if (searchQuery) params.search = searchQuery

      const response = await usersApi.list(params)
      setUsers(response.users)
      setTotal(response.total)
    } catch (error) {
      console.error('Failed to load users:', error)
      // Mock data for development
      setUsers([
        {
          id: '1',
          auth0Id: 'auth0|123',
          email: 'admin@festival.be',
          name: 'Admin Principal',
          phone: '+32 123 456 789',
          roles: ['ADMIN'],
          status: 'ACTIVE',
          isActive: true,
          lastLoginAt: '2026-01-22T10:30:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2026-01-22T10:30:00Z',
        },
        {
          id: '2',
          auth0Id: 'auth0|456',
          email: 'organizer@festival.be',
          name: 'Marie Dupont',
          phone: '+32 987 654 321',
          roles: ['ORGANIZER'],
          status: 'ACTIVE',
          isActive: true,
          lastLoginAt: '2026-01-21T15:00:00Z',
          createdAt: '2025-03-15T00:00:00Z',
          updatedAt: '2026-01-21T15:00:00Z',
        },
        {
          id: '3',
          auth0Id: 'auth0|789',
          email: 'jean.martin@email.com',
          name: 'Jean Martin',
          roles: ['FESTIVALIER'],
          status: 'ACTIVE',
          isActive: true,
          lastLoginAt: '2026-01-20T18:00:00Z',
          createdAt: '2025-06-01T00:00:00Z',
          updatedAt: '2026-01-20T18:00:00Z',
        },
        {
          id: '4',
          auth0Id: 'auth0|101',
          email: 'staff1@festival.be',
          name: 'Pierre Dumont',
          roles: ['STAFF'],
          status: 'ACTIVE',
          isActive: true,
          createdAt: '2025-06-10T00:00:00Z',
          updatedAt: '2025-06-10T00:00:00Z',
        },
        {
          id: '5',
          auth0Id: 'auth0|102',
          email: 'banned@email.com',
          name: 'Utilisateur Banni',
          roles: ['FESTIVALIER'],
          status: 'BANNED',
          isActive: false,
          createdAt: '2025-07-01T00:00:00Z',
          updatedAt: '2025-12-15T00:00:00Z',
        },
      ])
      setTotal(5)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadUsers()
  }

  const handleBan = async (userId: string) => {
    try {
      await usersApi.ban(userId)
      loadUsers()
    } catch (error) {
      console.error('Failed to ban user:', error)
      // Update locally for development
      setUsers(users.map(u => u.id === userId ? { ...u, status: 'BANNED' as UserStatus, isActive: false } : u))
    }
    setOpenMenuId(null)
  }

  const handleUnban = async (userId: string) => {
    try {
      await usersApi.unban(userId)
      loadUsers()
    } catch (error) {
      console.error('Failed to unban user:', error)
      // Update locally for development
      setUsers(users.map(u => u.id === userId ? { ...u, status: 'ACTIVE' as UserStatus, isActive: true } : u))
    }
    setOpenMenuId(null)
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchQuery ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = !roleFilter || user.roles.includes(roleFilter)
    const matchesStatus = !statusFilter || user.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  const totalPages = Math.ceil(total / perPage)
  const activeFilters = (roleFilter ? 1 : 0) + (statusFilter ? 1 : 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez les utilisateurs et leurs roles
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Total utilisateurs</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Admins</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">
            {users.filter(u => u.roles.includes('ADMIN')).length}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Staff</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {users.filter(u => u.roles.includes('STAFF') || u.roles.includes('MANAGER') || u.roles.includes('ORGANIZER')).length}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Bannis</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {users.filter(u => u.status === 'BANNED').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border pl-10 pr-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setPage(1)
                  loadUsers()
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
          >
            Rechercher
          </button>
        </form>

        <div className="flex items-center gap-3">
          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                activeFilters > 0
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Filter className="h-4 w-4" />
              Filtres
              {activeFilters > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                  {activeFilters}
                </span>
              )}
              <ChevronDown className="h-4 w-4" />
            </button>

            {filterMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setFilterMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border bg-white p-4 shadow-lg">
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <select
                      value={roleFilter}
                      onChange={(e) => {
                        setRoleFilter(e.target.value as UserRole | '')
                        setPage(1)
                      }}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Tous les roles</option>
                      <option value="ADMIN">Administrateur</option>
                      <option value="ORGANIZER">Organisateur</option>
                      <option value="MANAGER">Manager</option>
                      <option value="STAFF">Staff</option>
                      <option value="FESTIVALIER">Festivalier</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Statut
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value as UserStatus | '')
                        setPage(1)
                      }}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Tous les statuts</option>
                      <option value="ACTIVE">Actif</option>
                      <option value="BANNED">Banni</option>
                      <option value="SUSPENDED">Suspendu</option>
                    </select>
                  </div>

                  {activeFilters > 0 && (
                    <button
                      onClick={() => {
                        setRoleFilter('')
                        setStatusFilter('')
                        setPage(1)
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Reinitialiser les filtres
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Active filters display */}
      {activeFilters > 0 && (
        <div className="flex flex-wrap gap-2">
          {roleFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
              {roleConfig[roleFilter].label}
              <button
                onClick={() => {
                  setRoleFilter('')
                  setPage(1)
                }}
                className="ml-1 hover:text-primary/70"
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          )}
          {statusFilter && (
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm',
              statusFilter === 'ACTIVE' && 'bg-green-100 text-green-700',
              statusFilter === 'BANNED' && 'bg-red-100 text-red-700',
              statusFilter === 'SUSPENDED' && 'bg-yellow-100 text-yellow-700'
            )}>
              {statusConfig[statusFilter].label}
              <button
                onClick={() => {
                  setStatusFilter('')
                  setPage(1)
                }}
                className="ml-1 hover:opacity-70"
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Utilisateur
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Roles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Derniere connexion
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Inscription
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-12 animate-pulse rounded bg-gray-200" />
                  </td>
                </tr>
              ))
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Aucun utilisateur trouve
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/users/${user.id}`} className="block">
                      <UserCard user={user} variant="compact" />
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => {
                        const config = roleConfig[role]
                        const Icon = config.icon
                        return (
                          <span
                            key={role}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                              config.className
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={statusConfig[user.status].variant}
                      dot
                    >
                      {statusConfig[user.status].label}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDateTime(user.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block text-left">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === user.id ? null : user.id)
                        }}
                        className="rounded p-1 hover:bg-gray-100"
                      >
                        <MoreVertical className="h-5 w-5 text-gray-400" />
                      </button>

                      {openMenuId === user.id && (
                        <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                          <div className="py-1">
                            <Link
                              href={`/users/${user.id}`}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <UserIcon className="h-4 w-4" />
                              Voir le profil
                            </Link>
                            <Link
                              href={`/users/${user.id}?tab=roles`}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <Shield className="h-4 w-4" />
                              Gerer les roles
                            </Link>
                            {user.status === 'BANNED' ? (
                              <button
                                onClick={() => handleUnban(user.id)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-gray-100"
                              >
                                <UserCheck className="h-4 w-4" />
                                Debannir
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBan(user.id)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                              >
                                <Ban className="h-4 w-4" />
                                Bannir
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t bg-white px-6 py-3">
            <div className="text-sm text-gray-500">
              Affichage de {(page - 1) * perPage + 1} a{' '}
              {Math.min(page * perPage, total)} sur {total} resultats
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Precedent
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {openMenuId && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setOpenMenuId(null)}
        />
      )}
    </div>
  )
}
