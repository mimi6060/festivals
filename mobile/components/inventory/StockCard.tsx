import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InventoryItem } from '@/stores/inventoryStore';

interface StockCardProps {
  item: InventoryItem;
  onQuickAdd?: () => void;
  onQuickRemove?: () => void;
  onPress?: () => void;
}

export function StockCard({ item, onQuickAdd, onQuickRemove, onPress }: StockCardProps) {
  const getStatusConfig = () => {
    if (item.isOutOfStock) {
      return {
        label: 'Rupture',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        icon: 'alert-circle' as const,
        iconColor: '#DC2626',
      };
    }
    if (item.isLowStock) {
      return {
        label: 'Stock bas',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200',
        icon: 'warning' as const,
        iconColor: '#D97706',
      };
    }
    return {
      label: 'OK',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      borderColor: 'border-gray-200',
      icon: 'checkmark-circle' as const,
      iconColor: '#10B981',
    };
  };

  const config = getStatusConfig();

  const getProgressWidth = () => {
    if (!item.maxCapacity) return 100;
    return Math.min(100, (item.quantity / item.maxCapacity) * 100);
  };

  const getProgressColor = () => {
    if (item.isOutOfStock) return 'bg-red-500';
    if (item.isLowStock) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className={`bg-white rounded-xl p-4 mb-3 border ${config.borderColor}`}
    >
      <View className="flex-row items-start justify-between">
        {/* Product Info */}
        <View className="flex-1">
          <View className="flex-row items-center">
            <View className={`w-10 h-10 rounded-full items-center justify-center ${config.bgColor}`}>
              <Ionicons name={config.icon} size={20} color={config.iconColor} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-semibold text-gray-900">{item.productName}</Text>
              {item.productSku && (
                <Text className="text-gray-400 text-xs">SKU: {item.productSku}</Text>
              )}
            </View>
          </View>

          {/* Stock info */}
          <View className="mt-3 flex-row items-center">
            <Text className="text-gray-500 text-sm">Stock:</Text>
            <Text
              className={`ml-2 text-xl font-bold ${
                item.isOutOfStock
                  ? 'text-red-600'
                  : item.isLowStock
                  ? 'text-yellow-600'
                  : 'text-gray-900'
              }`}
            >
              {item.quantity}
            </Text>
            {item.maxCapacity && (
              <Text className="text-gray-400 text-sm ml-1">/ {item.maxCapacity}</Text>
            )}
            <View className={`ml-3 px-2 py-0.5 rounded ${config.bgColor}`}>
              <Text className={`text-xs font-medium ${config.textColor}`}>{config.label}</Text>
            </View>
          </View>

          {/* Progress bar */}
          {item.maxCapacity && (
            <View className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <View
                className={`h-full ${getProgressColor()}`}
                style={{ width: `${getProgressWidth()}%` }}
              />
            </View>
          )}

          {/* Threshold info */}
          <Text className="text-gray-400 text-xs mt-2">
            Seuil d'alerte: {item.minThreshold} unites
          </Text>
        </View>

        {/* Quick Actions */}
        {(onQuickAdd || onQuickRemove) && (
          <View className="ml-3 items-center">
            {onQuickAdd && (
              <TouchableOpacity
                onPress={onQuickAdd}
                className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mb-2"
              >
                <Ionicons name="add" size={24} color="#10B981" />
              </TouchableOpacity>
            )}
            {onQuickRemove && !item.isOutOfStock && (
              <TouchableOpacity
                onPress={onQuickRemove}
                className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="remove" size={24} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Last update info */}
      {(item.lastRestockAt || item.lastCountAt) && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={14} color="#9CA3AF" />
            <Text className="text-gray-400 text-xs ml-1">
              {item.lastRestockAt
                ? `Dernier restock: ${formatDate(item.lastRestockAt)}`
                : item.lastCountAt
                ? `Dernier inventaire: ${formatDate(item.lastCountAt)}`
                : ''}
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) {
    const minutes = Math.floor(diff / (1000 * 60));
    return `il y a ${minutes} min`;
  }
  if (hours < 24) {
    return `il y a ${hours}h`;
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Compact version for lists
interface StockCardCompactProps {
  item: InventoryItem;
  onPress?: () => void;
}

export function StockCardCompact({ item, onPress }: StockCardCompactProps) {
  const getStatusColor = () => {
    if (item.isOutOfStock) return 'bg-red-500';
    if (item.isLowStock) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className="flex-row items-center bg-white rounded-lg p-3 mb-2 border border-gray-200"
    >
      <View className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
      <Text className="flex-1 font-medium text-gray-900 ml-3">{item.productName}</Text>
      <Text
        className={`text-lg font-bold ${
          item.isOutOfStock
            ? 'text-red-600'
            : item.isLowStock
            ? 'text-yellow-600'
            : 'text-gray-900'
        }`}
      >
        {item.quantity}
      </Text>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" className="ml-2" />
    </TouchableOpacity>
  );
}

// Alert badge component
interface StockAlertBadgeProps {
  lowStock: number;
  outOfStock: number;
}

export function StockAlertBadge({ lowStock, outOfStock }: StockAlertBadgeProps) {
  const total = lowStock + outOfStock;

  if (total === 0) return null;

  return (
    <View className="flex-row items-center">
      {outOfStock > 0 && (
        <View className="flex-row items-center bg-red-100 rounded-full px-2 py-1 mr-2">
          <Ionicons name="alert-circle" size={14} color="#DC2626" />
          <Text className="text-red-700 text-xs font-medium ml-1">{outOfStock}</Text>
        </View>
      )}
      {lowStock > 0 && (
        <View className="flex-row items-center bg-yellow-100 rounded-full px-2 py-1">
          <Ionicons name="warning" size={14} color="#D97706" />
          <Text className="text-yellow-700 text-xs font-medium ml-1">{lowStock}</Text>
        </View>
      )}
    </View>
  );
}
