'use client'

import * as React from 'react'
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { DayPicker, DateRange } from 'react-day-picker'
import { Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  className?: string
  disabled?: boolean
  placeholder?: string
}

type PresetKey = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom'

interface Preset {
  label: string
  getRange: () => DateRange
}

const presets: Record<Exclude<PresetKey, 'custom'>, Preset> = {
  today: {
    label: "Today",
    getRange: () => {
      const today = new Date()
      return { from: today, to: today }
    },
  },
  yesterday: {
    label: "Yesterday",
    getRange: () => {
      const yesterday = subDays(new Date(), 1)
      return { from: yesterday, to: yesterday }
    },
  },
  last7days: {
    label: "Last 7 days",
    getRange: () => ({
      from: subDays(new Date(), 6),
      to: new Date(),
    }),
  },
  last30days: {
    label: "Last 30 days",
    getRange: () => ({
      from: subDays(new Date(), 29),
      to: new Date(),
    }),
  },
  thisWeek: {
    label: "This week",
    getRange: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    }),
  },
  lastWeek: {
    label: "Last week",
    getRange: () => {
      const lastWeekStart = startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 })
      return {
        from: lastWeekStart,
        to: endOfWeek(lastWeekStart, { weekStartsOn: 1 }),
      }
    },
  },
  thisMonth: {
    label: "This month",
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  lastMonth: {
    label: "Last month",
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      }
    },
  },
}

export function DateRangePicker({
  value,
  onChange,
  className,
  disabled,
  placeholder = "Select date range",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedPreset, setSelectedPreset] = React.useState<PresetKey | null>(null)
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(value)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync temp range with value
  React.useEffect(() => {
    setTempRange(value)
  }, [value])

  const handlePresetClick = (presetKey: Exclude<PresetKey, 'custom'>) => {
    const range = presets[presetKey].getRange()
    setSelectedPreset(presetKey)
    setTempRange(range)
    onChange?.(range)
    setIsOpen(false)
  }

  const handleCustomSelect = (range: DateRange | undefined) => {
    setSelectedPreset('custom')
    setTempRange(range)
  }

  const handleApply = () => {
    onChange?.(tempRange)
    setIsOpen(false)
  }

  const handleClear = () => {
    setSelectedPreset(null)
    setTempRange(undefined)
    onChange?.(undefined)
    setIsOpen(false)
  }

  const formatDateRange = (range?: DateRange) => {
    if (!range?.from) return placeholder
    if (!range.to) return format(range.from, 'd MMM yyyy', { locale: fr })
    if (range.from.toDateString() === range.to.toDateString()) {
      return format(range.from, 'd MMM yyyy', { locale: fr })
    }
    return `${format(range.from, 'd MMM', { locale: fr })} - ${format(range.to, 'd MMM yyyy', { locale: fr })}`
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
          'border-gray-300 hover:border-gray-400'
        )}
      >
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className={cn(!value?.from && 'text-gray-400')}>
            {formatDateRange(value)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-gray-500 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 flex rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Presets sidebar */}
          <div className="flex w-40 flex-col border-r border-gray-200 p-2">
            <p className="mb-2 px-2 text-xs font-medium uppercase text-gray-500">
              Quick Select
            </p>
            {Object.entries(presets).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetClick(key as Exclude<PresetKey, 'custom'>)}
                className={cn(
                  'rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  selectedPreset === key
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                {preset.label}
              </button>
            ))}
            <div className="my-2 border-t border-gray-200" />
            <button
              type="button"
              onClick={() => setSelectedPreset('custom')}
              className={cn(
                'rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                selectedPreset === 'custom'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              Custom range
            </button>
          </div>

          {/* Calendar */}
          <div className="p-3">
            <DayPicker
              mode="range"
              selected={tempRange}
              onSelect={handleCustomSelect}
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
                head_cell: 'text-gray-500 rounded-md w-9 font-normal text-[0.8rem]',
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

            {/* Footer with actions */}
            <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-500">
                {tempRange?.from && tempRange?.to && (
                  <>
                    {format(tempRange.from, 'd MMM yyyy', { locale: fr })}
                    {' - '}
                    {format(tempRange.to, 'd MMM yyyy', { locale: fr })}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleApply}
                  disabled={!tempRange?.from || !tempRange?.to}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DateRangePicker
