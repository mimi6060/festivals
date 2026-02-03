import * as React from 'react'
import { api } from './api'

// Impersonation session interface
export interface ImpersonationSession {
  id: string
  token?: string
  adminId: string
  targetUserId: string
  adminEmail: string
  targetUserEmail: string
  targetUserName: string
  reason: string
  ipAddress: string
  startedAt: string
  expiresAt: string
  endedAt?: string
  isActive: boolean
  actionsCount: number
}

// Storage keys
const IMPERSONATION_TOKEN_KEY = 'impersonation_token'
const IMPERSONATION_SESSION_KEY = 'impersonation_session'

// Impersonation state management
class ImpersonationManager {
  private token: string | null = null
  private session: ImpersonationSession | null = null
  private listeners: Set<() => void> = new Set()

  constructor() {
    // Load from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(IMPERSONATION_TOKEN_KEY)
      const sessionStr = localStorage.getItem(IMPERSONATION_SESSION_KEY)
      if (sessionStr) {
        try {
          this.session = JSON.parse(sessionStr)
          // Check if session has expired
          if (this.session && new Date(this.session.expiresAt) < new Date()) {
            this.clearState()
          }
        } catch {
          this.clearState()
        }
      }
    }
  }

  // Subscribe to state changes
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // Notify all listeners of state change
  private notify() {
    this.listeners.forEach(listener => listener())
  }

  // Get current impersonation token
  getToken(): string | null {
    return this.token
  }

  // Get current impersonation session
  getSession(): ImpersonationSession | null {
    return this.session
  }

  // Check if currently impersonating
  isImpersonating(): boolean {
    return this.token !== null && this.session !== null && new Date(this.session.expiresAt) > new Date()
  }

  // Start impersonation
  async startImpersonation(targetUserId: string, reason?: string): Promise<ImpersonationSession> {
    const response = await api.post<ImpersonationSession>(`/api/v1/admin/impersonate/${targetUserId}`, {
      reason: reason || 'Debugging user issue'
    })

    this.token = response.token || null
    this.session = response

    // Store in localStorage
    if (typeof window !== 'undefined' && this.token) {
      localStorage.setItem(IMPERSONATION_TOKEN_KEY, this.token)
      localStorage.setItem(IMPERSONATION_SESSION_KEY, JSON.stringify(this.session))
    }

    this.notify()
    return response
  }

  // End impersonation
  async endImpersonation(): Promise<void> {
    if (!this.token) {
      this.clearState()
      return
    }

    try {
      await api.delete('/api/v1/admin/impersonate')
    } finally {
      this.clearState()
    }
  }

  // Clear impersonation state
  clearState() {
    this.token = null
    this.session = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem(IMPERSONATION_TOKEN_KEY)
      localStorage.removeItem(IMPERSONATION_SESSION_KEY)
    }
    this.notify()
  }

  // Get impersonation header for API requests
  getHeaders(): Record<string, string> {
    if (this.token && this.isImpersonating()) {
      return { 'X-Impersonation-Token': this.token }
    }
    return {}
  }
}

// Singleton instance
export const impersonationManager = new ImpersonationManager()

// Hook for React components
export function useImpersonation() {
  const [, setTick] = React.useState(0)

  React.useEffect(() => {
    return impersonationManager.subscribe(() => setTick(t => t + 1))
  }, [])

  return {
    isImpersonating: impersonationManager.isImpersonating(),
    session: impersonationManager.getSession(),
    token: impersonationManager.getToken(),
    startImpersonation: impersonationManager.startImpersonation.bind(impersonationManager),
    endImpersonation: impersonationManager.endImpersonation.bind(impersonationManager),
  }
}

// API functions for impersonation
export const impersonationApi = {
  // Start impersonation
  start: (userId: string, reason?: string) =>
    api.post<ImpersonationSession>(`/api/v1/admin/impersonate/${userId}`, { reason }),

  // End impersonation
  end: () => api.delete<void>('/api/v1/admin/impersonate'),

  // Get current session
  getCurrent: () => api.get<ImpersonationSession>('/api/v1/admin/impersonation/current'),

  // List active sessions (admin only)
  listActive: () => api.get<ImpersonationSession[]>('/api/v1/admin/impersonation/active'),
}

// Wrapper for fetch that includes impersonation header
export function fetchWithImpersonation(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers)

  const impersonationHeaders = impersonationManager.getHeaders()
  Object.entries(impersonationHeaders).forEach(([key, value]) => {
    headers.set(key, value)
  })

  return fetch(input, {
    ...init,
    headers,
  })
}
