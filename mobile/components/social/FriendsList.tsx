import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Friend, FriendStatus } from '@/stores/socialStore';

interface FriendsListProps {
  title: string;
  friends: Friend[];
  onFriendPress: (friendId: string) => void;
  showLocationBadge?: boolean;
}

// Status configuration
const statusConfig: Record<
  FriendStatus,
  { color: string; bgColor: string }
> = {
  AT_FESTIVAL: {
    color: '#10B981',
    bgColor: 'bg-green-500',
  },
  ONLINE: {
    color: '#3B82F6',
    bgColor: 'bg-blue-500',
  },
  OFFLINE: {
    color: '#9CA3AF',
    bgColor: 'bg-gray-400',
  },
};

// Format relative time
const formatLastSeen = (dateString?: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "A l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

// Render avatar
const Avatar = ({
  name,
  avatarUrl,
  size = 48,
  status,
}: {
  name: string;
  avatarUrl?: string;
  size?: number;
  status?: FriendStatus;
}) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const statusColor = status ? statusConfig[status].color : undefined;

  return (
    <View style={{ position: 'relative' }}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <View
          className="bg-primary items-center justify-center"
          style={{ width: size, height: size, borderRadius: size / 2 }}
        >
          <Text
            className="text-white font-bold"
            style={{ fontSize: size * 0.35 }}
          >
            {initials}
          </Text>
        </View>
      )}
      {status && (
        <View
          className="absolute bottom-0 right-0 rounded-full border-2 border-white"
          style={{
            width: size * 0.25,
            height: size * 0.25,
            backgroundColor: statusColor,
          }}
        />
      )}
    </View>
  );
};

// Single friend item
interface FriendItemProps {
  friend: Friend;
  onPress: (friendId: string) => void;
  showLocationBadge?: boolean;
  showBorder?: boolean;
}

function FriendItem({ friend, onPress, showLocationBadge, showBorder = true }: FriendItemProps) {
  return (
    <TouchableOpacity
      onPress={() => onPress(friend.id)}
      activeOpacity={0.7}
      className={`flex-row items-center py-3 ${showBorder ? 'border-b border-gray-100' : ''}`}
    >
      {/* Avatar with status indicator */}
      <Avatar name={friend.name} avatarUrl={friend.avatarUrl} size={48} status={friend.status} />

      {/* Friend Info */}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <Text className="font-semibold text-gray-900">{friend.name}</Text>
          {friend.status === 'AT_FESTIVAL' && (
            <View className="ml-2 px-2 py-0.5 bg-green-100 rounded-full">
              <Text className="text-green-700 text-xs font-medium">Au festival</Text>
            </View>
          )}
        </View>
        <Text className="text-gray-500 text-sm">@{friend.username}</Text>

        {/* Location info if sharing */}
        {showLocationBadge && friend.isLocationShared && friend.location && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="location" size={12} color="#6366F1" />
            <Text className="text-primary text-xs ml-1">
              {friend.location.poiName || 'Position partagee'}
            </Text>
          </View>
        )}

        {/* Last seen for offline friends */}
        {friend.status === 'OFFLINE' && friend.lastSeen && (
          <Text className="text-gray-400 text-xs mt-0.5">
            Vu {formatLastSeen(friend.lastSeen)}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export default function FriendsList({
  title,
  friends,
  onFriendPress,
  showLocationBadge = false,
}: FriendsListProps) {
  if (friends.length === 0) {
    return null;
  }

  return (
    <View className="mb-6">
      {/* Section Title */}
      <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">
        {title} ({friends.length})
      </Text>

      {/* Friends List */}
      <View className="bg-white rounded-xl px-4">
        {friends.map((friend, index) => (
          <FriendItem
            key={friend.id}
            friend={friend}
            onPress={onFriendPress}
            showLocationBadge={showLocationBadge}
            showBorder={index < friends.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

// Horizontal friends list for compact display
interface HorizontalFriendsListProps {
  friends: Friend[];
  onFriendPress: (friendId: string) => void;
  maxVisible?: number;
}

export function HorizontalFriendsList({
  friends,
  onFriendPress,
  maxVisible = 5,
}: HorizontalFriendsListProps) {
  const visibleFriends = friends.slice(0, maxVisible);
  const remainingCount = friends.length - maxVisible;

  return (
    <View className="flex-row items-center">
      {visibleFriends.map((friend, index) => (
        <TouchableOpacity
          key={friend.id}
          onPress={() => onFriendPress(friend.id)}
          activeOpacity={0.8}
          className="items-center mr-4"
        >
          <Avatar name={friend.name} avatarUrl={friend.avatarUrl} size={56} status={friend.status} />
          <Text
            className="text-gray-700 text-xs mt-1 text-center"
            numberOfLines={1}
            style={{ maxWidth: 64 }}
          >
            {friend.name.split(' ')[0]}
          </Text>
        </TouchableOpacity>
      ))}
      {remainingCount > 0 && (
        <View className="items-center">
          <View className="w-14 h-14 bg-gray-100 rounded-full items-center justify-center">
            <Text className="text-gray-600 font-semibold">+{remainingCount}</Text>
          </View>
          <Text className="text-gray-400 text-xs mt-1">autres</Text>
        </View>
      )}
    </View>
  );
}

// Compact friend card for selection
interface SelectableFriendCardProps {
  friend: Friend;
  selected: boolean;
  onPress: (friend: Friend) => void;
}

export function SelectableFriendCard({ friend, selected, onPress }: SelectableFriendCardProps) {
  return (
    <TouchableOpacity
      onPress={() => onPress(friend)}
      activeOpacity={0.7}
      className={`flex-row items-center p-3 rounded-xl mb-2 ${
        selected ? 'bg-primary/10 border border-primary' : 'bg-white border border-gray-100'
      }`}
    >
      <Avatar name={friend.name} avatarUrl={friend.avatarUrl} size={40} status={friend.status} />
      <View className="flex-1 ml-3">
        <Text className={`font-medium ${selected ? 'text-primary' : 'text-gray-900'}`}>
          {friend.name}
        </Text>
        <Text className="text-gray-500 text-xs">@{friend.username}</Text>
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
      ) : (
        <View className="w-6 h-6 rounded-full border-2 border-gray-300" />
      )}
    </TouchableOpacity>
  );
}
