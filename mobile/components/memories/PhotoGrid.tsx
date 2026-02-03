import { View, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface MediaItem {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  url: string;
  thumbnailUrl?: string;
  likeCount: number;
  isLiked?: boolean;
}

interface PhotoGridProps {
  items: MediaItem[];
  columns?: number;
  gap?: number;
  onItemPress?: (item: MediaItem) => void;
  showLikes?: boolean;
  showType?: boolean;
}

export function PhotoGrid({
  items,
  columns = 3,
  gap = 2,
  onItemPress,
  showLikes = true,
  showType = true,
}: PhotoGridProps) {
  const router = useRouter();
  const itemSize = (width - gap * (columns + 1)) / columns;

  const handlePress = (item: MediaItem) => {
    if (onItemPress) {
      onItemPress(item);
    } else {
      router.push(`/memories/${item.id}` as any);
    }
  };

  return (
    <View className="flex-row flex-wrap" style={{ padding: gap / 2 }}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => handlePress(item)}
          style={{
            width: itemSize,
            height: itemSize,
            margin: gap / 2,
          }}
          className="bg-gray-200 overflow-hidden"
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: item.thumbnailUrl || item.url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />

          {/* Video indicator */}
          {showType && item.type === 'VIDEO' && (
            <View className="absolute top-1 right-1 bg-black/60 rounded px-1.5 py-0.5 flex-row items-center">
              <Ionicons name="videocam" size={12} color="white" />
            </View>
          )}

          {/* Like indicator */}
          {showLikes && item.isLiked && (
            <View className="absolute bottom-1 left-1">
              <Ionicons name="heart" size={14} color="#EF4444" />
            </View>
          )}

          {/* Like count */}
          {showLikes && item.likeCount > 0 && (
            <View className="absolute bottom-1 right-1 bg-black/60 rounded px-1.5 py-0.5 flex-row items-center">
              <Ionicons name="heart" size={10} color="white" />
              <View className="ml-1">
                <View>
                  {/* Text component would cause issues without proper styling */}
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Skeleton loader for PhotoGrid
export function PhotoGridSkeleton({
  count = 9,
  columns = 3,
  gap = 2,
}: {
  count?: number;
  columns?: number;
  gap?: number;
}) {
  const itemSize = (width - gap * (columns + 1)) / columns;

  return (
    <View className="flex-row flex-wrap" style={{ padding: gap / 2 }}>
      {[...Array(count)].map((_, i) => (
        <View
          key={i}
          style={{
            width: itemSize,
            height: itemSize,
            margin: gap / 2,
          }}
          className="bg-gray-200 animate-pulse"
        />
      ))}
    </View>
  );
}
