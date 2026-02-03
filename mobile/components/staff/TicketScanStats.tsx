import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TodayStats } from '@/stores/ticketScanStore';

interface TicketScanStatsProps {
  stats: TodayStats;
  compact?: boolean;
}

interface StatItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}

function StatItem({ icon, label, value, color, bgColor }: StatItemProps) {
  return (
    <View className="items-center">
      <View
        className="w-12 h-12 rounded-full items-center justify-center mb-2"
        style={{ backgroundColor: bgColor }}
      >
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-500 mt-1">{label}</Text>
    </View>
  );
}

export default function TicketScanStats({ stats, compact = false }: TicketScanStatsProps) {
  if (compact) {
    return (
      <View className="bg-white rounded-xl p-3">
        <View className="flex-row justify-around">
          <View className="items-center">
            <View className="flex-row items-center">
              <Ionicons name="enter-outline" size={16} color="#10B981" />
              <Text className="text-lg font-bold text-gray-900 ml-1">
                {stats.entries}
              </Text>
            </View>
            <Text className="text-xs text-gray-500">Entrees</Text>
          </View>

          <View className="w-px bg-gray-200" />

          <View className="items-center">
            <View className="flex-row items-center">
              <Ionicons name="exit-outline" size={16} color="#EF4444" />
              <Text className="text-lg font-bold text-gray-900 ml-1">
                {stats.exits}
              </Text>
            </View>
            <Text className="text-xs text-gray-500">Sorties</Text>
          </View>

          <View className="w-px bg-gray-200" />

          <View className="items-center">
            <View className="flex-row items-center">
              <Ionicons name="people" size={16} color="#3B82F6" />
              <Text className="text-lg font-bold text-gray-900 ml-1">
                {stats.currentlyInside}
              </Text>
            </View>
            <Text className="text-xs text-gray-500">Sur place</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-white rounded-2xl p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-semibold text-gray-900">
          Statistiques du jour
        </Text>
        <View className="bg-gray-100 px-3 py-1 rounded-full">
          <Text className="text-xs text-gray-600">
            {new Date().toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </View>
      </View>

      {/* Main stats */}
      <View className="flex-row justify-around mb-6">
        <StatItem
          icon="enter-outline"
          label="Entrees"
          value={stats.entries}
          color="#10B981"
          bgColor="#D1FAE5"
        />
        <StatItem
          icon="exit-outline"
          label="Sorties"
          value={stats.exits}
          color="#EF4444"
          bgColor="#FEE2E2"
        />
        <StatItem
          icon="people"
          label="Sur place"
          value={stats.currentlyInside}
          color="#3B82F6"
          bgColor="#DBEAFE"
        />
      </View>

      {/* Divider */}
      <View className="h-px bg-gray-100 my-4" />

      {/* Scan stats */}
      <View className="flex-row justify-between">
        <View className="flex-row items-center">
          <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-2">
            <Ionicons name="scan-outline" size={16} color="#6B7280" />
          </View>
          <View>
            <Text className="text-sm text-gray-500">Total scans</Text>
            <Text className="font-semibold text-gray-900">{stats.totalScans}</Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <View className="w-8 h-8 bg-green-50 rounded-full items-center justify-center mr-2">
            <Ionicons name="checkmark" size={16} color="#10B981" />
          </View>
          <View>
            <Text className="text-sm text-gray-500">Reussis</Text>
            <Text className="font-semibold text-green-600">{stats.successfulScans}</Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <View className="w-8 h-8 bg-red-50 rounded-full items-center justify-center mr-2">
            <Ionicons name="close" size={16} color="#EF4444" />
          </View>
          <View>
            <Text className="text-sm text-gray-500">Echecs</Text>
            <Text className="font-semibold text-red-600">{stats.failedScans}</Text>
          </View>
        </View>
      </View>

      {/* Success rate */}
      {stats.totalScans > 0 && (
        <View className="mt-4 bg-gray-50 rounded-xl p-3">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm text-gray-600">Taux de reussite</Text>
            <Text className="font-semibold text-gray-900">
              {Math.round((stats.successfulScans / stats.totalScans) * 100)}%
            </Text>
          </View>
          <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-full bg-green-500 rounded-full"
              style={{
                width: `${(stats.successfulScans / stats.totalScans) * 100}%`,
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}
