import { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Notification, NotificationType } from '@/stores/notificationStore';
import { NotificationActions } from './NotificationActions';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 80;

interface NotificationCardProps {
  notification: Notification;
  onPress: () => void;
  onMarkAsRead: () => void;
  onDelete: () => void;
}

// Configuration for notification types
const typeConfig: Record<
  NotificationType,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bgColor: string }
> = {
  ticket: {
    icon: 'ticket-outline',
    color: '#6366F1',
    bgColor: 'bg-indigo-100',
  },
  wallet: {
    icon: 'wallet-outline',
    color: '#10B981',
    bgColor: 'bg-emerald-100',
  },
  lineup: {
    icon: 'musical-notes-outline',
    color: '#8B5CF6',
    bgColor: 'bg-purple-100',
  },
  sos: {
    icon: 'warning-outline',
    color: '#EF4444',
    bgColor: 'bg-red-100',
  },
  announcement: {
    icon: 'megaphone-outline',
    color: '#F59E0B',
    bgColor: 'bg-amber-100',
  },
  general: {
    icon: 'notifications-outline',
    color: '#6B7280',
    bgColor: 'bg-gray-100',
  },
};

/**
 * Format a date string to relative time (e.g., "il y a 5 min", "il y a 2h")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "a l'instant";
  } else if (diffMinutes < 60) {
    return `il y a ${diffMinutes} min`;
  } else if (diffHours < 24) {
    return `il y a ${diffHours}h`;
  } else if (diffDays === 1) {
    return 'hier';
  } else if (diffDays < 7) {
    return `il y a ${diffDays}j`;
  } else {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  }
}

export function NotificationCard({
  notification,
  onPress,
  onMarkAsRead,
  onDelete,
}: NotificationCardProps) {
  const config = typeConfig[notification.type] || typeConfig.general;
  const translateX = useRef(new Animated.Value(0)).current;
  const isSwipedOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow left swipe (negative dx)
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -SCREEN_WIDTH / 2));
        } else if (isSwipedOpen.current) {
          // Allow right swipe to close
          translateX.setValue(Math.min(gestureState.dx - SWIPE_THRESHOLD, 0));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Open actions
          Animated.spring(translateX, {
            toValue: -SWIPE_THRESHOLD,
            useNativeDriver: true,
            friction: 8,
          }).start();
          isSwipedOpen.current = true;
        } else {
          // Close actions
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
          isSwipedOpen.current = false;
        }
      },
    })
  ).current;

  const closeSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
    isSwipedOpen.current = false;
  };

  const handleMarkAsRead = () => {
    closeSwipe();
    onMarkAsRead();
  };

  const handleDelete = () => {
    closeSwipe();
    onDelete();
  };

  return (
    <View className="relative overflow-hidden">
      {/* Background Actions */}
      <NotificationActions
        isRead={notification.read}
        onMarkAsRead={handleMarkAsRead}
        onDelete={handleDelete}
      />

      {/* Main Card */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          className={`flex-row items-start p-4 border-b border-gray-100 ${
            notification.read ? 'bg-white' : 'bg-indigo-50/50'
          }`}
        >
          {/* Icon */}
          <View className={`${config.bgColor} rounded-full p-3 mr-3`}>
            <Ionicons name={config.icon} size={20} color={config.color} />
          </View>

          {/* Content */}
          <View className="flex-1">
            <View className="flex-row items-start justify-between">
              <Text
                className={`flex-1 text-base ${
                  notification.read
                    ? 'font-normal text-gray-700'
                    : 'font-semibold text-gray-900'
                }`}
                numberOfLines={2}
              >
                {notification.title}
              </Text>

              {/* Unread Indicator */}
              {!notification.read && (
                <View className="ml-2 mt-1.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-primary" />
                </View>
              )}
            </View>

            <Text className="text-gray-500 text-sm mt-1" numberOfLines={2}>
              {notification.body}
            </Text>

            <Text className="text-gray-400 text-xs mt-2">
              {formatRelativeTime(notification.createdAt)}
            </Text>
          </View>

          {/* Chevron */}
          <View className="ml-2 self-center">
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default NotificationCard;
