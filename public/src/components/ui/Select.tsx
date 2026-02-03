'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
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
  className?: string
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      options,
      value,
      defaultValue,
      onValueChange,
      placeholder = 'Select...',
      label,
      error,
      disabled,
      className,
    },
    ref
  ) => {
    return (
      <div className={cn('w-full', className)}>
        {label && (
          <label
            className={cn(
              'mb-2 block text-sm font-medium text-gray-300',
              disabled && 'text-gray-500'
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
        >
          <SelectPrimitive.Trigger
            ref={ref}
            className={cn(
              'flex h-12 w-full items-center justify-between rounded-lg border bg-white/5 px-4 py-3 text-sm text-white transition-all duration-200',
              'hover:border-white/20',
              'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-offset-transparent',
              'disabled:cursor-not-allowed disabled:bg-white/[0.02] disabled:text-gray-500',
              !error && [
                'border-white/10',
                'focus:border-festival-500 focus:ring-festival-500/20',
              ],
              error && [
                'border-red-500/50',
                'focus:border-red-500 focus:ring-red-500/20',
              ]
            )}
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon asChild>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className={cn(
                'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-xl',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[side=bottom]:slide-in-from-top-2'
              )}
              position="popper"
              sideOffset={4}
            >
              <SelectPrimitive.Viewport className="p-1">
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-lg py-2.5 pl-10 pr-4 text-sm text-white outline-none',
                      'hover:bg-white/10',
                      'focus:bg-white/10',
                      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
                    )}
                  >
                    <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-4 w-4 text-festival-400" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>
                      {option.label}
                    </SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
