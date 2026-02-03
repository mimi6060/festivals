'use client'

import { useState } from 'react'
import { AlertTriangle, X, LogOut, User, Clock } from 'lucide-react'
import { useImpersonation } from '@/lib/impersonation'

export function ImpersonationBanner() {
  const { isImpersonating, session, endImpersonation } = useImpersonation()
  const [isEnding, setIsEnding] = useState(false)

  if (!isImpersonating || !session) {
    return null
  }

  const handleEndImpersonation = async () => {
    setIsEnding(true)
    try {
      await endImpersonation()
      // Reload to clear impersonated state
      window.location.reload()
    } catch (error) {
      console.error('Failed to end impersonation:', error)
      setIsEnding(false)
    }
  }

  // Calculate time remaining
  const expiresAt = new Date(session.expiresAt)
  const now = new Date()
  const minutesRemaining = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 60000))

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 shadow-lg">
      <div className="mx-auto flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="font-medium">
              Viewing as: {session.targetUserName || session.targetUserEmail}
            </span>
          </div>
          <span className="text-amber-800">|</span>
          <div className="flex items-center gap-1 text-sm text-amber-800">
            <Clock className="h-4 w-4" />
            <span>{minutesRemaining} min remaining</span>
          </div>
          {session.actionsCount > 0 && (
            <>
              <span className="text-amber-800">|</span>
              <span className="text-sm text-amber-800">
                {session.actionsCount} action{session.actionsCount !== 1 ? 's' : ''} performed
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleEndImpersonation}
            disabled={isEnding}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {isEnding ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Ending...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Exit Impersonation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Compact version for mobile or space-constrained layouts
export function ImpersonationBannerCompact() {
  const { isImpersonating, session, endImpersonation } = useImpersonation()
  const [isEnding, setIsEnding] = useState(false)

  if (!isImpersonating || !session) {
    return null
  }

  const handleEndImpersonation = async () => {
    setIsEnding(true)
    try {
      await endImpersonation()
      window.location.reload()
    } catch (error) {
      console.error('Failed to end impersonation:', error)
      setIsEnding(false)
    }
  }

  return (
    <div className="bg-amber-500 text-amber-950 px-3 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 truncate">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            Impersonating: {session.targetUserName || session.targetUserEmail}
          </span>
        </div>
        <button
          onClick={handleEndImpersonation}
          disabled={isEnding}
          className="flex-shrink-0 rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {isEnding ? 'Ending...' : 'Exit'}
        </button>
      </div>
    </div>
  )
}

// Info card variant for displaying in dashboards
export function ImpersonationInfoCard() {
  const { isImpersonating, session, endImpersonation } = useImpersonation()
  const [isEnding, setIsEnding] = useState(false)

  if (!isImpersonating || !session) {
    return null
  }

  const handleEndImpersonation = async () => {
    setIsEnding(true)
    try {
      await endImpersonation()
      window.location.reload()
    } catch (error) {
      console.error('Failed to end impersonation:', error)
      setIsEnding(false)
    }
  }

  return (
    <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-100 p-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">Impersonation Active</h3>
          <p className="mt-1 text-sm text-amber-800">
            You are viewing this page as <strong>{session.targetUserName || session.targetUserEmail}</strong>
          </p>
          {session.reason && (
            <p className="mt-1 text-xs text-amber-700">
              Reason: {session.reason}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3 text-xs text-amber-700">
            <span>Started: {new Date(session.startedAt).toLocaleTimeString()}</span>
            <span>Actions: {session.actionsCount}</span>
          </div>
          <button
            onClick={handleEndImpersonation}
            disabled={isEnding}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isEnding ? 'Ending...' : 'Exit Impersonation'}
          </button>
        </div>
      </div>
    </div>
  )
}
