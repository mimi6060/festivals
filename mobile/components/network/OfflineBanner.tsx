import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutUp,
} from 'react-native-reanimated';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSyncStore } from '@/stores/syncStore';

interface OfflineBannerProps {
  /** Whether to show pending transaction count */
  showPendingCount?: boolean;
  /** Custom message to display */
  message?: string;
  /** Whether to show sync button when back online */
  showSyncButton?: boolean;
  /** Callback when banner is tapped */
  onPress?: () => void;
  /** Callback when sync button is pressed */
  onSyncPress?: () => void;
  /** Whether banner is dismissible */
  dismissible?: boolean;
  /** Callback when banner is dismissed */
  onDismiss?: () => void;
  /** Style override for container */
  style?: object;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * OfflineBanner - Full-width banner for offline mode indication
 * Shows when device is offline with pending transaction information
 */
export default function OfflineBanner({
  showPendingCount = true,
  message,
  showSyncButton = true,
  onPress,
  onSyncPress,
  dismissible = false,
  onDismiss,
  style,
}: OfflineBannerProps) {
  const { isConnected, pendingCount, isSyncing } = useNetworkStatus();
  const { syncPendingTransactions } = useSyncStore();

  // Animation values
  const iconBounce = useSharedValue(0);
  const pulseOpacity = useSharedValue(0);

  // Animate offline icon bounce
  useEffect(() => {
    if (!isConnected) {
      iconBounce.value = withRepeat(
        withSequence(
          withTiming(-3, { duration: 500, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 500, easing: Easing.in(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      iconBounce.value = withTiming(0, { duration: 200 });
    }
  }, [isConnected, iconBounce]);

  // Pulse when there are pending transactions
  useEffect(() => {
    if (pendingCount > 0 && !isConnected) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 1000 }),
          withTiming(0, { duration: 1000 })
        ),
        -1,
        false
      );
    } else {
      pulseOpacity.value = 0;
    }
  }, [pendingCount, isConnected, pulseOpacity]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: iconBounce.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // Don't render if online and no pending transactions
  if (isConnected && pendingCount === 0) {
    return null;
  }

  // Handle sync button press
  const handleSyncPress = async () => {
    if (onSyncPress) {
      onSyncPress();
    } else if (isConnected && pendingCount > 0) {
      await syncPendingTransactions();
    }
  };

  // Determine banner state
  const isOffline = !isConnected;
  const hasPending = pendingCount > 0;
  const canSync = isConnected && hasPending && !isSyncing;

  // Banner message
  const displayMessage = message ?? (
    isOffline
      ? 'Vous etes hors ligne'
      : hasPending
        ? 'Des modifications sont en attente'
        : 'Connecte'
  );

  // Sub-message
  const subMessage = isOffline && hasPending
    ? `${pendingCount} modification${pendingCount > 1 ? 's' : ''} seront synchronisee${pendingCount > 1 ? 's' : ''} a la reconnexion`
    : isOffline
      ? 'Les modifications seront synchronisees a la reconnexion'
      : hasPending
        ? 'Appuyez sur Sync pour synchroniser'
        : undefined;

  return (
    <Animated.View
      entering={SlideInUp.duration(300).springify()}
      exiting={SlideOutUp.duration(200)}
      style={[styles.container, style]}
    >
      {/* Pulse background effect */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.pulseBackground,
          pulseAnimatedStyle,
        ]}
      />

      <TouchableOpacity
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.8 : 1}
        style={styles.content}
      >
        {/* Icon */}
        <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
          <View style={[styles.iconCircle, isOffline ? styles.iconCircleOffline : styles.iconCirclePending]}>
            <Ionicons
              name={isOffline ? 'cloud-offline' : 'time'}
              size={20}
              color="#FFFFFF"
            />
          </View>
        </Animated.View>

        {/* Text content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{displayMessage}</Text>
          {subMessage && (
            <Text style={styles.subtitle}>{subMessage}</Text>
          )}
        </View>

        {/* Right side content */}
        <View style={styles.rightContainer}>
          {/* Pending count badge */}
          {showPendingCount && hasPending && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingCount}>
                {pendingCount > 99 ? '99+' : pendingCount}
              </Text>
            </View>
          )}

          {/* Sync button */}
          {showSyncButton && canSync && (
            <TouchableOpacity
              onPress={handleSyncPress}
              style={styles.syncButton}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isSyncing ? 'sync' : 'refresh'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.syncButtonText}>Sync</Text>
            </TouchableOpacity>
          )}

          {/* Syncing indicator */}
          {isSyncing && (
            <View style={styles.syncingContainer}>
              <SyncingSpinner size={18} />
              <Text style={styles.syncingText}>Sync...</Text>
            </View>
          )}

          {/* Dismiss button */}
          {dismissible && (
            <TouchableOpacity
              onPress={onDismiss}
              style={styles.dismissButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Compact offline indicator
 */
export function OfflineIndicator({
  onPress,
  showWhenOnline = false,
}: {
  onPress?: () => void;
  showWhenOnline?: boolean;
}) {
  const { isConnected, pendingCount } = useNetworkStatus();

  if (isConnected && !showWhenOnline) {
    return null;
  }

  const hasIssues = !isConnected || pendingCount > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      style={[
        styles.indicator,
        hasIssues ? styles.indicatorOffline : styles.indicatorOnline,
      ]}
    >
      <Ionicons
        name={isConnected ? 'cloud-done' : 'cloud-offline'}
        size={14}
        color="#FFFFFF"
      />
      <Text style={styles.indicatorText}>
        {isConnected ? 'En ligne' : 'Hors ligne'}
      </Text>
      {pendingCount > 0 && (
        <View style={styles.indicatorBadge}>
          <Text style={styles.indicatorBadgeText}>{pendingCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * Animated syncing spinner
 */
function SyncingSpinner({ size = 20 }: { size?: number }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={spinnerStyle}>
      <Ionicons name="sync" size={size} color="#FFFFFF" />
    </Animated.View>
  );
}

/**
 * Minimal offline strip - very compact banner
 */
export function OfflineStrip() {
  const { isConnected } = useNetworkStatus();

  if (isConnected) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={styles.strip}
    >
      <Ionicons name="cloud-offline" size={12} color="#FFFFFF" />
      <Text style={styles.stripText}>Hors ligne</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2937',
    overflow: 'hidden',
  },
  pulseBackground: {
    backgroundColor: '#F59E0B',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleOffline: {
    backgroundColor: '#EF4444',
  },
  iconCirclePending: {
    backgroundColor: '#F59E0B',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  syncButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncingText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 4,
  },
  // Compact indicator styles
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  indicatorOffline: {
    backgroundColor: '#EF4444',
  },
  indicatorOnline: {
    backgroundColor: '#10B981',
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  indicatorBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 2,
  },
  indicatorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Minimal strip styles
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 4,
    gap: 6,
  },
  stripText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
