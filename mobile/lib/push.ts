import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
const PUSH_TOKEN_KEY = 'push-token';
const PUSH_TOKEN_SYNCED_KEY = 'push-token-synced';

/**
 * Push notification token management and registration utilities
 */

export interface PushTokenInfo {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
  deviceName: string | null;
}

/**
 * Get the stored push token
 */
export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting stored push token:', error);
    return null;
  }
}

/**
 * Store the push token locally
 */
export async function storePushToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    useNotificationStore.getState().setPushToken(token);
  } catch (error) {
    console.error('Error storing push token:', error);
  }
}

/**
 * Clear the stored push token
 */
export async function clearPushToken(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([PUSH_TOKEN_KEY, PUSH_TOKEN_SYNCED_KEY]);
    useNotificationStore.getState().setPushToken(null);
  } catch (error) {
    console.error('Error clearing push token:', error);
  }
}

/**
 * Check if push token has been synced with backend
 */
export async function isPushTokenSynced(): Promise<boolean> {
  try {
    const synced = await AsyncStorage.getItem(PUSH_TOKEN_SYNCED_KEY);
    return synced === 'true';
  } catch (error) {
    return false;
  }
}

/**
 * Mark push token as synced with backend
 */
export async function markPushTokenSynced(): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_SYNCED_KEY, 'true');
  } catch (error) {
    console.error('Error marking push token synced:', error);
  }
}

/**
 * Request push notification permissions
 * Returns true if granted, false otherwise
 */
export async function requestPushPermissions(): Promise<boolean> {
  // Check if running on a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Get push notification permission status
 */
export async function getPushPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Register for push notifications
 * Returns the push token if successful, null otherwise
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Check if running on physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Request permissions
  const hasPermission = await requestPushPermissions();
  if (!hasPermission) {
    console.log('Push notification permission not granted');
    return null;
  }

  try {
    // Get Expo push token
    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    const token = pushTokenData.data;

    // Store token locally
    await storePushToken(token);

    console.log('Push token registered:', token);
    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Configure Android notification channel
 */
export async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  // Default channel
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notifications',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6366F1',
    sound: 'default',
  });

  // Urgent channel for SOS
  await Notifications.setNotificationChannelAsync('urgent', {
    name: 'Urgences',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#EF4444',
    sound: 'default',
    bypassDnd: true,
  });

  // Tickets channel
  await Notifications.setNotificationChannelAsync('tickets', {
    name: 'Billets',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6366F1',
    sound: 'default',
  });

  // Wallet channel
  await Notifications.setNotificationChannelAsync('wallet', {
    name: 'Wallet',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10B981',
    sound: 'default',
  });

  // Lineup channel
  await Notifications.setNotificationChannelAsync('lineup', {
    name: 'Programme',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: '#8B5CF6',
    sound: 'default',
  });
}

/**
 * Sync push token with backend
 * Call this after user authentication
 */
export async function syncPushTokenWithBackend(): Promise<boolean> {
  const authToken = useAuthStore.getState().token;
  if (!authToken) {
    console.log('No auth token, skipping push token sync');
    return false;
  }

  const pushToken = await getStoredPushToken();
  if (!pushToken) {
    // Try to register first
    const newToken = await registerForPushNotifications();
    if (!newToken) {
      return false;
    }
    return syncPushTokenWithBackend();
  }

  // Check if already synced
  const isSynced = await isPushTokenSynced();
  if (isSynced) {
    console.log('Push token already synced');
    return true;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token: pushToken,
        platform: Platform.OS,
        deviceId: Device.deviceName || 'unknown',
        deviceName: Device.deviceName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync push token: ${response.status}`);
    }

    await markPushTokenSynced();
    console.log('Push token synced with backend');
    return true;
  } catch (error) {
    console.error('Error syncing push token:', error);
    return false;
  }
}

/**
 * Unregister push token from backend
 * Call this on user logout
 */
export async function unregisterPushToken(): Promise<boolean> {
  const authToken = useAuthStore.getState().token;
  const pushToken = await getStoredPushToken();

  if (!pushToken) {
    return true;
  }

  if (authToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/notifications/token`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token: pushToken,
        }),
      });

      if (!response.ok) {
        console.warn('Failed to unregister push token from backend');
      }
    } catch (error) {
      console.error('Error unregistering push token:', error);
    }
  }

  // Clear local token regardless
  await clearPushToken();
  return true;
}

/**
 * Initialize push notifications
 * Call this in app startup
 */
export async function initializePushNotifications(): Promise<void> {
  // Configure Android channels
  await configureAndroidChannel();

  // Configure notification display behavior
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;
      const channelId = getChannelForNotificationType(data?.type as string);

      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    },
  });

  // Try to register for push if not already registered
  const existingToken = await getStoredPushToken();
  if (!existingToken) {
    await registerForPushNotifications();
  }
}

/**
 * Get Android notification channel for notification type
 */
function getChannelForNotificationType(type?: string): string {
  switch (type) {
    case 'sos':
      return 'urgent';
    case 'ticket':
      return 'tickets';
    case 'wallet':
      return 'wallet';
    case 'lineup':
      return 'lineup';
    default:
      return 'default';
  }
}

/**
 * Get current badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count on app icon
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear badge count
 */
export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Cancel a scheduled notification by ID
 */
export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
