'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface SettingsCardProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  actions?: React.ReactNode
}

export function SettingsCard({
  title,
  description,
  children,
  className,
  actions,
}: SettingsCardProps) {
  return (
    <div className={cn('rounded-lg border bg-white', className)}>
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

interface SettingsFormProps {
  onSubmit: (e: React.FormEvent) => void
  children: React.ReactNode
  isLoading?: boolean
  submitLabel?: string
  className?: string
}

export function SettingsForm({
  onSubmit,
  children,
  isLoading = false,
  submitLabel = 'Save changes',
  className,
}: SettingsFormProps) {
  return (
    <form onSubmit={onSubmit} className={cn('space-y-6', className)}>
      {children}
      <div className="flex justify-end border-t pt-6">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

interface SettingsFieldProps {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
  required?: boolean
  className?: string
}

export function SettingsField({
  label,
  hint,
  error,
  children,
  required = false,
  className,
}: SettingsFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      {!error && hint && <p className="mt-1.5 text-sm text-gray-500">{hint}</p>}
    </div>
  )
}

interface SettingsSwitchProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function SettingsSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: SettingsSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className={cn('font-medium', disabled ? 'text-gray-400' : 'text-gray-900')}>
          {label}
        </p>
        {description && (
          <p className={cn('text-sm', disabled ? 'text-gray-300' : 'text-gray-500')}>
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
          checked ? 'bg-primary' : 'bg-gray-200',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  )
}

interface SettingsAlertProps {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  onDismiss?: () => void
}

export function SettingsAlert({ type, message, onDismiss }: SettingsAlertProps) {
  const styles = {
    success: 'bg-green-50 text-green-700 border-green-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  }

  return (
    <div className={cn('flex items-center justify-between rounded-lg border p-4', styles[type])}>
      <p>{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-current opacity-70 hover:opacity-100"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
