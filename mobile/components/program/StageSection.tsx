import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Performance, Stage, useLineupStore } from '@/stores/lineupStore';
import { PerformanceCard } from './PerformanceCard';

interface StageSectionProps {
  stage: Stage;
  performances: Performance[];
  currentPerformanceId?: string | null;
}

export function StageSection({ stage, performances, currentPerformanceId }: StageSectionProps) {
  const { getArtistById } = useLineupStore();

  if (performances.length === 0) {
    return null;
  }

  return (
    <View className="mb-6">
      {/* Stage Header */}
      <View className="flex-row items-center mb-3 px-1">
        <View
          className="w-4 h-4 rounded-full mr-2"
          style={{ backgroundColor: stage.color }}
        />
        <Ionicons name="musical-notes" size={18} color={stage.color} />
        <Text className="text-lg font-semibold text-gray-800 ml-2">
          {stage.name}
        </Text>
        <View className="bg-gray-200 rounded-full px-2 py-0.5 ml-2">
          <Text className="text-xs text-gray-600">{performances.length}</Text>
        </View>
      </View>

      {/* Stage Description */}
      {stage.description && (
        <Text className="text-gray-500 text-sm mb-3 px-1">{stage.location}</Text>
      )}

      {/* Performances List */}
      {performances.map((performance) => {
        const artist = getArtistById(performance.artistId);
        if (!artist) return null;

        const isNowPlaying = currentPerformanceId === performance.id;

        return (
          <PerformanceCard
            key={performance.id}
            performance={performance}
            artist={artist}
            stage={stage}
            isNowPlaying={isNowPlaying}
          />
        );
      })}
    </View>
  );
}

export default StageSection;
