import { useEffect, useRef } from 'react';
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

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    // Hide splash screen after app is ready
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
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
    </>
  );
}
