import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryStore, MovementType, InventoryItem } from '@/stores/inventoryStore';
import { useStaffStore } from '@/stores/staffStore';
import { AdjustmentForm } from '@/components/inventory/AdjustmentForm';
import { StockLevelBadge } from '@/components/inventory/StockLevelBadge';

type AdjustmentReason = {
  id: string;
  label: string;
  type: MovementType;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const ADJUSTMENT_REASONS: AdjustmentReason[] = [
  { id: 'restock', label: 'Reapprovisionnement', type: 'IN', icon: 'arrow-down-circle', color: '#10B981' },
  { id: 'return', label: 'Retour fournisseur', type: 'RETURN', icon: 'return-down-back', color: '#6366F1' },
  { id: 'sale', label: 'Vente manuelle', type: 'OUT', icon: 'cart', color: '#F59E0B' },
  { id: 'loss', label: 'Perte / Casse', type: 'LOSS', icon: 'alert-circle', color: '#EF4444' },
  { id: 'transfer', label: 'Transfert', type: 'TRANSFER', icon: 'swap-horizontal', color: '#8B5CF6' },
  { id: 'adjustment', label: 'Correction manuelle', type: 'ADJUSTMENT', icon: 'create', color: '#6B7280' },
];

export default function InventoryAdjustScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productId?: string; productName?: string }>();

  const { currentStand } = useStaffStore();
  const { items, adjustStock, isLoading, loadStandInventory } = useInventoryStore();

  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [selectedReason, setSelectedReason] = useState<AdjustmentReason | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isIncrease, setIsIncrease] = useState(true);

  // Load product from params or let user select
  useEffect(() => {
    if (params.productId) {
      const product = items.find((p) => p.productId === params.productId);
      if (product) {
        setSelectedProduct(product);
      }
    }
  }, [params.productId, items]);

  // Set increase/decrease based on reason
  useEffect(() => {
    if (selectedReason) {
      setIsIncrease(selectedReason.type === 'IN' || selectedReason.type === 'RETURN');
    }
  }, [selectedReason]);

  const handleQuantityChange = (value: string) => {
    // Only allow positive numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setQuantity(numericValue);
  };

  const handleQuickQuantity = (value: number) => {
    setQuantity(value.toString());
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      Alert.alert('Erreur', 'Veuillez selectionner un produit');
      return;
    }

    if (!selectedReason) {
      Alert.alert('Erreur', 'Veuillez selectionner une raison');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantite valide');
      return;
    }

    // Calculate the delta based on increase/decrease
    const delta = isIncrease ? qty : -qty;
    const newQuantity = selectedProduct.quantity + delta;

    if (newQuantity < 0) {
      Alert.alert(
        'Stock insuffisant',
        `Le stock actuel est de ${selectedProduct.quantity}. Vous ne pouvez pas retirer ${qty} unites.`
      );
      return;
    }

    Alert.alert(
      'Confirmer l\'ajustement',
      `${isIncrease ? 'Ajouter' : 'Retirer'} ${qty} ${selectedProduct.productName}\n` +
        `Raison: ${selectedReason.label}\n` +
        `Stock actuel: ${selectedProduct.quantity} -> ${newQuantity}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            const reason = notes.trim() || selectedReason.label;
            const success = await adjustStock(
              selectedProduct.productId,
              delta,
              selectedReason.type,
              reason
            );

            if (success) {
              // Reload inventory
              if (currentStand?.id) {
                await loadStandInventory(currentStand.id);
              }

              Alert.alert(
                'Succes',
                `Stock ajuste avec succes.\nNouveau stock: ${newQuantity}`,
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } else {
              Alert.alert('Erreur', 'Une erreur est survenue lors de l\'ajustement');
            }
          },
        },
      ]
    );
  };

  const getStockLevel = (item: InventoryItem): 'ok' | 'low' | 'out' => {
    if (item.isOutOfStock) return 'out';
    if (item.isLowStock) return 'low';
    return 'ok';
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View className="bg-white border-b border-gray-200 p-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-lg bg-gray-100 items-center justify-center mr-3"
          >
            <Ionicons name="arrow-back" size={24} color="#6B7280" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-gray-900">Ajustement de stock</Text>
            <Text className="text-gray-500">{currentStand?.name || 'Stand'}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Product Selection */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-sm font-medium text-gray-500 mb-3">Produit</Text>

          {selectedProduct ? (
            <TouchableOpacity
              onPress={() => setSelectedProduct(null)}
              className="flex-row items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/30"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center">
                  <Ionicons name="cube" size={20} color="#10B981" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-medium text-gray-900">{selectedProduct.productName}</Text>
                  <View className="flex-row items-center mt-1">
                    <Text className="text-gray-500 text-sm">
                      Stock: <Text className="font-semibold">{selectedProduct.quantity}</Text>
                    </Text>
                    <View className="ml-2">
                      <StockLevelBadge level={getStockLevel(selectedProduct)} />
                    </View>
                  </View>
                </View>
              </View>
              <Ionicons name="close-circle" size={24} color="#10B981" />
            </TouchableOpacity>
          ) : (
            <View>
              <Text className="text-gray-500 mb-3">Selectionnez un produit</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setSelectedProduct(item)}
                    className={`mr-2 px-4 py-3 rounded-lg border ${
                      item.isOutOfStock
                        ? 'bg-red-50 border-red-200'
                        : item.isLowStock
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Text className="font-medium text-gray-900">{item.productName}</Text>
                    <View className="flex-row items-center mt-1">
                      <Text className="text-gray-500 text-sm">{item.quantity}</Text>
                      <View className="ml-1">
                        <StockLevelBadge level={getStockLevel(item)} size="small" showLabel={false} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Reason Selection */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-sm font-medium text-gray-500 mb-3">Raison de l'ajustement</Text>

          <View className="flex-row flex-wrap -mx-1">
            {ADJUSTMENT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                onPress={() => setSelectedReason(reason)}
                className={`w-1/2 p-1`}
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
                  >
                    {reason.label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quantity Input */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-sm font-medium text-gray-500 mb-3">Quantite</Text>

          {/* Increase/Decrease Toggle */}
          <View className="flex-row mb-4 bg-gray-100 rounded-lg p-1">
            <TouchableOpacity
              onPress={() => setIsIncrease(true)}
              className={`flex-1 flex-row items-center justify-center py-2 rounded-md ${
                isIncrease ? 'bg-green-500' : ''
              }`}
            >
              <Ionicons
                name="add-circle"
                size={20}
                color={isIncrease ? 'white' : '#6B7280'}
              />
              <Text
                className={`ml-2 font-medium ${isIncrease ? 'text-white' : 'text-gray-600'}`}
              >
                Ajouter
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsIncrease(false)}
              className={`flex-1 flex-row items-center justify-center py-2 rounded-md ${
                !isIncrease ? 'bg-red-500' : ''
              }`}
            >
              <Ionicons
                name="remove-circle"
                size={20}
                color={!isIncrease ? 'white' : '#6B7280'}
              />
              <Text
                className={`ml-2 font-medium ${!isIncrease ? 'text-white' : 'text-gray-600'}`}
              >
                Retirer
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quantity Input */}
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
          {selectedProduct && quantity && (
            <View className="mt-4 p-3 bg-gray-50 rounded-lg">
              <Text className="text-gray-500 text-sm text-center">
                Nouveau stock apres ajustement:
              </Text>
              <Text className="text-center text-xl font-bold mt-1">
                <Text className="text-gray-500">{selectedProduct.quantity}</Text>
                <Text className={isIncrease ? 'text-green-600' : 'text-red-600'}>
                  {' '}
                  {isIncrease ? '+' : '-'} {quantity}
                </Text>
                <Text className="text-gray-900">
                  {' '}
                  = {selectedProduct.quantity + (isIncrease ? 1 : -1) * parseInt(quantity || '0', 10)}
                </Text>
              </Text>
            </View>
          )}
        </View>

        {/* Notes */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-sm font-medium text-gray-500 mb-3">Notes (optionnel)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ajouter une note..."
            multiline
            numberOfLines={3}
            className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900"
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-8">
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!selectedProduct || !selectedReason || !quantity || isLoading}
          className={`flex-row items-center justify-center py-4 rounded-xl ${
            selectedProduct && selectedReason && quantity && !isLoading
              ? isIncrease
                ? 'bg-green-500'
                : 'bg-red-500'
              : 'bg-gray-300'
          }`}
        >
          {isLoading ? (
            <Text className="text-white font-semibold text-lg">Chargement...</Text>
          ) : (
            <>
              <Ionicons
                name={isIncrease ? 'add-circle' : 'remove-circle'}
                size={24}
                color="white"
              />
              <Text className="text-white font-semibold text-lg ml-2">
                {isIncrease ? 'Ajouter' : 'Retirer'} {quantity || '0'} unite{parseInt(quantity || '0', 10) > 1 ? 's' : ''}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
