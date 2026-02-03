import { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  Share,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const { width, height } = Dimensions.get('window');

interface MediaItem {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  url: string;
  thumbnailUrl?: string;
  originalName?: string;
  uploaderName?: string;
  likeCount: number;
  isLiked: boolean;
  viewCount?: number;
  createdAt: string;
  metadata?: {
    artistName?: string;
    stageName?: string;
    day?: number;
    description?: string;
  };
  tags?: string[];
}

interface PhotoViewerProps {
  visible: boolean;
  item: MediaItem | null;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export function PhotoViewer({
  visible,
  item,
  onClose,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}: PhotoViewerProps) {
  const queryClient = useQueryClient();
  const [showInfo, setShowInfo] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const likeMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      // In real app, call API
      await new Promise((resolve) => setTimeout(resolve, 300));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      // In real app, call API
      await new Promise((resolve) => setTimeout(resolve, 300));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });

  const handleLike = () => {
    if (!item) return;
    if (item.isLiked) {
      unlikeMutation.mutate(item.id);
    } else {
      likeMutation.mutate(item.id);
    }
  };

  const handleShare = async () => {
    if (!item) return;
    try {
      await Share.share({
        message: `Decouvre cette photo du festival!`,
        url: item.url,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'black',
          transform: [{ translateY }],
        }}
        {...panResponder.panHandlers}
      >
        {/* Header */}
        <View className="absolute top-0 left-0 right-0 z-10 pt-12 px-4 pb-4 bg-gradient-to-b from-black/70 to-transparent">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            <View className="flex-row items-center">
              <TouchableOpacity onPress={handleShare} className="p-2 mr-2">
                <Ionicons name="share-outline" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowInfo(!showInfo)}
                className="p-2"
              >
                <Ionicons
                  name={showInfo ? 'information-circle' : 'information-circle-outline'}
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Image */}
        <View className="flex-1 justify-center items-center">
          <Image
            source={{ uri: item.url }}
            style={{ width, height: height * 0.7 }}
            resizeMode="contain"
          />

          {/* Navigation arrows */}
          {hasPrevious && (
            <TouchableOpacity
              onPress={onPrevious}
              className="absolute left-4 top-1/2 -mt-6 bg-black/50 rounded-full p-2"
            >
              <Ionicons name="chevron-back" size={28} color="white" />
            </TouchableOpacity>
          )}
          {hasNext && (
            <TouchableOpacity
              onPress={onNext}
              className="absolute right-4 top-1/2 -mt-6 bg-black/50 rounded-full p-2"
            >
              <Ionicons name="chevron-forward" size={28} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* Footer */}
        <View className="absolute bottom-0 left-0 right-0 z-10 pb-12 px-4 pt-4 bg-gradient-to-t from-black/70 to-transparent">
          {/* Actions */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <TouchableOpacity onPress={handleLike} className="flex-row items-center">
                <Ionicons
                  name={item.isLiked ? 'heart' : 'heart-outline'}
                  size={28}
                  color={item.isLiked ? '#EF4444' : 'white'}
                />
                <Text className="text-white ml-2 font-medium">
                  {item.likeCount}
                </Text>
              </TouchableOpacity>
              {item.viewCount !== undefined && (
                <View className="flex-row items-center ml-6">
                  <Ionicons name="eye-outline" size={24} color="white" />
                  <Text className="text-white ml-2">{item.viewCount}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Info Panel */}
          {showInfo && (
            <View className="bg-white/10 rounded-xl p-4 mb-4">
              {item.uploaderName && (
                <View className="flex-row items-center mb-2">
                  <Ionicons name="person-outline" size={16} color="white" />
                  <Text className="text-white ml-2">{item.uploaderName}</Text>
                </View>
              )}
              <View className="flex-row items-center mb-2">
                <Ionicons name="calendar-outline" size={16} color="white" />
                <Text className="text-white ml-2">{formatDate(item.createdAt)}</Text>
              </View>
              {item.metadata?.stageName && (
                <View className="flex-row items-center mb-2">
                  <Ionicons name="location-outline" size={16} color="white" />
                  <Text className="text-white ml-2">{item.metadata.stageName}</Text>
                </View>
              )}
              {item.metadata?.artistName && (
                <View className="flex-row items-center mb-2">
                  <Ionicons name="musical-notes-outline" size={16} color="white" />
                  <Text className="text-white ml-2">{item.metadata.artistName}</Text>
                </View>
              )}
              {item.metadata?.day && (
                <View className="flex-row items-center mb-2">
                  <Ionicons name="today-outline" size={16} color="white" />
                  <Text className="text-white ml-2">Jour {item.metadata.day}</Text>
                </View>
              )}
              {item.metadata?.description && (
                <Text className="text-white/80 mt-2">{item.metadata.description}</Text>
              )}
              {item.tags && item.tags.length > 0 && (
                <View className="flex-row flex-wrap mt-2">
                  {item.tags.map((tag) => (
                    <View
                      key={tag}
                      className="bg-white/20 rounded-full px-2 py-1 mr-1 mb-1"
                    >
                      <Text className="text-white text-xs">#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}
