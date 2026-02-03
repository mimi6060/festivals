import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFavoritesStore, FavoriteType } from '@/stores/favoritesStore';
import { useLineupStore } from '@/stores/lineupStore';
import { useMapStore } from '@/stores/mapStore';
import { useNetworkStore } from '@/stores/networkStore';
import {
  FavoriteArtistCard,
  FavoriteArtistCompact,
  FavoriteStandCard,
  FavoriteStandCompact,
} from '@/components/favorites';

type TabType = 'artists' | 'stages' | 'stands' | 'schedule';

export default function FavoritesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('artists');
  const [refreshing, setRefreshing] = useState(false);

  const {
    favoriteArtists,
    favoriteStages,
    favoriteStands,
    isSyncing,
    syncWithBackend,
    getFavoriteCount,
  } = useFavoritesStore();

  const {
    artists,
    stages,
    performances,
    getArtistById,
    getStageById,
    getPerformancesByArtist,
  } = useLineupStore();

  const { stands, stages: mapStages, getStandById } = useMapStore();
  const { isOnline } = useNetworkStore();

  // Get favorite data with details
  const favoriteArtistsData = useMemo(() => {
    return favoriteArtists.map((id) => {
      const artist = getArtistById(id);
      const artistPerformances = getPerformancesByArtist(id);
      const now = new Date();
      const nextPerformance = artistPerformances.find(
        (p) => new Date(p.startTime) > now
      );
      const stage = nextPerformance ? getStageById(nextPerformance.stageId) : undefined;

      return {
        artist,
        nextPerformance,
        stage,
      };
    }).filter((item) => item.artist !== undefined);
  }, [favoriteArtists, artists, performances]);

  const favoriteStagesData = useMemo(() => {
    return favoriteStages
      .map((id) => {
        // Check both lineup stages and map stages
        const lineupStage = getStageById(id);
        const mapStage = mapStages.find((s) => s.id === id);
        return lineupStage || mapStage;
      })
      .filter((stage) => stage !== undefined);
  }, [favoriteStages, stages, mapStages]);

  const favoriteStandsData = useMemo(() => {
    return favoriteStands
      .map((id) => getStandById(id))
      .filter((stand) => stand !== undefined);
  }, [favoriteStands, stands]);

  // Get upcoming schedule for favorite artists
  const upcomingFavoriteSchedule = useMemo(() => {
    const now = new Date();
    const schedule: Array<{
      performance: typeof performances[0];
      artist: NonNullable<ReturnType<typeof getArtistById>>;
      stage: NonNullable<ReturnType<typeof getStageById>>;
      isNowPlaying: boolean;
    }> = [];

    favoriteArtists.forEach((artistId) => {
      const artistPerformances = getPerformancesByArtist(artistId);
      const artist = getArtistById(artistId);

      artistPerformances.forEach((perf) => {
        const stage = getStageById(perf.stageId);
        const startTime = new Date(perf.startTime);
        const endTime = new Date(perf.endTime);
        const isNowPlaying = now >= startTime && now <= endTime;
        const isUpcoming = startTime > now;

        if ((isNowPlaying || isUpcoming) && artist && stage) {
          schedule.push({
            performance: perf,
            artist,
            stage,
            isNowPlaying,
          });
        }
      });
    });

    return schedule.sort(
      (a, b) =>
        new Date(a.performance.startTime).getTime() -
        new Date(b.performance.startTime).getTime()
    );
  }, [favoriteArtists, performances, getArtistById, getStageById]);

  // Sync on mount if online
  useEffect(() => {
    if (isOnline) {
      syncWithBackend();
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncWithBackend();
    setRefreshing(false);
  }, [syncWithBackend]);

  const tabs: { key: TabType; label: string; icon: string; count: number }[] = [
    {
      key: 'artists',
      label: 'Artistes',
      icon: 'musical-notes-outline',
      count: favoriteArtists.length,
    },
    {
      key: 'stages',
      label: 'Scenes',
      icon: 'radio-outline',
      count: favoriteStages.length,
    },
    {
      key: 'stands',
      label: 'Stands',
      icon: 'storefront-outline',
      count: favoriteStands.length,
    },
    {
      key: 'schedule',
      label: 'Programme',
      icon: 'calendar-outline',
      count: upcomingFavoriteSchedule.length,
    },
  ];

  const renderEmptyState = (type: TabType) => {
    const config = {
      artists: {
        icon: 'musical-notes-outline',
        title: 'Aucun artiste favori',
        description:
          'Ajoutez des artistes a vos favoris pour les retrouver facilement ici.',
        action: 'Decouvrir les artistes',
        route: '/(tabs)/program',
      },
      stages: {
        icon: 'radio-outline',
        title: 'Aucune scene favorite',
        description:
          'Ajoutez des scenes a vos favoris pour suivre leurs programmations.',
        action: 'Voir les scenes',
        route: '/(tabs)/map',
      },
      stands: {
        icon: 'storefront-outline',
        title: 'Aucun stand favori',
        description:
          'Ajoutez des stands a vos favoris pour y acceder rapidement.',
        action: 'Explorer la carte',
        route: '/(tabs)/map',
      },
      schedule: {
        icon: 'calendar-outline',
        title: 'Aucun concert a venir',
        description:
          'Ajoutez des artistes a vos favoris pour voir leur programme ici.',
        action: 'Decouvrir les artistes',
        route: '/(tabs)/program',
      },
    };

    const { icon, title, description, action, route } = config[type];

    return (
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Ionicons name={icon as any} size={40} color="#D1D5DB" />
        </View>
        <Text className="text-gray-900 text-lg font-semibold text-center">{title}</Text>
        <Text className="text-gray-500 text-center mt-2">{description}</Text>
        <TouchableOpacity
          onPress={() => router.push(route as any)}
          className="mt-6 bg-primary px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">{action}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'artists':
        if (favoriteArtistsData.length === 0) {
          return renderEmptyState('artists');
        }
        return (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {favoriteArtistsData.map(({ artist, nextPerformance, stage }) => (
              <FavoriteArtistCard
                key={artist!.id}
                artist={artist!}
                nextPerformance={nextPerformance}
                stage={stage}
              />
            ))}
          </ScrollView>
        );

      case 'stages':
        if (favoriteStagesData.length === 0) {
          return renderEmptyState('stages');
        }
        return (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {favoriteStagesData.map((stage) => (
              <TouchableOpacity
                key={stage!.id}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/map',
                    params: { stageId: stage!.id },
                  })
                }
                activeOpacity={0.7}
                className="bg-white rounded-xl p-4 mb-3 border border-gray-100"
              >
                <View className="flex-row items-center">
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center"
                    style={{ backgroundColor: `${stage!.color}20` }}
                  >
                    <Ionicons
                      name="radio-outline"
                      size={24}
                      color={stage!.color}
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="font-semibold text-gray-900 text-base">
                      {stage!.name}
                    </Text>
                    <Text className="text-gray-500 text-sm mt-0.5">
                      {stage!.description}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      useFavoritesStore.getState().toggleFavorite(stage!.id, 'stage');
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="p-2"
                  >
                    <Ionicons name="heart" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        );

      case 'stands':
        if (favoriteStandsData.length === 0) {
          return renderEmptyState('stands');
        }
        return (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {favoriteStandsData.map((stand) => (
              <FavoriteStandCard key={stand!.id} stand={stand!} />
            ))}
          </ScrollView>
        );

      case 'schedule':
        if (upcomingFavoriteSchedule.length === 0) {
          return renderEmptyState('schedule');
        }
        return (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Now Playing */}
            {upcomingFavoriteSchedule.filter((s) => s.isNowPlaying).length > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                  <Text className="text-sm font-semibold text-red-600">EN DIRECT</Text>
                </View>
                {upcomingFavoriteSchedule
                  .filter((s) => s.isNowPlaying)
                  .map(({ performance, artist, stage }) => (
                    <FavoriteArtistCompact
                      key={performance.id}
                      artist={artist}
                      performance={performance}
                      stage={stage}
                      isNowPlaying
                    />
                  ))}
              </View>
            )}

            {/* Upcoming */}
            <View>
              <Text className="text-sm font-semibold text-gray-600 mb-2">A VENIR</Text>
              {upcomingFavoriteSchedule
                .filter((s) => !s.isNowPlaying)
                .map(({ performance, artist, stage }) => (
                  <FavoriteArtistCompact
                    key={performance.id}
                    artist={artist}
                    performance={performance}
                    stage={stage}
                  />
                ))}
            </View>
          </ScrollView>
        );
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-2 pb-4 border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Favoris</Text>
            <Text className="text-gray-500 text-sm">
              {getFavoriteCount()} elements sauvegardes
            </Text>
          </View>
          {isSyncing && (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#6366F1" />
              <Text className="text-gray-500 text-xs ml-2">Sync...</Text>
            </View>
          )}
          {!isOnline && (
            <View className="flex-row items-center bg-yellow-100 px-2 py-1 rounded-full">
              <Ionicons name="cloud-offline-outline" size={14} color="#D97706" />
              <Text className="text-yellow-700 text-xs ml-1">Hors ligne</Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View className="flex-row bg-gray-100 rounded-xl p-1">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`flex-1 flex-row items-center justify-center py-2 rounded-lg ${
                activeTab === tab.key ? 'bg-white shadow-sm' : ''
              }`}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.key ? '#6366F1' : '#6B7280'}
              />
              {tab.count > 0 && (
                <View
                  className={`ml-1 px-1.5 py-0.5 rounded-full min-w-[18px] items-center ${
                    activeTab === tab.key ? 'bg-primary' : 'bg-gray-300'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      activeTab === tab.key ? 'text-white' : 'text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {renderTabContent()}
    </View>
  );
}
