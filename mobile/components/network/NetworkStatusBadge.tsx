import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export type NetworkState = 'online' | 'offline' | 'syncing' | 'pending' | 'error';

interface NetworkStatusBadgeProps {
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Whether to show text label */
  showLabel?: boolean;
  /** Custom label text (overrides default) */
  label?: string;
  /** Whether to show animated pulse when syncing */
  animated?: boolean;
  /** Callback when badge is pressed */
  onPress?: () => void;
  /** Style override for container */
  style?: object;
}

// Configuration for each network state
const STATE_CONFIG: Record<
  NetworkState,
  {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  online: {
    icon: 'checkmark-circle',
    color: '#10B981',
    bgColor: '#D1FAE5',
    label: 'En ligne',
  },
  offline: {
    icon: 'cloud-offline',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    label: 'Hors ligne',
  },
  syncing: {
    icon: 'sync',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    label: 'Sync...',
  },
  pending: {
    icon: 'time',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    label: 'En attente',
  },
  error: {
    icon: 'alert-circle',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    label: 'Erreur',
  },
};

// Size configurations
const SIZE_CONFIG = {
  small: {
    iconSize: 12,
    fontSize: 10,
    paddingH: 6,
    paddingV: 2,
    badgeSize: 8,
    gap: 3,
  },
  medium: {
    iconSize: 14,
    fontSize: 12,
    paddingH: 8,
    paddingV: 4,
    badgeSize: 10,
    gap: 4,
  },
  large: {
    iconSize: 18,
    fontSize: 14,
    paddingH: 12,
    paddingV: 6,
    badgeSize: 12,
    gap: 6,
  },
};

/**
 * NetworkStatusBadge - Small badge showing network status
 * Ideal for headers, cards, or anywhere compact status indication is needed
 */
export default function NetworkStatusBadge({
  size = 'medium',
  showLabel = true,
  label,
  animated = true,
  onPress,
  style,
}: NetworkStatusBadgeProps) {
  const { isConnected, isSyncing, pendingCount, syncStatus } = useNetworkStatus();

  // Animation values
  const rotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  // Determine current state
  const getState = (): NetworkState => {
    if (!isConnected) return 'offline';
    if (syncStatus === 'error') return 'error';
    if (isSyncing) return 'syncing';
    if (pendingCount > 0) return 'pending';
    return 'online';
  };

  const state = getState();
  const config = STATE_CONFIG[state];
  const sizeConfig = SIZE_CONFIG[size];

  // Rotation animation for syncing state
  useEffect(() => {
    if (state === 'syncing' && animated) {
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 1000,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      rotation.value = withTiming(0, { duration: 200 });
    }
  }, [state, animated, rotation]);

  // Pulse animation for syncing and pending states
  useEffect(() => {
    if ((state === 'syncing' || state === 'pending') && animated) {
      // Pulse scale
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 500, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 500, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );

      // Pulse opacity
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 500 }),
          withTiming(0, { duration: 500 })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = 1;
      pulseOpacity.value = 0;
    }
  }, [state, animated, pulseScale, pulseOpacity]);

  // Animated styles
  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const displayLabel = label ?? config.label;

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.bgColor,
          paddingHorizontal: sizeConfig.paddingH,
          paddingVertical: sizeConfig.paddingV,
        },
        style,
      ]}
    >
      {/* Pulse effect background */}
      {animated && (state === 'syncing' || state === 'pending') && (
        <Animated.View
          style={[
            styles.pulseRing,
            pulseAnimatedStyle,
            {
              backgroundColor: config.color,
              borderRadius: 100,
            },
          ]}
        />
      )}

      <View style={[styles.content, { gap: sizeConfig.gap }]}>
        <Animated.View style={state === 'syncing' ? iconAnimatedStyle : undefined}>
          <Ionicons
            name={config.icon}
            size={sizeConfig.iconSize}
            color={config.color}
          />
        </Animated.View>

        {showLabel && (
          <Text
            style={[
              styles.label,
              {
                color: config.color,
                fontSize: sizeConfig.fontSize,
              },
            ]}
          >
            {displayLabel}
          </Text>
        )}

        {pendingCount > 0 && state !== 'syncing' && (
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: config.color,
                minWidth: sizeConfig.badgeSize + 4,
                height: sizeConfig.badgeSize + 4,
                borderRadius: (sizeConfig.badgeSize + 4) / 2,
              },
            ]}
          >
            <Text
              style={[
                styles.countText,
                {
                  fontSize: sizeConfig.fontSize - 2,
                },
              ]}
            >
              {pendingCount > 99 ? '99+' : pendingCount}
            </Text>
          </View>
        )}
      </View>
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

/**
 * Minimal dot indicator for tight spaces
 */
export function NetworkDot({
  size = 8,
  onPress,
}: {
  size?: number;
  onPress?: () => void;
}) {
  const { isConnected, isSyncing, pendingCount, syncStatus } = useNetworkStatus();

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  // Determine color
  let color: string;
  if (!isConnected) {
    color = '#EF4444';
  } else if (syncStatus === 'error') {
    color = '#EF4444';
  } else if (isSyncing || pendingCount > 0) {
    color = '#F59E0B';
  } else {
    color = '#10B981';
  }

  const shouldPulse = isSyncing || pendingCount > 0;

  useEffect(() => {
    if (shouldPulse) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 600 }),
          withTiming(0, { duration: 600 })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = 1;
      pulseOpacity.value = 0;
    }
  }, [shouldPulse, pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const content = (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      {/* Pulse ring */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          pulseStyle,
        ]}
      />
      {/* Solid dot */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
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

/**
 * Icon-only badge variant
 */
export function NetworkIcon({
  size = 20,
  onPress,
}: {
  size?: number;
  onPress?: () => void;
}) {
  const { isConnected, isSyncing, syncStatus, pendingCount } = useNetworkStatus();
  const rotation = useSharedValue(0);

  // Determine icon and color
  let icon: keyof typeof Ionicons.glyphMap;
  let color: string;

  if (!isConnected) {
    icon = 'cloud-offline';
    color = '#EF4444';
  } else if (syncStatus === 'error') {
    icon = 'alert-circle';
    color = '#EF4444';
  } else if (isSyncing) {
    icon = 'sync';
    color = '#F59E0B';
  } else if (pendingCount > 0) {
    icon = 'time';
    color = '#F59E0B';
  } else {
    icon = 'checkmark-circle';
    color = '#10B981';
  }

  useEffect(() => {
    if (isSyncing) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotation.value = withTiming(0, { duration: 200 });
    }
  }, [isSyncing, rotation]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const content = (
    <Animated.View style={isSyncing ? iconStyle : undefined}>
      <Ionicons name={icon} size={size} color={color} />
    </Animated.View>
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

const styles = StyleSheet.create({
  container: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: '600',
  },
  countBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pulseRing: {
    ...StyleSheet.absoluteFillObject,
  },
});
