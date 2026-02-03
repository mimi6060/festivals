/**
 * Social API module
 * Handles all social-related API calls for friends, requests, and money transfers
 */

// Types
export interface User {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
}

export interface FriendResponse {
  id: string;
  userId: string;
  name: string;
  username: string;
  avatarUrl?: string;
  status: 'ONLINE' | 'OFFLINE' | 'AT_FESTIVAL';
  lastSeen?: string;
  location?: {
    latitude: number;
    longitude: number;
    updatedAt: string;
    poiName?: string;
  } | null;
  isLocationShared: boolean;
  addedAt: string;
}

export interface FriendRequestResponse {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUsername: string;
  fromAvatarUrl?: string;
  toUserId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface TransferResponse {
  id: string;
  fromUserId: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currencyName: string;
  message?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export interface SendFriendRequestParams {
  identifier: string; // username or QR code data
}

export interface SendMoneyParams {
  friendId: string;
  amount: number;
  message?: string;
}

export interface UpdateLocationParams {
  latitude: number;
  longitude: number;
}

export interface LocationSharingParams {
  friendId: string;
  enabled: boolean;
}

// API Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.festival.app';

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    // Authorization header would be added here from auth store
    // 'Authorization': `Bearer ${getAuthToken()}`,
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Une erreur est survenue' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Friends API
export const friendsApi = {
  /**
   * Get all friends for the current user
   */
  getAll: async (): Promise<FriendResponse[]> => {
    return apiCall<FriendResponse[]>('/social/friends');
  },

  /**
   * Get a specific friend by ID
   */
  getById: async (friendId: string): Promise<FriendResponse> => {
    return apiCall<FriendResponse>(`/social/friends/${friendId}`);
  },

  /**
   * Remove a friend
   */
  remove: async (friendId: string): Promise<void> => {
    await apiCall<void>(`/social/friends/${friendId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Update location sharing setting for a friend
   */
  updateLocationSharing: async ({ friendId, enabled }: LocationSharingParams): Promise<void> => {
    await apiCall<void>(`/social/friends/${friendId}/location-sharing`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  },
};

// Friend Requests API
export const friendRequestsApi = {
  /**
   * Get all pending friend requests (received)
   */
  getReceived: async (): Promise<FriendRequestResponse[]> => {
    return apiCall<FriendRequestResponse[]>('/social/requests/received');
  },

  /**
   * Get all sent friend requests
   */
  getSent: async (): Promise<FriendRequestResponse[]> => {
    return apiCall<FriendRequestResponse[]>('/social/requests/sent');
  },

  /**
   * Send a friend request by username or QR code
   */
  send: async ({ identifier }: SendFriendRequestParams): Promise<FriendRequestResponse> => {
    return apiCall<FriendRequestResponse>('/social/requests', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
  },

  /**
   * Accept a friend request
   */
  accept: async (requestId: string): Promise<FriendResponse> => {
    return apiCall<FriendResponse>(`/social/requests/${requestId}/accept`, {
      method: 'POST',
    });
  },

  /**
   * Reject a friend request
   */
  reject: async (requestId: string): Promise<void> => {
    await apiCall<void>(`/social/requests/${requestId}/reject`, {
      method: 'POST',
    });
  },

  /**
   * Cancel a sent friend request
   */
  cancel: async (requestId: string): Promise<void> => {
    await apiCall<void>(`/social/requests/${requestId}`, {
      method: 'DELETE',
    });
  },
};

// User Search API
export const userSearchApi = {
  /**
   * Search for users by name or username
   */
  search: async (query: string): Promise<User[]> => {
    const encodedQuery = encodeURIComponent(query);
    return apiCall<User[]>(`/social/search?q=${encodedQuery}`);
  },

  /**
   * Get user by QR code data
   */
  getByQRCode: async (qrData: string): Promise<User> => {
    return apiCall<User>('/social/qr-lookup', {
      method: 'POST',
      body: JSON.stringify({ qrData }),
    });
  },
};

// Money Transfer API
export const transferApi = {
  /**
   * Send money to a friend
   */
  send: async ({ friendId, amount, message }: SendMoneyParams): Promise<TransferResponse> => {
    return apiCall<TransferResponse>('/social/transfer', {
      method: 'POST',
      body: JSON.stringify({ friendId, amount, message }),
    });
  },

  /**
   * Get recent transfers
   */
  getRecent: async (limit: number = 20): Promise<TransferResponse[]> => {
    return apiCall<TransferResponse[]>(`/social/transfers?limit=${limit}`);
  },

  /**
   * Get transfer by ID
   */
  getById: async (transferId: string): Promise<TransferResponse> => {
    return apiCall<TransferResponse>(`/social/transfers/${transferId}`);
  },
};

// Location API
export const locationApi = {
  /**
   * Update my location
   */
  updateMyLocation: async ({ latitude, longitude }: UpdateLocationParams): Promise<void> => {
    await apiCall<void>('/social/location', {
      method: 'PUT',
      body: JSON.stringify({ latitude, longitude }),
    });
  },

  /**
   * Get friends' locations (only those who have shared with me)
   */
  getFriendsLocations: async (): Promise<
    Array<{
      friendId: string;
      latitude: number;
      longitude: number;
      updatedAt: string;
      poiName?: string;
    }>
  > => {
    return apiCall('/social/friends/locations');
  },

  /**
   * Enable/disable global location sharing
   */
  setGlobalSharing: async (enabled: boolean): Promise<void> => {
    await apiCall<void>('/social/location/sharing', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  },
};

// QR Code API
export const qrCodeApi = {
  /**
   * Generate QR code data for adding friends
   */
  generateFriendQR: async (): Promise<{ qrData: string; expiresAt: number }> => {
    return apiCall('/social/qr/generate');
  },

  /**
   * Validate QR code and get user info
   */
  validateFriendQR: async (
    qrData: string
  ): Promise<{ valid: boolean; user?: User; error?: string }> => {
    return apiCall('/social/qr/validate', {
      method: 'POST',
      body: JSON.stringify({ qrData }),
    });
  },
};

// Export all APIs as a single object for convenience
export const socialApi = {
  friends: friendsApi,
  requests: friendRequestsApi,
  search: userSearchApi,
  transfer: transferApi,
  location: locationApi,
  qrCode: qrCodeApi,
};

export default socialApi;
