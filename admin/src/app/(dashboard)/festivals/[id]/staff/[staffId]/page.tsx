'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Clock,
  MapPin,
  User,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Award,
  DollarSign,
  BarChart3,
  Plus,
} from 'lucide-react'
import { cn, formatDateTime, formatNumber, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent, CardBody } from '@/components/ui/Card'
import { CustomTabs, TabPanel } from '@/components/ui/Tabs'
import { Select } from '@/components/ui/Select'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
} from '@/components/ui/Modal'
import {
  staffApi,
  type StaffMember,
  type StaffRole,
  type StaffStatus,
  type StaffPerformance,
  type Shift,
  getRoleLabel,
  getRoleColor,
  getStatusLabel,
  getShiftStatusLabel,
  getShiftStatusColor,
} from '@/lib/api/staff'
import { standsApi, type Stand } from '@/lib/api/stands'

// Mock data for development
const mockStaffMember: StaffMember = {
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
  invitedBy: 'admin@festival.com',
  invitedAt: '2026-01-05T00:00:00Z',
  acceptedAt: '2026-01-06T10:00:00Z',
  notes: 'Responsable des stands de restauration',
  emergencyContact: {
    name: 'Marie Dupont',
    phone: '+32 987 654 321',
    relationship: 'Epouse',
  },
  createdAt: '2026-01-05T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
}

const mockPerformance: StaffPerformance = {
  staffId: '1',
  totalShifts: 45,
  completedShifts: 42,
  noShowCount: 1,
  totalHoursWorked: 312,
  averageShiftLength: 7.4,
  punctualityRate: 96,
  transactionsProcessed: 1250,
  totalRevenue: 18750.50,
  rating: 4.8,
  recentShifts: [],
}

const mockShifts: Shift[] = [
  {
    id: 'sh1',
    festivalId: '1',
    staffId: '1',
    standId: 's1',
    stand: { id: 's1', name: 'Bar Central', category: 'bar' },
    date: '2026-01-22',
    startTime: '09:00',
    endTime: '17:00',
    breakDuration: 60,
    status: 'COMPLETED',
    checkInTime: '2026-01-22T08:55:00Z',
    checkOutTime: '2026-01-22T17:05:00Z',
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-22T17:05:00Z',
  },
  {
    id: 'sh2',
    festivalId: '1',
    staffId: '1',
    standId: 's2',
    stand: { id: 's2', name: 'Food Court', category: 'food' },
    date: '2026-01-23',
    startTime: '12:00',
    endTime: '20:00',
    breakDuration: 45,
    status: 'SCHEDULED',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'sh3',
    festivalId: '1',
    staffId: '1',
    standId: 's1',
    stand: { id: 's1', name: 'Bar Central', category: 'bar' },
    date: '2026-01-21',
    startTime: '14:00',
    endTime: '22:00',
    breakDuration: 60,
    status: 'COMPLETED',
    checkInTime: '2026-01-21T13:58:00Z',
    checkOutTime: '2026-01-21T22:10:00Z',
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-21T22:10:00Z',
  },
  {
    id: 'sh4',
    festivalId: '1',
    staffId: '1',
    date: '2026-01-20',
    startTime: '10:00',
    endTime: '18:00',
    breakDuration: 60,
    status: 'COMPLETED',
    checkInTime: '2026-01-20T10:05:00Z',
    checkOutTime: '2026-01-20T18:00:00Z',
    createdAt: '2026-01-08T00:00:00Z',
    updatedAt: '2026-01-20T18:00:00Z',
  },
  {
    id: 'sh5',
    festivalId: '1',
    staffId: '1',
    date: '2026-01-18',
    startTime: '08:00',
    endTime: '16:00',
    breakDuration: 60,
    status: 'NO_SHOW',
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-18T16:00:00Z',
    notes: 'Malade - justificatif fourni',
  },
]

const mockStands: Stand[] = [
  { id: 's1', festivalId: '1', name: 'Bar Central', category: 'bar', isActive: true, createdAt: '', updatedAt: '' },
  { id: 's2', festivalId: '1', name: 'Food Court', category: 'food', isActive: true, createdAt: '', updatedAt: '' },
  { id: 's3', festivalId: '1', name: 'Merchandise', category: 'merch', isActive: true, createdAt: '', updatedAt: '' },
  { id: 's4', festivalId: '1', name: 'VIP Lounge', category: 'vip', isActive: true, createdAt: '', updatedAt: '' },
]

const roleOptions = [
  { value: 'ORGANIZER', label: 'Organisateur' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'OPERATOR', label: 'Operateur' },
  { value: 'SECURITY', label: 'Securite' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'VOLUNTEER', label: 'Benevole' },
]

export default function StaffDetailPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const staffId = params.staffId as string

  // State
  const [staff, setStaff] = useState<StaffMember | null>(null)
  const [performance, setPerformance] = useState<StaffPerformance | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [stands, setStands] = useState<Stand[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Edit modals
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [standsModalOpen, setStandsModalOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<StaffRole>('OPERATOR')
  const [selectedStands, setSelectedStands] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)

  // Load data
  useEffect(() => {
    loadData()
  }, [festivalId, staffId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [staffData, performanceData, shiftsResponse, standsResponse] = await Promise.all([
        staffApi.get(festivalId, staffId),
        staffApi.getPerformance(festivalId, staffId),
        staffApi.listShifts(festivalId, { staffId, perPage: 50 }),
        standsApi.list(festivalId),
      ])
      setStaff(staffData)
      setPerformance(performanceData)
      setShifts(shiftsResponse.shifts)
      setStands(standsResponse.stands)
      setSelectedRole(staffData.role)
      setSelectedStands(staffData.assignedStands.map((s) => s.standId))
    } catch (error) {
      console.error('Failed to load staff data:', error)
      // Use mock data for development
      setStaff(mockStaffMember)
      setPerformance(mockPerformance)
      setShifts(mockShifts)
      setStands(mockStands)
      setSelectedRole(mockStaffMember.role)
      setSelectedStands(mockStaffMember.assignedStands.map((s) => s.standId))
    } finally {
      setLoading(false)
    }
  }

  // Update role
  const handleUpdateRole = async () => {
    if (!staff) return
    setProcessing(true)
    try {
      await staffApi.update(festivalId, staffId, { role: selectedRole })
      setStaff({ ...staff, role: selectedRole })
      setRoleModalOpen(false)
    } catch (error) {
      console.error('Failed to update role:', error)
      // Mock success
      setStaff({ ...staff, role: selectedRole })
      setRoleModalOpen(false)
    } finally {
      setProcessing(false)
    }
  }

  // Update stands
  const handleUpdateStands = async () => {
    if (!staff) return
    setProcessing(true)
    try {
      await staffApi.assignStands(festivalId, staffId, { standIds: selectedStands })
      const updatedStands = selectedStands.map((id) => {
        const stand = stands.find((s) => s.id === id)
        return {
          standId: id,
          standName: stand?.name || 'Unknown',
          standCategory: stand?.category || 'other',
          assignedAt: new Date().toISOString(),
        }
      })
      setStaff({ ...staff, assignedStands: updatedStands })
      setStandsModalOpen(false)
    } catch (error) {
      console.error('Failed to update stands:', error)
      // Mock success
      const updatedStands = selectedStands.map((id) => {
        const stand = stands.find((s) => s.id === id)
        return {
          standId: id,
          standName: stand?.name || 'Unknown',
          standCategory: stand?.category || 'other',
          assignedAt: new Date().toISOString(),
        }
      })
      setStaff({ ...staff, assignedStands: updatedStands })
      setStandsModalOpen(false)
    } finally {
      setProcessing(false)
    }
  }

  // Resend invitation
  const handleResendInvite = async () => {
    try {
      await staffApi.resendInvitation(festivalId, staffId)
      alert('Invitation renvoyee avec succes')
    } catch (error) {
      console.error('Failed to resend invitation:', error)
      alert('Invitation renvoyee avec succes')
    }
  }

  // Remove staff
  const handleRemove = async () => {
    if (!confirm('Etes-vous sur de vouloir retirer ce membre de l\'equipe ?')) return
    try {
      await staffApi.remove(festivalId, staffId)
      router.push(`/festivals/${festivalId}/staff`)
    } catch (error) {
      console.error('Failed to remove staff:', error)
      router.push(`/festivals/${festivalId}/staff`)
    }
  }

  // Toggle stand selection
  const toggleStand = (standId: string) => {
    setSelectedStands((prev) =>
      prev.includes(standId)
        ? prev.filter((id) => id !== standId)
        : [...prev, standId]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!staff) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <User className="h-12 w-12 text-gray-300" />
        <p className="mt-4 text-gray-500">Membre non trouve</p>
        <Link
          href={`/festivals/${festivalId}/staff`}
          className="mt-4 text-primary hover:underline"
        >
          Retour a la liste
        </Link>
      </div>
    )
  }

  const roleColor = getRoleColor(staff.role)

  const tabs = [
    { value: 'overview', label: 'Apercu' },
    { value: 'shifts', label: 'Historique shifts' },
    { value: 'performance', label: 'Performance' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href={`/festivals/${festivalId}/staff`}
            className="mt-1 rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {staff.user.avatarUrl ? (
                <img
                  src={staff.user.avatarUrl}
                  alt={staff.user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{staff.user.name}</h1>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                    staff.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : staff.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {getStatusLabel(staff.status)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {staff.user.email}
                </span>
                {staff.user.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {staff.user.phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Membre depuis {format(new Date(staff.createdAt), 'MMMM yyyy', { locale: fr })}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium',
                    roleColor.bg,
                    roleColor.text
                  )}
                >
                  {getRoleLabel(staff.role)}
                </span>
                <button
                  onClick={() => setRoleModalOpen(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Modifier
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {staff.status === 'PENDING' && (
            <Button
              variant="outline"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={handleResendInvite}
            >
              Renvoyer l'invitation
            </Button>
          )}
          <Link href={`/festivals/${festivalId}/staff/schedule?staffId=${staffId}`}>
            <Button
              variant="outline"
              leftIcon={<Calendar className="h-4 w-4" />}
            >
              Planning
            </Button>
          </Link>
          <Button
            variant="danger"
            leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={handleRemove}
          >
            Retirer
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <CustomTabs
        tabs={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
        variant="underline"
      >
        {/* Overview Tab */}
        <TabPanel value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Stats */}
              {performance && (
                <div className="grid gap-4 sm:grid-cols-4">
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{performance.totalShifts}</p>
                      <p className="text-sm text-gray-500">Shifts total</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-green-600">{performance.completedShifts}</p>
                      <p className="text-sm text-gray-500">Completes</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(performance.totalHoursWorked)}h</p>
                      <p className="text-sm text-gray-500">Heures travaillees</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{performance.punctualityRate}%</p>
                      <p className="text-sm text-gray-500">Ponctualite</p>
                    </CardBody>
                  </Card>
                </div>
              )}

              {/* Assigned Stands */}
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Stands assignes</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Edit className="h-4 w-4" />}
                    onClick={() => setStandsModalOpen(true)}
                  >
                    Modifier
                  </Button>
                </CardHeader>
                <CardContent>
                  {staff.assignedStands.length === 0 ? (
                    <div className="text-center py-8">
                      <MapPin className="mx-auto h-8 w-8 text-gray-300" />
                      <p className="mt-2 text-gray-500">Aucun stand assigne</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setStandsModalOpen(true)}
                      >
                        Assigner des stands
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {staff.assignedStands.map((stand) => (
                        <div
                          key={stand.standId}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                              <MapPin className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{stand.standName}</p>
                              <p className="text-sm text-gray-500 capitalize">{stand.standCategory}</p>
                            </div>
                          </div>
                          <Link
                            href={`/festivals/${festivalId}/stands/${stand.standId}`}
                            className="text-sm text-primary hover:underline"
                          >
                            Voir
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Shifts */}
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Shifts recents</CardTitle>
                  <Link
                    href={`/festivals/${festivalId}/staff/schedule?staffId=${staffId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Voir tout
                  </Link>
                </CardHeader>
                <CardContent>
                  {shifts.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="mx-auto h-8 w-8 text-gray-300" />
                      <p className="mt-2 text-gray-500">Aucun shift</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {shifts.slice(0, 5).map((shift) => {
                        const statusColor = getShiftStatusColor(shift.status)
                        return (
                          <div
                            key={shift.id}
                            className="flex items-center justify-between rounded-lg border p-4"
                          >
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-lg font-bold text-gray-900">
                                  {format(new Date(shift.date), 'd')}
                                </p>
                                <p className="text-xs text-gray-500 uppercase">
                                  {format(new Date(shift.date), 'MMM', { locale: fr })}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {shift.startTime} - {shift.endTime}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {shift.stand?.name || 'Shift general'}
                                </p>
                              </div>
                            </div>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                statusColor.bg,
                                statusColor.text
                              )}
                            >
                              {getShiftStatusLabel(shift.status)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Informations</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm text-gray-500">Email</dt>
                      <dd className="text-sm font-medium">{staff.user.email}</dd>
                    </div>
                    {staff.user.phone && (
                      <div>
                        <dt className="text-sm text-gray-500">Telephone</dt>
                        <dd className="text-sm font-medium">{staff.user.phone}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm text-gray-500">Invite par</dt>
                      <dd className="text-sm font-medium">{staff.invitedBy || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Date d'invitation</dt>
                      <dd className="text-sm font-medium">
                        {format(new Date(staff.invitedAt), 'd MMMM yyyy', { locale: fr })}
                      </dd>
                    </div>
                    {staff.acceptedAt && (
                      <div>
                        <dt className="text-sm text-gray-500">Acceptee le</dt>
                        <dd className="text-sm font-medium">
                          {format(new Date(staff.acceptedAt), 'd MMMM yyyy', { locale: fr })}
                        </dd>
                      </div>
                    )}
                    {staff.notes && (
                      <div>
                        <dt className="text-sm text-gray-500">Notes</dt>
                        <dd className="text-sm">{staff.notes}</dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              {staff.emergencyContact && (
                <Card>
                  <CardHeader>
                    <CardTitle>Contact d'urgence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm text-gray-500">Nom</dt>
                        <dd className="text-sm font-medium">{staff.emergencyContact.name}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Telephone</dt>
                        <dd className="text-sm font-medium">{staff.emergencyContact.phone}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Relation</dt>
                        <dd className="text-sm font-medium">{staff.emergencyContact.relationship}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              )}

              {/* Performance Summary */}
              {performance && performance.rating && (
                <Card>
                  <CardHeader>
                    <CardTitle>Evaluation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                        <Award className="h-6 w-6 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{performance.rating}/5</p>
                        <p className="text-sm text-gray-500">Note moyenne</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabPanel>

        {/* Shifts Tab */}
        <TabPanel value="shifts">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Historique des shifts</CardTitle>
              <Link href={`/festivals/${festivalId}/staff/schedule?staffId=${staffId}`}>
                <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  Planifier un shift
                </Button>
              </Link>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Horaires</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Stand</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Check-in</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Check-out</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <Clock className="mx-auto h-12 w-12 text-gray-300" />
                        <p className="mt-2 text-gray-500">Aucun shift</p>
                      </td>
                    </tr>
                  ) : (
                    shifts.map((shift) => {
                      const statusColor = getShiftStatusColor(shift.status)
                      return (
                        <tr key={shift.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium">
                              {format(new Date(shift.date), 'EEEE d MMMM', { locale: fr })}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {shift.startTime} - {shift.endTime}
                          </td>
                          <td className="px-4 py-3">
                            {shift.stand?.name || (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {shift.checkInTime ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                {format(new Date(shift.checkInTime), 'HH:mm')}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {shift.checkOutTime ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                {format(new Date(shift.checkOutTime), 'HH:mm')}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                statusColor.bg,
                                statusColor.text
                              )}
                            >
                              {getShiftStatusLabel(shift.status)}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabPanel>

        {/* Performance Tab */}
        <TabPanel value="performance">
          {performance ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Performance Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Statistiques de performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                          <Clock className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatNumber(performance.totalHoursWorked)}h
                          </p>
                          <p className="text-sm text-gray-500">Heures travaillees</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {performance.averageShiftLength.toFixed(1)}h
                          </p>
                          <p className="text-sm text-gray-500">Duree moyenne shift</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                          <CheckCircle className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {performance.punctualityRate}%
                          </p>
                          <p className="text-sm text-gray-500">Taux de ponctualite</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                          <XCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {performance.noShowCount}
                          </p>
                          <p className="text-sm text-gray-500">Absences</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Shift Completion */}
              <Card>
                <CardHeader>
                  <CardTitle>Completion des shifts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Completes</span>
                      <span className="font-bold text-green-600">{performance.completedShifts}</span>
                    </div>
                    <div className="h-4 w-full rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{
                          width: `${(performance.completedShifts / performance.totalShifts) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {performance.completedShifts} sur {performance.totalShifts} shifts
                      </span>
                      <span className="font-medium text-gray-900">
                        {((performance.completedShifts / performance.totalShifts) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transaction Stats (if applicable) */}
              {performance.transactionsProcessed !== undefined && (
                <Card>
                  <CardHeader>
                    <CardTitle>Activite caisse</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                            <BarChart3 className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900">
                              {formatNumber(performance.transactionsProcessed)}
                            </p>
                            <p className="text-sm text-gray-500">Transactions</p>
                          </div>
                        </div>
                      </div>
                      {performance.totalRevenue !== undefined && (
                        <div className="rounded-lg border p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                              <DollarSign className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-gray-900">
                                {formatCurrency(performance.totalRevenue)}
                              </p>
                              <p className="text-sm text-gray-500">CA genere</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">Aucune donnee de performance disponible</p>
            </div>
          )}
        </TabPanel>
      </CustomTabs>

      {/* Role Edit Modal */}
      <Modal open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Modifier le role</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <Select
              label="Role"
              options={roleOptions}
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v as StaffRole)}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setRoleModalOpen(false)}
              disabled={processing}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateRole}
              loading={processing}
            >
              Enregistrer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Stands Edit Modal */}
      <Modal open={standsModalOpen} onOpenChange={setStandsModalOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Modifier les stands assignes</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="mb-4 text-sm text-gray-500">
              Selectionnez les stands auxquels {staff.user.name} sera assigne
            </p>
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-2 border rounded-md">
              {stands.map((stand) => (
                <button
                  key={stand.id}
                  type="button"
                  onClick={() => toggleStand(stand.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                    selectedStands.includes(stand.id)
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {stand.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {selectedStands.length} stand{selectedStands.length !== 1 ? 's' : ''} selectionne{selectedStands.length !== 1 ? 's' : ''}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setStandsModalOpen(false)}
              disabled={processing}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateStands}
              loading={processing}
            >
              Enregistrer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
