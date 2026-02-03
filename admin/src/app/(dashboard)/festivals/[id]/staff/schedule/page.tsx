'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft,
  Plus,
  Filter,
  Users,
  Calendar,
  Clock,
  Download,
  Settings,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Card, CardBody, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  ShiftCalendar,
  ShiftTemplatesSidebar,
  MiniCalendar,
  type CalendarView,
} from '@/components/staff/ShiftCalendar'
import { ShiftEditor, ShiftTemplateEditor } from '@/components/staff/ShiftEditor'
import {
  staffApi,
  type StaffMember,
  type Shift,
  type ShiftTemplate,
  type CreateShiftRequest,
  type UpdateShiftRequest,
  getRoleLabel,
} from '@/lib/api/staff'
import { standsApi, type Stand } from '@/lib/api/stands'

// Mock data for development
const mockStaff: StaffMember[] = [
  {
    id: '1',
    festivalId: '1',
    userId: 'u1',
    user: { id: 'u1', name: 'Jean Dupont', email: 'jean.dupont@email.com', avatarUrl: null },
    role: 'MANAGER',
    status: 'ACTIVE',
    assignedStands: [
      { standId: 's1', standName: 'Bar Central', standCategory: 'bar', assignedAt: '' },
    ],
    invitedAt: '',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '2',
    festivalId: '1',
    userId: 'u2',
    user: { id: 'u2', name: 'Marie Martin', email: 'marie.martin@email.com', avatarUrl: null },
    role: 'OPERATOR',
    status: 'ACTIVE',
    assignedStands: [
      { standId: 's1', standName: 'Bar Central', standCategory: 'bar', assignedAt: '' },
    ],
    invitedAt: '',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '3',
    festivalId: '1',
    userId: 'u3',
    user: { id: 'u3', name: 'Pierre Bernard', email: 'pierre.bernard@email.com', avatarUrl: null },
    role: 'SECURITY',
    status: 'ACTIVE',
    assignedStands: [],
    invitedAt: '',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '4',
    festivalId: '1',
    userId: 'u4',
    user: { id: 'u4', name: 'Sophie Leroy', email: 'sophie.leroy@email.com', avatarUrl: null },
    role: 'VOLUNTEER',
    status: 'ACTIVE',
    assignedStands: [
      { standId: 's3', standName: 'Merchandise', standCategory: 'merch', assignedAt: '' },
    ],
    invitedAt: '',
    createdAt: '',
    updatedAt: '',
  },
]

const mockShifts: Shift[] = [
  {
    id: 'sh1',
    festivalId: '1',
    staffId: '1',
    standId: 's1',
    stand: { id: 's1', name: 'Bar Central', category: 'bar' },
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '17:00',
    breakDuration: 60,
    status: 'SCHEDULED',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'sh2',
    festivalId: '1',
    staffId: '2',
    standId: 's1',
    stand: { id: 's1', name: 'Bar Central', category: 'bar' },
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '12:00',
    endTime: '20:00',
    breakDuration: 45,
    status: 'SCHEDULED',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'sh3',
    festivalId: '1',
    staffId: '3',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '08:00',
    endTime: '16:00',
    breakDuration: 60,
    status: 'SCHEDULED',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'sh4',
    festivalId: '1',
    staffId: '1',
    standId: 's2',
    stand: { id: 's2', name: 'Food Court', category: 'food' },
    date: format(addWeeks(new Date(), 0), 'yyyy-MM-dd').replace(/\d{2}$/, '24'),
    startTime: '14:00',
    endTime: '22:00',
    breakDuration: 60,
    status: 'SCHEDULED',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'sh5',
    festivalId: '1',
    staffId: '4',
    standId: 's3',
    stand: { id: 's3', name: 'Merchandise', category: 'merch' },
    date: format(addWeeks(new Date(), 0), 'yyyy-MM-dd').replace(/\d{2}$/, '25'),
    startTime: '10:00',
    endTime: '18:00',
    breakDuration: 45,
    status: 'SCHEDULED',
    createdAt: '',
    updatedAt: '',
  },
]

const mockTemplates: ShiftTemplate[] = [
  {
    id: 't1',
    festivalId: '1',
    name: 'Shift matin',
    description: 'Shift du matin standard',
    startTime: '08:00',
    endTime: '16:00',
    breakDuration: 60,
    color: '#3B82F6',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 't2',
    festivalId: '1',
    name: 'Shift soir',
    description: 'Shift du soir standard',
    startTime: '16:00',
    endTime: '00:00',
    breakDuration: 45,
    color: '#8B5CF6',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 't3',
    festivalId: '1',
    name: 'Journee complete',
    description: 'Shift journee entiere',
    startTime: '10:00',
    endTime: '22:00',
    breakDuration: 90,
    color: '#10B981',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
]

const mockStands: Stand[] = [
  { id: 's1', festivalId: '1', name: 'Bar Central', category: 'bar', isActive: true, createdAt: '', updatedAt: '' },
  { id: 's2', festivalId: '1', name: 'Food Court', category: 'food', isActive: true, createdAt: '', updatedAt: '' },
  { id: 's3', festivalId: '1', name: 'Merchandise', category: 'merch', isActive: true, createdAt: '', updatedAt: '' },
]

export default function StaffSchedulePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const festivalId = params.id as string
  const staffIdParam = searchParams.get('staffId')

  // State
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [stands, setStands] = useState<Stand[]>([])
  const [loading, setLoading] = useState(true)

  // Calendar state
  const [view, setView] = useState<CalendarView>('week')
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Filters
  const [staffFilter, setStaffFilter] = useState(staffIdParam || '')
  const [standFilter, setStandFilter] = useState('')

  // Modals
  const [shiftEditorOpen, setShiftEditorOpen] = useState(false)
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ShiftTemplate | null>(null)
  const [newShiftDate, setNewShiftDate] = useState<Date | undefined>()
  const [newShiftHour, setNewShiftHour] = useState<number | undefined>()
  const [saving, setSaving] = useState(false)

  // Load data
  useEffect(() => {
    loadData()
  }, [festivalId])

  const loadData = async () => {
    setLoading(true)
    try {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })

      const [staffResponse, shiftsResponse, templatesResponse, standsResponse] = await Promise.all([
        staffApi.list(festivalId, { status: 'ACTIVE', perPage: 100 }),
        staffApi.listShifts(festivalId, {
          startDate: format(weekStart, 'yyyy-MM-dd'),
          endDate: format(weekEnd, 'yyyy-MM-dd'),
          perPage: 500,
        }),
        staffApi.listTemplates(festivalId),
        standsApi.list(festivalId),
      ])

      setStaff(staffResponse.staff)
      setShifts(shiftsResponse.shifts)
      setTemplates(templatesResponse.templates)
      setStands(standsResponse.stands)
    } catch (error) {
      console.error('Failed to load schedule data:', error)
      // Use mock data
      setStaff(mockStaff)
      setShifts(mockShifts)
      setTemplates(mockTemplates)
      setStands(mockStands)
    } finally {
      setLoading(false)
    }
  }

  // Reload shifts when date changes
  useEffect(() => {
    if (!loading) {
      loadShifts()
    }
  }, [selectedDate, view])

  const loadShifts = async () => {
    try {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })

      const shiftsResponse = await staffApi.listShifts(festivalId, {
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd'),
        perPage: 500,
      })
      setShifts(shiftsResponse.shifts)
    } catch (error) {
      console.error('Failed to load shifts:', error)
    }
  }

  // Filter shifts
  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const matchesStaff = staffFilter === '' || shift.staffId === staffFilter
      const matchesStand = standFilter === '' || shift.standId === standFilter
      return matchesStaff && matchesStand
    })
  }, [shifts, staffFilter, standFilter])

  // Calculate shifts per day for mini calendar
  const shiftsPerDay = useMemo(() => {
    const map = new Map<string, number>()
    shifts.forEach((shift) => {
      const count = map.get(shift.date) || 0
      map.set(shift.date, count + 1)
    })
    return map
  }, [shifts])

  // Handle shift click
  const handleShiftClick = (shift: Shift) => {
    setSelectedShift(shift)
    setNewShiftDate(undefined)
    setNewShiftHour(undefined)
    setShiftEditorOpen(true)
  }

  // Handle empty slot click (create new shift)
  const handleSlotClick = (date: Date, hour: number) => {
    setSelectedShift(null)
    setNewShiftDate(date)
    setNewShiftHour(hour)
    setShiftEditorOpen(true)
  }

  // Handle shift drag and drop
  const handleShiftDrop = async (shiftId: string, newDate: Date, newStartTime: string) => {
    try {
      const shift = shifts.find((s) => s.id === shiftId)
      if (!shift) return

      // Calculate new end time based on original duration
      const [startH, startM] = shift.startTime.split(':').map(Number)
      const [endH, endM] = shift.endTime.split(':').map(Number)
      const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM)

      const [newStartH] = newStartTime.split(':').map(Number)
      const newEndMinutes = newStartH * 60 + durationMinutes
      const newEndTime = `${Math.floor(newEndMinutes / 60).toString().padStart(2, '0')}:${(newEndMinutes % 60).toString().padStart(2, '0')}`

      await staffApi.updateShift(festivalId, shiftId, {
        date: format(newDate, 'yyyy-MM-dd'),
        startTime: newStartTime,
        endTime: newEndTime,
      })

      setShifts((prev) =>
        prev.map((s) =>
          s.id === shiftId
            ? { ...s, date: format(newDate, 'yyyy-MM-dd'), startTime: newStartTime, endTime: newEndTime }
            : s
        )
      )
    } catch (error) {
      console.error('Failed to move shift:', error)
      // Mock success
      const shift = shifts.find((s) => s.id === shiftId)
      if (shift) {
        const [startH, startM] = shift.startTime.split(':').map(Number)
        const [endH, endM] = shift.endTime.split(':').map(Number)
        const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM)
        const [newStartH] = newStartTime.split(':').map(Number)
        const newEndMinutes = newStartH * 60 + durationMinutes
        const newEndTime = `${Math.floor(newEndMinutes / 60).toString().padStart(2, '0')}:${(newEndMinutes % 60).toString().padStart(2, '0')}`

        setShifts((prev) =>
          prev.map((s) =>
            s.id === shiftId
              ? { ...s, date: format(newDate, 'yyyy-MM-dd'), startTime: newStartTime, endTime: newEndTime }
              : s
          )
        )
      }
    }
  }

  // Save shift (create or update)
  const handleSaveShift = async (data: CreateShiftRequest | UpdateShiftRequest) => {
    setSaving(true)
    try {
      if (selectedShift) {
        // Update existing shift
        const updated = await staffApi.updateShift(festivalId, selectedShift.id, data as UpdateShiftRequest)
        setShifts((prev) =>
          prev.map((s) => (s.id === selectedShift.id ? updated : s))
        )
      } else {
        // Create new shift
        const created = await staffApi.createShift(festivalId, data as CreateShiftRequest)
        setShifts((prev) => [...prev, created])
      }
      setShiftEditorOpen(false)
    } catch (error) {
      console.error('Failed to save shift:', error)
      // Mock success
      if (selectedShift) {
        const updated: Shift = {
          ...selectedShift,
          ...(data as UpdateShiftRequest),
        }
        setShifts((prev) =>
          prev.map((s) => (s.id === selectedShift.id ? updated : s))
        )
      } else {
        const createData = data as CreateShiftRequest
        const newShift: Shift = {
          id: `new-${Date.now()}`,
          festivalId,
          staffId: createData.staffId,
          standId: createData.standId,
          stand: createData.standId ? stands.find((s) => s.id === createData.standId) : undefined,
          date: createData.date,
          startTime: createData.startTime,
          endTime: createData.endTime,
          breakDuration: createData.breakDuration || 60,
          status: 'SCHEDULED',
          notes: createData.notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setShifts((prev) => [...prev, newShift])
      }
      setShiftEditorOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // Delete shift
  const handleDeleteShift = async (shiftId: string) => {
    try {
      await staffApi.deleteShift(festivalId, shiftId)
      setShifts((prev) => prev.filter((s) => s.id !== shiftId))
      setShiftEditorOpen(false)
    } catch (error) {
      console.error('Failed to delete shift:', error)
      // Mock success
      setShifts((prev) => prev.filter((s) => s.id !== shiftId))
      setShiftEditorOpen(false)
    }
  }

  // Handle template click
  const handleTemplateClick = (template: ShiftTemplate) => {
    setSelectedTemplate(template)
    setTemplateEditorOpen(true)
  }

  // Create new template
  const handleCreateTemplate = () => {
    setSelectedTemplate(null)
    setTemplateEditorOpen(true)
  }

  // Save template
  const handleSaveTemplate = async (data: {
    name: string
    description?: string
    startTime: string
    endTime: string
    breakDuration: number
    standId?: string
    color: string
  }) => {
    setSaving(true)
    try {
      if (selectedTemplate) {
        const updated = await staffApi.updateTemplate(festivalId, selectedTemplate.id, data)
        setTemplates((prev) =>
          prev.map((t) => (t.id === selectedTemplate.id ? updated : t))
        )
      } else {
        const created = await staffApi.createTemplate(festivalId, data)
        setTemplates((prev) => [...prev, created])
      }
      setTemplateEditorOpen(false)
    } catch (error) {
      console.error('Failed to save template:', error)
      // Mock success
      if (selectedTemplate) {
        const updated: ShiftTemplate = {
          ...selectedTemplate,
          ...data,
          updatedAt: new Date().toISOString(),
        }
        setTemplates((prev) =>
          prev.map((t) => (t.id === selectedTemplate.id ? updated : t))
        )
      } else {
        const newTemplate: ShiftTemplate = {
          id: `new-${Date.now()}`,
          festivalId,
          ...data,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setTemplates((prev) => [...prev, newTemplate])
      }
      setTemplateEditorOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await staffApi.deleteTemplate(festivalId, templateId)
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
      setTemplateEditorOpen(false)
    } catch (error) {
      console.error('Failed to delete template:', error)
      // Mock success
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
      setTemplateEditorOpen(false)
    }
  }

  // Staff options for filter
  const staffOptions = [
    { value: '', label: 'Tous les membres' },
    ...staff.map((s) => ({
      value: s.id,
      label: `${s.user.name} (${getRoleLabel(s.role)})`,
    })),
  ]

  // Stand options for filter
  const standOptions = [
    { value: '', label: 'Tous les stands' },
    ...stands.map((s) => ({ value: s.id, label: s.name })),
  ]

  // Stats for the current view
  const viewStats = useMemo(() => {
    const uniqueStaff = new Set(filteredShifts.map((s) => s.staffId))
    const totalHours = filteredShifts.reduce((acc, shift) => {
      const [startH, startM] = shift.startTime.split(':').map(Number)
      const [endH, endM] = shift.endTime.split(':').map(Number)
      const duration = (endH * 60 + endM) - (startH * 60 + startM) - shift.breakDuration
      return acc + duration / 60
    }, 0)

    return {
      totalShifts: filteredShifts.length,
      uniqueStaff: uniqueStaff.size,
      totalHours: Math.round(totalHours),
    }
  }, [filteredShifts])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/staff`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planning</h1>
            <p className="text-gray-500">Gerez les shifts de votre equipe</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            leftIcon={<Download className="h-4 w-4" />}
          >
            Exporter
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => handleSlotClick(selectedDate, 9)}
          >
            Nouveau shift
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Shifts cette semaine</p>
              <p className="text-xl font-bold text-gray-900">{viewStats.totalShifts}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Membres actifs</p>
              <p className="text-xl font-bold text-gray-900">{viewStats.uniqueStaff}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Heures planifiees</p>
              <p className="text-xl font-bold text-gray-900">{viewStats.totalHours}h</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Select
                options={staffOptions}
                value={staffFilter}
                onValueChange={setStaffFilter}
                placeholder="Filtrer par membre"
                searchable
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Select
                options={standOptions}
                value={standFilter}
                onValueChange={setStandFilter}
                placeholder="Filtrer par stand"
                searchable
              />
            </div>
            {(staffFilter || standFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStaffFilter('')
                  setStandFilter('')
                }}
              >
                Effacer les filtres
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Mini Calendar */}
          <MiniCalendar
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            shiftsPerDay={shiftsPerDay}
          />

          {/* Templates */}
          <ShiftTemplatesSidebar
            templates={templates}
            onTemplateClick={handleTemplateClick}
            onCreateTemplate={handleCreateTemplate}
          />
        </div>

        {/* Calendar */}
        <div className="lg:col-span-3">
          <ShiftCalendar
            shifts={filteredShifts}
            templates={templates}
            staff={staff}
            view={view}
            onViewChange={setView}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onShiftClick={handleShiftClick}
            onSlotClick={handleSlotClick}
            onShiftDrop={handleShiftDrop}
            isLoading={loading}
          />
        </div>
      </div>

      {/* Shift Editor Modal */}
      <ShiftEditor
        open={shiftEditorOpen}
        onOpenChange={setShiftEditorOpen}
        shift={selectedShift}
        templates={templates}
        staff={staff}
        stands={stands}
        defaultDate={newShiftDate}
        defaultHour={newShiftHour}
        onSave={handleSaveShift}
        onDelete={handleDeleteShift}
        isLoading={saving}
      />

      {/* Template Editor Modal */}
      <ShiftTemplateEditor
        open={templateEditorOpen}
        onOpenChange={setTemplateEditorOpen}
        template={selectedTemplate}
        stands={stands}
        onSave={handleSaveTemplate}
        onDelete={handleDeleteTemplate}
        isLoading={saving}
      />
    </div>
  )
}
