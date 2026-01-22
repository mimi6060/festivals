'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  searchable?: boolean
  className?: string
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      options,
      value,
      defaultValue,
      onValueChange,
      placeholder = 'Select an option',
      label,
      error,
      disabled,
      searchable = false,
      className,
    },
    ref
  ) => {
    const [searchQuery, setSearchQuery] = React.useState('')
    const inputRef = React.useRef<HTMLInputElement>(null)

    const filteredOptions = searchable
      ? options.filter((option) =>
          option.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : options

    const handleOpenChange = (open: boolean) => {
      if (open && searchable) {
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (!open) {
        setSearchQuery('')
      }
    }

    return (
      <div className={cn('w-full', className)}>
        {label && (
          <label
            className={cn(
              'mb-1.5 block text-sm font-medium text-gray-700',
              disabled && 'text-gray-400'
            )}
          >
            {label}
          </label>
        )}
        <SelectPrimitive.Root
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          disabled={disabled}
          onOpenChange={handleOpenChange}
        >
          <SelectPrimitive.Trigger
            ref={ref}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm transition-colors',
              'placeholder:text-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
              !error && [
                'border-gray-300',
                'focus:border-blue-500 focus:ring-blue-500/20',
              ],
              error && [
                'border-red-500',
                'focus:border-red-500 focus:ring-red-500/20',
              ]
            )}
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon asChild>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className={cn(
                'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white shadow-md',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
                'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
              )}
              position="popper"
              sideOffset={4}
            >
              <SelectPrimitive.ScrollUpButton className="flex h-6 cursor-default items-center justify-center bg-white">
                <ChevronUp className="h-4 w-4" />
              </SelectPrimitive.ScrollUpButton>
              {searchable && (
                <div className="sticky top-0 border-b border-gray-200 bg-white p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 w-full rounded-md border border-gray-300 pl-8 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Search..."
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSearchQuery('')
                          inputRef.current?.focus()
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              <SelectPrimitive.Viewport className="p-1">
                {filteredOptions.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-gray-500">
                    No options found
                  </div>
                ) : (
                  filteredOptions.map((option) => (
                    <SelectPrimitive.Item
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      className={cn(
                        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
                        'focus:bg-gray-100 focus:text-gray-900',
                        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
                      )}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <SelectPrimitive.ItemIndicator>
                          <Check className="h-4 w-4" />
                        </SelectPrimitive.ItemIndicator>
                      </span>
                      <SelectPrimitive.ItemText>
                        {option.label}
                      </SelectPrimitive.ItemText>
                    </SelectPrimitive.Item>
                  ))
                )}
              </SelectPrimitive.Viewport>
              <SelectPrimitive.ScrollDownButton className="flex h-6 cursor-default items-center justify-center bg-white">
                <ChevronDown className="h-4 w-4" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'

// Multi-select component
export interface MultiSelectProps {
  options: SelectOption[]
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  searchable?: boolean
  className?: string
}

const MultiSelect = React.forwardRef<HTMLDivElement, MultiSelectProps>(
  (
    {
      options,
      value = [],
      defaultValue,
      onValueChange,
      placeholder = 'Select options',
      label,
      error,
      disabled,
      searchable = false,
      className,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [searchQuery, setSearchQuery] = React.useState('')
    const [internalValue, setInternalValue] = React.useState<string[]>(
      defaultValue || []
    )
    const inputRef = React.useRef<HTMLInputElement>(null)
    const containerRef = React.useRef<HTMLDivElement>(null)

    const selectedValues = value.length > 0 ? value : internalValue

    const filteredOptions = searchable
      ? options.filter((option) =>
          option.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : options

    const toggleOption = (optionValue: string) => {
      const newValue = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue]

      setInternalValue(newValue)
      onValueChange?.(newValue)
    }

    const removeOption = (optionValue: string, e: React.MouseEvent) => {
      e.stopPropagation()
      const newValue = selectedValues.filter((v) => v !== optionValue)
      setInternalValue(newValue)
      onValueChange?.(newValue)
    }

    const selectedLabels = selectedValues
      .map((v) => options.find((o) => o.value === v)?.label)
      .filter(Boolean)

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false)
          setSearchQuery('')
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
      <div ref={ref} className={cn('w-full', className)}>
        {label && (
          <label
            className={cn(
              'mb-1.5 block text-sm font-medium text-gray-700',
              disabled && 'text-gray-400'
            )}
          >
            {label}
          </label>
        )}
        <div ref={containerRef} className="relative">
          <div
            onClick={() => {
              if (!disabled) {
                setIsOpen(!isOpen)
                if (!isOpen && searchable) {
                  setTimeout(() => inputRef.current?.focus(), 0)
                }
              }
            }}
            className={cn(
              'flex min-h-10 w-full cursor-pointer flex-wrap items-center gap-1 rounded-md border bg-white px-3 py-2 text-sm transition-colors',
              'focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-0',
              disabled && 'cursor-not-allowed bg-gray-50',
              !error && [
                'border-gray-300',
                'focus-within:border-blue-500 focus-within:ring-blue-500/20',
              ],
              error && [
                'border-red-500',
                'focus-within:border-red-500 focus-within:ring-red-500/20',
              ]
            )}
          >
            {selectedLabels.length === 0 ? (
              <span className="text-gray-400">{placeholder}</span>
            ) : (
              selectedLabels.map((labelText, index) => (
                <span
                  key={selectedValues[index]}
                  className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-sm"
                >
                  {labelText}
                  <button
                    type="button"
                    onClick={(e) => removeOption(selectedValues[index], e)}
                    className="text-gray-500 hover:text-gray-700"
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
            <ChevronDown
              className={cn(
                'ml-auto h-4 w-4 shrink-0 opacity-50 transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </div>
          {isOpen && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-md">
              {searchable && (
                <div className="sticky top-0 border-b border-gray-200 bg-white p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 w-full rounded-md border border-gray-300 pl-8 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Search..."
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('')
                          inputRef.current?.focus()
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="p-1">
                {filteredOptions.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-gray-500">
                    No options found
                  </div>
                ) : (
                  filteredOptions.map((option) => (
                    <div
                      key={option.value}
                      onClick={() => !option.disabled && toggleOption(option.value)}
                      className={cn(
                        'relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm',
                        'hover:bg-gray-100',
                        option.disabled && 'pointer-events-none opacity-50'
                      )}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        {selectedValues.includes(option.value) && (
                          <Check className="h-4 w-4" />
                        )}
                      </span>
                      {option.label}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      </div>
    )
  }
)
MultiSelect.displayName = 'MultiSelect'

export { Select, MultiSelect }
