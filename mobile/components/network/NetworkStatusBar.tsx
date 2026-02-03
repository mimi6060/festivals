import React, { useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withRepeat,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSyncStore } from '@/stores/syncStore';

export type NetworkStatusBarVariant = 'offline' | 'syncing' | 'pending' | 'error' | 'hidden';

interface NetworkStatusBarProps {
  /** Whether to show details modal on tap */
  showDetailsOnTap?: boolean;
  /** Callback when bar is tapped */
  onPress?: () => void;
  /** Custom z-index for the bar */
  zIndex?: number;
  /** Auto-hide delay after syncing completes (ms) */
  autoHideDelay?: number;
}

// Status configuration
const STATUS_CONFIG: Record<
  Exclude<NetworkStatusBarVariant, 'hidden'>,
  {
    backgroundColor: string;
    textColor: string;
    icon: keyof typeof Ionicons.glyphMap;
    text: string;
  }
> = {
  offline: {
    backgroundColor: '#EF4444',
    textColor: '#FFFFFF',
    icon: 'cloud-offline-outline',
    text: 'Hors ligne',
  },
  syncing: {
    backgroundColor: '#F59E0B',
    textColor: '#FFFFFF',
    icon: 'sync-outline',
    text: 'Synchronisation...',
  },
  pending: {
    backgroundColor: '#F59E0B',
    textColor: '#FFFFFF',
    icon: 'time-outline',
    text: 'En attente de sync',
  },
  error: {
    backgroundColor: '#EF4444',
    textColor: '#FFFFFF',
    icon: 'alert-circle-outline',
    text: 'Erreur de synchronisation',
  },
};

const AUTO_HIDE_DELAY = 3000;
const BAR_HEIGHT = 32;

/**
 * NetworkStatusBar - Animated bar at top of screen showing network/sync status
 * Shows when offline (red), syncing (yellow), or has pending changes
 * Auto-hides when online and synced
 */
export default function NetworkStatusBar({
  showDetailsOnTap = true,
  onPress,
  zIndex = 1000,
  autoHideDelay = AUTO_HIDE_DELAY,
}: NetworkStatusBarProps) {
  const insets = useSafeAreaInsets();
  const { isConnected, pendingCount, isSyncing, syncStatus } = useNetworkStatus();
  const { syncError } = useSyncStore();

  // Animation values
  const translateY = useSharedValue(-BAR_HEIGHT - insets.top);
  const opacity = useSharedValue(0);
  const iconRotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  // Determine current variant
  const getVariant = useCallback((): NetworkStatusBarVariant => {
    if (!isConnected) return 'offline';
    if (syncStatus === 'error' || syncError) return 'error';
    if (isSyncing) return 'syncing';
    if (pendingCount > 0) return 'pending';
    return 'hidden';
  }, [isConnected, isSyncing, syncStatus, syncError, pendingCount]);

  const variant = getVariant();

  // Show/hide animation
  useEffect(() => {
    if (variant === 'hidden') {
      // Slide up and fade out
      translateY.value = withTiming(-BAR_HEIGHT - insets.top, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
      opacity.value = withTiming(0, { duration: 200 });
    } else {
      // Slide down and fade in
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      });
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [variant, insets.top, translateY, opacity]);

  // Syncing icon rotation animation
  useEffect(() => {
    if (isSyncing) {
      iconRotation.value = withRepeat(
        withTiming(360, {
          duration: 1000,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      iconRotation.value = withTiming(0, { duration: 200 });
    }
  }, [isSyncing, iconRotation]);

  // Pulse animation for pending state
  useEffect(() => {
    if (variant === 'pending') {
      pulseScale.value = withRepeat(
        withTiming(1.05, {
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [variant, pulseScale]);

  // Animated styles
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotation.value}deg` }],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Don't render if hidden
  if (variant === 'hidden') {
    return null;
  }

  const config = STATUS_CONFIG[variant];

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  return (
    <Animated.View
      style={[
        containerAnimatedStyle,
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex,
          paddingTop: insets.top,
          backgroundColor: config.backgroundColor,
        },
      ]}
    >
      <Pressable
        onPress={showDetailsOnTap ? handlePress : undefined}
        disabled={!showDetailsOnTap && !onPress}
      >
        <Animated.View
          style={[
            contentAnimatedStyle,
            {
              height: BAR_HEIGHT,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 16,
            },
          ]}
        >
          <Animated.View style={iconAnimatedStyle}>
            <Ionicons name={config.icon} size={16} color={config.textColor} />
          </Animated.View>

          <Text
            style={{
              marginLeft: 8,
              color: config.textColor,
              fontSize: 13,
              fontWeight: '600',
            }}
          >
            {config.text}
          </Text>

          {pendingCount > 0 && variant !== 'offline' && (
            <View
              style={{
                marginLeft: 8,
                backgroundColor: 'rgba(255,255,255,0.3)',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  color: config.textColor,
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                {pendingCount}
              </Text>
            </View>
          )}

          {showDetailsOnTap && (
            <Ionicons
              name="chevron-down"
              size={14}
              color={config.textColor}
              style={{ marginLeft: 4, opacity: 0.8 }}
            />
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Compact status indicator for headers
 */
export function NetworkStatusIndicator({
  onPress,
  size = 'medium',
}: {
  onPress?: () => void;
  size?: 'small' | 'medium';
}) {
  const { isConnected, isSyncing, pendingCount, syncStatus } = useNetworkStatus();
  const { syncError } = useSyncStore();

  const iconRotation = useSharedValue(0);

  useEffect(() => {
    if (isSyncing) {
      iconRotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      iconRotation.value = 0;
    }
  }, [isSyncing, iconRotation]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotation.value}deg` }],
  }));

  // Determine status
  let icon: keyof typeof Ionicons.glyphMap;
  let color: string;

  if (!isConnected) {
    icon = 'cloud-offline-outline';
    color = '#EF4444';
  } else if (syncStatus === 'error' || syncError) {
    icon = 'alert-circle-outline';
    color = '#EF4444';
  } else if (isSyncing) {
    icon = 'sync-outline';
    color = '#F59E0B';
  } else if (pendingCount > 0) {
    icon = 'time-outline';
    color = '#F59E0B';
  } else {
    icon = 'checkmark-circle-outline';
    color = '#10B981';
  }

  const iconSize = size === 'small' ? 18 : 22;

  const content = (
    <View style={{ position: 'relative' }}>
      <Animated.View style={isSyncing ? iconAnimatedStyle : undefined}>
        <Ionicons name={icon} size={iconSize} color={color} />
      </Animated.View>

      {pendingCount > 0 && !isSyncing && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 9,
              fontWeight: '700',
            }}
          >
            {pendingCount > 99 ? '99+' : pendingCount}
          </Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
