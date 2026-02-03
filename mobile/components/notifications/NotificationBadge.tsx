import { View, Text } from 'react-native';
import { useNotificationStore, selectUnreadCount } from '@/stores/notificationStore';

interface NotificationBadgeProps {
  /**
   * Size of the badge: 'small' for tab bar, 'large' for header
   */
  size?: 'small' | 'large';
  /**
   * Custom style for positioning
   */
  style?: object;
  /**
   * Maximum number to display before showing "99+"
   */
  maxCount?: number;
}

/**
 * Badge component showing unread notification count
 * Designed for use in tab bar icons or header buttons
 */
export function NotificationBadge({
  size = 'small',
  style,
  maxCount = 99,
}: NotificationBadgeProps) {
  const unreadCount = useNotificationStore(selectUnreadCount);

  // Don't render if no unread notifications
  if (unreadCount === 0) {
    return null;
  }

  const displayCount = unreadCount > maxCount ? `${maxCount}+` : unreadCount.toString();

  const sizeStyles = {
    small: {
      container: 'min-w-[18px] h-[18px] px-1',
      text: 'text-[10px]',
    },
    large: {
      container: 'min-w-[22px] h-[22px] px-1.5',
      text: 'text-xs',
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={style}
      className={`${currentSize.container} bg-red-500 rounded-full items-center justify-center absolute -top-1 -right-1`}
    >
      <Text className={`${currentSize.text} text-white font-bold`}>
        {displayCount}
      </Text>
    </View>
  );
}

/**
 * Wrapper component for tab bar icons with notification badge
 */
interface TabBarIconWithBadgeProps {
  children: React.ReactNode;
}

export function TabBarIconWithBadge({ children }: TabBarIconWithBadgeProps) {
  return (
    <View className="relative">
      {children}
      <NotificationBadge size="small" />
    </View>
  );
}

/**
 * Simple dot indicator for minimal badge display
 */
export function NotificationDot() {
  const unreadCount = useNotificationStore(selectUnreadCount);

  if (unreadCount === 0) {
    return null;
  }

  return (
    <View className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
  );
}

export default NotificationBadge;
