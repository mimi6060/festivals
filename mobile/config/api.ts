// API Configuration
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

export const API_TIMEOUT = 30000; // 30 seconds

// Endpoints
export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',

  // User
  USER_ME: '/users/me',
  USER_UPDATE: '/users/me',

  // Festivals
  FESTIVALS: '/festivals',
  FESTIVAL_BY_ID: (id: string) => `/festivals/${id}`,

  // Map
  MAP_FULL: (festivalId: string) => `/festivals/${festivalId}/map`,
  MAP_CONFIG: (festivalId: string) => `/festivals/${festivalId}/map/config`,
  MAP_POIS: (festivalId: string) => `/festivals/${festivalId}/map/pois`,
  MAP_ZONES: (festivalId: string) => `/festivals/${festivalId}/map/zones`,

  // Tickets
  TICKETS: (festivalId: string) => `/festivals/${festivalId}/tickets`,
  TICKET_VALIDATE: (festivalId: string, ticketId: string) =>
    `/festivals/${festivalId}/tickets/${ticketId}/validate`,

  // Wallet
  WALLET: (festivalId: string) => `/festivals/${festivalId}/wallet`,
  WALLET_TRANSACTIONS: (festivalId: string) =>
    `/festivals/${festivalId}/wallet/transactions`,
  WALLET_RECHARGE: (festivalId: string) => `/festivals/${festivalId}/wallet/recharge`,

  // Lineup
  LINEUP: (festivalId: string) => `/festivals/${festivalId}/lineup`,
  ARTISTS: (festivalId: string) => `/festivals/${festivalId}/lineup/artists`,
  STAGES: (festivalId: string) => `/festivals/${festivalId}/lineup/stages`,
  PERFORMANCES: (festivalId: string) => `/festivals/${festivalId}/lineup/performances`,

  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_MARK_READ: (id: string) => `/notifications/${id}/read`,
  PUSH_TOKEN: '/notifications/push-token',
};

// Fetch wrapper with error handling
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'An error occurred',
    }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();
  return data.data ?? data;
}

// HTTP method helpers
export const apiClient = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint),

  post: <T>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    apiFetch<T>(endpoint, {
      method: 'DELETE',
    }),
};
