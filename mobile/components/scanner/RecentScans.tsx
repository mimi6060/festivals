import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScanResult, ScanResultType, ScanMode } from '@/stores/ticketScanStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RecentScansProps {
  scans: ScanResult[];
  maxItems?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

const RESULT_CONFIG: Record<ScanResultType, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  label: string;
}> = {
  success: {
    icon: 'checkmark-circle',
    color: '#10B981',
    bgColor: '#D1FAE5',
    label: 'Valide',
  },
  error: {
    icon: 'close-circle',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    label: 'Erreur',
  },
  already_used: {
    icon: 'alert-circle',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    label: 'Deja utilise',
  },
  invalid: {
    icon: 'close-circle',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    label: 'Invalide',
  },
  expired: {
    icon: 'time',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    label: 'Expire',
  },
};

export default function RecentScans({
  scans,
  maxItems = 20,
  showViewAll = true,
  onViewAll,
}: RecentScansProps) {
  const [selectedScan, setSelectedScan] = useState<ScanResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const displayScans = scans.slice(0, maxItems);

  const handleScanPress = (scan: ScanResult) => {
    setSelectedScan(scan);
    setModalVisible(true);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderScanItem = ({ item, index }: { item: ScanResult; index: number }) => {
    const config = RESULT_CONFIG[item.resultType];

    return (
      <TouchableOpacity
        onPress={() => handleScanPress(item)}
        className="bg-white rounded-xl p-4 mb-2"
        activeOpacity={0.7}
      >
        <View className="flex-row items-start">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: config.bgColor }}
          >
            <Ionicons name={config.icon} size={24} color={config.color} />
          </View>

          <View className="flex-1 ml-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-gray-900" numberOfLines={1}>
                {item.holderName}
              </Text>
              <Text className="text-xs text-gray-400">{formatTime(item.scannedAt)}</Text>
            </View>

            <Text className="text-sm text-gray-600 mt-0.5" numberOfLines={1}>
              {item.ticketCode}
            </Text>

            <View className="flex-row items-center mt-2 flex-wrap">
              <View
                className="px-2 py-1 rounded-full mr-2 mb-1"
                style={{ backgroundColor: config.bgColor }}
              >
                <Text className="text-xs font-medium" style={{ color: config.color }}>
                  {config.label}
                </Text>
              </View>

              <View className="bg-gray-100 px-2 py-1 rounded-full mr-2 mb-1">
                <Text className="text-xs text-gray-600">
                  {item.scanMode === 'entry' ? 'Entree' : 'Sortie'}
                </Text>
              </View>

              <View className="bg-gray-100 px-2 py-1 rounded-full mb-1">
                <Text className="text-xs text-gray-600">{item.ticketTypeName}</Text>
              </View>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#D1D5DB" className="ml-2" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View className="bg-white rounded-xl p-8 items-center">
      <Ionicons name="scan-outline" size={48} color="#D1D5DB" />
      <Text className="text-gray-500 mt-3 text-center">Aucun scan recent</Text>
      <Text className="text-gray-400 text-sm text-center mt-1">
        Les scans apparaitront ici
      </Text>
    </View>
  );

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-semibold text-gray-900">
          Scans recents ({scans.length})
        </Text>
        {showViewAll && scans.length > maxItems && onViewAll && (
          <TouchableOpacity onPress={onViewAll}>
            <Text className="text-primary font-medium">Voir tout</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {displayScans.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={displayScans}
          renderItem={renderScanItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      )}

      {/* Detail Modal */}
      <ScanDetailModal
        visible={modalVisible}
        scan={selectedScan}
        onClose={() => {
          setModalVisible(false);
          setSelectedScan(null);
        }}
      />
    </View>
  );
}

interface ScanDetailModalProps {
  visible: boolean;
  scan: ScanResult | null;
  onClose: () => void;
}

function ScanDetailModal({ visible, scan, onClose }: ScanDetailModalProps) {
  if (!scan) return null;

  const config = RESULT_CONFIG[scan.resultType];

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
  };

  const dateTime = formatDateTime(scan.scannedAt);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View
          className="pt-4 pb-8 px-4"
          style={{ backgroundColor: config.color }}
        >
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-semibold">Details du scan</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Status indicator */}
          <View className="items-center">
            <View className="bg-white/20 w-20 h-20 rounded-full items-center justify-center mb-3">
              <Ionicons name={config.icon} size={48} color="#FFFFFF" />
            </View>
            <Text className="text-white text-2xl font-bold">{config.label}</Text>
            <Text className="text-white/80 text-center mt-1">{scan.message}</Text>
          </View>
        </View>

        {/* Content */}
        <View className="p-4 -mt-4">
          {/* Holder info */}
          <View className="bg-white rounded-2xl p-4 mb-4">
            <Text className="text-sm text-gray-500 mb-1">Titulaire</Text>
            <Text className="text-xl font-semibold text-gray-900">{scan.holderName}</Text>
          </View>

          {/* Ticket info */}
          <View className="bg-white rounded-2xl p-4 mb-4">
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-1">
                <Text className="text-sm text-gray-500 mb-1">Code du billet</Text>
                <Text className="text-lg font-mono text-gray-900">{scan.ticketCode}</Text>
              </View>
            </View>

            <View className="h-px bg-gray-100 my-3" />

            <View className="flex-row">
              <View className="flex-1">
                <Text className="text-sm text-gray-500 mb-1">Type de billet</Text>
                <Text className="text-gray-900">{scan.ticketTypeName}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm text-gray-500 mb-1">Mode</Text>
                <View className="flex-row items-center">
                  <Ionicons
                    name={scan.scanMode === 'entry' ? 'enter-outline' : 'exit-outline'}
                    size={16}
                    color={scan.scanMode === 'entry' ? '#10B981' : '#EF4444'}
                  />
                  <Text className="text-gray-900 ml-1">
                    {scan.scanMode === 'entry' ? 'Entree' : 'Sortie'}
                  </Text>
                </View>
              </View>
            </View>

            {scan.entryCount && scan.entryCount > 1 && (
              <>
                <View className="h-px bg-gray-100 my-3" />
                <View>
                  <Text className="text-sm text-gray-500 mb-1">Nombre d'entrees</Text>
                  <Text className="text-gray-900">{scan.entryCount} fois</Text>
                </View>
              </>
            )}
          </View>

          {/* Timestamp */}
          <View className="bg-white rounded-2xl p-4">
            <Text className="text-sm text-gray-500 mb-1">Date et heure du scan</Text>
            <Text className="text-gray-900 capitalize">{dateTime.date}</Text>
            <Text className="text-2xl font-semibold text-gray-900 mt-1">{dateTime.time}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Compact version for inline preview
export function RecentScansPreview({
  scans,
  maxItems = 3,
  onViewAll,
}: {
  scans: ScanResult[];
  maxItems?: number;
  onViewAll?: () => void;
}) {
  const displayScans = scans.slice(0, maxItems);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (displayScans.length === 0) {
    return null;
  }

  return (
    <View>
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-gray-600 font-medium">Derniers scans</Text>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll}>
            <Text className="text-primary font-medium">Voir tout</Text>
          </TouchableOpacity>
        )}
      </View>

      {displayScans.map((scan) => {
        const config = RESULT_CONFIG[scan.resultType];

        return (
          <View
            key={scan.id}
            className="bg-white rounded-xl p-3 mb-2 flex-row items-center"
          >
            <Ionicons name={config.icon} size={24} color={config.color} />
            <View className="flex-1 ml-3">
              <Text className="font-medium text-gray-900" numberOfLines={1}>
                {scan.holderName}
              </Text>
              <Text className="text-sm text-gray-500" numberOfLines={1}>
                {scan.ticketCode}
              </Text>
            </View>
            <Text className="text-xs text-gray-400">{formatTime(scan.scannedAt)}</Text>
          </View>
        );
      })}
    </View>
  );
}
