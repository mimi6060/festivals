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
      ...props
    },
    ref
  ) => {
    const inputId = id || React.useId()
    const errorId = `${inputId}-error`
    const hintId = `${inputId}-hint`

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
        {error && (
          <p id={errorId} className="mt-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={hintId} className="mt-2 text-sm text-gray-500">
            {hint}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
