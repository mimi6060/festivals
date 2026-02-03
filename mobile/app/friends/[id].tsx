import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSocialStore, Friend, FriendStatus } from '@/stores/socialStore';
import ShareLocationToggle from '@/components/social/ShareLocationToggle';
import SendMoneySheet, { SendMoneySheetRef } from '@/components/social/SendMoneySheet';

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

// Format friend since date
const formatFriendSince = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sendMoneySheetRef = useRef<SendMoneySheetRef>(null);

  const [isRemoving, setIsRemoving] = useState(false);

  const { getFriendById, removeFriend, toggleLocationSharing, recentTransfers } = useSocialStore();

  const friend = getFriendById(id);

  // Get transfers with this friend
  const transfersWithFriend = recentTransfers.filter(
    (t) => t.toUserId === friend?.userId || t.fromUserId === friend?.userId
  );

  const handleSendMoney = () => {
    sendMoneySheetRef.current?.expand();
  };

  const handleSendMoneySuccess = (amount: number) => {
    // Optionally show a success message
  };

  const handleLocationToggle = async (enabled: boolean) => {
    if (!friend) return;
    await toggleLocationSharing(friend.id, enabled);
  };

  const handleRemoveFriend = () => {
    Alert.alert(
      'Supprimer cet ami',
      `Etes-vous sur de vouloir supprimer ${friend?.name} de votre liste d'amis ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setIsRemoving(true);
            try {
              await removeFriend(id);
              router.back();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer cet ami.');
              setIsRemoving(false);
            }
          },
        },
      ]
    );
  };

  if (!friend) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Stack.Screen options={{ title: 'Ami' }} />
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="text-gray-500 mt-4">Chargement...</Text>
      </View>
    );
  }

  const status = statusConfig[friend.status];
  const initials = friend.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title: friend.name,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#1F2937',
          headerShadowVisible: false,
        }}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View className="bg-white px-4 pt-6 pb-8 items-center">
          {/* Avatar */}
          <View className="relative">
            {friend.avatarUrl ? (
              <Image
                source={{ uri: friend.avatarUrl }}
                className="w-28 h-28 rounded-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-28 h-28 bg-primary rounded-full items-center justify-center">
                <Text className="text-white text-4xl font-bold">{initials}</Text>
              </View>
            )}
            {/* Status indicator */}
            <View
              className="absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-white"
              style={{ backgroundColor: status.color }}
            />
          </View>

          {/* Name & Username */}
          <Text className="text-2xl font-bold text-gray-900 mt-4">{friend.name}</Text>
          <Text className="text-gray-500 text-lg">@{friend.username}</Text>

          {/* Status Badge */}
          <View className={`mt-3 px-4 py-1.5 rounded-full ${status.bgColor}`}>
            <View className="flex-row items-center">
              <Ionicons name={status.icon} size={14} color={status.color} />
              <Text className="ml-1.5 font-medium" style={{ color: status.color }}>
                {status.label}
              </Text>
            </View>
          </View>

          {/* Last seen for offline friends */}
          {friend.status === 'OFFLINE' && friend.lastSeen && (
            <Text className="text-gray-400 text-sm mt-2">
              Vu {formatLastSeen(friend.lastSeen)}
            </Text>
          )}

          {/* Location info if sharing */}
          {friend.isLocationShared && friend.location && (
            <View className="flex-row items-center mt-3 bg-primary/10 px-4 py-2 rounded-full">
              <Ionicons name="location" size={16} color="#6366F1" />
              <Text className="text-primary font-medium ml-2">
                {friend.location.poiName || 'Position partagee'}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View className="p-4">
          {/* Send Money Button */}
          <TouchableOpacity
            onPress={handleSendMoney}
            className="bg-primary rounded-xl p-4 flex-row items-center justify-center mb-4"
            activeOpacity={0.8}
          >
            <Ionicons name="paper-plane" size={24} color="white" />
            <Text className="text-white font-semibold text-lg ml-2">Envoyer de l'argent</Text>
          </TouchableOpacity>

          {/* Location Sharing */}
          <View className="mb-4">
            <ShareLocationToggle
              friendId={friend.id}
              friendName={friend.name}
              isEnabled={friend.isLocationShared}
              onToggle={handleLocationToggle}
            />
          </View>

          {/* Recent Transfers */}
          {transfersWithFriend.length > 0 && (
            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-sm font-semibold text-gray-500 uppercase mb-3">
                Transferts recents
              </Text>
              {transfersWithFriend.slice(0, 3).map((transfer) => (
                <View
                  key={transfer.id}
                  className="flex-row items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 bg-primary/10 rounded-full items-center justify-center">
                      <Ionicons name="paper-plane" size={14} color="#6366F1" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-gray-900 font-medium">
                        {transfer.amount} {transfer.currencyName}
                      </Text>
                      <Text className="text-gray-400 text-xs">
                        {formatLastSeen(transfer.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className={`font-medium ${
                      transfer.status === 'COMPLETED' ? 'text-green-600' : 'text-yellow-600'
                    }`}
                  >
                    {transfer.status === 'COMPLETED' ? 'Reussi' : 'En cours'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Friend Info */}
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-gray-500 uppercase mb-3">
              Informations
            </Text>
            <View className="flex-row items-center py-2 border-b border-gray-100">
              <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                <Ionicons name="calendar-outline" size={20} color="#6366F1" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-gray-500 text-sm">Ami depuis</Text>
                <Text className="text-gray-900 font-medium">
                  {formatFriendSince(friend.addedAt)}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center py-2">
              <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                <Ionicons name="at" size={20} color="#6366F1" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-gray-500 text-sm">Nom d'utilisateur</Text>
                <Text className="text-gray-900 font-medium">@{friend.username}</Text>
              </View>
            </View>
          </View>

          {/* Remove Friend */}
          <TouchableOpacity
            onPress={handleRemoveFriend}
            disabled={isRemoving}
            className="bg-white rounded-xl p-4 flex-row items-center justify-center"
            activeOpacity={0.8}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <Ionicons name="person-remove-outline" size={20} color="#EF4444" />
                <Text className="text-red-500 font-semibold ml-2">Supprimer cet ami</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Send Money Bottom Sheet */}
      <SendMoneySheet
        ref={sendMoneySheetRef}
        friend={friend}
        onClose={() => {}}
        onSuccess={handleSendMoneySuccess}
      />
    </View>
  );
}
