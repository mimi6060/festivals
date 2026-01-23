import { View, Text, ScrollView, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLineupStore, Performance } from '@/stores/lineupStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { DaySelector } from '@/components/program/DaySelector';
import { StageSection } from '@/components/program/StageSection';
import { PerformanceCard } from '@/components/program/PerformanceCard';

type ViewMode = 'stages' | 'timeline' | 'favorites';

export default function ProgramScreen() {
  const {
    days,
    stages,
    selectedDayIndex,
    searchQuery,
    isLoading,
    setSelectedDay,
    setSearchQuery,
    fetchLineup,
    getFilteredPerformances,
    getPerformancesByStage,
    getCurrentPerformance,
    getUpcomingPerformances,
    getArtistById,
    getStageById,
  } = useLineupStore();

  const { favoriteArtists, syncWithBackend } = useFavoritesStore();

  const [viewMode, setViewMode] = useState<ViewMode>('stages');
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Fetch lineup on mount
  useEffect(() => {
    fetchLineup('festival-1');
  }, []);

  // Get current performance for "now playing" highlight
  const currentPerformance = getCurrentPerformance();
  const upcomingPerformances = getUpcomingPerformances(3);

  // Get filtered performances for selected day
  const filteredPerformances = useMemo(() => {
    return getFilteredPerformances(selectedDayIndex, searchQuery);
  }, [selectedDayIndex, searchQuery, getFilteredPerformances]);

  // Group performances by stage for the selected day
  const performancesByStage = useMemo(() => {
    const result: { stage: typeof stages[0]; performances: Performance[] }[] = [];
    for (const stage of stages) {
      const stagePerformances = filteredPerformances.filter(
        (p) => p.stageId === stage.id
      );
      if (stagePerformances.length > 0) {
        result.push({ stage, performances: stagePerformances });
      }
    }
    return result;
  }, [stages, filteredPerformances]);

  // Get favorite artists' performances
  const favoritePerformances = useMemo(() => {
    return filteredPerformances.filter((p) => favoriteArtists.includes(p.artistId));
  }, [filteredPerformances, favoriteArtists]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchLineup('festival-1'),
      syncWithBackend('festival-1'),
    ]);
    setRefreshing(false);
  }, [fetchLineup, syncWithBackend]);

  const handleSearchToggle = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchQuery('');
    }
  };

  const renderViewModeSelector = () => (
    <View className="flex-row bg-gray-100 rounded-xl p-1 mx-4 mb-4">
      <TouchableOpacity
        onPress={() => setViewMode('stages')}
        className={`flex-1 py-2 rounded-lg ${viewMode === 'stages' ? 'bg-white shadow-sm' : ''}`}
      >
        <Text className={`text-center text-sm font-medium ${viewMode === 'stages' ? 'text-primary' : 'text-gray-500'}`}>
          Scenes
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setViewMode('timeline')}
        className={`flex-1 py-2 rounded-lg ${viewMode === 'timeline' ? 'bg-white shadow-sm' : ''}`}
      >
        <Text className={`text-center text-sm font-medium ${viewMode === 'timeline' ? 'text-primary' : 'text-gray-500'}`}>
          Horaires
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setViewMode('favorites')}
        className={`flex-1 py-2 rounded-lg flex-row items-center justify-center ${viewMode === 'favorites' ? 'bg-white shadow-sm' : ''}`}
      >
        <Ionicons
          name={viewMode === 'favorites' ? 'heart' : 'heart-outline'}
          size={14}
          color={viewMode === 'favorites' ? '#EF4444' : '#6B7280'}
        />
        <Text className={`text-center text-sm font-medium ml-1 ${viewMode === 'favorites' ? 'text-red-500' : 'text-gray-500'}`}>
          Favoris
        </Text>
        {favoriteArtists.length > 0 && (
          <View className="bg-red-500 rounded-full w-5 h-5 items-center justify-center ml-1">
            <Text className="text-white text-xs font-bold">{favoriteArtists.length}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderUpcomingSection = () => {
    if (upcomingPerformances.length === 0 && !currentPerformance) return null;

    return (
      <View className="mb-4">
        {currentPerformance && (
          <View className="mx-4 mb-3">
            <View className="flex-row items-center mb-2">
              <View className="w-2 h-2 rounded-full bg-danger mr-2 animate-pulse" />
              <Text className="text-sm font-semibold text-danger">EN DIRECT</Text>
            </View>
            {(() => {
              const artist = getArtistById(currentPerformance.artistId);
              const stage = getStageById(currentPerformance.stageId);
              if (!artist || !stage) return null;
              return (
                <PerformanceCard
                  performance={currentPerformance}
                  artist={artist}
                  stage={stage}
                  isNowPlaying
                  showStageName
                />
              );
            })()}
          </View>
        )}

        {upcomingPerformances.length > 0 && (
          <View className="mx-4">
            <Text className="text-sm font-semibold text-gray-600 mb-2">A VENIR</Text>
            {upcomingPerformances.slice(0, 2).map((performance) => {
              const artist = getArtistById(performance.artistId);
              const stage = getStageById(performance.stageId);
              if (!artist || !stage) return null;
              return (
                <PerformanceCard
                  key={performance.id}
                  performance={performance}
                  artist={artist}
                  stage={stage}
                  showStageName
                />
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading && !refreshing) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366F1" />
          <Text className="text-gray-500 mt-2">Chargement du programme...</Text>
        </View>
      );
    }

    if (viewMode === 'favorites') {
      if (favoriteArtists.length === 0) {
        return (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="heart-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-500 text-center mt-4 text-lg">
              Aucun artiste favori
            </Text>
            <Text className="text-gray-400 text-center mt-2">
              Appuyez sur le coeur pour ajouter des artistes a vos favoris
            </Text>
          </View>
        );
      }

      return (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Text className="text-sm font-semibold text-gray-600 mb-3">
            VOS FAVORIS ({favoritePerformances.length} performances)
          </Text>
          {favoritePerformances.map((performance) => {
            const artist = getArtistById(performance.artistId);
            const stage = getStageById(performance.stageId);
            if (!artist || !stage) return null;
            return (
              <PerformanceCard
                key={performance.id}
                performance={performance}
                artist={artist}
                stage={stage}
                isNowPlaying={currentPerformance?.id === performance.id}
                showStageName
              />
            );
          })}
        </ScrollView>
      );
    }

    if (viewMode === 'timeline') {
      return (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderUpcomingSection()}

          <Text className="text-sm font-semibold text-gray-600 mb-3 mt-2">
            PROGRAMME DU JOUR ({filteredPerformances.length})
          </Text>

          {filteredPerformances.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="search-outline" size={48} color="#D1D5DB" />
              <Text className="text-gray-500 mt-2">Aucun resultat</Text>
            </View>
          ) : (
            filteredPerformances.map((performance) => {
              const artist = getArtistById(performance.artistId);
              const stage = getStageById(performance.stageId);
              if (!artist || !stage) return null;
              return (
                <PerformanceCard
                  key={performance.id}
                  performance={performance}
                  artist={artist}
                  stage={stage}
                  isNowPlaying={currentPerformance?.id === performance.id}
                  showStageName
                />
              );
            })
          )}
        </ScrollView>
      );
    }

    // Default: stages view
    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderUpcomingSection()}

        {performancesByStage.length === 0 ? (
          <View className="items-center py-8">
            <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
            <Text className="text-gray-500 mt-2">
              {searchQuery ? 'Aucun resultat' : 'Programme a venir'}
            </Text>
          </View>
        ) : (
          performancesByStage.map(({ stage, performances }) => (
            <StageSection
              key={stage.id}
              stage={stage}
              performances={performances}
              currentPerformanceId={currentPerformance?.id}
            />
          ))
        )}
      </ScrollView>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Day Selector */}
      <DaySelector
        days={days}
        selectedIndex={selectedDayIndex}
        onSelectDay={setSelectedDay}
      />

      {/* Search Bar */}
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center">
          <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-3 py-2">
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              placeholder="Rechercher un artiste..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-2 text-gray-900"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* View Mode Selector */}
      <View className="pt-4">
        {renderViewModeSelector()}
      </View>

      {/* Content */}
      {renderContent()}
    </View>
  );
}
