import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InventoryCountItem } from '@/stores/inventoryStore';

interface CountingModeProps {
  item: InventoryCountItem;
  countedValue: string;
  notes: string;
  onCountChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function CountingMode({
  item,
  countedValue,
  notes,
  onCountChange,
  onNotesChange,
  onIncrement,
  onDecrement,
}: CountingModeProps) {
  const counted = parseInt(countedValue || '0', 10);
  const variance = counted - item.expectedQty;
  const hasVariance = variance !== 0;

  return (
    <View
      className={`bg-white rounded-xl p-4 mb-3 border ${
        hasVariance ? 'border-orange-200' : 'border-gray-200'
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-medium text-gray-900">{item.productName}</Text>
          {item.productSku && (
            <Text className="text-gray-400 text-sm">SKU: {item.productSku}</Text>
          )}
          <Text className="text-gray-500 text-sm mt-1">
            Attendu: <Text className="font-semibold">{item.expectedQty}</Text>
          </Text>
        </View>

        <View className="flex-row items-center space-x-2">
          <TouchableOpacity
            onPress={onDecrement}
            className="w-10 h-10 rounded-lg bg-gray-100 items-center justify-center"
          >
            <Ionicons name="remove" size={24} color="#6B7280" />
          </TouchableOpacity>

          <TextInput
            value={countedValue}
            onChangeText={onCountChange}
            keyboardType="numeric"
            className={`w-16 h-10 rounded-lg text-center text-lg font-semibold ${
              hasVariance ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-900'
            }`}
            selectTextOnFocus
          />

          <TouchableOpacity
            onPress={onIncrement}
            className="w-10 h-10 rounded-lg bg-gray-100 items-center justify-center"
          >
            <Ionicons name="add" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Variance indicator */}
      {hasVariance && (
        <View className="mt-2 flex-row items-center">
          <View
            className={`px-2 py-1 rounded ${
              variance > 0 ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                variance > 0 ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {variance > 0 ? '+' : ''}{variance}
            </Text>
          </View>
          <Text className="text-gray-500 text-sm ml-2">
            {variance > 0 ? 'de plus que prevu' : 'de moins que prevu'}
          </Text>
        </View>
      )}

      {/* Notes input */}
      {hasVariance && (
        <TextInput
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Raison de l'ecart (optionnel)"
          className="mt-2 px-3 py-2 bg-gray-50 rounded-lg text-gray-700"
        />
      )}
    </View>
  );
}

// Compact counting row for scanner mode
interface CountingRowCompactProps {
  item: InventoryCountItem;
  countedValue: number;
  onPress?: () => void;
}

export function CountingRowCompact({
  item,
  countedValue,
  onPress,
}: CountingRowCompactProps) {
  const variance = countedValue - item.expectedQty;
  const hasVariance = variance !== 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className={`flex-row items-center bg-white rounded-lg p-3 mb-2 border ${
        hasVariance ? 'border-orange-200' : 'border-gray-200'
      }`}
    >
      <View
        className={`w-3 h-3 rounded-full ${
          hasVariance
            ? variance > 0
              ? 'bg-green-500'
              : 'bg-red-500'
            : 'bg-gray-300'
        }`}
      />
      <View className="flex-1 ml-3">
        <Text className="font-medium text-gray-900">{item.productName}</Text>
        <Text className="text-gray-400 text-xs">
          Attendu: {item.expectedQty}
        </Text>
      </View>
      <View className="flex-row items-center">
        <Text
          className={`text-lg font-bold ${
            hasVariance
              ? variance > 0
                ? 'text-green-600'
                : 'text-red-600'
              : 'text-gray-900'
          }`}
        >
          {countedValue}
        </Text>
        {hasVariance && (
          <Text
            className={`text-sm ml-1 ${
              variance > 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            ({variance > 0 ? '+' : ''}{variance})
          </Text>
        )}
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginLeft: 8 }} />
      )}
    </TouchableOpacity>
  );
}

// Scanner count summary
interface CountSummaryProps {
  totalItems: number;
  countedItems: number;
  itemsWithVariance: number;
  totalVariance: number;
}

export function CountSummary({
  totalItems,
  countedItems,
  itemsWithVariance,
  totalVariance,
}: CountSummaryProps) {
  return (
    <View className="flex-row space-x-3">
      <View className="flex-1 bg-blue-50 rounded-lg p-3">
        <Text className="text-blue-600 text-xs">Progression</Text>
        <Text className="text-blue-700 text-xl font-semibold">
          {countedItems}/{totalItems}
        </Text>
      </View>

      <View
        className={`flex-1 rounded-lg p-3 ${
          itemsWithVariance > 0 ? 'bg-orange-50' : 'bg-green-50'
        }`}
      >
        <Text
          className={`text-xs ${
            itemsWithVariance > 0 ? 'text-orange-600' : 'text-green-600'
          }`}
        >
          Ecarts
        </Text>
        <Text
          className={`text-xl font-semibold ${
            itemsWithVariance > 0 ? 'text-orange-700' : 'text-green-700'
          }`}
        >
          {itemsWithVariance}
        </Text>
      </View>

      <View
        className={`flex-1 rounded-lg p-3 ${
          totalVariance !== 0 ? 'bg-orange-50' : 'bg-green-50'
        }`}
      >
        <Text
          className={`text-xs ${
            totalVariance !== 0 ? 'text-orange-600' : 'text-green-600'
          }`}
        >
          Variance
        </Text>
        <Text
          className={`text-xl font-semibold ${
            totalVariance !== 0 ? 'text-orange-700' : 'text-green-700'
          }`}
        >
          {totalVariance > 0 ? '+' : ''}{totalVariance}
        </Text>
      </View>
    </View>
  );
}

// Scanned item feedback
interface ScannedItemFeedbackProps {
  item: InventoryCountItem;
  countedValue: number;
  isSuccess: boolean;
}

export function ScannedItemFeedback({
  item,
  countedValue,
  isSuccess,
}: ScannedItemFeedbackProps) {
  return (
    <View
      className={`rounded-xl p-4 flex-row items-center ${
        isSuccess ? 'bg-green-500' : 'bg-red-500'
      }`}
    >
      <Ionicons
        name={isSuccess ? 'checkmark-circle' : 'close-circle'}
        size={24}
        color="white"
      />
      <View className="ml-3 flex-1">
        <Text className="text-white font-semibold">{item.productName}</Text>
        {isSuccess ? (
          <Text className="text-white/80 text-sm">
            Compte: {countedValue} (attendu: {item.expectedQty})
          </Text>
        ) : (
          <Text className="text-white/80 text-sm">Produit non reconnu</Text>
        )}
      </View>
    </View>
  );
}
