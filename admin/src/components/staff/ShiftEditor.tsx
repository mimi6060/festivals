'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Clock,
  Calendar,
  User,
  MapPin,
  FileText,
  Save,
  Trash2,
  X,
  Copy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
  Shift,
  ShiftTemplate,
  StaffMember,
  CreateShiftRequest,
  UpdateShiftRequest,
  ShiftStatus,
  getShiftStatusLabel,
  getShiftStatusColor,
} from '@/lib/api/staff'
import { Stand } from '@/lib/api/stands'

interface ShiftEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift?: Shift | null
  templates?: ShiftTemplate[]
  staff: StaffMember[]
  stands: Stand[]
  defaultDate?: Date
  defaultHour?: number
  onSave: (data: CreateShiftRequest | UpdateShiftRequest) => void
  onDelete?: (shiftId: string) => void
  isLoading?: boolean
}

export function ShiftEditor({
  open,
  onOpenChange,
  shift,
  templates = [],
  staff,
  stands,
  defaultDate,
  defaultHour,
  onSave,
  onDelete,
  isLoading,
}: ShiftEditorProps) {
  const isEditing = !!shift

  // Form state
  const [staffId, setStaffId] = useState('')
  const [standId, setStandId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [breakDuration, setBreakDuration] = useState('30')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<ShiftStatus>('SCHEDULED')
  const [templateId, setTemplateId] = useState('')

  // Reset form when modal opens/closes or shift changes
  useEffect(() => {
    if (open) {
      if (shift) {
        setStaffId(shift.staffId)
        setStandId(shift.standId || '')
        setDate(shift.date)
        setStartTime(shift.startTime)
        setEndTime(shift.endTime)
        setBreakDuration(String(shift.breakDuration))
        setNotes(shift.notes || '')
        setStatus(shift.status)
        setTemplateId(shift.templateId || '')
      } else {
        // New shift defaults
        setStaffId('')
        setStandId('')
        setDate(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
        setStartTime(defaultHour !== undefined ? `${defaultHour.toString().padStart(2, '0')}:00` : '09:00')
        setEndTime(defaultHour !== undefined ? `${(defaultHour + 8).toString().padStart(2, '0')}:00` : '17:00')
        setBreakDuration('30')
        setNotes('')
        setStatus('SCHEDULED')
        setTemplateId('')
      }
    }
  }, [open, shift, defaultDate, defaultHour])

  // Apply template
  const handleApplyTemplate = (template: ShiftTemplate) => {
    setStartTime(template.startTime)
    setEndTime(template.endTime)
    setBreakDuration(String(template.breakDuration))
    if (template.standId) {
      setStandId(template.standId)
    }
    setTemplateId(template.id)
  }

  // Handle save
  const handleSave = () => {
    if (!staffId || !date || !startTime || !endTime) return

    if (isEditing) {
      const updateData: UpdateShiftRequest = {
        staffId,
        standId: standId || undefined,
        date,
        startTime,
        endTime,
        breakDuration: parseInt(breakDuration),
        notes: notes || undefined,
        status,
      }
      onSave(updateData)
    } else {
      const createData: CreateShiftRequest = {
        staffId,
        standId: standId || undefined,
        date,
        startTime,
        endTime,
        breakDuration: parseInt(breakDuration),
        notes: notes || undefined,
        templateId: templateId || undefined,
      }
      onSave(createData)
    }
  }

  // Handle delete
  const handleDelete = () => {
    if (shift && onDelete && confirm('Supprimer ce shift ?')) {
      onDelete(shift.id)
    }
  }

  // Calculate duration
  const calculateDuration = () => {
    if (!startTime || !endTime) return null
    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)
    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM) - parseInt(breakDuration || '0')
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`
  }

  // Staff options for select
  const staffOptions = staff.map((s) => ({
    value: s.id,
    label: s.user.name,
  }))

  // Stand options for select
  const standOptions = [
    { value: '', label: 'Aucun stand (general)' },
    ...stands.map((s) => ({
      value: s.id,
      label: s.name,
    })),
  ]

  // Status options for select
  const statusOptions: { value: ShiftStatus; label: string }[] = [
    { value: 'SCHEDULED', label: 'Planifie' },
    { value: 'IN_PROGRESS', label: 'En cours' },
    { value: 'COMPLETED', label: 'Termine' },
    { value: 'CANCELLED', label: 'Annule' },
    { value: 'NO_SHOW', label: 'Absent' },
  ]

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>
            {isEditing ? 'Modifier le shift' : 'Nouveau shift'}
          </ModalTitle>
        </ModalHeader>

        <ModalBody className="space-y-6">
          {/* Templates (only for new shifts) */}
          {!isEditing && templates.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Appliquer un modele
              </label>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleApplyTemplate(template)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors',
                      templateId === template.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: template.color }}
                    />
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Staff selection */}
          <Select
            label="Membre du staff"
            placeholder="Selectionner un membre"
            options={staffOptions}
            value={staffId}
            onValueChange={setStaffId}
            searchable
          />

          {/* Date */}
          <Input
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            leftIcon={<Calendar className="h-4 w-4" />}
          />

          {/* Time row */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="time"
              label="Heure de debut"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              leftIcon={<Clock className="h-4 w-4" />}
            />
            <Input
              type="time"
              label="Heure de fin"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              leftIcon={<Clock className="h-4 w-4" />}
            />
          </div>

          {/* Break and duration */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Pause (minutes)"
              value={breakDuration}
              onChange={(e) => setBreakDuration(e.target.value)}
              min="0"
              step="5"
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Duree effective
              </label>
              <div className="h-10 flex items-center px-3 bg-gray-50 rounded-md border border-gray-200">
                <span className="text-sm text-gray-700">
                  {calculateDuration() || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Stand selection */}
          <Select
            label="Stand (optionnel)"
            placeholder="Selectionner un stand"
            options={standOptions}
            value={standId}
            onValueChange={setStandId}
            searchable
          />

          {/* Status (only for editing) */}
          {isEditing && (
            <Select
              label="Statut"
              options={statusOptions}
              value={status}
              onValueChange={(v) => setStatus(v as ShiftStatus)}
            />
          )}

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Notes (optionnel)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Instructions speciales, notes..."
            />
          </div>
        </ModalBody>

        <ModalFooter>
          <div className="flex w-full items-center justify-between">
            <div>
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                disabled={!staffId || !date || !startTime || !endTime || isLoading}
                loading={isLoading}
              >
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? 'Enregistrer' : 'Creer'}
              </Button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

// Template editor modal
interface ShiftTemplateEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: ShiftTemplate | null
  stands: Stand[]
  onSave: (data: {
    name: string
    description?: string
    startTime: string
    endTime: string
    breakDuration: number
    standId?: string
    color: string
  }) => void
  onDelete?: (templateId: string) => void
  isLoading?: boolean
}

const TEMPLATE_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
]

export function ShiftTemplateEditor({
  open,
  onOpenChange,
  template,
  stands,
  onSave,
  onDelete,
  isLoading,
}: ShiftTemplateEditorProps) {
  const isEditing = !!template

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [breakDuration, setBreakDuration] = useState('30')
  const [standId, setStandId] = useState('')
  const [color, setColor] = useState(TEMPLATE_COLORS[0])

  // Reset form when modal opens/closes or template changes
  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name)
        setDescription(template.description || '')
        setStartTime(template.startTime)
        setEndTime(template.endTime)
        setBreakDuration(String(template.breakDuration))
        setStandId(template.standId || '')
        setColor(template.color)
      } else {
        setName('')
        setDescription('')
        setStartTime('09:00')
        setEndTime('17:00')
        setBreakDuration('30')
        setStandId('')
        setColor(TEMPLATE_COLORS[0])
      }
    }
  }, [open, template])

  // Handle save
  const handleSave = () => {
    if (!name || !startTime || !endTime) return

    onSave({
      name,
      description: description || undefined,
      startTime,
      endTime,
      breakDuration: parseInt(breakDuration),
      standId: standId || undefined,
      color,
    })
  }

  // Handle delete
  const handleDelete = () => {
    if (template && onDelete && confirm('Supprimer ce modele ?')) {
      onDelete(template.id)
    }
  }

  // Stand options for select
  const standOptions = [
    { value: '', label: 'Aucun stand specifique' },
    ...stands.map((s) => ({
      value: s.id,
      label: s.name,
    })),
  ]

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>
            {isEditing ? 'Modifier le modele' : 'Nouveau modele de shift'}
          </ModalTitle>
        </ModalHeader>

        <ModalBody className="space-y-6">
          {/* Name */}
          <Input
            label="Nom du modele"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Shift matin, Service soir..."
          />

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Description du modele..."
            />
          </div>

          {/* Time row */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="time"
              label="Heure de debut"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              type="time"
              label="Heure de fin"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          {/* Break duration */}
          <Input
            type="number"
            label="Pause (minutes)"
            value={breakDuration}
            onChange={(e) => setBreakDuration(e.target.value)}
            min="0"
            step="5"
          />

          {/* Stand selection */}
          <Select
            label="Stand par defaut (optionnel)"
            placeholder="Selectionner un stand"
            options={standOptions}
            value={standId}
            onValueChange={setStandId}
          />

          {/* Color selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Couleur
            </label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-8 h-8 rounded-full transition-all',
                    color === c
                      ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                      : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <div className="flex w-full items-center justify-between">
            <div>
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                disabled={!name || !startTime || !endTime || isLoading}
                loading={isLoading}
              >
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? 'Enregistrer' : 'Creer'}
              </Button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

// Invite staff modal
interface InviteStaffModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stands: Stand[]
  onInvite: (data: {
    email: string
    name?: string
    role: string
    standIds?: string[]
    notes?: string
  }) => void
  isLoading?: boolean
}

export function InviteStaffModal({
  open,
  onOpenChange,
  stands,
  onInvite,
  isLoading,
}: InviteStaffModalProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('OPERATOR')
  const [selectedStands, setSelectedStands] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  // Reset form on open
  useEffect(() => {
    if (open) {
      setEmail('')
      setName('')
      setRole('OPERATOR')
      setSelectedStands([])
      setNotes('')
    }
  }, [open])

  const handleSubmit = () => {
    if (!email) return

    onInvite({
      email,
      name: name || undefined,
      role,
      standIds: selectedStands.length > 0 ? selectedStands : undefined,
      notes: notes || undefined,
    })
  }

  const roleOptions = [
    { value: 'ORGANIZER', label: 'Organisateur' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'OPERATOR', label: 'Operateur' },
    { value: 'SECURITY', label: 'Securite' },
    { value: 'MEDICAL', label: 'Medical' },
    { value: 'VOLUNTEER', label: 'Benevole' },
  ]

  const toggleStand = (standId: string) => {
    setSelectedStands((prev) =>
      prev.includes(standId)
        ? prev.filter((id) => id !== standId)
        : [...prev, standId]
    )
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Inviter un membre</ModalTitle>
        </ModalHeader>

        <ModalBody className="space-y-6">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemple.com"
            required
          />

          <Input
            label="Nom (optionnel)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Prenom Nom"
            hint="Si non renseigne, l'utilisateur le completera lors de l'inscription"
          />

          <Select
            label="Role"
            options={roleOptions}
            value={role}
            onValueChange={setRole}
          />

          {/* Stand assignment */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Assigner a des stands (optionnel)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
              {stands.map((stand) => (
                <button
                  key={stand.id}
                  type="button"
                  onClick={() => toggleStand(stand.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded text-sm transition-colors',
                    selectedStands.includes(stand.id)
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  <MapPin className="h-3 w-3" />
                  {stand.name}
                </button>
              ))}
              {stands.length === 0 && (
                <p className="text-sm text-gray-500">Aucun stand disponible</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Notes (optionnel)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Notes internes..."
            />
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={!email || isLoading}
            loading={isLoading}
          >
            Envoyer l'invitation
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
