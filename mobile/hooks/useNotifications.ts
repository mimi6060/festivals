import { useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { useNotificationStore, Notification, NotificationType } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import {
  registerForPushNotifications,
  initializePushNotifications,
  syncPushTokenWithBackend,
  getStoredPushToken,
  clearBadgeCount,
  setBadgeCount,
} from '@/lib/push';

export type NotificationActionType =
  | 'lineup_change'
  | 'wallet_low'
  | 'order_ready'
  | 'announcement'
  | 'ticket'
  | 'wallet'
  | 'lineup'
  | 'sos'
  | 'general';

interface NotificationData {
  type?: NotificationActionType;
  ticketId?: string;
  transactionId?: string;
  performanceId?: string;
  orderId?: string;
  festivalId?: string;
  artistId?: string;
  screen?: string;
  [key: string]: unknown;
}

interface UseNotificationsOptions {
  onNotificationReceived?: (notification: Notification) => void;
  onNotificationPressed?: (notification: Notification, data: NotificationData) => void;
  autoRequestPermission?: boolean;
  autoSyncToken?: boolean;
}

interface UseNotificationsReturn {
  pushToken: string | null;
  notifications: Notification[];
  unreadCount: number;
  hasPermission: boolean | null;
  isInitialized: boolean;
  requestPermission: () => Promise<boolean>;
  syncToken: () => Promise<boolean>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  refreshBadge: () => void;
}

/**
 * Hook for managing push notifications
 * Handles registration, listening, and navigation based on notification type
 */
export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const {
    onNotificationReceived,
    onNotificationPressed,
    autoRequestPermission = true,
    autoSyncToken = true,
  } = options;

  // Store state
  const pushToken = useNotificationStore((state) => state.pushToken);
  const notifications = useNotificationStore((state) => state.notifications);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const clearNotifications = useNotificationStore((state) => state.clearNotifications);
  const setPushToken = useNotificationStore((state) => state.setPushToken);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Local state
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs
  const notificationListenerRef = useRef<Notifications.Subscription | null>(null);
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  /**
   * Handle deep linking based on notification type
   */
  const handleNotificationNavigation = useCallback((data: NotificationData) => {
    const type = data.type;

    switch (type) {
      case 'lineup_change':
      case 'lineup':
        // Navigate to program/lineup
        if (data.performanceId) {
          router.push('/(tabs)/program');
        } else if (data.artistId) {
          router.push(`/artist/${data.artistId}`);
        } else {
          router.push('/(tabs)/program');
        }
        break;

      case 'wallet_low':
      case 'wallet':
        // Navigate to wallet
        if (data.transactionId) {
          router.push('/wallet');
        } else {
          router.push('/(tabs)/wallet');
        }
        break;

      case 'order_ready':
        // Navigate to orders
        if (data.orderId) {
          router.push('/(tabs)/orders');
        } else {
          router.push('/(tabs)/orders');
        }
        break;

      case 'announcement':
        // Show alert for announcements
        Alert.alert(
          'Announcement',
          typeof data.message === 'string' ? data.message : 'New announcement available',
          [{ text: 'OK' }]
        );
        break;

      case 'ticket':
        // Navigate to ticket
        if (data.ticketId) {
          router.push(`/ticket/${data.ticketId}`);
        } else {
          router.push('/(tabs)/tickets');
        }
        break;

      case 'sos':
        // Navigate to SOS screen
        router.push('/sos');
        break;

      case 'general':
      default:
        // Navigate based on screen parameter if provided
        if (data.screen) {
          try {
            router.push(data.screen as any);
          } catch {
            // Fallback to home
            router.push('/(tabs)');
          }
        }
        break;
    }
  }, []);

  /**
   * Handle notification received while app is foregrounded
   */
  const handleNotificationReceived = useCallback(
    (notification: Notifications.Notification) => {
      const { title, body, data } = notification.request.content;

      console.log('[Notifications] Received:', { title, body, data });

      // Create notification object for store
      const notificationData: Notification = {
        id: notification.request.identifier,
        type: (data?.type as NotificationType) || 'general',
        title: title || 'Notification',
        body: body || '',
        data: (data as Record<string, unknown>) || {},
        read: false,
        createdAt: new Date().toISOString(),
      };

      // Add to store
      addNotification(notificationData);

      // Call custom handler if provided
      if (onNotificationReceived) {
        onNotificationReceived(notificationData);
      }

      // Update badge count
      const newUnreadCount = notifications.filter((n) => !n.read).length + 1;
      setBadgeCount(newUnreadCount);
    },
    [addNotification, notifications, onNotificationReceived]
  );

  /**
   * Handle notification tap (response)
   */
  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const { data, title, body } = response.notification.request.content;
      const notificationId = response.notification.request.identifier;

      console.log('[Notifications] Tapped:', { title, body, data });

      // Mark notification as read
      markAsRead(notificationId);

      // Create notification object
      const notificationData: Notification = {
        id: notificationId,
        type: (data?.type as NotificationType) || 'general',
        title: title || 'Notification',
        body: body || '',
        data: (data as Record<string, unknown>) || {},
        read: true,
        createdAt: new Date().toISOString(),
      };

      // Call custom handler if provided
      if (onNotificationPressed) {
        onNotificationPressed(notificationData, data as NotificationData);
      }

      // Handle navigation
      handleNotificationNavigation(data as NotificationData);
    },
    [markAsRead, onNotificationPressed, handleNotificationNavigation]
  );

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const token = await registerForPushNotifications();
    const hasToken = token !== null;
    setHasPermission(hasToken);

    if (hasToken) {
      setPushToken(token);
    }

    return hasToken;
  }, [setPushToken]);

  /**
   * Sync push token with backend
   */
  const syncToken = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) {
      console.log('[Notifications] Not authenticated, skipping token sync');
      return false;
    }

    return syncPushTokenWithBackend();
  }, [isAuthenticated]);

  /**
   * Refresh badge count
   */
  const refreshBadge = useCallback(() => {
    const count = notifications.filter((n) => !n.read).length;
    setBadgeCount(count);
  }, [notifications]);

  /**
   * Handle app state changes
   */
  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      // When app comes to foreground, refresh badge
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        refreshBadge();
      }
      appStateRef.current = nextAppState;
    },
    [refreshBadge]
  );

  /**
   * Initialize notifications on mount
   */
  useEffect(() => {
    const initialize = async () => {
      // Initialize push notifications (configure channels, handler)
      await initializePushNotifications();

      // Check for existing token
      const existingToken = await getStoredPushToken();
      if (existingToken) {
        setPushToken(existingToken);
        setHasPermission(true);
      }

      // Set up notification listeners
      notificationListenerRef.current = Notifications.addNotificationReceivedListener(
        handleNotificationReceived
      );

      responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

      // Check for notification that opened the app
      const initialNotification = await Notifications.getLastNotificationResponseAsync();
      if (initialNotification) {
        handleNotificationResponse(initialNotification);
      }

      setIsInitialized(true);

      // Auto-request permission if enabled
      if (autoRequestPermission && !existingToken) {
        await requestPermission();
      }
    };

    initialize();

    // App state listener
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup
    return () => {
      if (notificationListenerRef.current) {
        Notifications.removeNotificationSubscription(notificationListenerRef.current);
      }
      if (responseListenerRef.current) {
        Notifications.removeNotificationSubscription(responseListenerRef.current);
      }
      appStateSubscription.remove();
    };
  }, [
    autoRequestPermission,
    handleNotificationReceived,
    handleNotificationResponse,
    handleAppStateChange,
    requestPermission,
    setPushToken,
  ]);

  /**
   * Sync token when authenticated
   */
  useEffect(() => {
    if (isAuthenticated && autoSyncToken && pushToken) {
      syncToken();
    }
  }, [isAuthenticated, autoSyncToken, pushToken, syncToken]);

  /**
   * Update badge count when notifications change
   */
  useEffect(() => {
    refreshBadge();
  }, [notifications, refreshBadge]);

  /**
   * Clear badge when all notifications are read
   */
  useEffect(() => {
    if (unreadCount === 0) {
      clearBadgeCount();
    }
  }, [unreadCount]);

  return {
    pushToken,
    notifications,
    unreadCount,
    hasPermission,
    isInitialized,
    requestPermission,
    syncToken,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    refreshBadge,
  };
}

/**
 * Hook for simple notification badge count
 */
export function useNotificationBadge(): number {
  const notifications = useNotificationStore((state) => state.notifications);
  return notifications.filter((n) => !n.read).length;
}

/**
 * Hook for checking if notifications are enabled
 */
export function useNotificationPermission(): boolean | null {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    checkPermission();
  }, []);

  return hasPermission;
}

export default useNotifications;
