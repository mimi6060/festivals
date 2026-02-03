import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRechargeStore } from '@/stores/rechargeStore';
import { useWalletStore } from '@/stores/walletStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7;

export default function RechargeScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(true);

  const { rechargeAmount, setScannedCustomer } = useRechargeStore();
  const { currencyName } = useWalletStore();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!isScanning) return;
    setIsScanning(false);

    // Parse QR code data - expected format: { walletId, userId, name }
    try {
      const walletData = JSON.parse(data);

      // Simulate fetching customer wallet info
      const mockCustomer = {
        id: walletData.walletId || 'wallet-' + Date.now(),
        name: walletData.name || 'Client',
        balance: Math.floor(Math.random() * 100) + 20, // Would come from API
        email: walletData.email,
        phone: walletData.phone,
      };

      setScannedCustomer(mockCustomer);
      router.push('/(staff)/recharge/confirm');
    } catch {
      // If not JSON, treat as wallet ID
      const mockCustomer = {
        id: data,
        name: 'Client #' + data.slice(-4),
        balance: Math.floor(Math.random() * 100) + 20,
      };

      setScannedCustomer(mockCustomer);
      router.push('/(staff)/recharge/confirm');
    }
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un code wallet');
      return;
    }

    const mockCustomer = {
      id: manualCode,
      name: 'Client #' + manualCode.slice(-4),
      balance: Math.floor(Math.random() * 100) + 20,
    };

    setScannedCustomer(mockCustomer);
    router.push('/(staff)/recharge/confirm');
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
            />

            <View className="mt-6 bg-success/10 rounded-xl p-4">
              <Text className="text-gray-500 text-sm">Montant a recharger</Text>
              <Text className="text-2xl font-bold text-success mt-1">
                +{rechargeAmount} {currencyName}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleManualSubmit}
              className="mt-6 bg-success py-4 rounded-xl"
            >
              <Text className="text-white font-semibold text-center text-lg">
                Valider
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
        onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
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
          </View>
          <View className="flex-1 bg-black/50" />
        </View>

        {/* Bottom overlay */}
        <View className="flex-1 bg-black/50" />
      </View>

      {/* Header */}
      <View className="absolute top-0 left-0 right-0 pt-12 pb-4 px-4">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-black/30 rounded-full items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View className="bg-success/80 px-4 py-2 rounded-full">
            <Text className="text-white font-semibold">
              +{rechargeAmount} {currencyName}
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
        <Text className="text-white text-center text-lg font-medium mb-6">
          Scannez le QR code du wallet client
        </Text>

        <TouchableOpacity
          onPress={() => setShowManualEntry(true)}
          className="bg-white/20 py-3 rounded-xl flex-row items-center justify-center"
        >
          <Ionicons name="keypad-outline" size={20} color="#FFFFFF" />
          <Text className="text-white font-medium ml-2">Entrer le code manuellement</Text>
        </TouchableOpacity>

        {!isScanning && (
          <TouchableOpacity
            onPress={() => setIsScanning(true)}
            className="mt-3 bg-success py-3 rounded-xl"
          >
            <Text className="text-white font-medium text-center">Scanner a nouveau</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
