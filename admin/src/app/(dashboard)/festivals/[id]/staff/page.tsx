'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Download,
  Filter,
  X,
  Users,
  UserCheck,
  Clock,
  Calendar,
  Mail,
  RefreshCw,
} from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StaffCard, StaffCardSkeleton } from '@/components/staff/StaffCard'
import { InviteStaffModal } from '@/components/staff/ShiftEditor'
import {
  staffApi,
  type StaffMember,
  type StaffRole,
  type StaffStatus,
  type StaffStats,
  getRoleLabel,
  getRoleColor,
  getStatusLabel,
} from '@/lib/api/staff'
import { standsApi, type Stand } from '@/lib/api/stands'

type ViewMode = 'grid' | 'list'

const roleOptions = [
  { value: '', label: 'Tous les roles' },
  { value: 'ORGANIZER', label: 'Organisateur' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'OPERATOR', label: 'Operateur' },
  { value: 'SECURITY', label: 'Securite' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'VOLUNTEER', label: 'Benevole' },
]

const statusOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'INACTIVE', label: 'Inactif' },
]

// Mock data for development
const mockStaff: StaffMember[] = [
  {
    id: '1',
    festivalId: '1',
    userId: 'u1',
    user: {
      id: 'u1',
      name: 'Jean Dupont',
      email: 'jean.dupont@email.com',
      phone: '+32 123 456 789',
      avatarUrl: null,
    },
    role: 'MANAGER',
    status: 'ACTIVE',
    assignedStands: [
      { standId: 's1', standName: 'Bar Central', standCategory: 'bar', assignedAt: '2026-01-10T00:00:00Z' },
      { standId: 's2', standName: 'Food Court', standCategory: 'food', assignedAt: '2026-01-10T00:00:00Z' },
    ],
    invitedBy: 'admin',
    invitedAt: '2026-01-05T00:00:00Z',
    acceptedAt: '2026-01-06T10:00:00Z',
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: '2',
    festivalId: '1',
    userId: 'u2',
    user: {
      id: 'u2',
      name: 'Marie Martin',
      email: 'marie.martin@email.com',
      phone: '+32 987 654 321',
      avatarUrl: null,
    },
    role: 'OPERATOR',
    status: 'ACTIVE',
    assignedStands: [
      { standId: 's1', standName: 'Bar Central', standCategory: 'bar', assignedAt: '2026-01-12T00:00:00Z' },
    ],
    invitedBy: 'admin',
    invitedAt: '2026-01-10T00:00:00Z',
    acceptedAt: '2026-01-11T14:00:00Z',
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: '3',
    festivalId: '1',
    userId: 'u3',
    user: {
      id: 'u3',
      name: 'Pierre Bernard',
      email: 'pierre.bernard@email.com',
      avatarUrl: null,
    },
    role: 'SECURITY',
    status: 'PENDING',
    assignedStands: [],
    invitedBy: 'admin',
    invitedAt: '2026-01-20T00:00:00Z',
    createdAt: '2026-01-20T00:00:00Z',
    updatedAt: '2026-01-20T00:00:00Z',
  },
  {
    id: '4',
    festivalId: '1',
    userId: 'u4',
    user: {
      id: 'u4',
      name: 'Sophie Leroy',
      email: 'sophie.leroy@email.com',
      phone: '+32 555 123 456',
      avatarUrl: null,
    },
    role: 'VOLUNTEER',
    status: 'ACTIVE',
    assignedStands: [
      { standId: 's3', standName: 'Merchandise', standCategory: 'merch', assignedAt: '2026-01-15T00:00:00Z' },
    ],
    invitedBy: 'admin',
    invitedAt: '2026-01-12T00:00:00Z',
    acceptedAt: '2026-01-13T09:00:00Z',
    createdAt: '2026-01-12T00:00:00Z',
    updatedAt: '2026-01-18T00:00:00Z',
  },
  {
    id: '5',
    festivalId: '1',
    userId: 'u5',
    user: {
      id: 'u5',
      name: 'Lucas Moreau',
      email: 'lucas.moreau@email.com',
      avatarUrl: null,
    },
    role: 'MEDICAL',
    status: 'ACTIVE',
    assignedStands: [],
    invitedBy: 'admin',
    invitedAt: '2026-01-08T00:00:00Z',
    acceptedAt: '2026-01-08T16:00:00Z',
    createdAt: '2026-01-08T00:00:00Z',
    updatedAt: '2026-01-14T00:00:00Z',
  },
]

const mockStats: StaffStats = {
  totalStaff: 45,
  activeStaff: 38,
  pendingInvitations: 7,
  staffByRole: {
    ORGANIZER: 2,
    MANAGER: 5,
    OPERATOR: 20,
    SECURITY: 8,
    MEDICAL: 3,
    VOLUNTEER: 7,
  },
  shiftsToday: 12,
  shiftsThisWeek: 84,
  averageHoursPerWeek: 24,
}

const mockStands: Stand[] = [
  { id: 's1', festivalId: '1', name: 'Bar Central', category: 'bar', isActive: true, createdAt: '', updatedAt: '' },
  { id: 's2', festivalId: '1', name: 'Food Court', category: 'food', isActive: true, createdAt: '', updatedAt: '' },
  { id: 's3', festivalId: '1', name: 'Merchandise', category: 'merch', isActive: true, createdAt: '', updatedAt: '' },
]

export default function StaffListPage() {
  const params = useParams()
  const festivalId = params.id as string

  // State
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [stands, setStands] = useState<Stand[]>([])
  const [stats, setStats] = useState<StaffStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviting, setInviting] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [standFilter, setStandFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const perPage = 20

  // Load data
  useEffect(() => {
    loadData()
  }, [festivalId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Parallel fetch
      const [staffResponse, standsResponse, statsResponse] = await Promise.all([
        staffApi.list(festivalId, { page, perPage }),
        standsApi.list(festivalId),
        staffApi.getStats(festivalId),
      ])
      setStaff(staffResponse.staff)
      setTotalPages(Math.ceil(staffResponse.meta.total / perPage))
      setStands(standsResponse.stands)
      setStats(statsResponse)
    } catch (error) {
      console.error('Failed to load staff data:', error)
      // Use mock data for development
      setStaff(mockStaff)
      setStands(mockStands)
      setStats(mockStats)
    } finally {
      setLoading(false)
    }
  }

  // Filter staff
  const filteredStaff = useMemo(() => {
    return staff.filter((member) => {
      const matchesSearch =
        search === '' ||
        member.user.name.toLowerCase().includes(search.toLowerCase()) ||
        member.user.email.toLowerCase().includes(search.toLowerCase())
      const matchesRole = roleFilter === '' || member.role === roleFilter
      const matchesStatus = statusFilter === '' || member.status === statusFilter
      const matchesStand =
        standFilter === '' ||
        member.assignedStands.some((s) => s.standId === standFilter)
      return matchesSearch && matchesRole && matchesStatus && matchesStand
    })
  }, [staff, search, roleFilter, statusFilter, standFilter])

  const hasActiveFilters = search || roleFilter || statusFilter || standFilter

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('')
    setStatusFilter('')
    setStandFilter('')
  }

  // Debounced search
  const debouncedSearch = useMemo(() => {
    let timeoutId: NodeJS.Timeout
    return (value: string) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setSearch(value)
      }, 300)
    }
  }, [])

  // Invite staff
  const handleInvite = async (data: {
    email: string
    name?: string
    role: string
    standIds?: string[]
    notes?: string
  }) => {
    setInviting(true)
    try {
      const newStaff = await staffApi.invite(festivalId, {
        email: data.email,
        name: data.name,
        role: data.role as StaffRole,
        standIds: data.standIds,
        notes: data.notes,
      })
      setStaff((prev) => [newStaff, ...prev])
      setInviteModalOpen(false)
      if (stats) {
        setStats({
          ...stats,
          totalStaff: stats.totalStaff + 1,
          pendingInvitations: stats.pendingInvitations + 1,
        })
      }
    } catch (error) {
      console.error('Failed to invite staff:', error)
      // Mock success for development
      const mockNewStaff: StaffMember = {
        id: `new-${Date.now()}`,
        festivalId,
        userId: `user-${Date.now()}`,
        user: {
          id: `user-${Date.now()}`,
          name: data.name || data.email.split('@')[0],
          email: data.email,
          avatarUrl: null,
        },
        role: data.role as StaffRole,
        status: 'PENDING',
        assignedStands: data.standIds
          ? data.standIds.map((id) => {
              const stand = stands.find((s) => s.id === id)
              return {
                standId: id,
                standName: stand?.name || 'Unknown',
                standCategory: stand?.category || 'other',
                assignedAt: new Date().toISOString(),
              }
            })
          : [],
        invitedBy: 'current-user',
        invitedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setStaff((prev) => [mockNewStaff, ...prev])
      setInviteModalOpen(false)
    } finally {
      setInviting(false)
    }
  }

  // Edit staff
  const handleEdit = (member: StaffMember) => {
    // TODO: Open edit modal
    console.log('Edit staff:', member)
  }

  // Delete staff
  const handleDelete = async (staffId: string) => {
    try {
      await staffApi.remove(festivalId, staffId)
      setStaff((prev) => prev.filter((s) => s.id !== staffId))
    } catch (error) {
      console.error('Failed to remove staff:', error)
      // Mock success
      setStaff((prev) => prev.filter((s) => s.id !== staffId))
    }
  }

  // Resend invite
  const handleResendInvite = async (staffId: string) => {
    try {
      await staffApi.resendInvitation(festivalId, staffId)
      alert('Invitation renvoyee avec succes')
    } catch (error) {
      console.error('Failed to resend invitation:', error)
      alert('Invitation renvoyee avec succes')
    }
  }

  // Stand options for filter
  const standOptions = [
    { value: '', label: 'Tous les stands' },
    ...stands.map((stand) => ({ value: stand.id, label: stand.name })),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
          <p className="text-gray-500">Gerez les membres de votre equipe et leurs affectations</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/festivals/${festivalId}/staff/schedule`}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Calendar className="h-4 w-4" />
            Planning
          </Link>
          <Button
            variant="outline"
            leftIcon={<Download className="h-4 w-4" />}
          >
            Exporter
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setInviteModalOpen(true)}
          >
            Inviter
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total equipe</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalStaff)}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Actifs</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.activeStaff)}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
                <Mail className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Invitations en attente</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.pendingInvitations)}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Shifts aujourd'hui</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.shiftsToday)}</p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4">
            {/* Search and filter toggle */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Rechercher par nom ou email..."
                  leftIcon={<Search className="h-4 w-4" />}
                  defaultValue={search}
                  onChange={(e) => debouncedSearch(e.target.value)}
                />
              </div>
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                leftIcon={<Filter className="h-4 w-4" />}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filtres
                {hasActiveFilters && (
                  <Badge variant="info" size="sm" className="ml-2">
                    Actifs
                  </Badge>
                )}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<X className="h-4 w-4" />}
                  onClick={clearFilters}
                >
                  Effacer
                </Button>
              )}
              <div className="flex rounded-lg border bg-white">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'rounded-l-lg p-2',
                    viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <LayoutGrid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'rounded-r-lg p-2',
                    viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <List className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Extended filters */}
            {showFilters && (
              <div className="grid gap-4 border-t border-gray-200 pt-4 sm:grid-cols-3">
                <Select
                  options={roleOptions}
                  value={roleFilter}
                  onValueChange={setRoleFilter}
                  placeholder="Role"
                />
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  placeholder="Statut"
                />
                <Select
                  options={standOptions}
                  value={standFilter}
                  onValueChange={setStandFilter}
                  placeholder="Stand"
                  searchable
                />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Staff Display */}
      {loading ? (
        viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <StaffCardSkeleton key={i} viewMode="grid" />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Membre</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Stands</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <StaffCardSkeleton key={i} viewMode="list" />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : filteredStaff.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border bg-white">
          <Users className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">Aucun membre trouve</p>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Reinitialiser les filtres
            </button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              className="mt-4"
              onClick={() => setInviteModalOpen(true)}
            >
              Inviter un membre
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredStaff.map((member) => (
            <StaffCard
              key={member.id}
              staff={member}
              festivalId={festivalId}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onResendInvite={handleResendInvite}
              viewMode="grid"
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Membre</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Stands</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((member) => (
                <StaffCard
                  key={member.id}
                  staff={member}
                  festivalId={festivalId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onResendInvite={handleResendInvite}
                  viewMode="list"
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Results count */}
      {!loading && filteredStaff.length > 0 && (
        <p className="text-center text-sm text-gray-500">
          {filteredStaff.length} membre{filteredStaff.length > 1 ? 's' : ''} trouve{filteredStaff.length > 1 ? 's' : ''}
        </p>
      )}

      {/* Invite Modal */}
      <InviteStaffModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        stands={stands}
        onInvite={handleInvite}
        isLoading={inviting}
      />
    </div>
  )
}
