'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimeRangePickerProps {
  startTime: string
  endTime: string
  onStartTimeChange: (time: string) => void
  onEndTimeChange: (time: string) => void
  error?: string
}

export function TimeRangePicker({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  error,
}: TimeRangePickerProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Time Range
      </label>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            className={cn(
              'w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              error && 'border-red-300'
            )}
          />
        </div>
        <span className="text-gray-500">to</span>
        <div className="relative flex-1">
          <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="time"
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
            className={cn(
              'w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              error && 'border-red-300'
            )}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">
        Supports overnight ranges (e.g., 22:00 to 02:00)
      </p>
    </div>
  )
}

// Quick time presets for common happy hour times
export function TimePresets({
  onSelect,
}: {
  onSelect: (start: string, end: string) => void
}) {
  const presets = [
    { label: 'Happy Hour (17-19)', start: '17:00', end: '19:00' },
    { label: 'Lunch (12-14)', start: '12:00', end: '14:00' },
    { label: 'Late Night (22-00)', start: '22:00', end: '00:00' },
    { label: 'All Day', start: '00:00', end: '23:59' },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => onSelect(preset.start, preset.end)}
          className="rounded-full border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}
