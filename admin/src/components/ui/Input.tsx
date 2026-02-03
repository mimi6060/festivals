'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  containerClassName?: string
  showCharacterCount?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      type = 'text',
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      disabled,
      id,
      showCharacterCount,
      maxLength,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const inputId = id || React.useId()
    const errorId = `${inputId}-error`
    const hintId = `${inputId}-hint`
    const [internalValue, setInternalValue] = React.useState(defaultValue?.toString() || '')

    // Use controlled value if provided, otherwise use internal state
    const currentValue = value !== undefined ? value.toString() : internalValue
    const characterCount = currentValue.length

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) {
        setInternalValue(e.target.value)
      }
      onChange?.(e)
    }

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'mb-1.5 block text-sm font-medium text-gray-700',
              disabled && 'text-gray-400'
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span
                className={cn(
                  'text-gray-400',
                  error && 'text-red-400',
                  disabled && 'text-gray-300'
                )}
              >
                {leftIcon}
              </span>
            </div>
          )}
          <input
            type={type}
            id={inputId}
            ref={ref}
            disabled={disabled}
            maxLength={maxLength}
            value={value}
            defaultValue={value === undefined ? defaultValue : undefined}
            onChange={handleChange}
            aria-invalid={!!error}
            aria-describedby={
              error ? errorId : hint ? hintId : undefined
            }
            className={cn(
              'flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm transition-colors',
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
              ],
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span
                className={cn(
                  'text-gray-400',
                  error && 'text-red-400',
                  disabled && 'text-gray-300'
                )}
              >
                {rightIcon}
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-between mt-1.5">
          <div>
            {error && (
              <p id={errorId} className="text-sm text-red-600">
                {error}
              </p>
            )}
            {!error && hint && (
              <p id={hintId} className="text-sm text-gray-500">
                {hint}
              </p>
            )}
          </div>
          {showCharacterCount && maxLength && (
            <p className={cn(
              "text-sm",
              characterCount >= maxLength ? "text-red-600" : "text-gray-500"
            )}>
              {characterCount}/{maxLength}
            </p>
          )}
        </div>
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
