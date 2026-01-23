import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Friend, FriendStatus } from '@/stores/socialStore';

interface FriendCardProps {
  friend: Friend;
  onPress?: (friend: Friend) => void;
  showLocation?: boolean;
  showBorder?: boolean;
  compact?: boolean;
}

// Status configuration
const statusConfig: Record<
  FriendStatus,
  { label: string; color: string; bgColor: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  AT_FESTIVAL: {
    label: 'Au festival',
    color: '#10B981',
    bgColor: 'bg-green-100',
    icon: 'musical-notes',
  },
  ONLINE: {
    label: 'En ligne',
    color: '#3B82F6',
    bgColor: 'bg-blue-100',
    icon: 'ellipse',
  },
  OFFLINE: {
    label: 'Hors ligne',
    color: '#9CA3AF',
    bgColor: 'bg-gray-100',
    icon: 'ellipse-outline',
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
            width: size * 0.3,
            height: size * 0.3,
            backgroundColor: statusColor,
          }}
        />
      )}
    </View>
  );
};

export default function FriendCard({
  friend,
  onPress,
  showLocation = true,
  showBorder = true,
  compact = false,
}: FriendCardProps) {
  const status = statusConfig[friend.status];

  if (compact) {
    return (
      <TouchableOpacity
        onPress={() => onPress?.(friend)}
        activeOpacity={0.7}
        className={`flex-row items-center py-2 ${showBorder ? 'border-b border-gray-100' : ''}`}
      >
        <Avatar name={friend.name} avatarUrl={friend.avatarUrl} size={40} status={friend.status} />
        <View className="flex-1 ml-3">
          <Text className="font-medium text-gray-900">{friend.name}</Text>
          <Text className="text-gray-500 text-xs">@{friend.username}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />}
      </TouchableOpacity>
    );
  }

  const content = (
    <View className={`flex-row items-center py-3 ${showBorder ? 'border-b border-gray-100' : ''}`}>
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
        {showLocation && friend.isLocationShared && friend.location && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="location" size={12} color="#6366F1" />
            <Text className="text-primary text-xs ml-1">{friend.location.poiName || 'Position partagee'}</Text>
          </View>
        )}

        {/* Last seen for offline friends */}
        {friend.status === 'OFFLINE' && friend.lastSeen && (
          <Text className="text-gray-400 text-xs mt-0.5">
            Vu {formatLastSeen(friend.lastSeen)}
          </Text>
        )}
      </View>

      {/* Chevron if clickable */}
      {onPress && <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={() => onPress(friend)} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// Friend Request Card
interface FriendRequestCardProps {
  request: {
    id: string;
    fromUserName: string;
    fromUsername: string;
    fromAvatarUrl?: string;
    createdAt: string;
  };
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
  isLoading?: boolean;
}

export function FriendRequestCard({
  request,
  onAccept,
  onReject,
  isLoading = false,
}: FriendRequestCardProps) {
  return (
    <View className="bg-white rounded-xl p-4 mb-3">
      <View className="flex-row items-center">
        <Avatar name={request.fromUserName} avatarUrl={request.fromAvatarUrl} size={48} />
        <View className="flex-1 ml-3">
          <Text className="font-semibold text-gray-900">{request.fromUserName}</Text>
          <Text className="text-gray-500 text-sm">@{request.fromUsername}</Text>
          <Text className="text-gray-400 text-xs mt-0.5">
            {formatLastSeen(request.createdAt)}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row mt-4 space-x-3">
        <TouchableOpacity
          onPress={() => onAccept(request.id)}
          disabled={isLoading}
          className="flex-1 bg-primary rounded-lg py-2.5 items-center"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold">Accepter</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onReject(request.id)}
          disabled={isLoading}
          className="flex-1 bg-gray-100 rounded-lg py-2.5 items-center ml-3"
          activeOpacity={0.8}
        >
          <Text className="text-gray-700 font-semibold">Refuser</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Small Avatar for lists
export function FriendAvatarSmall({
  friend,
  onPress,
}: {
  friend: Friend;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} className="items-center mr-4">
      <Avatar name={friend.name} avatarUrl={friend.avatarUrl} size={56} status={friend.status} />
      <Text className="text-gray-700 text-xs mt-1 text-center" numberOfLines={1} style={{ maxWidth: 64 }}>
        {friend.name.split(' ')[0]}
      </Text>
    </TouchableOpacity>
  );
}
