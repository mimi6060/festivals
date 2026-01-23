import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSocialStore } from '@/stores/socialStore';
import FriendsList from '@/components/social/FriendsList';
import FriendRequestCard from '@/components/social/FriendRequestCard';

export default function FriendsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  const {
    friends,
    friendRequests,
    isLoadingFriends,
    isLoadingRequests,
    fetchFriends,
    fetchFriendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
  } = useSocialStore();

  // Initial load
  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
  }, [fetchFriends, fetchFriendRequests]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchFriends(), fetchFriendRequests()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFriends, fetchFriendRequests]);

  const handleFriendPress = (friendId: string) => {
    router.push(`/friends/${friendId}`);
  };

  const handleAddFriend = () => {
    router.push('/friends/add');
  };

  const handleAcceptRequest = async (requestId: string) => {
    await acceptFriendRequest(requestId);
  };

  const handleRejectRequest = async (requestId: string) => {
    await rejectFriendRequest(requestId);
  };

  // Separate friends by status
  const atFestivalFriends = friends.filter((f) => f.status === 'AT_FESTIVAL');
  const onlineFriends = friends.filter((f) => f.status === 'ONLINE');
  const offlineFriends = friends.filter((f) => f.status === 'OFFLINE');

  const pendingRequestsCount = friendRequests.length;

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title: 'Amis',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#1F2937',
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleAddFriend}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="mr-2"
            >
              <Ionicons name="person-add" size={24} color="#6366F1" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Tabs */}
      <View className="flex-row bg-white border-b border-gray-200">
        <TouchableOpacity
          onPress={() => setActiveTab('friends')}
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'friends' ? 'border-primary' : 'border-transparent'
          }`}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center">
            <Ionicons
              name="people"
              size={20}
              color={activeTab === 'friends' ? '#6366F1' : '#9CA3AF'}
            />
            <Text
              className={`ml-2 font-medium ${
                activeTab === 'friends' ? 'text-primary' : 'text-gray-500'
              }`}
            >
              Amis ({friends.length})
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('requests')}
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'requests' ? 'border-primary' : 'border-transparent'
          }`}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center">
            <Ionicons
              name="mail"
              size={20}
              color={activeTab === 'requests' ? '#6366F1' : '#9CA3AF'}
            />
            <Text
              className={`ml-2 font-medium ${
                activeTab === 'requests' ? 'text-primary' : 'text-gray-500'
              }`}
            >
              Demandes
            </Text>
            {pendingRequestsCount > 0 && (
              <View className="ml-2 bg-red-500 rounded-full px-2 py-0.5">
                <Text className="text-white text-xs font-bold">{pendingRequestsCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {activeTab === 'friends' ? (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
          }
          showsVerticalScrollIndicator={false}
        >
          {isLoadingFriends && friends.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color="#6366F1" />
              <Text className="text-gray-500 mt-4">Chargement...</Text>
            </View>
          ) : friends.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20 px-8">
              <View className="bg-primary/10 rounded-full p-6 mb-4">
                <Ionicons name="people-outline" size={48} color="#6366F1" />
              </View>
              <Text className="text-gray-900 text-lg font-semibold text-center">
                Aucun ami pour le moment
              </Text>
              <Text className="text-gray-500 text-center mt-2">
                Ajoutez des amis pour partager votre position et leur envoyer de l'argent
              </Text>
              <TouchableOpacity
                onPress={handleAddFriend}
                className="bg-primary rounded-xl px-6 py-3 mt-6 flex-row items-center"
                activeOpacity={0.8}
              >
                <Ionicons name="person-add" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Ajouter des amis</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="p-4">
              {/* At Festival Section */}
              {atFestivalFriends.length > 0 && (
                <FriendsList
                  title="Au festival"
                  friends={atFestivalFriends}
                  onFriendPress={handleFriendPress}
                  showLocationBadge
                />
              )}

              {/* Online Section */}
              {onlineFriends.length > 0 && (
                <FriendsList
                  title="En ligne"
                  friends={onlineFriends}
                  onFriendPress={handleFriendPress}
                />
              )}

              {/* Offline Section */}
              {offlineFriends.length > 0 && (
                <FriendsList
                  title="Hors ligne"
                  friends={offlineFriends}
                  onFriendPress={handleFriendPress}
                />
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
          }
          showsVerticalScrollIndicator={false}
        >
          {isLoadingRequests && friendRequests.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color="#6366F1" />
              <Text className="text-gray-500 mt-4">Chargement...</Text>
            </View>
          ) : friendRequests.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20 px-8">
              <View className="bg-gray-100 rounded-full p-6 mb-4">
                <Ionicons name="mail-outline" size={48} color="#9CA3AF" />
              </View>
              <Text className="text-gray-900 text-lg font-semibold text-center">
                Aucune demande en attente
              </Text>
              <Text className="text-gray-500 text-center mt-2">
                Les demandes d'amis que vous recevrez apparaitront ici
              </Text>
            </View>
          ) : (
            <View className="p-4">
              <Text className="text-sm font-semibold text-gray-500 uppercase mb-3">
                Demandes recues ({friendRequests.length})
              </Text>
              {friendRequests.map((request) => (
                <FriendRequestCard
                  key={request.id}
                  request={request}
                  onAccept={handleAcceptRequest}
                  onReject={handleRejectRequest}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Floating Add Button */}
      <TouchableOpacity
        onPress={handleAddFriend}
        className="absolute bottom-6 right-6 bg-primary rounded-full w-14 h-14 items-center justify-center shadow-lg"
        style={{
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
