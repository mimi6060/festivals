import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Animated, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFavoritesStore } from '@/stores/favoritesStore';

interface FavoriteButtonProps {
  artistId: string;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
  style?: ViewStyle;
  onToggle?: (isFavorite: boolean) => void;
}

export function FavoriteButton({
  artistId,
  size = 24,
  activeColor = '#EF4444',
  inactiveColor = '#9CA3AF',
  style,
  onToggle,
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const favorited = isFavorite(artistId, 'artist');

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const burstScale = useRef(new Animated.Value(0)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;

  // Reset burst animation when favorite state changes
  useEffect(() => {
    burstScale.setValue(0);
    burstOpacity.setValue(0);
  }, [favorited]);

  const handlePress = async () => {
    // Haptic feedback
    try {
      await Haptics.impactAsync(
        favorited ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
      );
    } catch (e) {
      // Haptics not available
    }

    // Main button animation
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.6,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Burst animation only when adding to favorites
    if (!favorited) {
      Animated.parallel([
        Animated.timing(burstScale, {
          toValue: 2.5,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(burstOpacity, {
            toValue: 0.4,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(burstOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }

    // Toggle favorite
    toggleFavorite(artistId, 'artist');

    // Callback
    onToggle?.(!favorited);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={1}
      style={[styles.container, style]}
    >
      {/* Burst effect circle */}
      <Animated.View
        style={[
          styles.burst,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: activeColor,
            transform: [{ scale: burstScale }],
            opacity: burstOpacity,
          },
        ]}
      />

      {/* Heart icon */}
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }}
      >
        <Ionicons
          name={favorited ? 'heart' : 'heart-outline'}
          size={size}
          color={favorited ? activeColor : inactiveColor}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// Compact version for list items
interface FavoriteButtonCompactProps {
  artistId: string;
  onToggle?: (isFavorite: boolean) => void;
}

export function FavoriteButtonCompact({ artistId, onToggle }: FavoriteButtonCompactProps) {
  return (
    <FavoriteButton
      artistId={artistId}
      size={20}
      onToggle={onToggle}
      style={{ padding: 4 }}
    />
  );
}

// Large version for detail screens
interface FavoriteButtonLargeProps {
  artistId: string;
  showLabel?: boolean;
  onToggle?: (isFavorite: boolean) => void;
}

export function FavoriteButtonLarge({
  artistId,
  showLabel = true,
  onToggle,
}: FavoriteButtonLargeProps) {
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const favorited = isFavorite(artistId, 'artist');
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
        toValue: 0.9,
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

    toggleFavorite(artistId, 'artist');
    onToggle?.(!favorited);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={[
          styles.largeButton,
          favorited ? styles.largeButtonActive : styles.largeButtonInactive,
        ]}
      >
        <Ionicons
          name={favorited ? 'heart' : 'heart-outline'}
          size={24}
          color={favorited ? '#FFFFFF' : '#EF4444'}
        />
        {showLabel && (
          <Animated.Text
            style={[
              styles.largeButtonText,
              favorited ? styles.largeButtonTextActive : styles.largeButtonTextInactive,
            ]}
          >
            {favorited ? 'Favori' : 'Ajouter aux favoris'}
          </Animated.Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  burst: {
    position: 'absolute',
  },
  largeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  largeButtonActive: {
    backgroundColor: '#EF4444',
  },
  largeButtonInactive: {
    backgroundColor: '#FEE2E2',
  },
  largeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  largeButtonTextActive: {
    color: '#FFFFFF',
  },
  largeButtonTextInactive: {
    color: '#EF4444',
  },
});

export default FavoriteButton;
