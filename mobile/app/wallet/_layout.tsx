import { Stack } from 'expo-router';

export default function WalletLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerTintColor: '#6366F1',
      }}
    >
      <Stack.Screen
        name="topup"
        options={{
          title: 'Recharger',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="transactions"
        options={{
          title: 'Historique',
        }}
      />
    </Stack>
  );
}
