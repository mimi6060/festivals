import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function AuthLayout() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    // If user is already authenticated, redirect to main app
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Connexion',
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Inscription',
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: 'Mot de passe oublie',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
