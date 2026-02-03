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
              'mb-2 block text-sm font-medium text-gray-300',
              disabled && 'text-gray-500'
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <span
                className={cn(
                  'text-gray-400',
                  error && 'text-red-400',
                  disabled && 'text-gray-600'
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
              'flex h-12 w-full rounded-lg border bg-white/5 px-4 py-3 text-sm text-white transition-all duration-200',
              'placeholder:text-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-offset-transparent',
              'disabled:cursor-not-allowed disabled:bg-white/[0.02] disabled:text-gray-500',
              !error && [
                'border-white/10',
                'hover:border-white/20',
                'focus:border-festival-500 focus:ring-festival-500/20',
              ],
              error && [
                'border-red-500/50',
                'focus:border-red-500 focus:ring-red-500/20',
              ],
              leftIcon && 'pl-11',
              rightIcon && 'pr-11',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-4">
              <span
                className={cn(
                  'text-gray-400',
                  error && 'text-red-400',
                  disabled && 'text-gray-600'
                )}
              >
                {rightIcon}
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-between mt-2">
          <div>
            {error && (
              <p id={errorId} className="text-sm text-red-400">
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
              characterCount >= maxLength ? "text-red-400" : "text-gray-500"
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
