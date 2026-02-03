import { useEffect, useState, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/stores/authStore';
import { useNotifications } from '@/hooks/useNotifications';
import { initializeNetworkMonitoring } from '@/lib/network';
import { NetworkStatusBar } from '@/components/network';
import { SyncProgressOverlay } from '@/components/network';
import { Notification } from '@/stores/notificationStore';
import { logger } from '@/lib/logger';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

/**
 * Root Layout Component
 * Handles app initialization including:
 * - Push notification setup
 * - Network monitoring
 * - Navigation structure
 */
export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [syncOverlayVisible, setSyncOverlayVisible] = useState(false);

  // Initialize push notifications with the custom hook
  const {
    isInitialized: notificationsInitialized,
    unreadCount,
    syncToken,
  } = useNotifications({
    autoRequestPermission: true,
    autoSyncToken: true,
    onNotificationReceived: handleNotificationReceived,
    onNotificationPressed: handleNotificationPressed,
  });

  /**
   * Handle notifications received while app is in foreground
   * Can show an in-app banner or toast
   */
  function handleNotificationReceived(notification: Notification) {
    logger.notifications.debug('Notification received:', notification.title);

    // For important notifications, show an in-app alert
    if (notification.type === 'sos' || notification.type === 'announcement') {
      Alert.alert(
        notification.title,
        notification.body,
        [{ text: 'OK' }],
        { cancelable: true }
      );
    }
  }

  /**
   * Handle notification taps
   * Navigation is handled automatically by useNotifications hook
   */
  function handleNotificationPressed(notification: Notification, data: Record<string, unknown>) {
    logger.notifications.debug('Notification pressed:', notification.title);
  }

  // Initialize network monitoring on mount
  useEffect(() => {
    initializeNetworkMonitoring({
      checkInterval: 30000, // Check every 30 seconds
      onStatusChange: (isOnline, quality) => {
        logger.network.debug('Status changed:', { isOnline, quality });
      },
    });
  }, []);

  // Hide splash screen after initialization
  useEffect(() => {
    const hideSplash = async () => {
      // Wait for notifications to initialize
      if (notificationsInitialized) {
        await SplashScreen.hideAsync();
      }
    };
    hideSplash();
  }, [notificationsInitialized]);

  // Sync push token when user authenticates
  useEffect(() => {
    if (isAuthenticated && notificationsInitialized) {
      syncToken();
    }
  }, [isAuthenticated, notificationsInitialized, syncToken]);

  // Handle network status bar tap to show sync overlay
  const handleNetworkStatusPress = useCallback(() => {
    setSyncOverlayVisible(true);
  }, []);

  const handleSyncOverlayClose = useCallback(() => {
    setSyncOverlayVisible(false);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="auto" />

      {/* Network Status Bar - shows at top when offline or syncing */}
      <NetworkStatusBar
        onPress={handleNetworkStatusPress}
        showDetailsOnTap
        zIndex={1000}
      />

      {/* Sync Progress Overlay */}
      <SyncProgressOverlay
        visible={syncOverlayVisible}
        onClose={handleSyncOverlayClose}
        cancellable
        title="Synchronisation"
      />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(staff)" />
        <Stack.Screen
          name="ticket/[id]"
          options={{
            headerShown: true,
            title: 'Mon Billet',
          }}
        />
        <Stack.Screen
          name="ticket/transfer"
          options={{
            headerShown: true,
            title: 'Transferer',
            presentation: 'modal',
          }}
        />
        <Stack.Screen name="sos" options={{ presentation: 'modal' }} />
        <Stack.Screen name="wallet" options={{ headerShown: false }} />
        <Stack.Screen
          name="scan"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="friends/index"
          options={{
            headerShown: true,
            title: 'Amis',
          }}
        />
        <Stack.Screen
          name="friends/[id]"
          options={{
            headerShown: true,
            title: 'Profil',
          }}
        />
        <Stack.Screen
          name="friends/add"
          options={{
            headerShown: true,
            title: 'Ajouter un ami',
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: true,
            title: 'Notifications',
          }}
        />
      </Stack>
    </View>
  );
}
