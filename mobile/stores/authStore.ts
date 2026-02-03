import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  festivalId?: string;
}

// Token refresh threshold: refresh if token expires within 5 minutes
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

interface AuthState {
  user: User | null;
  token: string | null;
  tokenExpiresAt: number | null;
  lastRefreshAt: number | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null, expiresAt?: number) => void;
  setTokenExpiry: (expiresAt: number) => void;
  logout: () => void;
  isTokenStale: () => boolean;
  shouldRefreshToken: () => boolean;
  markTokenRefreshed: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      tokenExpiresAt: null,
      lastRefreshAt: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token, expiresAt) => set({
        token,
        tokenExpiresAt: expiresAt ?? null,
      }),
      setTokenExpiry: (expiresAt) => set({ tokenExpiresAt: expiresAt }),
      logout: () => set({
        user: null,
        token: null,
        tokenExpiresAt: null,
        lastRefreshAt: null,
        isAuthenticated: false,
      }),
      isTokenStale: () => {
        const { tokenExpiresAt, token } = get();
        if (!token || !tokenExpiresAt) return true;
        return Date.now() >= tokenExpiresAt;
      },
      shouldRefreshToken: () => {
        const { tokenExpiresAt, isAuthenticated, token } = get();
        if (!isAuthenticated || !tokenExpiresAt || !token) return false;
        // Refresh if token expires within threshold
        return Date.now() >= tokenExpiresAt - TOKEN_REFRESH_THRESHOLD_MS;
      },
      markTokenRefreshed: () => set({ lastRefreshAt: Date.now() }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Helper function to parse JWT and extract expiration
export function parseTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    if (decoded.exp) {
      return decoded.exp * 1000; // Convert to milliseconds
    }
    return null;
  } catch {
    return null;
  }
}

// Token refresh manager for background refresh
export class TokenRefreshManager {
  private intervalId: NodeJS.Timeout | null = null;
  private refreshFn: (() => Promise<void>) | null = null;

  start(refreshFn: () => Promise<void>) {
    this.refreshFn = refreshFn;
    this.stop(); // Clear any existing interval

    // Check every minute
    this.intervalId = setInterval(() => {
      this.checkAndRefresh();
    }, 60 * 1000);

    // Initial check
    this.checkAndRefresh();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkAndRefresh() {
    const state = useAuthStore.getState();
    if (state.isAuthenticated && state.shouldRefreshToken() && this.refreshFn) {
      try {
        await this.refreshFn();
        useAuthStore.getState().markTokenRefreshed();
      } catch (error) {
        console.error('Failed to refresh token:', error);
      }
    }
  }
}

export const tokenRefreshManager = new TokenRefreshManager();
