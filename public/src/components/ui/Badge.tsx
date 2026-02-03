'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-white/10 text-white border border-white/20',
        primary: 'bg-festival-500/20 text-festival-300 border border-festival-500/30',
        success: 'bg-green-500/20 text-green-300 border border-green-500/30',
        warning: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
        danger: 'bg-red-500/20 text-red-300 border border-red-500/30',
        info: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        neon: 'bg-black text-neon-pink border border-neon-pink shadow-[0_0_10px_rgba(255,0,255,0.3)]',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-3 py-1 text-xs',
        lg: 'px-4 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    />
  )
)
Badge.displayName = 'Badge'

export { Badge, badgeVariants }
