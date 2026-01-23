import { useEffect, useRef, useState, useCallback } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/stores/authStore';
import {
  registerForPushNotifications,
  savePushToken,
  initializeNotificationListeners,
  getInitialNotification,
  handleNotificationResponse,
  setBadgeCount,
} from '@/lib/notifications';
import { useNotificationStore, selectUnreadCount } from '@/stores/notificationStore';
import { initializeNetworkMonitoring } from '@/lib/network';
import { NetworkStatusBar } from '@/components/network';
import { SyncProgressOverlay } from '@/components/network';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [syncOverlayVisible, setSyncOverlayVisible] = useState(false);

  // Initialize network monitoring on mount
  useEffect(() => {
    initializeNetworkMonitoring({
      checkInterval: 30000, // Check every 30 seconds
      onStatusChange: (isOnline, quality) => {
        console.log('[Network] Status changed:', { isOnline, quality });
      },
    });
  }, []);

  useEffect(() => {
    // Hide splash screen after app is ready
    SplashScreen.hideAsync();
  }, []);

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
      </Stack>
    </View>
  );
}
