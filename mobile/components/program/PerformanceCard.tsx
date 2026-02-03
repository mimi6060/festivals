import { TouchableOpacity, View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Artist, Performance, Stage } from '@/stores/lineupStore';
import { useFavoritesStore } from '@/stores/favoritesStore';

interface PerformanceCardProps {
  performance: Performance;
  artist: Artist;
  stage: Stage;
  isNowPlaying?: boolean;
  showStageName?: boolean;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

export function PerformanceCard({
  performance,
  artist,
  stage,
  isNowPlaying = false,
  showStageName = false,
}: PerformanceCardProps) {
  const router = useRouter();
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const favorited = isFavorite(artist.id, 'artist');

  const handlePress = () => {
    router.push(`/artist/${artist.id}`);
  };

  const handleFavoritePress = () => {
    toggleFavorite(artist.id, 'artist');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className={`bg-white rounded-xl p-4 mb-3 flex-row items-center ${
        isNowPlaying ? 'border-2 border-primary' : 'border border-gray-100'
      }`}
    >
      {/* Now Playing Indicator */}
      {isNowPlaying && (
        <View className="absolute -top-2 left-4 bg-primary px-2 py-0.5 rounded-full">
          <Text className="text-white text-xs font-semibold">EN DIRECT</Text>
        </View>
      )}

      {/* Artist Photo */}
      <View className="relative">
        <Image
          source={{ uri: artist.photo }}
          className="w-14 h-14 rounded-full bg-gray-200"
          defaultSource={require('@/assets/icon.png')}
        />
        {isNowPlaying && (
          <View className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
            <Ionicons name="musical-notes" size={12} color="white" />
          </View>
        )}
      </View>

      {/* Artist Info */}
      <View className="flex-1 ml-3">
        <Text className="font-semibold text-gray-900 text-base" numberOfLines={1}>
          {artist.name}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text className="text-gray-500 text-sm ml-1">
            {formatTime(performance.startTime)} - {formatTime(performance.endTime)}
          </Text>
          <Text className="text-gray-400 text-sm ml-1">
            ({getDuration(performance.startTime, performance.endTime)})
          </Text>
        </View>
        {showStageName && (
          <View className="flex-row items-center mt-0.5">
            <View
              className="w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: stage.color }}
            />
            <Text className="text-gray-500 text-sm">{stage.name}</Text>
          </View>
        )}
        <Text className="text-gray-400 text-xs mt-0.5">{artist.genre}</Text>
      </View>

      {/* Favorite Button */}
      <TouchableOpacity
        onPress={handleFavoritePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        className="p-2"
      >
        <Ionicons
          name={favorited ? 'heart' : 'heart-outline'}
          size={24}
          color={favorited ? '#EF4444' : '#9CA3AF'}
        />
      </TouchableOpacity>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export default PerformanceCard;
