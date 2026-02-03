import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type StockLevel = 'ok' | 'low' | 'out';
type BadgeSize = 'small' | 'medium' | 'large';

interface StockLevelBadgeProps {
  level: StockLevel;
  quantity?: number;
  threshold?: number;
  size?: BadgeSize;
  showLabel?: boolean;
  showIcon?: boolean;
}

const LEVEL_CONFIG = {
  ok: {
    label: 'OK',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    iconColor: '#10B981',
    icon: 'checkmark-circle' as const,
  },
  low: {
    label: 'Stock bas',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    iconColor: '#D97706',
    icon: 'warning' as const,
  },
  out: {
    label: 'Rupture',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    iconColor: '#DC2626',
    icon: 'alert-circle' as const,
  },
};

const SIZE_CONFIG = {
  small: {
    padding: 'px-1.5 py-0.5',
    iconSize: 12,
    textSize: 'text-xs',
    iconMargin: 'mr-0.5',
  },
  medium: {
    padding: 'px-2 py-1',
    iconSize: 14,
    textSize: 'text-sm',
    iconMargin: 'mr-1',
  },
  large: {
    padding: 'px-3 py-1.5',
    iconSize: 16,
    textSize: 'text-base',
    iconMargin: 'mr-1.5',
  },
};

export function StockLevelBadge({
  level,
  quantity,
  threshold,
  size = 'medium',
  showLabel = true,
  showIcon = true,
}: StockLevelBadgeProps) {
  const config = LEVEL_CONFIG[level];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <View className={`flex-row items-center rounded ${config.bgColor} ${sizeConfig.padding}`}>
      {showIcon && (
        <Ionicons
          name={config.icon}
          size={sizeConfig.iconSize}
          color={config.iconColor}
          style={{ marginRight: showLabel ? 4 : 0 }}
        />
      )}
      {showLabel && (
        <Text className={`font-medium ${config.textColor} ${sizeConfig.textSize}`}>
          {config.label}
        </Text>
      )}
    </View>
  );
}

// Compact version for inline use
interface StockLevelDotProps {
  level: StockLevel;
  size?: 'small' | 'medium' | 'large';
}

const DOT_SIZES = {
  small: 'w-2 h-2',
  medium: 'w-3 h-3',
  large: 'w-4 h-4',
};

const DOT_COLORS = {
  ok: 'bg-green-500',
  low: 'bg-yellow-500',
  out: 'bg-red-500',
};

export function StockLevelDot({ level, size = 'medium' }: StockLevelDotProps) {
  return <View className={`rounded-full ${DOT_SIZES[size]} ${DOT_COLORS[level]}`} />;
}

// Progress bar showing stock level relative to capacity/threshold
interface StockProgressBarProps {
  current: number;
  min: number;
  max?: number;
  showLabels?: boolean;
}

export function StockProgressBar({
  current,
  min,
  max,
  showLabels = false,
}: StockProgressBarProps) {
  const capacity = max || min * 5; // If no max, assume 5x threshold
  const percentage = Math.min(100, (current / capacity) * 100);
  const thresholdPercentage = (min / capacity) * 100;

  const getProgressColor = () => {
    if (current === 0) return 'bg-red-500';
    if (current <= min) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <View>
      <View className="h-2 bg-gray-200 rounded-full overflow-hidden relative">
        {/* Progress */}
        <View
          className={`h-full ${getProgressColor()}`}
          style={{ width: `${percentage}%` }}
        />
        {/* Threshold marker */}
        <View
          className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
          style={{ left: `${thresholdPercentage}%` }}
        />
      </View>

      {showLabels && (
        <View className="flex-row justify-between mt-1">
          <Text className="text-gray-400 text-xs">0</Text>
          <Text className="text-gray-500 text-xs font-medium">{current}</Text>
          <Text className="text-gray-400 text-xs">{capacity}</Text>
        </View>
      )}
    </View>
  );
}

// Alert count badge
interface StockAlertCountProps {
  lowCount: number;
  outCount: number;
  compact?: boolean;
}

export function StockAlertCount({ lowCount, outCount, compact = false }: StockAlertCountProps) {
  const total = lowCount + outCount;

  if (total === 0) return null;

  if (compact) {
    return (
      <View className="bg-red-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1.5">
        <Text className="text-white text-xs font-bold">{total}</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center space-x-2">
      {outCount > 0 && (
        <View className="flex-row items-center bg-red-100 rounded-full px-2 py-1">
          <Ionicons name="alert-circle" size={14} color="#DC2626" />
          <Text className="text-red-700 text-xs font-medium ml-1">{outCount}</Text>
        </View>
      )}
      {lowCount > 0 && (
        <View className="flex-row items-center bg-yellow-100 rounded-full px-2 py-1">
          <Ionicons name="warning" size={14} color="#D97706" />
          <Text className="text-yellow-700 text-xs font-medium ml-1">{lowCount}</Text>
        </View>
      )}
    </View>
  );
}

// Utility function to get stock level from item
export function getStockLevel(
  quantity: number,
  minThreshold: number,
  isOutOfStock?: boolean,
  isLowStock?: boolean
): StockLevel {
  if (isOutOfStock !== undefined && isLowStock !== undefined) {
    if (isOutOfStock) return 'out';
    if (isLowStock) return 'low';
    return 'ok';
  }

  if (quantity === 0) return 'out';
  if (quantity <= minThreshold) return 'low';
  return 'ok';
}
