import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useStaffStore } from '@/stores/staffStore';
import { useWalletStore } from '@/stores/walletStore';
import { useNetworkStore } from '@/stores/networkStore';
import { useOfflineTransactionStore } from '@/stores/offlineTransactionStore';
import {
  validateQROffline,
  parseQRCode,
  checkDuplicateQRScan,
  cacheWallet,
} from '@/lib/offline';
import OfflineReceipt from '@/components/staff/OfflineReceipt';
import type { OfflineTransaction, OfflineTransactionItem } from '@/lib/offline';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7;

interface ExtendedCustomerWallet {
  id: string;
  userId: string;
  name: string;
  balance: number;
  effectiveBalance: number;
  currencyName: string;
  isOfflineValidation: boolean;
  warningMessage?: string;
}

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [showOfflineReceipt, setShowOfflineReceipt] = useState(false);
  const [lastOfflineTransaction, setLastOfflineTransaction] = useState<OfflineTransaction | null>(null);

  const { setScannedCustomer, cartTotal, cart, currentStand, clearCart } = useStaffStore();
  const { currencyName } = useWalletStore();
  const { isOnline } = useNetworkStore();
  const {
    processOfflinePayment,
    validateAndCacheQR,
    isProcessing,
  } = useOfflineTransactionStore();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // Convert cart items to offline transaction items
  const cartToOfflineItems = (): OfflineTransactionItem[] => {
    return cart.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.price,
      totalPrice: item.product.price * item.quantity,
    }));
  };

  // Process offline payment
  const processOffline = async (
    walletId: string,
    userId: string,
    customerName: string,
    balance: number
  ) => {
    const result = await processOfflinePayment(
      {
        walletId,
        userId,
        customerName,
        amount: cartTotal,
        items: cartToOfflineItems(),
        standId: currentStand?.id || 'unknown',
        standName: currentStand?.name || 'Unknown Stand',
        staffId: 'staff-1', // Would come from auth store
      },
      balance
    );

    if (result.success && result.transaction) {
      setLastOfflineTransaction(result.transaction);
      setShowOfflineReceipt(true);
    } else {
      Alert.alert('Erreur', result.error || 'Impossible de traiter le paiement hors ligne');
      setIsScanning(true);
    }
  };

  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (!isScanning || isValidating) return;
      setIsScanning(false);
      setIsValidating(true);

      try {
        // Check for duplicate scan
        const duplicateCheck = await checkDuplicateQRScan(data);
        if (duplicateCheck.isDuplicate) {
          Alert.alert('Attention', duplicateCheck.message || 'QR code deja scanne');
          setIsValidating(false);
          setIsScanning(true);
          return;
        }

        // Parse QR code
        const parsed = parseQRCode(data);

        if (!parsed) {
          Alert.alert('Erreur', 'QR code invalide');
          setIsValidating(false);
          setIsScanning(true);
          return;
        }

        // Determine if we're online or offline
        if (isOnline) {
          // Online mode - use existing flow
          const mockCustomer = {
            id: parsed.walletId,
            name: parsed.customerName || 'Client',
            balance: parsed.balance,
            currencyName: currencyName,
          };

          // Cache wallet for potential offline use
          await cacheWallet({
            walletId: parsed.walletId,
            userId: parsed.userId,
            customerName: parsed.customerName || 'Client',
            balance: parsed.balance,
            lastSyncedAt: new Date().toISOString(),
          });

          setScannedCustomer(mockCustomer);
          setIsValidating(false);
          router.push('/(staff)/payment/confirm');
        } else {
          // Offline mode - validate locally
          const validationResult = await validateQROffline(data, cartTotal);

          if (!validationResult.valid) {
            Alert.alert(
              'Paiement refuse',
              validationResult.error || 'Impossible de valider le paiement',
              [{ text: 'OK', onPress: () => setIsScanning(true) }]
            );
            setIsValidating(false);
            return;
          }

          // Show warning if applicable
          if (validationResult.warningMessage) {
            Alert.alert(
              'Attention',
              validationResult.warningMessage,
              [
                {
                  text: 'Annuler',
                  style: 'cancel',
                  onPress: () => {
                    setIsValidating(false);
                    setIsScanning(true);
                  },
                },
                {
                  text: 'Continuer',
                  onPress: async () => {
                    await processOffline(
                      validationResult.walletId!,
                      validationResult.userId!,
                      validationResult.customerName || 'Client',
                      validationResult.effectiveBalance!
                    );
                    setIsValidating(false);
                  },
                },
              ]
            );
          } else {
            // Process offline payment directly
            await processOffline(
              validationResult.walletId!,
              validationResult.userId!,
              validationResult.customerName || 'Client',
              validationResult.effectiveBalance!
            );
            setIsValidating(false);
          }
        }
      } catch (error) {
        console.error('Scan error:', error);
        Alert.alert('Erreur', 'Une erreur est survenue lors du scan');
        setIsValidating(false);
        setIsScanning(true);
      }
    },
    [isScanning, isValidating, isOnline, cartTotal, currencyName]
  );

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un code wallet');
      return;
    }

    setIsValidating(true);

    if (isOnline) {
      // Online mode - use existing flow
      const mockCustomer = {
        id: manualCode,
        name: 'Client #' + manualCode.slice(-4),
        balance: Math.floor(Math.random() * 200) + 50,
        currencyName: currencyName,
      };

      setScannedCustomer(mockCustomer);
      setIsValidating(false);
      router.push('/(staff)/payment/confirm');
    } else {
      // Offline mode - try to create a basic validation
      // In offline mode with manual entry, we need cached wallet data
      Alert.alert(
        'Mode hors ligne',
        'En mode hors ligne, seuls les QR codes peuvent etre valides. L\'entree manuelle necessite une connexion.',
        [
          {
            text: 'OK',
            onPress: () => {
              setIsValidating(false);
              setShowManualEntry(false);
            },
          },
        ]
      );
    }
  };

  const handleOfflineReceiptDismiss = () => {
    setShowOfflineReceipt(false);
    setLastOfflineTransaction(null);
  };

  const handleNewSale = () => {
    setShowOfflineReceipt(false);
    setLastOfflineTransaction(null);
    clearCart();
    router.replace('/(staff)/payment');
  };

  if (!permission) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white">Chargement...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center p-6">
        <Ionicons name="camera-outline" size={64} color="#FFFFFF" />
        <Text className="text-white text-xl font-semibold mt-4 text-center">
          Acces camera requis
        </Text>
        <Text className="text-gray-400 text-center mt-2">
          Autorisez l'acces a la camera pour scanner les QR codes des clients
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="mt-6 bg-success px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Autoriser la camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowManualEntry(true)}
          className="mt-4"
        >
          <Text className="text-gray-400">Ou entrer le code manuellement</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showManualEntry) {
    return (
      <View className="flex-1 bg-gray-50">
        {/* Offline Banner */}
        {!isOnline && (
          <View className="bg-amber-500 px-4 py-2 flex-row items-center">
            <Ionicons name="cloud-offline-outline" size={18} color="#FFFFFF" />
            <Text className="text-white font-medium ml-2">Mode hors ligne</Text>
          </View>
        )}

        {/* Header */}
        <View className="bg-success pt-12 pb-6 px-4">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => setShowManualEntry(false)}
              className="p-2"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-semibold">Entree manuelle</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <View className="flex-1 p-6">
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-gray-600 mb-2">Code wallet du client</Text>
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Ex: WAL-12345"
              className="border border-gray-300 rounded-xl px-4 py-3 text-lg"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isValidating}
            />

            <View className="mt-6 bg-gray-50 rounded-xl p-4">
              <Text className="text-gray-500 text-sm">Montant a debiter</Text>
              <Text className="text-2xl font-bold mt-1">
                {cartTotal} {currencyName}
              </Text>
            </View>

            {!isOnline && (
              <View className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <View className="flex-row items-center">
                  <Ionicons name="information-circle" size={18} color="#F59E0B" />
                  <Text className="text-amber-700 text-sm ml-2 flex-1">
                    En mode hors ligne, preferez le scan QR pour valider le solde client.
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleManualSubmit}
              disabled={isValidating}
              className={`mt-6 py-4 rounded-xl ${
                isValidating ? 'bg-gray-300' : 'bg-success'
              }`}
            >
              <Text className="text-white font-semibold text-center text-lg">
                {isValidating ? 'Validation...' : 'Valider'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={isScanning && !isValidating ? handleBarCodeScanned : undefined}
      />

      {/* Overlay */}
      <View style={StyleSheet.absoluteFillObject}>
        {/* Top overlay */}
        <View className="flex-1 bg-black/50" />

        {/* Middle section with scan area */}
        <View className="flex-row">
          <View className="flex-1 bg-black/50" />
          <View
            style={{ width: SCAN_AREA_SIZE, height: SCAN_AREA_SIZE }}
            className="relative"
          >
            {/* Corner decorations */}
            <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-success rounded-tl-lg" />
            <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-success rounded-tr-lg" />
            <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-success rounded-bl-lg" />
            <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-success rounded-br-lg" />

            {/* Loading indicator */}
            {isValidating && (
              <View className="absolute inset-0 items-center justify-center">
                <View className="bg-black/70 px-6 py-4 rounded-xl">
                  <Text className="text-white font-medium">Validation...</Text>
                </View>
              </View>
            )}
          </View>
          <View className="flex-1 bg-black/50" />
        </View>

        {/* Bottom overlay */}
        <View className="flex-1 bg-black/50" />
      </View>

      {/* Header */}
      <View className="absolute top-0 left-0 right-0 pt-12 pb-4 px-4">
        {/* Offline Mode Indicator */}
        {!isOnline && (
          <View className="bg-amber-500 px-4 py-2 rounded-full flex-row items-center justify-center mb-4 self-center">
            <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
            <Text className="text-white font-medium text-sm ml-2">Mode hors ligne</Text>
          </View>
        )}

        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-black/30 rounded-full items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View className="bg-black/30 px-4 py-2 rounded-full">
            <Text className="text-white font-semibold">
              {cartTotal} {currencyName}
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

      {/* Instructions */}
      <View className="absolute bottom-0 left-0 right-0 pb-12 px-6">
        <Text className="text-white text-center text-lg font-medium mb-2">
          Scannez le QR code du client
        </Text>

        {!isOnline && (
          <Text className="text-amber-400 text-center text-sm mb-4">
            Validation locale du solde - Le paiement sera synchronise automatiquement
          </Text>
        )}

        <TouchableOpacity
          onPress={() => setShowManualEntry(true)}
          className="bg-white/20 py-3 rounded-xl flex-row items-center justify-center"
        >
          <Ionicons name="keypad-outline" size={20} color="#FFFFFF" />
          <Text className="text-white font-medium ml-2">Entrer le code manuellement</Text>
        </TouchableOpacity>

        {!isScanning && !isValidating && (
          <TouchableOpacity
            onPress={() => setIsScanning(true)}
            className="mt-3 bg-success py-3 rounded-xl"
          >
            <Text className="text-white font-medium text-center">Scanner a nouveau</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Offline Receipt Modal */}
      <OfflineReceipt
        visible={showOfflineReceipt}
        transaction={lastOfflineTransaction}
        currencyName={currencyName}
        onDismiss={handleOfflineReceiptDismiss}
        onNewSale={handleNewSale}
      />
    </View>
  );
}
