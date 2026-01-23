import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  useScanStore,
  parseQRCode,
  getRouteForQRType,
  ScanEntry,
} from '@/stores/scanStore';
import ScannerOverlay from '@/components/scanner/ScannerOverlay';
import ScanResult from '@/components/scanner/ScanResult';
import ScanHistory from '@/components/scanner/ScanHistory';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ViewMode = 'scanner' | 'history';

export default function UniversalScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('scanner');
  const [isScanning, setIsScanning] = useState(true);
  const [showResult, setShowResult] = useState(false);

  const {
    scanHistory,
    lastScan,
    isProcessing,
    addScan,
    clearHistory,
    removeFromHistory,
    setLastScan,
    setIsProcessing,
  } = useScanStore();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (!isScanning || isProcessing) return;

      setIsScanning(false);
      setIsProcessing(true);

      try {
        // Parse the QR code
        const parsed = parseQRCode(data);

        // Create scan entry
        const scanEntry = addScan({
          rawData: data,
          qrType: parsed.qrType,
          resourceId: parsed.resourceId,
          displayName: parsed.displayName,
          description: parsed.description,
          successful: parsed.qrType !== 'unknown',
        });

        setShowResult(true);
      } catch (error) {
        console.error('Error processing QR code:', error);
        Alert.alert('Erreur', 'Impossible de traiter ce code QR');
        setIsScanning(true);
      } finally {
        setIsProcessing(false);
      }
    },
    [isScanning, isProcessing, addScan, setIsProcessing]
  );

  const handleNavigate = useCallback(() => {
    if (!lastScan) return;

    const routeInfo = getRouteForQRType(lastScan.qrType, lastScan.resourceId);
    if (routeInfo) {
      setShowResult(false);
      setLastScan(null);

      // Navigate based on QR type
      switch (lastScan.qrType) {
        case 'ticket':
          router.push({
            pathname: '/ticket/[id]',
            params: { id: lastScan.resourceId || '' },
          });
          break;
        case 'wallet':
          router.push({
            pathname: '/(staff)/payment/confirm',
            params: { walletId: lastScan.resourceId || '' },
          });
          break;
        case 'stand':
          router.push({
            pathname: '/(tabs)/map',
            params: { standId: lastScan.resourceId || '' },
          });
          break;
      }
    }
  }, [lastScan, router, setLastScan]);

  const handleDismiss = useCallback(() => {
    setShowResult(false);
    setLastScan(null);
  }, [setLastScan]);

  const handleScanAgain = useCallback(() => {
    setShowResult(false);
    setLastScan(null);
    setIsScanning(true);
  }, [setLastScan]);

  const handleSelectFromHistory = useCallback(
    (scan: ScanEntry) => {
      setLastScan(scan);
      setShowResult(true);
      setViewMode('scanner');
    },
    [setLastScan]
  );

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      'Effacer l\'historique',
      'Voulez-vous vraiment effacer tout l\'historique des scans?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: clearHistory,
        },
      ]
    );
  }, [clearHistory]);

  // Permission loading state
  if (!permission) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white">Chargement...</Text>
      </View>
    );
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="flex-1 items-center justify-center p-6">
          <View className="w-24 h-24 bg-white/10 rounded-full items-center justify-center mb-6">
            <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
          </View>
          <Text className="text-white text-2xl font-bold text-center">
            Acces camera requis
          </Text>
          <Text className="text-gray-400 text-center mt-3 px-8">
            Autorisez l'acces a la camera pour scanner les codes QR
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="mt-8 bg-primary px-8 py-4 rounded-xl"
          >
            <Text className="text-white font-semibold text-lg">
              Autoriser la camera
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} className="mt-4 py-3">
            <Text className="text-gray-400">Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // History view
  if (viewMode === 'history') {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-primary pt-4 pb-6 px-4">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => setViewMode('scanner')}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-semibold">
              Historique des scans
            </Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <ScanHistory
          scans={scanHistory}
          onSelectScan={handleSelectFromHistory}
          onClearHistory={handleClearHistory}
          onRemoveScan={removeFromHistory}
        />
      </SafeAreaView>
    );
  }

  // Main scanner view
  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={flashEnabled}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={
          isScanning && !isProcessing ? handleBarCodeScanned : undefined
        }
      />

      {/* Scanner overlay with animated viewfinder */}
      <ScannerOverlay isActive={isScanning && !showResult} accentColor="#6366F1" />

      {/* Header */}
      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View className="px-4 pt-2" pointerEvents="box-none">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-black/30 rounded-full items-center justify-center"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="bg-black/30 px-4 py-2 rounded-full flex-row items-center">
              <Ionicons name="scan" size={18} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Scanner QR</Text>
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

        {/* Bottom controls */}
        <View
          className="absolute bottom-0 left-0 right-0 pb-8 px-6"
          pointerEvents="box-none"
        >
          {/* Instruction text */}
          <Text className="text-white text-center text-lg font-medium mb-4">
            {isProcessing
              ? 'Traitement en cours...'
              : 'Placez un code QR dans le cadre'}
          </Text>

          {/* QR type hints */}
          <View className="flex-row justify-center mb-6 gap-3">
            <View className="bg-white/20 px-3 py-2 rounded-full flex-row items-center">
              <Ionicons name="ticket" size={14} color="#FFFFFF" />
              <Text className="text-white text-xs ml-1">Billets</Text>
            </View>
            <View className="bg-white/20 px-3 py-2 rounded-full flex-row items-center">
              <Ionicons name="wallet" size={14} color="#FFFFFF" />
              <Text className="text-white text-xs ml-1">Paiements</Text>
            </View>
            <View className="bg-white/20 px-3 py-2 rounded-full flex-row items-center">
              <Ionicons name="storefront" size={14} color="#FFFFFF" />
              <Text className="text-white text-xs ml-1">Stands</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setViewMode('history')}
              className="flex-1 bg-white/20 py-4 rounded-xl flex-row items-center justify-center"
            >
              <Ionicons name="time-outline" size={20} color="#FFFFFF" />
              <Text className="text-white font-medium ml-2">Historique</Text>
              {scanHistory.length > 0 && (
                <View className="ml-2 bg-white/30 px-2 py-0.5 rounded-full">
                  <Text className="text-white text-xs font-semibold">
                    {scanHistory.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {!isScanning && !showResult && (
              <TouchableOpacity
                onPress={() => setIsScanning(true)}
                className="flex-1 bg-primary py-4 rounded-xl flex-row items-center justify-center"
              >
                <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
                <Text className="text-white font-medium ml-2">
                  Scanner a nouveau
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Compact history preview */}
          {scanHistory.length > 0 && !showResult && (
            <View className="mt-4">
              <ScanHistory
                scans={scanHistory}
                onSelectScan={handleSelectFromHistory}
                onClearHistory={handleClearHistory}
                maxItems={3}
                compact
              />
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Scan result overlay */}
      <ScanResult
        visible={showResult}
        scan={lastScan}
        onNavigate={handleNavigate}
        onDismiss={handleDismiss}
        onScanAgain={handleScanAgain}
      />
    </View>
  );
}
