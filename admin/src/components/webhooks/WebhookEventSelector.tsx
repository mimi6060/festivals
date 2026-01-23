'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WEBHOOK_EVENTS, groupEventsByCategory, type WebhookEvent } from '@/lib/api/webhooks'

interface WebhookEventSelectorProps {
  selectedEvents: string[]
  onChange: (events: string[]) => void
  disabled?: boolean
  error?: string
}

export function WebhookEventSelector({
  selectedEvents,
  onChange,
  disabled = false,
  error,
}: WebhookEventSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const groupedEvents = useMemo(() => groupEventsByCategory(WEBHOOK_EVENTS), [])

  const filteredGroupedEvents = useMemo(() => {
    if (!searchQuery) return groupedEvents

    const lowerQuery = searchQuery.toLowerCase()
    const filtered: Record<string, WebhookEvent[]> = {}

    Object.entries(groupedEvents).forEach(([category, events]) => {
      const matchingEvents = events.filter(
        (event) =>
          event.id.toLowerCase().includes(lowerQuery) ||
          event.label.toLowerCase().includes(lowerQuery) ||
          event.description.toLowerCase().includes(lowerQuery)
      )
      if (matchingEvents.length > 0) {
        filtered[category] = matchingEvents
      }
    })

    return filtered
  }, [groupedEvents, searchQuery])

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const toggleEvent = (eventId: string) => {
    if (disabled) return

    if (selectedEvents.includes(eventId)) {
      onChange(selectedEvents.filter((e) => e !== eventId))
    } else {
      onChange([...selectedEvents, eventId])
    }
  }

  const toggleCategoryEvents = (category: string) => {
    if (disabled) return

    const categoryEvents = filteredGroupedEvents[category] || []
    const categoryEventIds = categoryEvents.map((e) => e.id)
    const allSelected = categoryEventIds.every((id) => selectedEvents.includes(id))

    if (allSelected) {
      // Deselect all events in this category
      onChange(selectedEvents.filter((id) => !categoryEventIds.includes(id)))
    } else {
      // Select all events in this category
      const newSelected = new Set([...selectedEvents, ...categoryEventIds])
      onChange(Array.from(newSelected))
    }
  }

  const selectAll = () => {
    if (disabled) return
    onChange(WEBHOOK_EVENTS.map((e) => e.id))
  }

  const deselectAll = () => {
    if (disabled) return
    onChange([])
  }

  const getCategorySelectionState = (category: string): 'all' | 'some' | 'none' => {
    const categoryEvents = filteredGroupedEvents[category] || []
    const categoryEventIds = categoryEvents.map((e) => e.id)
    const selectedCount = categoryEventIds.filter((id) => selectedEvents.includes(id)).length

    if (selectedCount === 0) return 'none'
    if (selectedCount === categoryEventIds.length) return 'all'
    return 'some'
  }

  return (
    <div className={cn('space-y-3', disabled && 'opacity-60')}>
      {/* Search and actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un evenement..."
            disabled={disabled}
            className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="button"
          onClick={selectAll}
          disabled={disabled}
          className="text-sm text-primary hover:underline disabled:cursor-not-allowed"
        >
          Tout
        </button>
        <span className="text-gray-300">|</span>
        <button
          type="button"
          onClick={deselectAll}
          disabled={disabled}
          className="text-sm text-gray-500 hover:underline disabled:cursor-not-allowed"
        >
          Aucun
        </button>
      </div>

      {/* Selection count */}
      <div className="text-sm text-gray-500">
        {selectedEvents.length} evenement{selectedEvents.length !== 1 ? 's' : ''} selectionne{selectedEvents.length !== 1 ? 's' : ''}
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Event categories */}
      <div className="max-h-80 overflow-y-auto rounded-lg border divide-y">
        {Object.entries(filteredGroupedEvents).map(([category, events]) => {
          const isExpanded = expandedCategories.has(category) || searchQuery.length > 0
          const selectionState = getCategorySelectionState(category)

          return (
            <div key={category}>
              {/* Category header */}
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100',
                  disabled && 'cursor-not-allowed'
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  disabled={disabled}
                  className="p-0.5"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => toggleCategoryEvents(category)}
                  disabled={disabled}
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded border',
                    selectionState === 'all' && 'bg-primary border-primary',
                    selectionState === 'some' && 'bg-primary/50 border-primary',
                    selectionState === 'none' && 'border-gray-300'
                  )}
                >
                  {selectionState !== 'none' && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </button>

                <span className="flex-1 text-sm font-medium text-gray-700">{category}</span>
                <span className="text-xs text-gray-400">
                  {events.filter((e) => selectedEvents.includes(e.id)).length}/{events.length}
                </span>
              </div>

              {/* Events */}
              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {events.map((event) => {
                    const isSelected = selectedEvents.includes(event.id)

                    return (
                      <label
                        key={event.id}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50',
                          isSelected && 'bg-primary/5',
                          disabled && 'cursor-not-allowed'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEvent(event.id)}
                          disabled={disabled}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{event.label}</span>
                            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                              {event.id}
                            </code>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">{event.description}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {Object.keys(filteredGroupedEvents).length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            Aucun evenement trouve pour "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  )
}
