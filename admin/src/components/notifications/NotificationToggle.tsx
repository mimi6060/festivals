'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NotificationToggleProps {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void | Promise<void>
  disabled?: boolean
  icon?: React.ReactNode
  channel?: 'email' | 'sms' | 'push'
}

export function NotificationToggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  icon,
  channel,
}: NotificationToggleProps) {
  const [isLoading, setIsLoading] = React.useState(false)

  const handleChange = async () => {
    if (disabled || isLoading) return

    setIsLoading(true)
    try {
      await onChange(!checked)
    } finally {
      setIsLoading(false)
    }
  }

  const channelColors = {
    email: 'bg-blue-100 text-blue-600',
    sms: 'bg-green-100 text-green-600',
    push: 'bg-purple-100 text-purple-600',
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-4 transition-colors',
        checked && !disabled ? 'border-primary/20 bg-primary/5' : 'border-gray-200',
        disabled && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-4">
        {icon && (
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              channel ? channelColors[channel] : 'bg-gray-100 text-gray-600'
            )}
          >
            {icon}
          </div>
        )}
        <div>
          <label
            htmlFor={id}
            className={cn(
              'block font-medium cursor-pointer',
              disabled ? 'text-gray-400' : 'text-gray-900'
            )}
          >
            {label}
          </label>
          {description && (
            <p className={cn('mt-0.5 text-sm', disabled ? 'text-gray-300' : 'text-gray-500')}>
              {description}
            </p>
          )}
        </div>
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled || isLoading}
        onClick={handleChange}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          checked ? 'bg-primary' : 'bg-gray-200',
          (disabled || isLoading) && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className="sr-only">{label}</span>
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        >
          {isLoading && (
            <Loader2 className="h-3 w-3 animate-spin text-gray-400 absolute top-1 left-1" />
          )}
        </span>
      </button>
    </div>
  )
}

// Group component for organizing multiple toggles
export interface NotificationToggleGroupProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function NotificationToggleGroup({
  title,
  description,
  children,
  className,
}: NotificationToggleGroupProps) {
  return (
    <div className={cn('rounded-lg border bg-white', className)}>
      <div className="border-b px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      <div className="divide-y p-4">
        {React.Children.map(children, (child, index) => (
          <div className={cn(index > 0 && 'pt-4', index < React.Children.count(children) - 1 && 'pb-4')}>
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
