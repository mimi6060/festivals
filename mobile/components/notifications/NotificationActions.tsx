import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NotificationActionsProps {
  isRead: boolean;
  onMarkAsRead: () => void;
  onDelete: () => void;
}

/**
 * Swipe action buttons for notification cards
 * Positioned behind the card and revealed on left swipe
 */
export function NotificationActions({
  isRead,
  onMarkAsRead,
  onDelete,
}: NotificationActionsProps) {
  return (
    <View className="absolute right-0 top-0 bottom-0 flex-row items-stretch">
      {/* Mark as Read Button - only show if unread */}
      {!isRead && (
        <TouchableOpacity
          onPress={onMarkAsRead}
          className="bg-primary w-20 items-center justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={24} color="white" />
          <Text className="text-white text-xs mt-1 font-medium">Lu</Text>
        </TouchableOpacity>
      )}

      {/* Delete Button */}
      <TouchableOpacity
        onPress={onDelete}
        className="bg-red-500 w-20 items-center justify-center"
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={24} color="white" />
        <Text className="text-white text-xs mt-1 font-medium">Supprimer</Text>
      </TouchableOpacity>
    </View>
  );
}

export default NotificationActions;
