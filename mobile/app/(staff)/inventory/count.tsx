import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useInventoryStore, InventoryCountItem } from '@/stores/inventoryStore';
import { useStaffStore } from '@/stores/staffStore';
import { CountingMode } from '@/components/inventory/CountingMode';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.6;

type ViewMode = 'list' | 'scanner';

export default function InventoryCountScreen() {
  const router = useRouter();
  const { currentStand } = useStaffStore();
  const [permission, requestPermission] = useCameraPermissions();

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
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isScanning, setIsScanning] = useState(true);
  const [lastScannedItem, setLastScannedItem] = useState<InventoryCountItem | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);

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

  const handleBarcodeScanned = useCallback(
    ({ data }: { type: string; data: string }) => {
      if (!isScanning) return;

      // Find product by SKU or product ID
      const foundItem = countItems.find(
        (item) =>
          item.productSku?.toLowerCase() === data.toLowerCase() ||
          item.productId === data
      );

      if (foundItem) {
        Vibration.vibrate(100);
        setIsScanning(false);
        setLastScannedItem(foundItem);

        // Increment the count for the scanned item
        const currentValue = parseInt(countedValues[foundItem.id] || '0', 10);
        setCountedValues((prev) => ({ ...prev, [foundItem.id]: (currentValue + 1).toString() }));

        // Allow scanning again after a brief delay
        setTimeout(() => {
          setIsScanning(true);
        }, 1500);
      } else {
        Vibration.vibrate([0, 100, 100, 100]);
        Alert.alert(
          'Produit non trouve',
          `Aucun produit avec le code "${data}" dans cet inventaire.`,
          [{ text: 'OK', onPress: () => setIsScanning(true) }]
        );
        setIsScanning(false);
      }
    },
    [isScanning, countItems, countedValues]
  );

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
  const countedItemsCount = countItems.filter(
    (item) => countedValues[item.id] !== undefined
  ).length;

  // Scanner View
  if (viewMode === 'scanner') {
    if (!permission?.granted) {
      return (
        <View className="flex-1 bg-gray-900 items-center justify-center p-6">
          <Ionicons name="barcode-outline" size={64} color="#FFFFFF" />
          <Text className="text-white text-xl font-semibold mt-4 text-center">
            Acces camera requis
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            Autorisez l'acces a la camera pour scanner les codes-barres
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="mt-6 bg-primary px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">Autoriser la camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            className="mt-4"
          >
            <Text className="text-gray-400">Retour au mode liste</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="flex-1 bg-black">
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={flashEnabled}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'upc_a', 'upc_e'],
          }}
          onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
        />

        {/* Overlay */}
        <View style={StyleSheet.absoluteFillObject}>
          {/* Top overlay */}
          <View className="flex-1 bg-black/60" />

          {/* Middle section with scan area */}
          <View className="flex-row">
            <View className="flex-1 bg-black/60" />
            <View
              style={{ width: SCAN_AREA_SIZE, height: SCAN_AREA_SIZE }}
              className="relative"
            >
              {/* Corner decorations */}
              <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
            </View>
            <View className="flex-1 bg-black/60" />
          </View>

          {/* Bottom overlay */}
          <View className="flex-1 bg-black/60" />
        </View>

        {/* Header */}
        <View className="absolute top-0 left-0 right-0 pt-12 pb-4 px-4">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => setViewMode('list')}
              className="w-10 h-10 bg-black/30 rounded-full items-center justify-center"
            >
              <Ionicons name="list" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="bg-primary/80 px-4 py-2 rounded-full">
              <Text className="text-white font-semibold">
                {countedItemsCount}/{countItems.length} comptes
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setFlashEnabled(!flashEnabled)}
              className="w-10 h-10 bg-black/30 rounded-full items-center justify-center"
            >
              <Ionicons
                name={flashEnabled ? 'flash' : 'flash-outline'}
                size={24}
                color={flashEnabled ? '#FCD34D' : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Last Scanned Item */}
        {lastScannedItem && (
          <View className="absolute top-32 left-4 right-4">
            <View className="bg-green-500 rounded-xl p-4 flex-row items-center">
              <Ionicons name="checkmark-circle" size={24} color="white" />
              <View className="ml-3 flex-1">
                <Text className="text-white font-semibold">{lastScannedItem.productName}</Text>
                <Text className="text-white/80 text-sm">
                  Compte: {countedValues[lastScannedItem.id] || 0}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View className="absolute bottom-0 left-0 right-0 pb-12 px-6">
          <Text className="text-white text-center text-lg font-medium mb-4">
            Scannez le code-barres du produit
          </Text>

          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={handleCancel}
              className="flex-1 bg-white/20 py-3 rounded-xl flex-row items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
              <Text className="text-white font-medium ml-2">Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleComplete}
              className="flex-1 bg-green-500 py-3 rounded-xl flex-row items-center justify-center"
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-medium ml-2">Terminer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // List View
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
          <View className="flex-row items-center space-x-2">
            <TouchableOpacity
              onPress={() => {
                requestPermission();
                setViewMode('scanner');
              }}
              className="p-2 rounded-lg bg-primary/10"
            >
              <Ionicons name="barcode-outline" size={24} color="#10B981" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCancel}
              className="p-2 rounded-lg bg-gray-100"
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
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
        {countItems.map((item) => (
          <CountingMode
            key={item.id}
            item={item}
            countedValue={countedValues[item.id] || '0'}
            notes={notes[item.id] || ''}
            onCountChange={(value) => handleCountChange(item.id, value)}
            onNotesChange={(value) => handleNotesChange(item.id, value)}
            onIncrement={() => handleIncrement(item.id)}
            onDecrement={() => handleDecrement(item.id)}
          />
        ))}
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
