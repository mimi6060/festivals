import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { QRType, ScanEntry } from '@/stores/scanStore';

interface ScanHistoryProps {
  scans: ScanEntry[];
  onSelectScan: (scan: ScanEntry) => void;
  onClearHistory: () => void;
  onRemoveScan?: (id: string) => void;
  maxItems?: number;
  compact?: boolean;
}

const TYPE_ICONS: Record<QRType, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}> = {
  ticket: {
    icon: 'ticket',
    color: '#6366F1',
    bgColor: '#EEF2FF',
  },
  wallet: {
    icon: 'wallet',
    color: '#10B981',
    bgColor: '#D1FAE5',
  },
  stand: {
    icon: 'storefront',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
  },
  unknown: {
    icon: 'help-circle',
    color: '#6B7280',
    bgColor: '#F3F4F6',
  },
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 1 minute
  if (diff < 60000) {
    return 'A l\'instant';
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `Il y a ${minutes} min`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `Il y a ${hours}h`;
  }

  // Same year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ScanHistoryItem({
  scan,
  onPress,
  onRemove,
  compact = false,
}: {
  scan: ScanEntry;
  onPress: () => void;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const typeConfig = TYPE_ICONS[scan.qrType];

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        className="flex-row items-center py-2 px-3 bg-white/10 rounded-lg mb-2"
        activeOpacity={0.7}
      >
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: `${typeConfig.color}30` }}
        >
          <Ionicons name={typeConfig.icon} size={16} color={typeConfig.color} />
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-white font-medium text-sm" numberOfLines={1}>
            {scan.displayName}
          </Text>
          <Text className="text-white/60 text-xs" numberOfLines={1}>
            {formatTimestamp(scan.timestamp)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-3"
      activeOpacity={0.7}
    >
      <View className="flex-row items-start">
        <View
          className="w-12 h-12 rounded-full items-center justify-center"
          style={{ backgroundColor: typeConfig.bgColor }}
        >
          <Ionicons name={typeConfig.icon} size={24} color={typeConfig.color} />
        </View>

        <View className="flex-1 ml-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-semibold text-gray-900 text-base" numberOfLines={1}>
              {scan.displayName}
            </Text>
            <Text className="text-xs text-gray-400">
              {formatTimestamp(scan.timestamp)}
            </Text>
          </View>

          <Text className="text-sm text-gray-600 mt-1" numberOfLines={1}>
            {scan.description}
          </Text>

          <View className="flex-row items-center mt-2 gap-2">
            <View
              className="px-2 py-1 rounded-full flex-row items-center"
              style={{ backgroundColor: typeConfig.bgColor }}
            >
              <Ionicons name={typeConfig.icon} size={12} color={typeConfig.color} />
              <Text
                className="text-xs font-medium ml-1"
                style={{ color: typeConfig.color }}
              >
                {scan.qrType.toUpperCase()}
              </Text>
            </View>

            {scan.successful ? (
              <View className="px-2 py-1 rounded-full bg-green-100 flex-row items-center">
                <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                <Text className="text-xs font-medium text-green-600 ml-1">
                  Succes
                </Text>
              </View>
            ) : (
              <View className="px-2 py-1 rounded-full bg-red-100 flex-row items-center">
                <Ionicons name="close-circle" size={12} color="#EF4444" />
                <Text className="text-xs font-medium text-red-600 ml-1">
                  Echec
                </Text>
              </View>
            )}
          </View>
        </View>

        {onRemove && (
          <TouchableOpacity
            onPress={onRemove}
            className="p-2 -mr-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ScanHistory({
  scans,
  onSelectScan,
  onClearHistory,
  onRemoveScan,
  maxItems,
  compact = false,
}: ScanHistoryProps) {
  const displayScans = maxItems ? scans.slice(0, maxItems) : scans;

  if (scans.length === 0) {
    return (
      <View className={compact ? 'py-4' : 'py-8 items-center'}>
        <Ionicons
          name="scan-outline"
          size={compact ? 32 : 48}
          color={compact ? 'rgba(255,255,255,0.4)' : '#D1D5DB'}
        />
        <Text
          className={
            compact
              ? 'text-white/40 text-sm mt-2 text-center'
              : 'text-gray-400 mt-3 text-center'
          }
        >
          Aucun scan effectue
        </Text>
      </View>
    );
  }

  if (compact) {
    return (
      <View>
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-white/70 text-sm font-medium">
            Scans recents
          </Text>
          {scans.length > 0 && (
            <TouchableOpacity onPress={onClearHistory}>
              <Text className="text-white/50 text-xs">Effacer</Text>
            </TouchableOpacity>
          )}
        </View>
        {displayScans.map((scan) => (
          <ScanHistoryItem
            key={scan.id}
            scan={scan}
            onPress={() => onSelectScan(scan)}
            compact
          />
        ))}
        {maxItems && scans.length > maxItems && (
          <Text className="text-white/40 text-xs text-center mt-1">
            +{scans.length - maxItems} autres scans
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row justify-between items-center mb-4 px-4">
        <Text className="text-lg font-semibold text-gray-900">
          Historique ({scans.length})
        </Text>
        {scans.length > 0 && (
          <TouchableOpacity
            onPress={onClearHistory}
            className="flex-row items-center"
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text className="text-red-500 text-sm ml-1">Effacer tout</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {displayScans.map((scan) => (
          <ScanHistoryItem
            key={scan.id}
            scan={scan}
            onPress={() => onSelectScan(scan)}
            onRemove={onRemoveScan ? () => onRemoveScan(scan.id) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}
