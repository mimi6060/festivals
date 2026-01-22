import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useStaffStore } from '@/stores/staffStore';

export default function StaffLayout() {
  const currentStand = useStaffStore((state) => state.currentStand);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: '#FFFFFF',
        },
        headerStyle: {
          backgroundColor: '#10B981',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerRight: () => (
          <View className="mr-4 bg-white/20 px-3 py-1 rounded-full">
            <Text className="text-white text-xs font-medium">
              {currentStand?.name || 'Stand'}
            </Text>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="payment"
        options={{
          title: 'Encaissement',
          headerTitle: 'Encaissement',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          headerTitle: "Aujourd'hui",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventaire',
          headerTitle: 'Inventaire',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hide the nested screens from tab bar */}
      <Tabs.Screen
        name="payment/scan"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="payment/confirm"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="inventory/count"
        options={{
          href: null,
          headerTitle: 'Comptage inventaire',
        }}
      />
    </Tabs>
  );
}
