import React from 'react';
import { TouchableOpacity, View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Artist, Performance, Stage, useLineupStore } from '@/stores/lineupStore';
import { useFavoritesStore } from '@/stores/favoritesStore';

interface FavoriteArtistCardProps {
  artist: Artist;
  nextPerformance?: Performance;
  stage?: Stage;
  onRemove?: () => void;
}

function formatDateTime(isoString: string): { date: string; time: string } {
  const dateObj = new Date(isoString);
  const date = dateObj.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = dateObj.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return { date, time };
}

export function FavoriteArtistCard({
  artist,
  nextPerformance,
  stage,
  onRemove,
}: FavoriteArtistCardProps) {
  const router = useRouter();
  const { toggleFavorite } = useFavoritesStore();

  const handlePress = () => {
    router.push(`/artist/${artist.id}`);
  };

  const handleRemoveFavorite = () => {
    toggleFavorite(artist.id, 'artist');
    onRemove?.();
  };

  const performanceInfo = nextPerformance ? formatDateTime(nextPerformance.startTime) : null;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100"
    >
      <View className="flex-row items-center">
        {/* Artist Photo */}
        <Image
          source={{ uri: artist.photo }}
          className="w-16 h-16 rounded-xl bg-gray-200"
          defaultSource={require('@/assets/icon.png')}
        />

        {/* Artist Info */}
        <View className="flex-1 ml-3">
          <Text className="font-semibold text-gray-900 text-base" numberOfLines={1}>
            {artist.name}
          </Text>
          <Text className="text-gray-500 text-sm mt-0.5">{artist.genre}</Text>

          {/* Next Performance */}
          {nextPerformance && stage && performanceInfo && (
            <View className="mt-2 flex-row items-center">
              <View
                className="w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: stage.color }}
              />
              <Text className="text-gray-600 text-xs">
                {performanceInfo.date} - {performanceInfo.time}
              </Text>
            </View>
          )}

          {/* No upcoming performance */}
          {!nextPerformance && (
            <View className="mt-2 flex-row items-center">
              <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
              <Text className="text-gray-400 text-xs ml-1">Pas de concert prevu</Text>
            </View>
          )}
        </View>

        {/* Favorite Button */}
        <TouchableOpacity
          onPress={handleRemoveFavorite}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="p-2"
        >
          <Ionicons name="heart" size={24} color="#EF4444" />
        </TouchableOpacity>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>

      {/* Stage info if available */}
      {nextPerformance && stage && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <View className="flex-row items-center">
            <Ionicons name="location-outline" size={14} color="#6B7280" />
            <Text className="text-gray-600 text-sm ml-1">{stage.name}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Compact version for schedule quick view
interface FavoriteArtistCompactProps {
  artist: Artist;
  performance: Performance;
  stage: Stage;
  isNowPlaying?: boolean;
  onPress?: () => void;
}

export function FavoriteArtistCompact({
  artist,
  performance,
  stage,
  isNowPlaying = false,
  onPress,
}: FavoriteArtistCompactProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/artist/${artist.id}`);
    }
  };

  const formatTime = (isoString: string): string => {
    return new Date(isoString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className={`bg-white rounded-lg p-3 mb-2 flex-row items-center ${
        isNowPlaying ? 'border-2 border-primary' : 'border border-gray-100'
      }`}
    >
      {/* Now Playing Indicator */}
      {isNowPlaying && (
        <View className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse" />
      )}

      {/* Stage Color Bar */}
      <View
        className="w-1 h-10 rounded-full mr-3"
        style={{ backgroundColor: stage.color }}
      />

      {/* Artist Info */}
      <View className="flex-1">
        <Text className="font-medium text-gray-900" numberOfLines={1}>
          {artist.name}
        </Text>
        <Text className="text-gray-500 text-xs">
          {formatTime(performance.startTime)} - {stage.name}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export default FavoriteArtistCard;
