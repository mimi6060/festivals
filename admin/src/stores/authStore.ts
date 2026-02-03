import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  name: string
  roles: string[]
  festivalId?: string
}

// Token refresh threshold: refresh if token expires within 5 minutes
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  tokenExpiresAt: number | null
  lastRefreshAt: number | null
  setUser: (user: User | null) => void
  setTokenExpiry: (expiresAt: number) => void
  logout: () => void
  isTokenStale: () => boolean
  shouldRefreshToken: () => boolean
  markTokenRefreshed: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      tokenExpiresAt: null,
      lastRefreshAt: null,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTokenExpiry: (expiresAt) => set({ tokenExpiresAt: expiresAt }),
      logout: () => set({
        user: null,
        isAuthenticated: false,
        tokenExpiresAt: null,
        lastRefreshAt: null
      }),
      isTokenStale: () => {
        const { tokenExpiresAt } = get()
        if (!tokenExpiresAt) return true
        return Date.now() >= tokenExpiresAt
      },
      shouldRefreshToken: () => {
        const { tokenExpiresAt, isAuthenticated } = get()
        if (!isAuthenticated || !tokenExpiresAt) return false
        // Refresh if token expires within threshold
        return Date.now() >= tokenExpiresAt - TOKEN_REFRESH_THRESHOLD_MS
      },
      markTokenRefreshed: () => set({ lastRefreshAt: Date.now() }),
    }),
    {
      name: 'auth-storage',
    }
  )
)

// Helper hook to check and refresh token proactively
export function useTokenRefresh(refreshTokenFn: () => Promise<void>) {
  const { shouldRefreshToken, markTokenRefreshed, isAuthenticated } = useAuthStore()

  // Check on mount and periodically
  if (typeof window !== 'undefined') {
    const checkAndRefresh = async () => {
      if (isAuthenticated && shouldRefreshToken()) {
        try {
          await refreshTokenFn()
          markTokenRefreshed()
        } catch (error) {
          console.error('Failed to refresh token:', error)
        }
      }
    }

    // Initial check
    checkAndRefresh()

    // Check every minute
    const interval = setInterval(checkAndRefresh, 60 * 1000)
    return () => clearInterval(interval)
  }
}
