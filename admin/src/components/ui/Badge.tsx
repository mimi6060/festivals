'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800',
        success: 'bg-green-100 text-green-800',
        warning: 'bg-yellow-100 text-yellow-800',
        error: 'bg-red-100 text-red-800',
        info: 'bg-blue-100 text-blue-800',
        outline: 'border border-gray-200 bg-transparent text-gray-700',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

const dotVariants = cva('mr-1.5 h-1.5 w-1.5 rounded-full', {
  variants: {
    variant: {
      default: 'bg-gray-500',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500',
      info: 'bg-blue-500',
      outline: 'bg-gray-500',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot = false, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(dotVariants({ variant }))}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
)
Badge.displayName = 'Badge'

// Status Badge with predefined status mappings
export type StatusType =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'success'
  | 'error'
  | 'warning'
  | 'draft'
  | 'published'
  | 'archived'

const statusConfig: Record<
  StatusType,
  { variant: BadgeProps['variant']; label: string }
> = {
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'default', label: 'Inactive' },
  pending: { variant: 'warning', label: 'Pending' },
  success: { variant: 'success', label: 'Success' },
  error: { variant: 'error', label: 'Error' },
  warning: { variant: 'warning', label: 'Warning' },
  draft: { variant: 'default', label: 'Draft' },
  published: { variant: 'success', label: 'Published' },
  archived: { variant: 'info', label: 'Archived' },
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: StatusType
  customLabel?: string
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, customLabel, dot = true, ...props }, ref) => {
    const config = statusConfig[status]
    return (
      <Badge ref={ref} variant={config.variant} dot={dot} {...props}>
        {customLabel || config.label}
      </Badge>
    )
  }
)
StatusBadge.displayName = 'StatusBadge'

export { Badge, StatusBadge, badgeVariants }
