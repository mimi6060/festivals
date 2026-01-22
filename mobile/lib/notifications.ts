import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationStore, Notification, NotificationType } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
const PUSH_TOKEN_KEY = 'push-token';

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and return the token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  let token: string | null = null;

  // Check if running on a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check and request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  try {
    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    token = pushTokenData.data;

    // Store token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    // Update store
    useNotificationStore.getState().setPushToken(token);

    console.log('Push token:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }

  // Configure Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    });
  }

  return token;
}

/**
 * Save the push token to the backend
 */
export async function savePushToken(token: string): Promise<boolean> {
  const authToken = useAuthStore.getState().token;

  if (!authToken) {
    console.log('No auth token available, skipping push token save');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        deviceId: Device.deviceName || 'unknown',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save push token: ${response.status}`);
    }

    console.log('Push token saved to backend');
    return true;
  } catch (error) {
    console.error('Error saving push token:', error);
    return false;
  }
}

/**
 * Handle notification received while app is in foreground
 */
export function handleNotificationReceived(notification: Notifications.Notification): void {
  const { title, body, data } = notification.request.content;

  console.log('Notification received:', { title, body, data });

  // Create notification object for store
  const notificationData: Notification = {
    id: notification.request.identifier,
    type: (data?.type as NotificationType) || 'general',
    title: title || 'Notification',
    body: body || '',
    data: data || {},
    read: false,
    createdAt: new Date().toISOString(),
  };

  // Add to store
  useNotificationStore.getState().addNotification(notificationData);
}

/**
 * Handle notification tap (response) - includes deep linking
 */
export function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const { data, title, body } = response.notification.request.content;

  console.log('Notification tapped:', { title, body, data });

  // Mark notification as read
  const notificationId = response.notification.request.identifier;
  useNotificationStore.getState().markAsRead(notificationId);

  // Handle deep linking based on notification type
  const type = data?.type as NotificationType;

  switch (type) {
    case 'ticket':
      if (data?.ticketId) {
        router.push(`/ticket/${data.ticketId}`);
      } else {
        router.push('/(tabs)/tickets');
      }
      break;

    case 'wallet':
      if (data?.transactionId) {
        router.push('/wallet');
      } else {
        router.push('/(tabs)/wallet');
      }
      break;

    case 'lineup':
      if (data?.performanceId) {
        router.push('/(tabs)/program');
      } else {
        router.push('/(tabs)/program');
      }
      break;

    case 'sos':
      router.push('/sos');
      break;

    case 'announcement':
    case 'general':
    default:
      // Navigate to notifications list
      router.push('/notifications');
      break;
  }
}

/**
 * Initialize notification listeners
 * Returns cleanup function
 */
export function initializeNotificationListeners(): () => void {
  // Listener for notifications received while app is foregrounded
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    handleNotificationReceived
  );

  // Listener for notification taps
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse
  );

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Check if there was a notification that opened the app
 */
export async function getInitialNotification(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

/**
 * Fetch notifications from the backend
 */
export async function fetchNotifications(): Promise<Notification[]> {
  const authToken = useAuthStore.getState().token;

  if (!authToken) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch notifications: ${response.status}`);
    }

    const data = await response.json();
    return data.notifications || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Mark all notifications as read on the backend
 */
export async function markAllAsReadOnBackend(): Promise<boolean> {
  const authToken = useAuthStore.getState().token;

  if (!authToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications/read-all`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error marking all as read:', error);
    return false;
  }
}

/**
 * Schedule a local notification (useful for reminders)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data: Record<string, unknown> = {},
  trigger: Notifications.NotificationTriggerInput = null
): Promise<string> {
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger,
  });

  return identifier;
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Set the badge count on the app icon
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
