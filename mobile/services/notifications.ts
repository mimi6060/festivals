/**
 * Notification Service
 * Handles all backend API interactions for push notifications
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore, Notification, NotificationType } from '@/stores/notificationStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

// Types
export interface RegisterTokenRequest {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
  deviceName?: string | null;
  appVersion?: string;
}

export interface RegisterTokenResponse {
  success: boolean;
  message?: string;
}

export interface NotificationListResponse {
  notifications: BackendNotification[];
  total: number;
  page: number;
  limit: number;
}

export interface BackendNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationPreferences {
  globalEmailEnabled: boolean;
  globalSMSEnabled: boolean;
  globalPushEnabled: boolean;
  globalInAppEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  marketingEnabled: boolean;
  weeklyDigestEnabled: boolean;
  preferredLanguage: string;
  deviceCount: number;
}

export interface UpdatePreferencesRequest {
  globalEmailEnabled?: boolean;
  globalSMSEnabled?: boolean;
  globalPushEnabled?: boolean;
  globalInAppEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  marketingEnabled?: boolean;
  weeklyDigestEnabled?: boolean;
  preferredLanguage?: string;
}

// Helper to get auth header
function getAuthHeader(): Record<string, string> {
  const token = useAuthStore.getState().token;
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

// Helper for API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `API Error: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();
  return data.data ?? data;
}

/**
 * Register a push notification token with the backend
 */
export async function registerPushToken(token: string): Promise<boolean> {
  try {
    const request: RegisterTokenRequest = {
      token,
      platform: Platform.OS as 'ios' | 'android',
      deviceId: Device.deviceName || `${Platform.OS}-${Date.now()}`,
      deviceName: Device.deviceName,
      appVersion: Device.osVersion || undefined,
    };

    await apiRequest<RegisterTokenResponse>('/api/v1/notifications/token', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    console.log('[NotificationService] Push token registered successfully');
    return true;
  } catch (error) {
    console.error('[NotificationService] Failed to register push token:', error);
    return false;
  }
}

/**
 * Unregister a push notification token from the backend
 */
export async function unregisterPushToken(token: string): Promise<boolean> {
  try {
    await apiRequest<void>('/api/v1/notifications/token', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });

    console.log('[NotificationService] Push token unregistered successfully');
    return true;
  } catch (error) {
    console.error('[NotificationService] Failed to unregister push token:', error);
    return false;
  }
}

/**
 * Fetch notifications from the backend
 */
export async function fetchNotifications(
  page: number = 1,
  limit: number = 20
): Promise<NotificationListResponse> {
  try {
    const response = await apiRequest<NotificationListResponse>(
      `/api/v1/notifications?page=${page}&limit=${limit}`
    );

    // Update local store with fetched notifications
    const store = useNotificationStore.getState();
    const notifications: Notification[] = response.notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data,
      read: n.read,
      createdAt: n.createdAt,
    }));

    if (page === 1) {
      store.setNotifications(notifications);
    }

    return response;
  } catch (error) {
    console.error('[NotificationService] Failed to fetch notifications:', error);
    return {
      notifications: [],
      total: 0,
      page,
      limit,
    };
  }
}

/**
 * Mark a notification as read on the backend
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    await apiRequest<void>(`/api/v1/notifications/${notificationId}/read`, {
      method: 'POST',
    });

    // Update local store
    useNotificationStore.getState().markAsRead(notificationId);

    console.log('[NotificationService] Notification marked as read:', notificationId);
    return true;
  } catch (error) {
    console.error('[NotificationService] Failed to mark notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read on the backend
 */
export async function markAllNotificationsAsRead(): Promise<boolean> {
  try {
    await apiRequest<void>('/api/v1/notifications/read-all', {
      method: 'POST',
    });

    // Update local store
    useNotificationStore.getState().markAllAsRead();

    console.log('[NotificationService] All notifications marked as read');
    return true;
  } catch (error) {
    console.error('[NotificationService] Failed to mark all notifications as read:', error);
    return false;
  }
}

/**
 * Delete a notification on the backend
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    await apiRequest<void>(`/api/v1/notifications/${notificationId}`, {
      method: 'DELETE',
    });

    // Update local store
    useNotificationStore.getState().removeNotification(notificationId);

    console.log('[NotificationService] Notification deleted:', notificationId);
    return true;
  } catch (error) {
    console.error('[NotificationService] Failed to delete notification:', error);
    return false;
  }
}

/**
 * Get notification preferences from the backend
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  try {
    const response = await apiRequest<NotificationPreferences>(
      '/api/v1/notifications/preferences'
    );
    return response;
  } catch (error) {
    console.error('[NotificationService] Failed to get notification preferences:', error);
    return null;
  }
}

/**
 * Update notification preferences on the backend
 */
export async function updateNotificationPreferences(
  preferences: UpdatePreferencesRequest
): Promise<NotificationPreferences | null> {
  try {
    const response = await apiRequest<NotificationPreferences>(
      '/api/v1/notifications/preferences',
      {
        method: 'PATCH',
        body: JSON.stringify(preferences),
      }
    );
    return response;
  } catch (error) {
    console.error('[NotificationService] Failed to update notification preferences:', error);
    return null;
  }
}

/**
 * Subscribe to a notification topic
 */
export async function subscribeToTopic(topic: string): Promise<boolean> {
  try {
    await apiRequest<void>(`/api/v1/notifications/topics/${topic}/subscribe`, {
      method: 'POST',
    });

    console.log('[NotificationService] Subscribed to topic:', topic);
    return true;
  } catch (error) {
    console.error('[NotificationService] Failed to subscribe to topic:', error);
    return false;
  }
}

/**
 * Unsubscribe from a notification topic
 */
export async function unsubscribeFromTopic(topic: string): Promise<boolean> {
  try {
    await apiRequest<void>(`/api/v1/notifications/topics/${topic}/unsubscribe`, {
      method: 'POST',
    });

    console.log('[NotificationService] Unsubscribed from topic:', topic);
    return true;
  } catch (error) {
    console.error('[NotificationService] Failed to unsubscribe from topic:', error);
    return false;
  }
}

/**
 * Get unread notification count from the backend
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const response = await apiRequest<{ count: number }>('/api/v1/notifications/unread-count');
    return response.count;
  } catch (error) {
    console.error('[NotificationService] Failed to get unread count:', error);
    // Fall back to local store count
    return useNotificationStore.getState().notifications.filter((n) => !n.read).length;
  }
}

/**
 * Send a test notification (for development)
 */
export async function sendTestNotification(): Promise<boolean> {
  try {
    await apiRequest<void>('/api/v1/notifications/test', {
      method: 'POST',
    });

    console.log('[NotificationService] Test notification sent');
    return true;
  } catch (error) {
    console.error('[NotificationService] Failed to send test notification:', error);
    return false;
  }
}

// Export notification service object for convenience
export const NotificationService = {
  registerPushToken,
  unregisterPushToken,
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  subscribeToTopic,
  unsubscribeFromTopic,
  getUnreadCount,
  sendTestNotification,
};

export default NotificationService;
