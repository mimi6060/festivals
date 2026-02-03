import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const GAP = 2;
const ITEM_SIZE = (width - GAP * (COLUMN_COUNT + 1)) / COLUMN_COUNT;

interface MediaItem {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  url: string;
  thumbnailUrl: string;
  likeCount: number;
  isLiked: boolean;
  metadata: {
    artistName?: string;
    day?: number;
  };
  createdAt: string;
}

interface Album {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  itemCount: number;
  type: string;
  createdAt: string;
}

export default function AlbumDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch album details
  const {
    data: album,
    isLoading: albumLoading,
    refetch: refetchAlbum,
  } = useQuery({
    queryKey: ['album', id],
    queryFn: async () => {
      // In real app, call API
      return {
        id: id,
        name: 'Jour 1 - Main Stage',
        description: 'Les meilleurs moments du premier jour',
        coverUrl: '',
        itemCount: 24,
        type: 'DAILY',
        createdAt: new Date().toISOString(),
      } as Album;
    },
    enabled: !!id,
  });

  // Fetch album items
  const {
    data: itemsData,
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['album-items', id],
    queryFn: async () => {
      // In real app, call API
      return {
        items: [] as MediaItem[],
        total: 0,
      };
    },
    enabled: !!id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchAlbum(), refetchItems()]);
    setRefreshing(false);
  }, [refetchAlbum, refetchItems]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Decouvre l'album "${album?.name}" du festival!`,
        url: `https://festivals.app/share/album/${id}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const renderMediaItem = (item: MediaItem) => (
    <TouchableOpacity
      key={item.id}
      onPress={() => router.push(`/memories/${item.id}` as any)}
      style={{ width: ITEM_SIZE, height: ITEM_SIZE, margin: GAP / 2 }}
      className="bg-gray-200"
    >
      <Image
        source={{ uri: item.thumbnailUrl || item.url }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
      {item.type === 'VIDEO' && (
        <View className="absolute top-1 right-1 bg-black/50 rounded px-1">
          <Ionicons name="videocam" size={14} color="white" />
        </View>
      )}
      {item.isLiked && (
        <View className="absolute bottom-1 left-1">
          <Ionicons name="heart" size={14} color="#EF4444" />
        </View>
      )}
    </TouchableOpacity>
  );

  const isLoading = albumLoading || itemsLoading;

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-12 pb-4 bg-white border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center"
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
            <Text className="text-lg font-semibold ml-1">Retour</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} className="p-2">
            <Ionicons name="share-outline" size={24} color="#6366F1" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Album Header */}
        <View className="p-4 border-b border-gray-100">
          {isLoading ? (
            <View>
              <View className="bg-gray-200 rounded h-8 w-2/3 animate-pulse" />
              <View className="bg-gray-200 rounded h-4 w-full mt-2 animate-pulse" />
              <View className="bg-gray-200 rounded h-4 w-1/4 mt-2 animate-pulse" />
            </View>
          ) : (
            <View>
              <Text className="text-2xl font-bold">{album?.name}</Text>
              {album?.description && (
                <Text className="text-gray-500 mt-1">{album.description}</Text>
              )}
              <View className="flex-row items-center mt-2">
                <Ionicons name="images-outline" size={16} color="#9CA3AF" />
                <Text className="text-gray-400 ml-1">
                  {album?.itemCount || 0} photos
                </Text>
                <View className="w-1 h-1 bg-gray-300 rounded-full mx-2" />
                <Text className="text-gray-400">
                  {album?.type === 'DAILY'
                    ? 'Album journalier'
                    : album?.type === 'STAGE'
                    ? 'Album scene'
                    : album?.type === 'ARTIST'
                    ? 'Album artiste'
                    : 'Album'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Grid */}
        {itemsLoading ? (
          <View className="flex-row flex-wrap p-px">
            {[...Array(12)].map((_, i) => (
              <View
                key={i}
                style={{ width: ITEM_SIZE, height: ITEM_SIZE, margin: GAP / 2 }}
                className="bg-gray-200 animate-pulse"
              />
            ))}
          </View>
        ) : itemsData?.items?.length ? (
          <View className="flex-row flex-wrap p-px">
            {itemsData.items.map(renderMediaItem)}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="images-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-400 text-lg mt-4">
              Cet album est vide
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
