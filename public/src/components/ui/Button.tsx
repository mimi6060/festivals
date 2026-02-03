'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-festival-500 to-festival-600 text-white hover:from-festival-600 hover:to-festival-700 focus-visible:ring-festival-500 shadow-lg shadow-festival-500/25 hover:shadow-festival-500/40',
        secondary:
          'bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-sm focus-visible:ring-white/50',
        outline:
          'border-2 border-festival-500 text-festival-500 bg-transparent hover:bg-festival-500 hover:text-white focus-visible:ring-festival-500',
        ghost:
          'bg-transparent text-gray-300 hover:bg-white/10 hover:text-white focus-visible:ring-white/50',
        danger:
          'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
        neon:
          'bg-black border-2 border-neon-pink text-neon-pink hover:bg-neon-pink hover:text-black shadow-[0_0_20px_rgba(255,0,255,0.5)] hover:shadow-[0_0_30px_rgba(255,0,255,0.8)] transition-all duration-300',
      },
      size: {
        sm: 'h-9 px-4 text-xs',
        md: 'h-11 px-6 text-sm',
        lg: 'h-14 px-8 text-base',
        xl: 'h-16 px-10 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    const isDisabled = disabled || loading

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {!loading && leftIcon && (
          <span className="mr-2 inline-flex shrink-0">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && (
          <span className="ml-2 inline-flex shrink-0">{rightIcon}</span>
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
