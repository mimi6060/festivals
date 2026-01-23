import { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Base skeleton component with shimmer animation
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E5E7EB',
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton loader for card items
 */
export function CardSkeleton() {
  return (
    <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
      {/* Header */}
      <View className="flex-row items-center mb-4">
        <Skeleton width={48} height={48} borderRadius={24} />
        <View className="ml-3 flex-1">
          <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      {/* Content */}
      <Skeleton width="100%" height={12} style={{ marginBottom: 8 }} />
      <Skeleton width="80%" height={12} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={12} />
    </View>
  );
}

/**
 * Skeleton loader for ticket cards
 */
export function TicketCardSkeleton() {
  return (
    <View className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm">
      {/* Header */}
      <View className="bg-gray-200 px-4 py-3">
        <View className="flex-row justify-between items-center">
          <Skeleton width="50%" height={20} borderRadius={4} />
          <Skeleton width={60} height={24} borderRadius={12} />
        </View>
        <Skeleton width="40%" height={14} style={{ marginTop: 8 }} />
      </View>
      {/* Body */}
      <View className="p-4">
        <View className="flex-row">
          <View className="flex-1">
            <Skeleton width="70%" height={14} style={{ marginBottom: 12 }} />
            <Skeleton width="60%" height={14} style={{ marginBottom: 12 }} />
            <Skeleton width="50%" height={14} />
          </View>
          <Skeleton width={64} height={64} borderRadius={8} />
        </View>
        {/* Footer */}
        <View className="flex-row justify-between items-center mt-4 pt-4 border-t border-gray-100">
          <Skeleton width="30%" height={12} />
          <Skeleton width={24} height={24} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton loader for transaction items
 */
export function TransactionSkeleton() {
  return (
    <View className="flex-row items-center py-3">
      <Skeleton width={40} height={40} borderRadius={20} />
      <View className="ml-3 flex-1">
        <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={60} height={16} />
    </View>
  );
}

/**
 * Skeleton loader for list items
 */
export function ListItemSkeleton() {
  return (
    <View className="flex-row items-center py-3 px-4">
      <Skeleton width={48} height={48} borderRadius={8} />
      <View className="ml-3 flex-1">
        <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} />
        <Skeleton width="50%" height={12} />
      </View>
      <Skeleton width={24} height={24} borderRadius={12} />
    </View>
  );
}

/**
 * Skeleton loader for profile/user cards
 */
export function ProfileSkeleton() {
  return (
    <View className="items-center py-6">
      <Skeleton width={96} height={96} borderRadius={48} />
      <Skeleton width={160} height={24} style={{ marginTop: 16, marginBottom: 8 }} />
      <Skeleton width={120} height={14} />
    </View>
  );
}

/**
 * Skeleton loader for wallet balance
 */
export function WalletBalanceSkeleton() {
  return (
    <View className="bg-primary/10 rounded-2xl p-6 items-center">
      <Skeleton width={100} height={14} style={{ marginBottom: 12 }} />
      <Skeleton width={180} height={48} style={{ marginBottom: 8 }} />
      <Skeleton width={80} height={14} />
    </View>
  );
}

/**
 * Skeleton loader for performance/event cards
 */
export function PerformanceCardSkeleton() {
  return (
    <View className="bg-white rounded-xl p-4 mb-3 shadow-sm">
      <View className="flex-row">
        <Skeleton width={60} height={60} borderRadius={8} />
        <View className="ml-3 flex-1">
          <Skeleton width="70%" height={18} style={{ marginBottom: 8 }} />
          <Skeleton width="50%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton loader for image grids (photos/memories)
 */
export function ImageGridSkeleton({ columns = 3, count = 9 }: { columns?: number; count?: number }) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <View className="flex-row flex-wrap">
      {items.map((item) => (
        <View
          key={item}
          style={{ width: `${100 / columns}%`, padding: 2 }}
        >
          <Skeleton width="100%" height={120} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton loader for stats/metrics
 */
export function StatsSkeleton() {
  return (
    <View className="flex-row justify-around py-4">
      {[1, 2, 3].map((item) => (
        <View key={item} className="items-center">
          <Skeleton width={48} height={32} style={{ marginBottom: 8 }} />
          <Skeleton width={64} height={14} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton loader for section headers
 */
export function SectionHeaderSkeleton() {
  return (
    <View className="flex-row items-center justify-between py-3 px-4">
      <Skeleton width={140} height={20} />
      <Skeleton width={60} height={14} />
    </View>
  );
}

/**
 * Full screen loading skeleton
 */
export function FullScreenSkeleton({ type = 'list' }: { type?: 'list' | 'cards' | 'profile' }) {
  if (type === 'profile') {
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <ProfileSkeleton />
        <StatsSkeleton />
        <View className="mt-4">
          {[1, 2, 3, 4].map((item) => (
            <ListItemSkeleton key={item} />
          ))}
        </View>
      </View>
    );
  }

  if (type === 'cards') {
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <SectionHeaderSkeleton />
        {[1, 2, 3].map((item) => (
          <CardSkeleton key={item} />
        ))}
      </View>
    );
  }

  // Default: list
  return (
    <View className="flex-1 bg-gray-50">
      <SectionHeaderSkeleton />
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <ListItemSkeleton key={item} />
      ))}
    </View>
  );
}

export default {
  Skeleton,
  CardSkeleton,
  TicketCardSkeleton,
  TransactionSkeleton,
  ListItemSkeleton,
  ProfileSkeleton,
  WalletBalanceSkeleton,
  PerformanceCardSkeleton,
  ImageGridSkeleton,
  StatsSkeleton,
  SectionHeaderSkeleton,
  FullScreenSkeleton,
};
