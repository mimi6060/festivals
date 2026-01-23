import { useCallback, useRef, ReactNode } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollViewProps,
  FlatList,
  FlatListProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Theme colors
const THEME = {
  primary: '#6366F1',
  background: '#F9FAFB',
};

export interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  refreshing?: boolean;
  tintColor?: string;
  title?: string;
  progressViewOffset?: number;
  style?: ScrollViewProps['style'];
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  showsVerticalScrollIndicator?: boolean;
  bounces?: boolean;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  scrollEnabled?: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

/**
 * Pull to refresh wrapper with consistent styling
 * Wraps children in a ScrollView with RefreshControl
 */
export function PullToRefresh({
  children,
  onRefresh,
  refreshing = false,
  tintColor = THEME.primary,
  progressViewOffset = 0,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator = true,
  bounces = true,
  keyboardShouldPersistTaps = 'handled',
  scrollEnabled = true,
  onScroll,
}: PullToRefreshProps) {
  const handleRefresh = useCallback(async () => {
    await onRefresh();
  }, [onRefresh]);

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: THEME.background }, style]}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      bounces={bounces}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEnabled={scrollEnabled}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={tintColor}
          colors={[tintColor]}
          progressViewOffset={progressViewOffset}
        />
      }
    >
      {children}
    </ScrollView>
  );
}

/**
 * Pull to refresh for FlatList with consistent styling
 */
export interface PullToRefreshListProps<T> extends Omit<FlatListProps<T>, 'refreshControl'> {
  onRefresh: () => Promise<void> | void;
  refreshing?: boolean;
  tintColor?: string;
  progressViewOffset?: number;
}

export function PullToRefreshList<T>({
  onRefresh,
  refreshing = false,
  tintColor = THEME.primary,
  progressViewOffset = 0,
  style,
  ...props
}: PullToRefreshListProps<T>) {
  const handleRefresh = useCallback(async () => {
    await onRefresh();
  }, [onRefresh]);

  return (
    <FlatList<T>
      style={[{ flex: 1, backgroundColor: THEME.background }, style]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={tintColor}
          colors={[tintColor]}
          progressViewOffset={progressViewOffset}
        />
      }
      {...props}
    />
  );
}

/**
 * Custom refresh indicator component
 * Can be used for more advanced refresh animations
 */
export interface RefreshIndicatorProps {
  refreshing: boolean;
  progress?: number; // 0 to 1
  color?: string;
  size?: 'small' | 'large';
}

export function RefreshIndicator({
  refreshing,
  progress = 0,
  color = THEME.primary,
  size = 'large',
}: RefreshIndicatorProps) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Spin animation when refreshing
  useCallback(() => {
    if (refreshing) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [refreshing, spinAnim]);

  // Scale based on pull progress
  useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: refreshing ? 1 : Math.min(progress, 1),
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [progress, refreshing, scaleAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const iconSize = size === 'large' ? 28 : 20;

  return (
    <View className="items-center justify-center py-4">
      <Animated.View
        style={{
          transform: [
            { scale: scaleAnim },
            { rotate: spin },
          ],
        }}
      >
        <Ionicons
          name={refreshing ? 'sync' : 'arrow-down'}
          size={iconSize}
          color={color}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Hook for managing refresh state
 */
export function useRefresh(refreshFn: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFn();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFn]);

  return { refreshing, onRefresh: handleRefresh };
}

// Need to import useState
import { useState } from 'react';

export default PullToRefresh;
