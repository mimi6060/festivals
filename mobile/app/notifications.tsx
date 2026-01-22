import { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNotificationStore,
  selectNotificationsByDate,
  selectUnreadCount,
  NotificationType,
} from '@/stores/notificationStore';
import { fetchNotifications, markAllAsReadOnBackend } from '@/lib/notifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { useState } from 'react';

export default function NotificationsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const notifications = useNotificationStore((state) => state.notifications);
  const notificationsByDate = useNotificationStore(selectNotificationsByDate);
  const unreadCount = useNotificationStore(selectUnreadCount);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const setNotifications = useNotificationStore((state) => state.setNotifications);

  const loadNotifications = useCallback(async () => {
    const data = await fetchNotifications();
    if (data.length > 0) {
      setNotifications(data);
    }
  }, [setNotifications]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleMarkAllAsRead = async () => {
    markAllAsRead();
    await markAllAsReadOnBackend();
  };

  const handleNotificationPress = (id: string, type: NotificationType, data: Record<string, unknown>) => {
    // Mark as read
    useNotificationStore.getState().markAsRead(id);

    // Navigate based on type
    switch (type) {
      case 'ticket':
        if (data?.ticketId) {
          router.push(`/ticket/${data.ticketId}`);
        } else {
          router.push('/(tabs)/tickets');
        }
        break;
      case 'wallet':
        router.push('/(tabs)/wallet');
        break;
      case 'lineup':
        router.push('/(tabs)/program');
        break;
      case 'sos':
        router.push('/sos');
        break;
      default:
        // Stay on notifications screen
        break;
    }
  };

  const dateGroups = Object.entries(notificationsByDate);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notifications',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
          ),
          headerRight: () =>
            unreadCount > 0 ? (
              <TouchableOpacity onPress={handleMarkAllAsRead} className="ml-4">
                <Text className="text-primary font-medium">Tout lire</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#6366F1']}
            tintColor="#6366F1"
          />
        }
      >
        {notifications.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <View className="bg-gray-100 rounded-full p-6 mb-4">
              <Ionicons name="notifications-off-outline" size={48} color="#9CA3AF" />
            </View>
            <Text className="text-gray-500 text-lg font-medium">
              Aucune notification
            </Text>
            <Text className="text-gray-400 text-sm mt-1 text-center px-8">
              Vous recevrez des notifications sur vos billets, votre wallet et les annonces.
            </Text>
          </View>
        ) : (
          dateGroups.map(([date, items]) => (
            <View key={date}>
              {/* Date Header */}
              <View className="px-4 py-3 bg-gray-100">
                <Text className="text-gray-600 font-semibold text-sm uppercase">
                  {date}
                </Text>
              </View>

              {/* Notifications for this date */}
              {items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onPress={() =>
                    handleNotificationPress(
                      notification.id,
                      notification.type,
                      notification.data
                    )
                  }
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
