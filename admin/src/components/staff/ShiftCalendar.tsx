'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  eachHourOfInterval,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isSameDay,
  isToday,
  parseISO,
  setHours,
  setMinutes,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
  MapPin,
  Plus,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Shift,
  ShiftTemplate,
  StaffMember,
  getShiftStatusColor,
  getShiftStatusLabel,
} from '@/lib/api/staff'

export type CalendarView = 'week' | 'day'

interface ShiftCalendarProps {
  shifts: Shift[]
  templates?: ShiftTemplate[]
  staff?: StaffMember[]
  view: CalendarView
  onViewChange: (view: CalendarView) => void
  selectedDate: Date
  onDateChange: (date: Date) => void
  onShiftClick?: (shift: Shift) => void
  onSlotClick?: (date: Date, hour: number) => void
  onShiftDrop?: (shiftId: string, newDate: Date, newStartTime: string) => void
  isLoading?: boolean
  className?: string
}

interface DragState {
  shiftId: string
  originalDate: string
  originalTime: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const WORKING_HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6am to midnight

export function ShiftCalendar({
  shifts,
  templates = [],
  staff = [],
  view,
  onViewChange,
  selectedDate,
  onDateChange,
  onShiftClick,
  onSlotClick,
  onShiftDrop,
  isLoading,
  className,
}: ShiftCalendarProps) {
  const [dragState, setDragState] = useState<DragState | null>(null)

  // Calculate date range based on view
  const dateRange = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 })
      const end = endOfWeek(selectedDate, { weekStartsOn: 1 })
      return eachDayOfInterval({ start, end })
    }
    return [selectedDate]
  }, [selectedDate, view])

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    shifts.forEach((shift) => {
      const dateKey = shift.date
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(shift)
    })
    return map
  }, [shifts])

  // Navigation handlers
  const handlePrevious = () => {
    if (view === 'week') {
      onDateChange(subWeeks(selectedDate, 1))
    } else {
      onDateChange(subDays(selectedDate, 1))
    }
  }

  const handleNext = () => {
    if (view === 'week') {
      onDateChange(addWeeks(selectedDate, 1))
    } else {
      onDateChange(addDays(selectedDate, 1))
    }
  }

  const handleToday = () => {
    onDateChange(new Date())
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, shift: Shift) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', shift.id)
    setDragState({
      shiftId: shift.id,
      originalDate: shift.date,
      originalTime: shift.startTime,
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault()
    if (!dragState || !onShiftDrop) return

    const newDate = date
    const newStartTime = `${hour.toString().padStart(2, '0')}:00`

    onShiftDrop(dragState.shiftId, newDate, newStartTime)
    setDragState(null)
  }

  const handleDragEnd = () => {
    setDragState(null)
  }

  // Calculate shift position and height
  const getShiftStyle = (shift: Shift) => {
    const [startHour, startMin] = shift.startTime.split(':').map(Number)
    const [endHour, endMin] = shift.endTime.split(':').map(Number)

    const startOffset = (startHour - 6) * 60 + startMin // minutes from 6am
    const duration = (endHour - startHour) * 60 + (endMin - startMin)

    const top = (startOffset / 60) * 64 // 64px per hour
    const height = (duration / 60) * 64

    return { top: `${top}px`, height: `${Math.max(height, 32)}px` }
  }

  // Get title for current view
  const getViewTitle = () => {
    if (view === 'week') {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 })
      const end = endOfWeek(selectedDate, { weekStartsOn: 1 })
      return `${format(start, 'd', { locale: fr })} - ${format(end, 'd MMMM yyyy', { locale: fr })}`
    }
    return format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })
  }

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 capitalize">
            {getViewTitle()}
          </h2>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Aujourd'hui
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-gray-200">
            <button
              onClick={() => onViewChange('day')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors',
                view === 'day'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              Jour
            </button>
            <button
              onClick={() => onViewChange('week')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors border-l',
                view === 'week'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              Semaine
            </button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex overflow-auto">
        {/* Time column */}
        <div className="flex-shrink-0 w-16 border-r bg-gray-50">
          <div className="h-12 border-b" /> {/* Header spacer */}
          {WORKING_HOURS.map((hour) => (
            <div
              key={hour}
              className="h-16 border-b px-2 py-1 text-xs text-gray-500 text-right"
            >
              {`${hour.toString().padStart(2, '0')}:00`}
            </div>
          ))}
        </div>

        {/* Days columns */}
        <div className={cn('flex-1 flex', view === 'day' ? '' : 'divide-x')}>
          {dateRange.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd')
            const dayShifts = shiftsByDate.get(dateKey) || []
            const isCurrentDay = isToday(date)

            return (
              <div
                key={dateKey}
                className={cn('flex-1 min-w-[120px]', view === 'day' && 'min-w-[200px]')}
              >
                {/* Day header */}
                <div
                  className={cn(
                    'h-12 border-b px-2 py-1 text-center',
                    isCurrentDay ? 'bg-primary/5' : 'bg-gray-50'
                  )}
                >
                  <p className="text-xs text-gray-500 uppercase">
                    {format(date, 'EEE', { locale: fr })}
                  </p>
                  <p
                    className={cn(
                      'text-lg font-semibold',
                      isCurrentDay ? 'text-primary' : 'text-gray-900'
                    )}
                  >
                    {format(date, 'd')}
                  </p>
                </div>

                {/* Hours grid */}
                <div className="relative">
                  {WORKING_HOURS.map((hour) => (
                    <div
                      key={hour}
                      className={cn(
                        'h-16 border-b hover:bg-gray-50 cursor-pointer transition-colors',
                        isCurrentDay && 'bg-primary/5'
                      )}
                      onClick={() => onSlotClick?.(date, hour)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, date, hour)}
                    />
                  ))}

                  {/* Shifts */}
                  {dayShifts.map((shift) => {
                    const style = getShiftStyle(shift)
                    const statusColor = getShiftStatusColor(shift.status)
                    const staffMember = staff.find((s) => s.id === shift.staffId)

                    return (
                      <div
                        key={shift.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, shift)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          e.stopPropagation()
                          onShiftClick?.(shift)
                        }}
                        className={cn(
                          'absolute left-1 right-1 rounded-md px-2 py-1 cursor-pointer transition-all',
                          'hover:shadow-md hover:z-10',
                          dragState?.shiftId === shift.id && 'opacity-50',
                          statusColor.bg
                        )}
                        style={style}
                      >
                        <div className="flex items-start gap-1">
                          <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5 cursor-grab" />
                          <div className="min-w-0 flex-1">
                            <p className={cn('text-xs font-medium truncate', statusColor.text)}>
                              {staffMember?.user.name || 'Non assigne'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {shift.startTime} - {shift.endTime}
                            </p>
                            {shift.stand && (
                              <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" />
                                {shift.stand.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}
    </div>
  )
}

// Templates sidebar component
interface ShiftTemplatesSidebarProps {
  templates: ShiftTemplate[]
  onTemplateClick?: (template: ShiftTemplate) => void
  onCreateTemplate?: () => void
  className?: string
}

export function ShiftTemplatesSidebar({
  templates,
  onTemplateClick,
  onCreateTemplate,
  className,
}: ShiftTemplatesSidebarProps) {
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white overflow-hidden', className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold text-gray-900">Modeles de shift</h3>
        {onCreateTemplate && (
          <Button variant="ghost" size="sm" onClick={onCreateTemplate}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="p-4 space-y-2">
        {templates.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Aucun modele cree
          </p>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              draggable
              onClick={() => onTemplateClick?.(template)}
              className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: template.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {template.name}
                </p>
                <p className="text-xs text-gray-500">
                  {template.startTime} - {template.endTime}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Mini calendar for date selection
interface MiniCalendarProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
  shiftsPerDay?: Map<string, number>
  className?: string
}

export function MiniCalendar({
  selectedDate,
  onDateSelect,
  shiftsPerDay,
  className,
}: MiniCalendarProps) {
  const [viewMonth, setViewMonth] = useState(selectedDate)

  const monthStart = startOfWeek(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1), { weekStartsOn: 1 })
  const monthEnd = endOfWeek(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="font-semibold text-gray-900 capitalize">
          {format(viewMonth, 'MMMM yyyy', { locale: fr })}
        </h3>
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const shiftCount = shiftsPerDay?.get(dateKey) || 0
          const isSelected = isSameDay(day, selectedDate)
          const isCurrent = isToday(day)
          const isCurrentMonth = day.getMonth() === viewMonth.getMonth()

          return (
            <button
              key={dateKey}
              onClick={() => onDateSelect(day)}
              className={cn(
                'relative h-8 rounded text-sm transition-colors',
                isSelected
                  ? 'bg-primary text-white'
                  : isCurrent
                  ? 'bg-primary/10 text-primary'
                  : isCurrentMonth
                  ? 'hover:bg-gray-100 text-gray-900'
                  : 'text-gray-400'
              )}
            >
              {format(day, 'd')}
              {shiftCount > 0 && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
