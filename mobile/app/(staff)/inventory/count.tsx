import React, { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryStore, InventoryCountItem } from '@/stores/inventoryStore';
import { useStaffStore } from '@/stores/staffStore';

export default function InventoryCountScreen() {
  const router = useRouter();
  const { currentStand } = useStaffStore();
  const {
    items,
    currentCount,
    countItems,
    startCount,
    updateCountItem,
    completeCount,
    cancelCount,
    loadStandInventory,
  } = useInventoryStore();

  const [countedValues, setCountedValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Start count if not already started
  useEffect(() => {
    if (!currentCount && currentStand?.id && items.length > 0) {
      const newCount = {
        id: `count-${Date.now()}`,
        standId: currentStand.id,
        standName: currentStand.name,
        festivalId: 'fest-1',
        status: 'IN_PROGRESS' as const,
        startedAt: new Date().toISOString(),
      };

      const newCountItems: InventoryCountItem[] = items.map((item) => ({
        id: `ci-${item.id}`,
        countId: newCount.id,
        inventoryItemId: item.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        expectedQty: item.quantity,
      }));

      startCount(newCount, newCountItems);

      // Initialize counted values with expected quantities
      const initialValues: Record<string, string> = {};
      newCountItems.forEach((item) => {
        initialValues[item.id] = item.expectedQty.toString();
      });
      setCountedValues(initialValues);
    }
  }, [currentCount, currentStand, items]);

  const handleCountChange = (itemId: string, value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setCountedValues((prev) => ({ ...prev, [itemId]: numericValue }));
  };

  const handleNotesChange = (itemId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleIncrement = (itemId: string) => {
    const currentValue = parseInt(countedValues[itemId] || '0', 10);
    setCountedValues((prev) => ({ ...prev, [itemId]: (currentValue + 1).toString() }));
  };

  const handleDecrement = (itemId: string) => {
    const currentValue = parseInt(countedValues[itemId] || '0', 10);
    if (currentValue > 0) {
      setCountedValues((prev) => ({ ...prev, [itemId]: (currentValue - 1).toString() }));
    }
  };

  const handleComplete = () => {
    // Update all count items with counted values
    countItems.forEach((item) => {
      const countedQty = parseInt(countedValues[item.id] || '0', 10);
      updateCountItem(item.id, countedQty, notes[item.id]);
    });

    Alert.alert(
      'Terminer l\'inventaire',
      'Cette action va mettre a jour les niveaux de stock. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            completeCount();
            if (currentStand?.id) {
              loadStandInventory(currentStand.id);
            }
            Alert.alert('Succes', 'Inventaire termine avec succes');
            router.back();
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Annuler l\'inventaire',
      'Etes-vous sur de vouloir annuler cet inventaire ? Les modifications ne seront pas enregistrees.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: () => {
            cancelCount();
            router.back();
          },
        },
      ]
    );
  };

  const getVariance = (item: InventoryCountItem): number => {
    const counted = parseInt(countedValues[item.id] || '0', 10);
    return counted - item.expectedQty;
  };

  const totalVariance = countItems.reduce((sum, item) => sum + getVariance(item), 0);
  const itemsWithVariance = countItems.filter((item) => getVariance(item) !== 0).length;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View className="bg-white border-b border-gray-200 p-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-semibold text-gray-900">Inventaire en cours</Text>
            <Text className="text-gray-500">{currentStand?.name || 'Stand'}</Text>
          </View>
          <TouchableOpacity
            onPress={handleCancel}
            className="p-2 rounded-lg bg-gray-100"
          >
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View className="flex-row mt-4 space-x-3">
          <View className="flex-1 bg-gray-100 rounded-lg p-3">
            <Text className="text-gray-500 text-sm">Produits</Text>
            <Text className="text-gray-900 text-xl font-semibold">{countItems.length}</Text>
          </View>
          <View
            className={`flex-1 rounded-lg p-3 ${
              itemsWithVariance > 0 ? 'bg-orange-100' : 'bg-green-100'
            }`}
          >
            <Text className={`text-sm ${itemsWithVariance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
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
              totalVariance !== 0 ? 'bg-orange-100' : 'bg-green-100'
            }`}
          >
            <Text className={`text-sm ${totalVariance !== 0 ? 'text-orange-600' : 'text-green-600'}`}>
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
      </View>

      {/* Count Items */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {countItems.map((item) => {
          const variance = getVariance(item);
          const hasVariance = variance !== 0;

          return (
            <View
              key={item.id}
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
                    onPress={() => handleDecrement(item.id)}
                    className="w-10 h-10 rounded-lg bg-gray-100 items-center justify-center"
                  >
                    <Ionicons name="remove" size={24} color="#6B7280" />
                  </TouchableOpacity>

                  <TextInput
                    value={countedValues[item.id] || '0'}
                    onChangeText={(value) => handleCountChange(item.id, value)}
                    keyboardType="numeric"
                    className={`w-16 h-10 rounded-lg text-center text-lg font-semibold ${
                      hasVariance ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-900'
                    }`}
                    selectTextOnFocus
                  />

                  <TouchableOpacity
                    onPress={() => handleIncrement(item.id)}
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
                  value={notes[item.id] || ''}
                  onChangeText={(value) => handleNotesChange(item.id, value)}
                  placeholder="Raison de l'ecart (optionnel)"
                  className="mt-2 px-3 py-2 bg-gray-50 rounded-lg text-gray-700"
                />
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Complete Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-8">
        <TouchableOpacity
          onPress={handleComplete}
          className="flex-row items-center justify-center py-4 bg-success rounded-xl"
        >
          <Ionicons name="checkmark-circle" size={24} color="white" />
          <Text className="text-white font-semibold text-lg ml-2">
            Terminer l'inventaire
          </Text>
        </TouchableOpacity>
        {itemsWithVariance > 0 && (
          <Text className="text-center text-orange-600 text-sm mt-2">
            Attention: {itemsWithVariance} produit{itemsWithVariance > 1 ? 's' : ''} avec ecart
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
