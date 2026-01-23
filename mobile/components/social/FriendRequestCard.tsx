import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FriendRequest } from '@/stores/socialStore';

interface FriendRequestCardProps {
  request: FriendRequest;
  onAccept: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}

// Format relative time
const formatRelativeTime = (dateString: string): string => {
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
}: {
  name: string;
  avatarUrl?: string;
  size?: number;
}) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return avatarUrl ? (
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
      <Text className="text-white font-bold" style={{ fontSize: size * 0.35 }}>
        {initials}
      </Text>
    </View>
  );
};

export default function FriendRequestCard({
  request,
  onAccept,
  onReject,
}: FriendRequestCardProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(request.id);
    } catch (error) {
      console.error('Failed to accept request:', error);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(request.id);
    } catch (error) {
      console.error('Failed to reject request:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  const isLoading = isAccepting || isRejecting;

  return (
    <View className="bg-white rounded-xl p-4 mb-3">
      {/* User Info */}
      <View className="flex-row items-center">
        <Avatar name={request.fromUserName} avatarUrl={request.fromAvatarUrl} size={48} />
        <View className="flex-1 ml-3">
          <Text className="font-semibold text-gray-900">{request.fromUserName}</Text>
          <Text className="text-gray-500 text-sm">@{request.fromUsername}</Text>
          <View className="flex-row items-center mt-0.5">
            <Ionicons name="time-outline" size={12} color="#9CA3AF" />
            <Text className="text-gray-400 text-xs ml-1">
              {formatRelativeTime(request.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row mt-4">
        <TouchableOpacity
          onPress={handleAccept}
          disabled={isLoading}
          className={`flex-1 rounded-lg py-2.5 items-center justify-center ${
            isLoading ? 'bg-primary/50' : 'bg-primary'
          }`}
          activeOpacity={0.8}
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <View className="flex-row items-center">
              <Ionicons name="checkmark" size={18} color="white" />
              <Text className="text-white font-semibold ml-1">Accepter</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleReject}
          disabled={isLoading}
          className={`flex-1 rounded-lg py-2.5 items-center justify-center ml-3 ${
            isLoading ? 'bg-gray-50' : 'bg-gray-100'
          }`}
          activeOpacity={0.8}
        >
          {isRejecting ? (
            <ActivityIndicator size="small" color="#6B7280" />
          ) : (
            <View className="flex-row items-center">
              <Ionicons name="close" size={18} color="#6B7280" />
              <Text className="text-gray-700 font-semibold ml-1">Refuser</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Compact version for notifications or inline display
interface CompactFriendRequestProps {
  request: FriendRequest;
  onAccept: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}

export function CompactFriendRequest({
  request,
  onAccept,
  onReject,
}: CompactFriendRequestProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(request.id);
    } catch (error) {
      console.error('Failed to accept request:', error);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(request.id);
    } catch (error) {
      console.error('Failed to reject request:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  const isLoading = isAccepting || isRejecting;

  return (
    <View className="flex-row items-center py-3 border-b border-gray-100">
      <Avatar name={request.fromUserName} avatarUrl={request.fromAvatarUrl} size={40} />
      <View className="flex-1 ml-3">
        <Text className="font-medium text-gray-900">{request.fromUserName}</Text>
        <Text className="text-gray-500 text-xs">@{request.fromUsername}</Text>
      </View>
      <View className="flex-row">
        <TouchableOpacity
          onPress={handleAccept}
          disabled={isLoading}
          className="w-8 h-8 bg-primary rounded-full items-center justify-center"
          activeOpacity={0.8}
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="checkmark" size={18} color="white" />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleReject}
          disabled={isLoading}
          className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center ml-2"
          activeOpacity={0.8}
        >
          {isRejecting ? (
            <ActivityIndicator size="small" color="#6B7280" />
          ) : (
            <Ionicons name="close" size={18} color="#6B7280" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Sent request card (for viewing sent requests)
interface SentRequestCardProps {
  request: FriendRequest;
  onCancel?: (requestId: string) => Promise<void>;
}

export function SentRequestCard({ request, onCancel }: SentRequestCardProps) {
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    if (!onCancel) return;
    setIsCancelling(true);
    try {
      await onCancel(request.id);
    } catch (error) {
      console.error('Failed to cancel request:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <View className="bg-white rounded-xl p-4 mb-3 flex-row items-center">
      <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
        <Ionicons name="paper-plane-outline" size={20} color="#6B7280" />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-gray-900 font-medium">Demande envoyee</Text>
        <Text className="text-gray-500 text-sm">En attente de reponse</Text>
      </View>
      <View className="flex-row items-center">
        <View className="bg-yellow-100 px-2 py-1 rounded-full mr-2">
          <Text className="text-yellow-700 text-xs font-medium">En attente</Text>
        </View>
        {onCancel && (
          <TouchableOpacity
            onPress={handleCancel}
            disabled={isCancelling}
            className="p-2"
            activeOpacity={0.7}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
