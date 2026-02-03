'use client'

import * as React from 'react'
import { Search, X, Filter, Calendar } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { DayPicker, DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, MultiSelect } from '@/components/ui/Select'
import {
  AuditAction,
  AuditResource,
  AuditLogFilters,
  AUDIT_ACTIONS,
  AUDIT_RESOURCES,
  getActionLabel,
  getResourceLabel,
} from '@/lib/api/audit'

interface AuditFiltersProps {
  filters: AuditLogFilters
  onFiltersChange: (filters: AuditLogFilters) => void
  users?: Array<{ id: string; name: string; email: string }>
  className?: string
}

type PresetKey = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom'

interface Preset {
  label: string
  getRange: () => DateRange
}

const presets: Record<Exclude<PresetKey, 'custom'>, Preset> = {
  today: {
    label: "Aujourd'hui",
    getRange: () => {
      const today = new Date()
      return { from: today, to: today }
    },
  },
  yesterday: {
    label: 'Hier',
    getRange: () => {
      const yesterday = subDays(new Date(), 1)
      return { from: yesterday, to: yesterday }
    },
  },
  last7days: {
    label: '7 derniers jours',
    getRange: () => ({
      from: subDays(new Date(), 6),
      to: new Date(),
    }),
  },
  last30days: {
    label: '30 derniers jours',
    getRange: () => ({
      from: subDays(new Date(), 29),
      to: new Date(),
    }),
  },
  thisMonth: {
    label: 'Ce mois',
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  lastMonth: {
    label: 'Mois dernier',
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      }
    },
  },
}

export function AuditFilters({
  filters,
  onFiltersChange,
  users = [],
  className,
}: AuditFiltersProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false)
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  const datePickerRef = React.useRef<HTMLDivElement>(null)

  const dateRange: DateRange | undefined =
    filters.startDate && filters.endDate
      ? {
          from: new Date(filters.startDate),
          to: new Date(filters.endDate),
        }
      : undefined

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target as Node)
      ) {
        setIsDatePickerOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value || undefined, page: 1 })
  }

  const handleActionChange = (values: string[]) => {
    onFiltersChange({
      ...filters,
      action: values.length > 0 ? (values as AuditAction[]) : undefined,
      page: 1,
    })
  }

  const handleResourceChange = (values: string[]) => {
    onFiltersChange({
      ...filters,
      resource: values.length > 0 ? (values as AuditResource[]) : undefined,
      page: 1,
    })
  }

  const handleUserChange = (value: string) => {
    onFiltersChange({
      ...filters,
      actorId: value || undefined,
      page: 1,
    })
  }

  const handleSeverityChange = (values: string[]) => {
    onFiltersChange({
      ...filters,
      severity:
        values.length > 0
          ? (values as ('info' | 'warning' | 'critical')[])
          : undefined,
      page: 1,
    })
  }

  const handleDateRangeChange = (range: DateRange | undefined) => {
    onFiltersChange({
      ...filters,
      startDate: range?.from ? range.from.toISOString().split('T')[0] : undefined,
      endDate: range?.to ? range.to.toISOString().split('T')[0] : undefined,
      page: 1,
    })
  }

  const handlePresetClick = (presetKey: Exclude<PresetKey, 'custom'>) => {
    const range = presets[presetKey].getRange()
    handleDateRangeChange(range)
    setIsDatePickerOpen(false)
  }

  const clearFilters = () => {
    onFiltersChange({ page: 1, perPage: filters.perPage })
  }

  const hasActiveFilters =
    filters.search ||
    (filters.action && filters.action.length > 0) ||
    (filters.resource && filters.resource.length > 0) ||
    filters.actorId ||
    (filters.severity && filters.severity.length > 0) ||
    filters.startDate ||
    filters.endDate

  const formatDateRange = () => {
    if (!dateRange?.from) return 'Selectionner une periode'
    if (!dateRange.to) return format(dateRange.from, 'd MMM yyyy', { locale: fr })
    if (dateRange.from.toDateString() === dateRange.to.toDateString()) {
      return format(dateRange.from, 'd MMM yyyy', { locale: fr })
    }
    return `${format(dateRange.from, 'd MMM', { locale: fr })} - ${format(
      dateRange.to,
      'd MMM yyyy',
      { locale: fr }
    )}`
  }

  const actionOptions = AUDIT_ACTIONS.map((action) => ({
    value: action,
    label: getActionLabel(action),
  }))

  const resourceOptions = AUDIT_RESOURCES.map((resource) => ({
    value: resource,
    label: getResourceLabel(resource),
  }))

  const userOptions = users.map((user) => ({
    value: user.id,
    label: `${user.name} (${user.email})`,
  }))

  const severityOptions = [
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Attention' },
    { value: 'critical', label: 'Critique' },
  ]

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main filters row */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        {/* Search */}
        <div className="flex-1">
          <Input
            placeholder="Rechercher dans les logs..."
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            rightIcon={
              filters.search ? (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : undefined
            }
          />
        </div>

        {/* Date Range Picker */}
        <div className="relative w-full lg:w-64" ref={datePickerRef}>
          <button
            type="button"
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className={cn(
              'flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
              'border-gray-300 hover:border-gray-400'
            )}
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className={cn(!dateRange?.from && 'text-gray-400')}>
                {formatDateRange()}
              </span>
            </span>
          </button>

          {isDatePickerOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 flex rounded-lg border border-gray-200 bg-white shadow-lg">
              {/* Presets sidebar */}
              <div className="flex w-36 flex-col border-r border-gray-200 p-2">
                <p className="mb-2 px-2 text-xs font-medium uppercase text-gray-500">
                  Raccourcis
                </p>
                {Object.entries(presets).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      handlePresetClick(key as Exclude<PresetKey, 'custom'>)
                    }
                    className="rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {preset.label}
                  </button>
                ))}
                <div className="my-2 border-t border-gray-200" />
                {dateRange?.from && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDateRangeChange(undefined)
                      setIsDatePickerOpen(false)
                    }}
                    className="rounded-md px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Effacer
                  </button>
                )}
              </div>

              {/* Calendar */}
              <div className="p-3">
                <DayPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={handleDateRangeChange}
                  numberOfMonths={2}
                  locale={fr}
                  showOutsideDays
                  disabled={{ after: new Date() }}
                  classNames={{
                    months: 'flex gap-4',
                    month: 'space-y-4',
                    caption: 'flex justify-center pt-1 relative items-center',
                    caption_label: 'text-sm font-medium',
                    nav: 'space-x-1 flex items-center',
                    nav_button: cn(
                      'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
                      'inline-flex items-center justify-center rounded-md border border-gray-300',
                      'hover:bg-gray-100 transition-colors'
                    ),
                    nav_button_previous: 'absolute left-1',
                    nav_button_next: 'absolute right-1',
                    table: 'w-full border-collapse space-y-1',
                    head_row: 'flex',
                    head_cell:
                      'text-gray-500 rounded-md w-9 font-normal text-[0.8rem]',
                    row: 'flex w-full mt-2',
                    cell: cn(
                      'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
                      '[&:has([aria-selected])]:bg-blue-50',
                      '[&:has([aria-selected].day-range-end)]:rounded-r-md',
                      '[&:has([aria-selected].day-range-start)]:rounded-l-md',
                      'first:[&:has([aria-selected])]:rounded-l-md',
                      'last:[&:has([aria-selected])]:rounded-r-md'
                    ),
                    day: cn(
                      'h-9 w-9 p-0 font-normal',
                      'inline-flex items-center justify-center rounded-md',
                      'hover:bg-gray-100 transition-colors',
                      'aria-selected:opacity-100'
                    ),
                    day_range_start: 'day-range-start',
                    day_range_end: 'day-range-end',
                    day_selected: cn(
                      'bg-blue-600 text-white hover:bg-blue-600 hover:text-white',
                      'focus:bg-blue-600 focus:text-white'
                    ),
                    day_today: 'bg-gray-100 text-gray-900',
                    day_outside: 'text-gray-400 opacity-50',
                    day_disabled: 'text-gray-400 opacity-50',
                    day_range_middle:
                      'aria-selected:bg-blue-50 aria-selected:text-blue-600',
                    day_hidden: 'invisible',
                  }}
                />

                <div className="mt-3 flex justify-end border-t border-gray-200 pt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsDatePickerOpen(false)}
                  >
                    Appliquer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toggle advanced filters */}
        <Button
          variant="outline"
          size="md"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="shrink-0"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtres
          {hasActiveFilters && (
            <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
              {[
                filters.action?.length || 0,
                filters.resource?.length || 0,
                filters.actorId ? 1 : 0,
                filters.severity?.length || 0,
              ].reduce((a, b) => a + b, 0)}
            </span>
          )}
        </Button>

        {/* Clear all */}
        {hasActiveFilters && (
          <Button variant="ghost" size="md" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Effacer tout
          </Button>
        )}
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Action filter */}
            <MultiSelect
              label="Actions"
              options={actionOptions}
              value={filters.action || []}
              onValueChange={handleActionChange}
              placeholder="Toutes les actions"
              searchable
            />

            {/* Resource filter */}
            <MultiSelect
              label="Resources"
              options={resourceOptions}
              value={filters.resource || []}
              onValueChange={handleResourceChange}
              placeholder="Toutes les resources"
              searchable
            />

            {/* User filter */}
            {users.length > 0 && (
              <Select
                label="Utilisateur"
                options={[
                  { value: '', label: 'Tous les utilisateurs' },
                  ...userOptions,
                ]}
                value={filters.actorId || ''}
                onValueChange={handleUserChange}
                searchable
              />
            )}

            {/* Severity filter */}
            <MultiSelect
              label="Severite"
              options={severityOptions}
              value={filters.severity || []}
              onValueChange={handleSeverityChange}
              placeholder="Toutes"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditFilters
