'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ConnectionState } from '@/lib/websocket'

export interface LiveIndicatorProps {
  /** Whether the indicator should show as live (pulsing) */
  isLive?: boolean
  /** Connection state for automatic live detection */
  connectionState?: ConnectionState
  /** Size of the indicator */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Color variant */
  color?: 'green' | 'blue' | 'red' | 'yellow' | 'auto'
  /** Show label next to indicator */
  showLabel?: boolean
  /** Custom label text */
  label?: string
  /** Pulse animation style */
  pulseStyle?: 'ping' | 'pulse' | 'none'
  /** Additional CSS classes */
  className?: string
}

const SIZE_CLASSES = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
}

const PING_SIZE_CLASSES = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
}

const COLOR_CLASSES = {
  green: {
    dot: 'bg-green-500',
    ping: 'bg-green-400',
    label: 'text-green-700',
  },
  blue: {
    dot: 'bg-blue-500',
    ping: 'bg-blue-400',
    label: 'text-blue-700',
  },
  red: {
    dot: 'bg-red-500',
    ping: 'bg-red-400',
    label: 'text-red-700',
  },
  yellow: {
    dot: 'bg-yellow-500',
    ping: 'bg-yellow-400',
    label: 'text-yellow-700',
  },
  gray: {
    dot: 'bg-gray-400',
    ping: 'bg-gray-300',
    label: 'text-gray-600',
  },
}

const LABEL_SIZE_CLASSES = {
  xs: 'text-xs',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
}

/**
 * Get color based on connection state
 */
function getAutoColor(
  connectionState?: ConnectionState,
  isLive?: boolean
): keyof typeof COLOR_CLASSES {
  if (connectionState) {
    switch (connectionState) {
      case 'connected':
        return 'green'
      case 'connecting':
      case 'reconnecting':
        return 'yellow'
      case 'error':
        return 'red'
      case 'disconnected':
      default:
        return 'gray'
    }
  }
  return isLive ? 'green' : 'gray'
}

/**
 * LiveIndicator component - A pulsing dot indicator for live data
 *
 * Use this to show that data is being updated in real-time.
 * The pulsing animation draws attention to live content.
 */
export function LiveIndicator({
  isLive,
  connectionState,
  size = 'sm',
  color = 'auto',
  showLabel = false,
  label = 'Live',
  pulseStyle = 'ping',
  className,
}: LiveIndicatorProps) {
  // Determine if we should show as live
  const shouldPulse = useMemo(() => {
    if (typeof isLive === 'boolean') return isLive
    if (connectionState) return connectionState === 'connected'
    return false
  }, [isLive, connectionState])

  // Determine color
  const colorKey = useMemo(() => {
    if (color === 'auto') {
      return getAutoColor(connectionState, isLive)
    }
    return color
  }, [color, connectionState, isLive])

  const colors = COLOR_CLASSES[colorKey]
  const sizeClass = SIZE_CLASSES[size]
  const pingSizeClass = PING_SIZE_CLASSES[size]
  const labelSizeClass = LABEL_SIZE_CLASSES[size]

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('relative flex', sizeClass)}>
        {/* Ping animation */}
        {shouldPulse && pulseStyle === 'ping' && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              pingSizeClass,
              colors.ping
            )}
          />
        )}
        {/* Main dot */}
        <span
          className={cn(
            'relative inline-flex rounded-full',
            sizeClass,
            colors.dot,
            shouldPulse && pulseStyle === 'pulse' && 'animate-pulse'
          )}
        />
      </span>
      {showLabel && (
        <span className={cn('font-medium', labelSizeClass, colors.label)}>
          {label}
        </span>
      )}
    </span>
  )
}

/**
 * LiveBadge - A badge variant of the live indicator
 */
export interface LiveBadgeProps {
  /** Whether currently live */
  isLive?: boolean
  /** Connection state */
  connectionState?: ConnectionState
  /** Custom label */
  label?: string
  /** Additional CSS classes */
  className?: string
}

export function LiveBadge({
  isLive,
  connectionState,
  label,
  className,
}: LiveBadgeProps) {
  const shouldPulse = useMemo(() => {
    if (typeof isLive === 'boolean') return isLive
    if (connectionState) return connectionState === 'connected'
    return false
  }, [isLive, connectionState])

  const displayLabel = label ?? (shouldPulse ? 'Live' : 'Offline')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        shouldPulse
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-600',
        className
      )}
    >
      <LiveIndicator
        isLive={shouldPulse}
        size="xs"
        pulseStyle={shouldPulse ? 'ping' : 'none'}
      />
      {displayLabel}
    </span>
  )
}

/**
 * LiveDot - Absolute positioned indicator for cards/containers
 */
export interface LiveDotProps {
  /** Whether currently live */
  isLive?: boolean
  /** Connection state */
  connectionState?: ConnectionState
  /** Position within parent */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  /** Size of the dot */
  size?: 'xs' | 'sm' | 'md'
  /** Additional CSS classes */
  className?: string
}

const POSITION_CLASSES = {
  'top-right': 'top-2 right-2',
  'top-left': 'top-2 left-2',
  'bottom-right': 'bottom-2 right-2',
  'bottom-left': 'bottom-2 left-2',
}

export function LiveDot({
  isLive,
  connectionState,
  position = 'top-right',
  size = 'sm',
  className,
}: LiveDotProps) {
  const shouldPulse = useMemo(() => {
    if (typeof isLive === 'boolean') return isLive
    if (connectionState) return connectionState === 'connected'
    return false
  }, [isLive, connectionState])

  if (!shouldPulse) return null

  return (
    <span
      className={cn(
        'absolute',
        POSITION_CLASSES[position],
        className
      )}
    >
      <LiveIndicator isLive size={size} pulseStyle="ping" />
    </span>
  )
}

/**
 * RecordingIndicator - For indicating active recording/streaming
 */
export interface RecordingIndicatorProps {
  /** Whether actively recording */
  isRecording?: boolean
  /** Size */
  size?: 'sm' | 'md' | 'lg'
  /** Show "REC" label */
  showLabel?: boolean
  /** Additional CSS classes */
  className?: string
}

export function RecordingIndicator({
  isRecording = true,
  size = 'md',
  showLabel = true,
  className,
}: RecordingIndicatorProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  }

  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        isRecording ? 'text-red-600' : 'text-gray-400',
        className
      )}
    >
      <span className="relative flex">
        {isRecording && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75',
              sizeClasses[size]
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full',
            sizeClasses[size],
            isRecording ? 'bg-red-500' : 'bg-gray-400'
          )}
        />
      </span>
      {showLabel && (
        <span className={cn('font-bold uppercase', labelSizeClasses[size])}>
          {isRecording ? 'REC' : 'OFF'}
        </span>
      )}
    </span>
  )
}
