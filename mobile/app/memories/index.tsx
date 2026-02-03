import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';

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
}

interface Album {
  id: string;
  name: string;
  coverUrl: string;
  itemCount: number;
  type: string;
}

export default function MemoriesScreen() {
  const router = useRouter();
  const { festivalId } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'gallery' | 'albums' | 'my-photos'>('gallery');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch gallery
  const {
    data: galleryData,
    isLoading: galleryLoading,
    refetch: refetchGallery,
  } = useQuery({
    queryKey: ['gallery', festivalId],
    queryFn: async () => {
      // In real app, call API
      return {
        items: [] as MediaItem[],
        total: 0,
      };
    },
    enabled: activeTab === 'gallery' && !!festivalId,
  });

  // Fetch albums
  const {
    data: albumsData,
    isLoading: albumsLoading,
    refetch: refetchAlbums,
  } = useQuery({
    queryKey: ['albums', festivalId],
    queryFn: async () => {
      // In real app, call API
      return {
        items: [] as Album[],
        total: 0,
      };
    },
    enabled: activeTab === 'albums' && !!festivalId,
  });

  // Fetch my photos
  const {
    data: myPhotosData,
    isLoading: myPhotosLoading,
    refetch: refetchMyPhotos,
  } = useQuery({
    queryKey: ['my-photos', festivalId],
    queryFn: async () => {
      // In real app, call API
      return {
        items: [] as MediaItem[],
        total: 0,
      };
    },
    enabled: activeTab === 'my-photos' && !!festivalId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'gallery') await refetchGallery();
    else if (activeTab === 'albums') await refetchAlbums();
    else await refetchMyPhotos();
    setRefreshing(false);
  }, [activeTab, refetchGallery, refetchAlbums, refetchMyPhotos]);

  const renderTabButton = (tab: typeof activeTab, label: string, icon: string) => (
    <TouchableOpacity
      onPress={() => setActiveTab(tab)}
      className={`flex-1 flex-row items-center justify-center py-3 ${
        activeTab === tab ? 'border-b-2 border-primary' : ''
      }`}
    >
      <Ionicons
        name={icon as any}
        size={18}
        color={activeTab === tab ? '#6366F1' : '#9CA3AF'}
      />
      <Text
        className={`ml-1 ${
          activeTab === tab ? 'text-primary font-semibold' : 'text-gray-400'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

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

  const renderAlbum = (album: Album) => (
    <TouchableOpacity
      key={album.id}
      onPress={() => router.push(`/memories/album/${album.id}` as any)}
      className="mb-4"
      style={{ width: (width - 48) / 2 }}
    >
      <View className="bg-gray-200 rounded-lg overflow-hidden" style={{ height: 120 }}>
        {album.coverUrl ? (
          <Image
            source={{ uri: album.coverUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="images-outline" size={40} color="#9CA3AF" />
          </View>
        )}
      </View>
      <Text className="font-medium mt-2" numberOfLines={1}>
        {album.name}
      </Text>
      <Text className="text-gray-500 text-sm">{album.itemCount} photos</Text>
    </TouchableOpacity>
  );

  const renderEmptyState = (message: string) => (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons name="images-outline" size={64} color="#D1D5DB" />
      <Text className="text-gray-400 text-lg mt-4">{message}</Text>
      <TouchableOpacity
        onPress={() => router.push('/memories/upload' as any)}
        className="bg-primary rounded-full px-6 py-3 mt-6"
      >
        <Text className="text-white font-medium">Ajouter une photo</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-12 pb-4 bg-white border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold">Souvenirs</Text>
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => router.push('/memories/upload' as any)}
              className="bg-primary rounded-full p-2 mr-2"
            >
              <Ionicons name="camera" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/memories/liked' as any)}
              className="bg-gray-100 rounded-full p-2"
            >
              <Ionicons name="heart-outline" size={22} color="#6366F1" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-100">
        {renderTabButton('gallery', 'Galerie', 'grid-outline')}
        {renderTabButton('albums', 'Albums', 'albums-outline')}
        {renderTabButton('my-photos', 'Mes photos', 'person-outline')}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Gallery Tab */}
        {activeTab === 'gallery' && (
          <View>
            {galleryLoading ? (
              <View className="flex-row flex-wrap p-px">
                {[...Array(9)].map((_, i) => (
                  <View
                    key={i}
                    style={{ width: ITEM_SIZE, height: ITEM_SIZE, margin: GAP / 2 }}
                    className="bg-gray-200 animate-pulse"
                  />
                ))}
              </View>
            ) : galleryData?.items?.length ? (
              <View className="flex-row flex-wrap p-px">
                {galleryData.items.map(renderMediaItem)}
              </View>
            ) : (
              renderEmptyState('Aucune photo dans la galerie')
            )}
          </View>
        )}

        {/* Albums Tab */}
        {activeTab === 'albums' && (
          <View className="p-4">
            {albumsLoading ? (
              <View className="flex-row flex-wrap justify-between">
                {[...Array(4)].map((_, i) => (
                  <View key={i} className="mb-4" style={{ width: (width - 48) / 2 }}>
                    <View className="bg-gray-200 rounded-lg animate-pulse" style={{ height: 120 }} />
                    <View className="bg-gray-200 rounded h-4 mt-2 w-2/3" />
                    <View className="bg-gray-200 rounded h-3 mt-1 w-1/3" />
                  </View>
                ))}
              </View>
            ) : albumsData?.items?.length ? (
              <View className="flex-row flex-wrap justify-between">
                {albumsData.items.map(renderAlbum)}
              </View>
            ) : (
              renderEmptyState('Aucun album disponible')
            )}
          </View>
        )}

        {/* My Photos Tab */}
        {activeTab === 'my-photos' && (
          <View>
            {myPhotosLoading ? (
              <View className="flex-row flex-wrap p-px">
                {[...Array(6)].map((_, i) => (
                  <View
                    key={i}
                    style={{ width: ITEM_SIZE, height: ITEM_SIZE, margin: GAP / 2 }}
                    className="bg-gray-200 animate-pulse"
                  />
                ))}
              </View>
            ) : myPhotosData?.items?.length ? (
              <View className="flex-row flex-wrap p-px">
                {myPhotosData.items.map(renderMediaItem)}
              </View>
            ) : (
              renderEmptyState('Tu n\'as pas encore de photos')
            )}
          </View>
        )}
      </ScrollView>

      {/* Generate Souvenir Button */}
      <View className="p-4 border-t border-gray-100">
        <TouchableOpacity
          onPress={() => router.push('/memories/souvenir' as any)}
          className="bg-gradient-to-r from-purple-500 to-primary rounded-xl p-4 flex-row items-center justify-center"
          style={{ backgroundColor: '#6366F1' }}
        >
          <Ionicons name="gift-outline" size={22} color="white" />
          <Text className="text-white font-semibold ml-2">
            Generer mon souvenir PDF
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
