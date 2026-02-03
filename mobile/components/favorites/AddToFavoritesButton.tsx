import React from 'react';
import { TouchableOpacity, View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFavoritesStore, FavoriteType } from '@/stores/favoritesStore';
import * as Haptics from 'expo-haptics';

interface AddToFavoritesButtonProps {
  itemId: string;
  itemType: FavoriteType;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon' | 'button' | 'pill';
  showLabel?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  onToggle?: (isFavorite: boolean) => void;
}

export function AddToFavoritesButton({
  itemId,
  itemType,
  size = 'medium',
  variant = 'icon',
  showLabel = false,
  activeColor = '#EF4444',
  inactiveColor = '#9CA3AF',
  onToggle,
}: AddToFavoritesButtonProps) {
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const favorited = isFavorite(itemId, itemType);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const sizeConfig = {
    small: { icon: 18, padding: 6, fontSize: 'text-xs' },
    medium: { icon: 24, padding: 8, fontSize: 'text-sm' },
    large: { icon: 32, padding: 12, fontSize: 'text-base' },
  };

  const config = sizeConfig[size];

  const handlePress = async () => {
    // Haptic feedback
    try {
      await Haptics.impactAsync(
        favorited ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
      );
    } catch (e) {
      // Haptics not available
    }

    // Animate the button
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Toggle favorite
    toggleFavorite(itemId, itemType);

    // Callback
    onToggle?.(!favorited);
  };

  const getLabel = (): string => {
    switch (itemType) {
      case 'artist':
        return favorited ? 'Artiste favori' : 'Ajouter aux favoris';
      case 'stage':
        return favorited ? 'Scene favorite' : 'Ajouter aux favoris';
      case 'stand':
        return favorited ? 'Stand favori' : 'Ajouter aux favoris';
      default:
        return favorited ? 'Favori' : 'Ajouter';
    }
  };

  // Icon-only variant
  if (variant === 'icon') {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={handlePress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ padding: config.padding }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={favorited ? 'heart' : 'heart-outline'}
            size={config.icon}
            color={favorited ? activeColor : inactiveColor}
          />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Pill variant
  if (variant === 'pill') {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.7}
          className={`flex-row items-center px-3 py-1.5 rounded-full ${
            favorited ? 'bg-red-100' : 'bg-gray-100'
          }`}
        >
          <Ionicons
            name={favorited ? 'heart' : 'heart-outline'}
            size={config.icon - 4}
            color={favorited ? activeColor : inactiveColor}
          />
          {showLabel && (
            <Text
              className={`ml-1.5 font-medium ${config.fontSize} ${
                favorited ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              {favorited ? 'Favori' : 'Ajouter'}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Button variant
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        className={`flex-row items-center justify-center px-4 py-2.5 rounded-xl ${
          favorited ? 'bg-red-500' : 'bg-gray-100'
        }`}
      >
        <Ionicons
          name={favorited ? 'heart' : 'heart-outline'}
          size={config.icon - 2}
          color={favorited ? '#FFFFFF' : inactiveColor}
        />
        <Text
          className={`ml-2 font-semibold ${config.fontSize} ${
            favorited ? 'text-white' : 'text-gray-700'
          }`}
        >
          {getLabel()}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Floating action button variant for use in detail screens
interface FloatingFavoriteButtonProps {
  itemId: string;
  itemType: FavoriteType;
  onToggle?: (isFavorite: boolean) => void;
}

export function FloatingFavoriteButton({
  itemId,
  itemType,
  onToggle,
}: FloatingFavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const favorited = isFavorite(itemId, itemType);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = async () => {
    try {
      await Haptics.impactAsync(
        favorited ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
      );
    } catch (e) {
      // Haptics not available
    }

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    toggleFavorite(itemId, itemType);
    onToggle?.(!favorited);
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        position: 'absolute',
        right: 16,
        bottom: 16,
      }}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        className={`w-14 h-14 rounded-full items-center justify-center shadow-lg ${
          favorited ? 'bg-red-500' : 'bg-white'
        }`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons
          name={favorited ? 'heart' : 'heart-outline'}
          size={28}
          color={favorited ? '#FFFFFF' : '#EF4444'}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

// Badge showing favorite count
interface FavoriteCountBadgeProps {
  type?: FavoriteType;
  showZero?: boolean;
}

export function FavoriteCountBadge({ type, showZero = false }: FavoriteCountBadgeProps) {
  const { getFavoriteCount } = useFavoritesStore();
  const count = getFavoriteCount(type);

  if (count === 0 && !showZero) return null;

  return (
    <View className="bg-red-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1.5">
      <Text className="text-white text-xs font-bold">{count}</Text>
    </View>
  );
}

export default AddToFavoritesButton;
