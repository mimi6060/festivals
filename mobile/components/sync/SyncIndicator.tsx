import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSyncStatus } from '@/hooks/useNetworkSync';
import { SyncStatus } from '@/stores/syncStore';

interface SyncIndicatorProps {
  /** Whether to show the indicator when there's nothing to sync */
  showWhenEmpty?: boolean;
  /** Whether to show the last sync time */
  showLastSync?: boolean;
  /** Callback when the indicator is pressed */
  onPress?: () => void;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Style variant */
  variant?: 'minimal' | 'detailed' | 'badge';
}

// Format last sync time for display
const formatLastSync = (isoString: string | null): string => {
  if (!isoString) return 'Jamais';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "A l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Get status configuration
const getStatusConfig = (
  syncStatus: SyncStatus,
  isOnline: boolean,
  pendingCount: number
): {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  text: string;
} => {
  if (!isOnline) {
    return {
      icon: 'cloud-offline-outline',
      color: '#6B7280',
      bgColor: 'bg-gray-100',
      text: 'Hors ligne',
    };
  }

  if (syncStatus === 'syncing') {
    return {
      icon: 'sync-outline',
      color: '#3B82F6',
      bgColor: 'bg-blue-100',
      text: 'Synchronisation...',
    };
  }

  if (syncStatus === 'error') {
    return {
      icon: 'alert-circle-outline',
      color: '#EF4444',
      bgColor: 'bg-red-100',
      text: 'Erreur de sync',
    };
  }

  if (pendingCount > 0) {
    return {
      icon: 'time-outline',
      color: '#F59E0B',
      bgColor: 'bg-yellow-100',
      text: `${pendingCount} en attente`,
    };
  }

  return {
    icon: 'checkmark-circle-outline',
    color: '#10B981',
    bgColor: 'bg-green-100',
    text: 'Synchronise',
  };
};

/**
 * SyncIndicator - Shows sync status with pending count and last sync time
 */
export default function SyncIndicator({
  showWhenEmpty = false,
  showLastSync = true,
  onPress,
  size = 'medium',
  variant = 'detailed',
}: SyncIndicatorProps) {
  const { isOnline, isSyncing, syncStatus, pendingCount, lastSyncTime } = useSyncStatus();

  // Animation for syncing state
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [isSyncing, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Don't render if empty and showWhenEmpty is false
  if (!showWhenEmpty && pendingCount === 0 && syncStatus !== 'syncing' && isOnline) {
    return null;
  }

  const config = getStatusConfig(syncStatus, isOnline, pendingCount);

  // Size configuration
  const sizeConfig = {
    small: { iconSize: 14, textSize: 'text-xs', padding: 'px-2 py-1' },
    medium: { iconSize: 18, textSize: 'text-sm', padding: 'px-3 py-2' },
    large: { iconSize: 22, textSize: 'text-base', padding: 'px-4 py-3' },
  };

  const currentSize = sizeConfig[size];

  // Badge variant - compact circle with count
  if (variant === 'badge') {
    if (pendingCount === 0 && !isSyncing) {
      return null;
    }

    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        disabled={!onPress}
        className={`rounded-full ${config.bgColor} items-center justify-center`}
        style={{ width: size === 'small' ? 20 : size === 'medium' ? 24 : 28, height: size === 'small' ? 20 : size === 'medium' ? 24 : 28 }}
      >
        {isSyncing ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync-outline" size={currentSize.iconSize - 4} color={config.color} />
          </Animated.View>
        ) : (
          <Text className={`font-semibold ${currentSize.textSize}`} style={{ color: config.color }}>
            {pendingCount > 99 ? '99+' : pendingCount}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  // Minimal variant - icon only with optional count
  if (variant === 'minimal') {
    const content = (
      <View className={`flex-row items-center ${config.bgColor} rounded-full ${currentSize.padding}`}>
        {isSyncing ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name={config.icon} size={currentSize.iconSize} color={config.color} />
          </Animated.View>
        ) : (
          <Ionicons name={config.icon} size={currentSize.iconSize} color={config.color} />
        )}
        {pendingCount > 0 && (
          <Text className={`ml-1 font-medium ${currentSize.textSize}`} style={{ color: config.color }}>
            {pendingCount}
          </Text>
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

  // Detailed variant - full status with text
  const content = (
    <View className={`flex-row items-center ${config.bgColor} rounded-lg ${currentSize.padding}`}>
      <View className="flex-row items-center">
        {isSyncing ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name={config.icon} size={currentSize.iconSize} color={config.color} />
          </Animated.View>
        ) : (
          <Ionicons name={config.icon} size={currentSize.iconSize} color={config.color} />
        )}
        <Text className={`ml-2 font-medium ${currentSize.textSize}`} style={{ color: config.color }}>
          {config.text}
        </Text>
      </View>

      {showLastSync && lastSyncTime && !isSyncing && (
        <Text className={`ml-2 ${currentSize.textSize} text-gray-400`}>
          {formatLastSync(lastSyncTime)}
        </Text>
      )}

      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={currentSize.iconSize - 2}
          color="#9CA3AF"
          style={{ marginLeft: 4 }}
        />
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

/**
 * Compact sync badge for navigation headers
 */
export function SyncBadge({ onPress }: { onPress?: () => void }) {
  return <SyncIndicator variant="badge" size="small" onPress={onPress} showWhenEmpty={false} />;
}

/**
 * Sync status row for settings/profile screens
 */
export function SyncStatusRow({ onPress }: { onPress?: () => void }) {
  const { isOnline, syncStatus, pendingCount, lastSyncTime } = useSyncStatus();
  const config = getStatusConfig(syncStatus, isOnline, pendingCount);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className="flex-row items-center justify-between py-3 border-b border-gray-100"
    >
      <View className="flex-row items-center">
        <View className={`w-8 h-8 rounded-full items-center justify-center ${config.bgColor}`}>
          <Ionicons name={config.icon} size={18} color={config.color} />
        </View>
        <View className="ml-3">
          <Text className="font-medium text-gray-900">Synchronisation</Text>
          <Text className="text-gray-500 text-sm">{config.text}</Text>
        </View>
      </View>

      <View className="flex-row items-center">
        {lastSyncTime && (
          <Text className="text-gray-400 text-sm mr-2">{formatLastSync(lastSyncTime)}</Text>
        )}
        {onPress && <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />}
      </View>
    </TouchableOpacity>
  );
}
