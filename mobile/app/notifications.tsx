import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNotificationStore,
  selectUnreadCount,
  Notification,
  NotificationType,
} from '@/stores/notificationStore';
import { fetchNotifications, markAllAsReadOnBackend, deleteNotificationOnBackend } from '@/lib/notifications';
import { NotificationCard } from '@/components/notifications/NotificationCard';

export default function NotificationsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore(selectUnreadCount);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
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

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read
    markAsRead(notification.id);

    // Navigate based on type
    switch (notification.type) {
      case 'ticket':
        if (notification.data?.ticketId) {
          router.push(`/ticket/${notification.data.ticketId}`);
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

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Supprimer la notification',
      'Voulez-vous vraiment supprimer cette notification ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            removeNotification(id);
            await deleteNotificationOnBackend(id);
          },
        },
      ]
    );
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <NotificationCard
      notification={item}
      onPress={() => handleNotificationPress(item)}
      onMarkAsRead={() => handleMarkAsRead(item.id)}
      onDelete={() => handleDelete(item.id)}
    />
  );

  const renderSectionHeader = (date: string) => (
    <View className="px-4 py-3 bg-gray-100">
      <Text className="text-gray-600 font-semibold text-sm uppercase">
        {date}
      </Text>
    </View>
  );

  const renderEmptyState = () => (
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
  );

  // Group notifications by date
  const getDateKey = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, today)) {
      return "Aujourd'hui";
    } else if (isSameDay(date, yesterday)) {
      return 'Hier';
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  // Create sections for FlatList
  const sections = notifications.reduce<{ date: string; data: Notification[] }[]>(
    (acc, notification) => {
      const dateKey = getDateKey(notification.createdAt);
      const existingSection = acc.find((s) => s.date === dateKey);

      if (existingSection) {
        existingSection.data.push(notification);
      } else {
        acc.push({ date: dateKey, data: [notification] });
      }

      return acc;
    },
    []
  );

  // Flatten sections for FlatList with headers
  type ListItem =
    | { type: 'header'; date: string; id: string }
    | { type: 'notification'; notification: Notification; id: string };

  const flattenedData: ListItem[] = sections.flatMap((section) => [
    { type: 'header' as const, date: section.date, id: `header-${section.date}` },
    ...section.data.map((notification) => ({
      type: 'notification' as const,
      notification,
      id: notification.id,
    })),
  ]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return renderSectionHeader(item.date);
    }
    return renderNotification({ item: item.notification });
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
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

      <FlatList
        data={flattenedData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#6366F1']}
            tintColor="#6366F1"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// Helper function
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}
