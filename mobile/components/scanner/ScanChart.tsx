import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, ScrollView, Dimensions } from 'react-native';
import { HourlyScanData } from '@/stores/scanStatsStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ScanChartProps {
  data: HourlyScanData[];
  height?: number;
  showLabels?: boolean;
  animated?: boolean;
  highlightPeakHour?: boolean;
  currentHour?: number;
}

const BAR_WIDTH = 24;
const BAR_GAP = 8;
const CHART_PADDING = 16;

export default function ScanChart({
  data,
  height = 200,
  showLabels = true,
  animated = true,
  highlightPeakHour = true,
  currentHour,
}: ScanChartProps) {
  const maxValue = Math.max(...data.map((d) => d.total), 1);
  const peakHour = data.reduce((peak, d) => (d.total > peak.total ? d : peak), data[0]).hour;
  const now = currentHour ?? new Date().getHours();

  // Filter to show relevant hours (those with activity or around current time)
  const relevantHours = data.filter((d, index) => {
    const hasActivity = d.total > 0;
    const isNearCurrent = Math.abs(index - now) <= 2;
    const isFestivalHours = (index >= 10 && index <= 23) || index <= 2;
    return hasActivity || isNearCurrent || isFestivalHours;
  });

  // Use all 24 hours if no filtering makes sense
  const displayData = relevantHours.length > 0 ? data : data;

  return (
    <View className="bg-white rounded-2xl p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-semibold text-gray-900">Scans par heure</Text>
        <View className="flex-row items-center">
          <View className="flex-row items-center mr-4">
            <View className="w-3 h-3 rounded-full bg-green-500 mr-1" />
            <Text className="text-xs text-gray-500">Valides</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-3 h-3 rounded-full bg-red-500 mr-1" />
            <Text className="text-xs text-gray-500">Invalides</Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: CHART_PADDING,
          alignItems: 'flex-end',
        }}
      >
        <View style={{ height, flexDirection: 'row', alignItems: 'flex-end' }}>
          {displayData.map((hourData, index) => (
            <ChartBar
              key={hourData.hour}
              data={hourData}
              maxValue={maxValue}
              height={height - (showLabels ? 30 : 0)}
              animated={animated}
              delay={index * 30}
              isPeak={highlightPeakHour && hourData.hour === peakHour}
              isCurrent={hourData.hour === now}
              showLabel={showLabels}
            />
          ))}
        </View>
      </ScrollView>

      {/* Y-axis scale indicators */}
      <View className="absolute right-4 top-14" style={{ height: height - 50 }}>
        <View className="flex-1 justify-between">
          <Text className="text-xs text-gray-400">{maxValue}</Text>
          <Text className="text-xs text-gray-400">{Math.floor(maxValue / 2)}</Text>
          <Text className="text-xs text-gray-400">0</Text>
        </View>
      </View>
    </View>
  );
}

interface ChartBarProps {
  data: HourlyScanData;
  maxValue: number;
  height: number;
  animated: boolean;
  delay: number;
  isPeak: boolean;
  isCurrent: boolean;
  showLabel: boolean;
}

function ChartBar({
  data,
  maxValue,
  height,
  animated,
  delay,
  isPeak,
  isCurrent,
  showLabel,
}: ChartBarProps) {
  const animatedHeight = useRef(new Animated.Value(0)).current;

  const validHeight = (data.valid / maxValue) * height;
  const invalidHeight = (data.invalid / maxValue) * height;
  const totalHeight = validHeight + invalidHeight;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedHeight, {
        toValue: 1,
        duration: 600,
        delay,
        useNativeDriver: false,
      }).start();
    } else {
      animatedHeight.setValue(1);
    }
  }, [data, animated, delay]);

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}h`;
  };

  const animatedValidHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, validHeight],
  });

  const animatedInvalidHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, invalidHeight],
  });

  return (
    <View
      style={{
        width: BAR_WIDTH + BAR_GAP,
        alignItems: 'center',
      }}
    >
      {/* Bar container */}
      <View
        style={{
          height,
          width: BAR_WIDTH,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        {/* Stacked bar */}
        <View style={{ width: BAR_WIDTH, borderRadius: 4, overflow: 'hidden' }}>
          {/* Invalid (top) */}
          <Animated.View
            style={{
              width: BAR_WIDTH,
              height: animatedInvalidHeight,
              backgroundColor: '#EF4444',
            }}
          />
          {/* Valid (bottom) */}
          <Animated.View
            style={{
              width: BAR_WIDTH,
              height: animatedValidHeight,
              backgroundColor: '#10B981',
            }}
          />
        </View>

        {/* Peak indicator */}
        {isPeak && data.total > 0 && (
          <View className="absolute -top-6 items-center">
            <View className="bg-orange-500 px-1.5 py-0.5 rounded">
              <Text className="text-white text-xs font-bold">{data.total}</Text>
            </View>
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 4,
                borderRightWidth: 4,
                borderTopWidth: 4,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: '#F97316',
              }}
            />
          </View>
        )}

        {/* Current hour indicator */}
        {isCurrent && (
          <View
            className="absolute -bottom-1 w-2 h-2 rounded-full bg-blue-500"
            style={{ marginBottom: showLabel ? 24 : 0 }}
          />
        )}
      </View>

      {/* Hour label */}
      {showLabel && (
        <Text
          className={`text-xs mt-2 ${
            isCurrent ? 'text-blue-600 font-semibold' : 'text-gray-400'
          }`}
        >
          {formatHour(data.hour)}
        </Text>
      )}
    </View>
  );
}

// Compact version for quick overview
export function CompactScanChart({
  data,
  height = 60,
}: {
  data: HourlyScanData[];
  height?: number;
}) {
  const maxValue = Math.max(...data.map((d) => d.total), 1);

  // Only show hours with activity
  const activeHours = data.filter((d) => d.total > 0);

  if (activeHours.length === 0) {
    return (
      <View className="bg-gray-50 rounded-xl p-3 items-center justify-center" style={{ height }}>
        <Text className="text-gray-400 text-sm">Aucune donnee</Text>
      </View>
    );
  }

  return (
    <View className="bg-gray-50 rounded-xl p-2" style={{ height }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: height - 16 }}>
        {data.map((hourData) => {
          const barHeight = (hourData.total / maxValue) * (height - 20);
          const validRatio = hourData.total > 0 ? hourData.valid / hourData.total : 0;

          return (
            <View
              key={hourData.hour}
              style={{
                flex: 1,
                height: barHeight,
                marginHorizontal: 1,
                borderRadius: 2,
                overflow: 'hidden',
                backgroundColor: hourData.total > 0 ? '#E5E7EB' : 'transparent',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  width: '100%',
                  height: `${validRatio * 100}%`,
                  backgroundColor: '#10B981',
                  borderRadius: 2,
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Peak hours summary component
export function PeakHoursSummary({
  data,
}: {
  data: HourlyScanData[];
}) {
  const sortedHours = [...data]
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  if (sortedHours.length === 0) {
    return null;
  }

  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}h`;

  return (
    <View className="bg-white rounded-2xl p-4">
      <Text className="text-lg font-semibold text-gray-900 mb-3">Heures de pointe</Text>
      <View className="space-y-2">
        {sortedHours.map((hourData, index) => {
          const medals = ['gold', 'silver', 'bronze'];
          const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

          return (
            <View
              key={hourData.hour}
              className="flex-row items-center justify-between bg-gray-50 rounded-xl p-3"
            >
              <View className="flex-row items-center">
                <View
                  className="w-8 h-8 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: medalColors[index] }}
                >
                  <Text className="text-white font-bold text-sm">{index + 1}</Text>
                </View>
                <View>
                  <Text className="font-semibold text-gray-900">
                    {formatHour(hourData.hour)} - {formatHour(hourData.hour + 1)}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {hourData.valid} valides, {hourData.invalid} invalides
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-xl font-bold text-gray-900">{hourData.total}</Text>
                <Text className="text-xs text-gray-500">scans</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
