import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MovementType, InventoryItem } from '@/stores/inventoryStore';
import { StockLevelBadge, getStockLevel } from './StockLevelBadge';

export type AdjustmentReason = {
  id: string;
  label: string;
  type: MovementType;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export const ADJUSTMENT_REASONS: AdjustmentReason[] = [
  { id: 'restock', label: 'Reapprovisionnement', type: 'IN', icon: 'arrow-down-circle', color: '#10B981' },
  { id: 'return', label: 'Retour fournisseur', type: 'RETURN', icon: 'return-down-back', color: '#6366F1' },
  { id: 'sale', label: 'Vente manuelle', type: 'OUT', icon: 'cart', color: '#F59E0B' },
  { id: 'loss', label: 'Perte / Casse', type: 'LOSS', icon: 'alert-circle', color: '#EF4444' },
  { id: 'transfer', label: 'Transfert', type: 'TRANSFER', icon: 'swap-horizontal', color: '#8B5CF6' },
  { id: 'adjustment', label: 'Correction manuelle', type: 'ADJUSTMENT', icon: 'create', color: '#6B7280' },
];

interface AdjustmentFormProps {
  product: InventoryItem;
  onSubmit: (
    quantity: number,
    isIncrease: boolean,
    reason: AdjustmentReason,
    notes?: string
  ) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AdjustmentForm({
  product,
  onSubmit,
  onCancel,
  isLoading = false,
}: AdjustmentFormProps) {
  const [selectedReason, setSelectedReason] = useState<AdjustmentReason | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isIncrease, setIsIncrease] = useState(true);

  const handleQuantityChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setQuantity(numericValue);
  };

  const handleQuickQuantity = (value: number) => {
    setQuantity(value.toString());
  };

  const handleSubmit = () => {
    if (!selectedReason) {
      Alert.alert('Erreur', 'Veuillez selectionner une raison');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantite valide');
      return;
    }

    const newQuantity = product.quantity + (isIncrease ? qty : -qty);
    if (newQuantity < 0) {
      Alert.alert(
        'Stock insuffisant',
        `Le stock actuel est de ${product.quantity}. Vous ne pouvez pas retirer ${qty} unites.`
      );
      return;
    }

    onSubmit(qty, isIncrease, selectedReason, notes.trim() || undefined);
  };

  const previewQuantity = () => {
    const qty = parseInt(quantity || '0', 10);
    return product.quantity + (isIncrease ? qty : -qty);
  };

  return (
    <View className="bg-white rounded-xl">
      {/* Product Info */}
      <View className="p-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center">
            <Ionicons name="cube" size={24} color="#10B981" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="font-semibold text-gray-900 text-lg">{product.productName}</Text>
            <View className="flex-row items-center mt-1">
              <Text className="text-gray-500">
                Stock: <Text className="font-semibold">{product.quantity}</Text>
              </Text>
              <View className="ml-2">
                <StockLevelBadge
                  level={getStockLevel(
                    product.quantity,
                    product.minThreshold,
                    product.isOutOfStock,
                    product.isLowStock
                  )}
                />
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={onCancel} className="p-2">
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Reason Selection */}
      <View className="p-4 border-b border-gray-100">
        <Text className="text-sm font-medium text-gray-500 mb-3">Raison de l'ajustement</Text>
        <View className="flex-row flex-wrap -mx-1">
          {ADJUSTMENT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              onPress={() => {
                setSelectedReason(reason);
                setIsIncrease(reason.type === 'IN' || reason.type === 'RETURN');
              }}
              className="w-1/2 p-1"
            >
              <View
                className={`flex-row items-center p-3 rounded-lg border ${
                  selectedReason?.id === reason.id
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <View
                  style={{ backgroundColor: reason.color + '20' }}
                  className="w-8 h-8 rounded-full items-center justify-center"
                >
                  <Ionicons name={reason.icon} size={18} color={reason.color} />
                </View>
                <Text
                  className={`ml-2 text-sm font-medium flex-1 ${
                    selectedReason?.id === reason.id ? 'text-primary' : 'text-gray-700'
                  }`}
                  numberOfLines={1}
                >
                  {reason.label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Quantity Input */}
      <View className="p-4 border-b border-gray-100">
        <Text className="text-sm font-medium text-gray-500 mb-3">Quantite</Text>

        {/* Increase/Decrease Toggle */}
        <View className="flex-row mb-4 bg-gray-100 rounded-lg p-1">
          <TouchableOpacity
            onPress={() => setIsIncrease(true)}
            className={`flex-1 flex-row items-center justify-center py-2 rounded-md ${
              isIncrease ? 'bg-green-500' : ''
            }`}
          >
            <Ionicons name="add-circle" size={20} color={isIncrease ? 'white' : '#6B7280'} />
            <Text className={`ml-2 font-medium ${isIncrease ? 'text-white' : 'text-gray-600'}`}>
              Ajouter
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsIncrease(false)}
            className={`flex-1 flex-row items-center justify-center py-2 rounded-md ${
              !isIncrease ? 'bg-red-500' : ''
            }`}
          >
            <Ionicons name="remove-circle" size={20} color={!isIncrease ? 'white' : '#6B7280'} />
            <Text className={`ml-2 font-medium ${!isIncrease ? 'text-white' : 'text-gray-600'}`}>
              Retirer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quantity Controls */}
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => {
              const current = parseInt(quantity || '0', 10);
              if (current > 0) setQuantity((current - 1).toString());
            }}
            className="w-12 h-12 rounded-lg bg-gray-100 items-center justify-center"
          >
            <Ionicons name="remove" size={24} color="#6B7280" />
          </TouchableOpacity>

          <TextInput
            value={quantity}
            onChangeText={handleQuantityChange}
            keyboardType="numeric"
            placeholder="0"
            className={`flex-1 mx-3 h-14 rounded-xl text-center text-2xl font-bold ${
              isIncrease ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
            selectTextOnFocus
          />

          <TouchableOpacity
            onPress={() => {
              const current = parseInt(quantity || '0', 10);
              setQuantity((current + 1).toString());
            }}
            className="w-12 h-12 rounded-lg bg-gray-100 items-center justify-center"
          >
            <Ionicons name="add" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Quick Quantity Buttons */}
        <View className="flex-row mt-4 space-x-2">
          {[1, 5, 10, 20, 50].map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => handleQuickQuantity(value)}
              className={`flex-1 py-2 rounded-lg items-center ${
                quantity === value.toString() ? 'bg-primary' : 'bg-gray-100'
              }`}
            >
              <Text
                className={`font-medium ${
                  quantity === value.toString() ? 'text-white' : 'text-gray-700'
                }`}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Preview */}
        {quantity && (
          <View className="mt-4 p-3 bg-gray-50 rounded-lg">
            <Text className="text-gray-500 text-sm text-center">
              Nouveau stock apres ajustement:
            </Text>
            <Text className="text-center text-xl font-bold mt-1">
              <Text className="text-gray-500">{product.quantity}</Text>
              <Text className={isIncrease ? 'text-green-600' : 'text-red-600'}>
                {' '}{isIncrease ? '+' : '-'} {quantity}
              </Text>
              <Text className="text-gray-900"> = {previewQuantity()}</Text>
            </Text>
          </View>
        )}
      </View>

      {/* Notes */}
      <View className="p-4 border-b border-gray-100">
        <Text className="text-sm font-medium text-gray-500 mb-3">Notes (optionnel)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Ajouter une note..."
          multiline
          numberOfLines={2}
          className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900"
          textAlignVertical="top"
        />
      </View>

      {/* Actions */}
      <View className="p-4 flex-row space-x-3">
        <TouchableOpacity
          onPress={onCancel}
          className="flex-1 py-3 rounded-xl bg-gray-100 items-center justify-center"
        >
          <Text className="font-semibold text-gray-700">Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!selectedReason || !quantity || isLoading}
          className={`flex-1 py-3 rounded-xl items-center justify-center flex-row ${
            selectedReason && quantity && !isLoading
              ? isIncrease
                ? 'bg-green-500'
                : 'bg-red-500'
              : 'bg-gray-300'
          }`}
        >
          {isLoading ? (
            <Text className="text-white font-semibold">Chargement...</Text>
          ) : (
            <>
              <Ionicons
                name={isIncrease ? 'add-circle' : 'remove-circle'}
                size={20}
                color="white"
              />
              <Text className="text-white font-semibold ml-2">
                {isIncrease ? 'Ajouter' : 'Retirer'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Compact inline adjustment for quick adjustments
interface QuickAdjustmentProps {
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function QuickAdjustment({
  quantity,
  onAdd,
  onRemove,
  disabled = false,
}: QuickAdjustmentProps) {
  return (
    <View className="flex-row items-center space-x-2">
      <TouchableOpacity
        onPress={onRemove}
        disabled={disabled || quantity === 0}
        className={`w-8 h-8 rounded-full items-center justify-center ${
          disabled || quantity === 0 ? 'bg-gray-100' : 'bg-red-100'
        }`}
      >
        <Ionicons
          name="remove"
          size={20}
          color={disabled || quantity === 0 ? '#D1D5DB' : '#EF4444'}
        />
      </TouchableOpacity>

      <Text className="text-lg font-semibold text-gray-900 min-w-[40px] text-center">
        {quantity}
      </Text>

      <TouchableOpacity
        onPress={onAdd}
        disabled={disabled}
        className={`w-8 h-8 rounded-full items-center justify-center ${
          disabled ? 'bg-gray-100' : 'bg-green-100'
        }`}
      >
        <Ionicons name="add" size={20} color={disabled ? '#D1D5DB' : '#10B981'} />
      </TouchableOpacity>
    </View>
  );
}
