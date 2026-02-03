import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ScanStatsCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  color?: 'green' | 'red' | 'blue' | 'orange' | 'gray';
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
  suffix?: string;
  style?: ViewStyle;
}

const COLOR_CONFIG = {
  green: {
    icon: '#10B981',
    bg: '#D1FAE5',
    text: '#047857',
  },
  red: {
    icon: '#EF4444',
    bg: '#FEE2E2',
    text: '#B91C1C',
  },
  blue: {
    icon: '#3B82F6',
    bg: '#DBEAFE',
    text: '#1D4ED8',
  },
  orange: {
    icon: '#F59E0B',
    bg: '#FEF3C7',
    text: '#B45309',
  },
  gray: {
    icon: '#6B7280',
    bg: '#F3F4F6',
    text: '#374151',
  },
};

const SIZE_CONFIG = {
  small: {
    container: 'p-3',
    iconContainer: 'w-10 h-10',
    iconSize: 20,
    valueSize: 'text-xl',
    labelSize: 'text-xs',
  },
  medium: {
    container: 'p-4',
    iconContainer: 'w-12 h-12',
    iconSize: 24,
    valueSize: 'text-2xl',
    labelSize: 'text-sm',
  },
  large: {
    container: 'p-5',
    iconContainer: 'w-14 h-14',
    iconSize: 28,
    valueSize: 'text-3xl',
    labelSize: 'text-sm',
  },
};

export default function ScanStatsCard({
  icon,
  value,
  label,
  color = 'blue',
  size = 'medium',
  animated = true,
  suffix = '',
  style,
}: ScanStatsCardProps) {
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const colors = COLOR_CONFIG[color];
  const sizeConfig = SIZE_CONFIG[size];

  useEffect(() => {
    if (animated) {
      // Scale and fade in animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Count-up animation
      const duration = 1000;
      const startTime = Date.now();
      const startValue = displayValue;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth count-up
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(startValue + (value - startValue) * easeOutQuart);

        setDisplayValue(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    } else {
      setDisplayValue(value);
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
    }
  }, [value, animated]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
        style,
      ]}
    >
      <View className={`bg-white rounded-2xl ${sizeConfig.container}`}>
        <View className="flex-row items-center">
          <View
            className={`${sizeConfig.iconContainer} rounded-full items-center justify-center`}
            style={{ backgroundColor: colors.bg }}
          >
            <Ionicons name={icon} size={sizeConfig.iconSize} color={colors.icon} />
          </View>
          <View className="ml-3 flex-1">
            <View className="flex-row items-baseline">
              <Text
                className={`${sizeConfig.valueSize} font-bold`}
                style={{ color: colors.text }}
              >
                {displayValue.toLocaleString('fr-FR')}
              </Text>
              {suffix && (
                <Text className="text-sm text-gray-500 ml-1">{suffix}</Text>
              )}
            </View>
            <Text className={`${sizeConfig.labelSize} text-gray-500 mt-0.5`}>
              {label}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// Compact variant for inline display
export function CompactScanStatsCard({
  icon,
  value,
  label,
  color = 'blue',
  animated = true,
  suffix = '',
}: Omit<ScanStatsCardProps, 'size' | 'style'>) {
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value);
  const colors = COLOR_CONFIG[color];

  useEffect(() => {
    if (animated && value !== displayValue) {
      const duration = 800;
      const startTime = Date.now();
      const startValue = displayValue;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(startValue + (value - startValue) * easeOutQuart);

        setDisplayValue(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    } else if (!animated) {
      setDisplayValue(value);
    }
  }, [value, animated]);

  return (
    <View className="items-center">
      <View className="flex-row items-center">
        <Ionicons name={icon} size={16} color={colors.icon} />
        <Text className="text-lg font-bold text-gray-900 ml-1">
          {displayValue.toLocaleString('fr-FR')}
          {suffix}
        </Text>
      </View>
      <Text className="text-xs text-gray-500">{label}</Text>
    </View>
  );
}

// Full-width stat card for dashboard
export function DashboardStatCard({
  icon,
  value,
  label,
  color = 'blue',
  animated = true,
  suffix = '',
  trend,
  trendValue,
}: ScanStatsCardProps & {
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}) {
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value);
  const colors = COLOR_CONFIG[color];

  useEffect(() => {
    if (animated && value !== displayValue) {
      const duration = 1000;
      const startTime = Date.now();
      const startValue = displayValue;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(startValue + (value - startValue) * easeOutQuart);

        setDisplayValue(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    } else if (!animated) {
      setDisplayValue(value);
    }
  }, [value, animated]);

  const trendColor = trend === 'up' ? '#10B981' : trend === 'down' ? '#EF4444' : '#6B7280';
  const trendIcon = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove';

  return (
    <View className="bg-white rounded-2xl p-4 flex-1">
      <View className="flex-row items-center justify-between mb-3">
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.bg }}
        >
          <Ionicons name={icon} size={20} color={colors.icon} />
        </View>
        {trend && trendValue && (
          <View className="flex-row items-center">
            <Ionicons name={trendIcon} size={14} color={trendColor} />
            <Text className="text-xs ml-1" style={{ color: trendColor }}>
              {trendValue}
            </Text>
          </View>
        )}
      </View>
      <View>
        <Text className="text-3xl font-bold text-gray-900">
          {displayValue.toLocaleString('fr-FR')}
          {suffix}
        </Text>
        <Text className="text-sm text-gray-500 mt-1">{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});
