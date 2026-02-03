import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTicketScanStore, ScanResult, ScanMode } from '@/stores/ticketScanStore';
import ScanResultOverlay from '@/components/staff/ScanResultOverlay';
import TicketScanStats from '@/components/staff/TicketScanStats';
import haptics from '@/lib/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.65;

type ViewMode = 'scanner' | 'manual' | 'history';

export default function ScanTicketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('scanner');
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const [showResultOverlay, setShowResultOverlay] = useState(false);

  const {
    scanMode,
    setScanMode,
    scanTicket,
    recentScans,
    todayStats,
    lastScanResult,
    clearLastScanResult,
    isScanning: isProcessing,
  } = useTicketScanStore();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (!isScanning || isProcessing) return;
      setIsScanning(false);
      haptics.scanInProgress();

      try {
        // Parse QR code - expected format could be JSON or plain ticket code
        let ticketCode: string;
        try {
          const parsed = JSON.parse(data);
          ticketCode = parsed.ticketCode || parsed.code || data;
        } catch {
          ticketCode = data;
        }

        const result = await scanTicket(ticketCode);

        // Haptic feedback based on scan result
        if (result?.resultType === 'success') {
          haptics.ticketValidated();
        } else if (result?.resultType === 'already_used') {
          haptics.ticketAlreadyUsed();
        } else {
          haptics.ticketInvalid();
        }

        setShowResultOverlay(true);
      } catch (error) {
        haptics.scanError();
        Alert.alert('Erreur', 'Impossible de traiter ce code QR');
        setIsScanning(true);
      }
    },
    [isScanning, isProcessing, scanTicket]
  );

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      haptics.warning();
      Alert.alert('Erreur', 'Veuillez entrer un code de billet');
      return;
    }

    haptics.buttonPressHeavy();
    const result = await scanTicket(manualCode.trim());

    // Haptic feedback based on scan result
    if (result?.resultType === 'success') {
      haptics.ticketValidated();
    } else if (result?.resultType === 'already_used') {
      haptics.ticketAlreadyUsed();
    } else {
      haptics.ticketInvalid();
    }

    setShowResultOverlay(true);
    setManualCode('');
  };

  const handleResultDismiss = () => {
    setShowResultOverlay(false);
    clearLastScanResult();
    setIsScanning(true);
  };

  const toggleScanMode = () => {
    haptics.toggle();
    const newMode: ScanMode = scanMode === 'entry' ? 'exit' : 'entry';
    setScanMode(newMode);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getResultIcon = (result: ScanResult): keyof typeof Ionicons.glyphMap => {
    switch (result.resultType) {
      case 'success':
        return 'checkmark-circle';
      case 'already_used':
        return 'alert-circle';
      case 'expired':
        return 'time';
      default:
        return 'close-circle';
    }
  };

  const getResultColor = (result: ScanResult): string => {
    switch (result.resultType) {
      case 'success':
        return '#10B981';
      case 'already_used':
        return '#F59E0B';
      case 'expired':
        return '#6B7280';
      default:
        return '#EF4444';
    }
  };

  // Permission loading state
  if (!permission) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white">Chargement...</Text>
      </View>
    );
  }

  // Manual entry view
  if (viewMode === 'manual') {
    return (
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-primary pt-4 pb-6 px-4">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={() => setViewMode('scanner')} className="p-2">
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-semibold">Entree manuelle</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Stats */}
          <TicketScanStats stats={todayStats} compact />

          {/* Manual entry form */}
          <View className="bg-white rounded-2xl p-6 mt-4">
            <Text className="text-gray-600 mb-2">Code du billet</Text>
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Ex: GRIF-WKD-2026-001"
              className="border border-gray-300 rounded-xl px-4 py-3 text-lg"
              autoCapitalize="characters"
              autoCorrect={false}
            />

            {/* Mode indicator */}
            <View className="mt-4 bg-gray-50 rounded-xl p-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons
                  name={scanMode === 'entry' ? 'enter-outline' : 'exit-outline'}
                  size={24}
                  color={scanMode === 'entry' ? '#10B981' : '#EF4444'}
                />
                <Text className="text-gray-700 font-medium ml-2">
                  Mode {scanMode === 'entry' ? 'Entree' : 'Sortie'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={toggleScanMode}
                className="bg-gray-200 px-4 py-2 rounded-lg"
              >
                <Text className="text-gray-600 font-medium">Changer</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleManualSubmit}
              disabled={isProcessing}
              className={`mt-6 py-4 rounded-xl ${
                isProcessing ? 'bg-gray-300' : 'bg-primary'
              }`}
            >
              <Text className="text-white font-semibold text-center text-lg">
                {isProcessing ? 'Verification...' : 'Valider le billet'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Recent scans preview */}
          {recentScans.length > 0 && (
            <View className="mt-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-600 font-medium">Derniers scans</Text>
                <TouchableOpacity onPress={() => setViewMode('history')}>
                  <Text className="text-primary font-medium">Voir tout</Text>
                </TouchableOpacity>
              </View>
              {recentScans.slice(0, 3).map((scan) => (
                <View
                  key={scan.id}
                  className="bg-white rounded-xl p-3 mb-2 flex-row items-center"
                >
                  <Ionicons
                    name={getResultIcon(scan)}
                    size={24}
                    color={getResultColor(scan)}
                  />
                  <View className="flex-1 ml-3">
                    <Text className="font-medium text-gray-900">{scan.holderName}</Text>
                    <Text className="text-sm text-gray-500">{scan.ticketCode}</Text>
                  </View>
                  <Text className="text-xs text-gray-400">
                    {formatTime(scan.scannedAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Result overlay */}
        {lastScanResult && (
          <ScanResultOverlay
            visible={showResultOverlay}
            resultType={lastScanResult.resultType}
            scanMode={lastScanResult.scanMode}
            holderName={lastScanResult.holderName}
            ticketTypeName={lastScanResult.ticketTypeName}
            message={lastScanResult.message}
            entryCount={lastScanResult.entryCount}
            onDismiss={handleResultDismiss}
          />
        )}
      </View>
    );
  }

  // History view
  if (viewMode === 'history') {
    return (
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-primary pt-4 pb-6 px-4">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={() => setViewMode('scanner')} className="p-2">
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-semibold">Historique des scans</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Full stats */}
          <TicketScanStats stats={todayStats} />

          {/* Scans list */}
          <View className="mt-4">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Scans recents ({recentScans.length})
            </Text>

            {recentScans.length === 0 ? (
              <View className="bg-white rounded-xl p-8 items-center">
                <Ionicons name="scan-outline" size={48} color="#D1D5DB" />
                <Text className="text-gray-500 mt-3 text-center">
                  Aucun scan effectue
                </Text>
              </View>
            ) : (
              recentScans.map((scan) => (
                <View
                  key={scan.id}
                  className="bg-white rounded-xl p-4 mb-2"
                >
                  <View className="flex-row items-start">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: `${getResultColor(scan)}20` }}
                    >
                      <Ionicons
                        name={getResultIcon(scan)}
                        size={24}
                        color={getResultColor(scan)}
                      />
                    </View>
                    <View className="flex-1 ml-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="font-semibold text-gray-900">
                          {scan.holderName}
                        </Text>
                        <Text className="text-xs text-gray-400">
                          {formatTime(scan.scannedAt)}
                        </Text>
                      </View>
                      <Text className="text-sm text-gray-600 mt-1">
                        {scan.ticketCode}
                      </Text>
                      <View className="flex-row items-center mt-2">
                        <View
                          className="px-2 py-1 rounded-full"
                          style={{ backgroundColor: `${getResultColor(scan)}20` }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{ color: getResultColor(scan) }}
                          >
                            {scan.message}
                          </Text>
                        </View>
                        <View className="bg-gray-100 px-2 py-1 rounded-full ml-2">
                          <Text className="text-xs text-gray-600">
                            {scan.scanMode === 'entry' ? 'Entree' : 'Sortie'}
                          </Text>
                        </View>
                        <View className="bg-gray-100 px-2 py-1 rounded-full ml-2">
                          <Text className="text-xs text-gray-600">
                            {scan.ticketTypeName}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center p-6">
        <Ionicons name="camera-outline" size={64} color="#FFFFFF" />
        <Text className="text-white text-xl font-semibold mt-4 text-center">
          Acces camera requis
        </Text>
        <Text className="text-gray-400 text-center mt-2">
          Autorisez l'acces a la camera pour scanner les billets
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="mt-6 bg-primary px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Autoriser la camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setViewMode('manual')} className="mt-4">
          <Text className="text-gray-400">Ou entrer le code manuellement</Text>
        </TouchableOpacity>
      </View>
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
        onBarcodeScanned={isScanning && !isProcessing ? handleBarCodeScanned : undefined}
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
            <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
            <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
            <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
            <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
          </View>
          <View className="flex-1 bg-black/50" />
        </View>

        {/* Bottom overlay */}
        <View className="flex-1 bg-black/50" />
      </View>

      {/* Header */}
      <View className="absolute top-0 left-0 right-0 pt-4 pb-4 px-4">
        {/* Mode toggle */}
        <TouchableOpacity
          onPress={toggleScanMode}
          className={`self-center px-6 py-3 rounded-full flex-row items-center ${
            scanMode === 'entry' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          <Ionicons
            name={scanMode === 'entry' ? 'enter-outline' : 'exit-outline'}
            size={20}
            color="#FFFFFF"
          />
          <Text className="text-white font-semibold ml-2">
            Mode {scanMode === 'entry' ? 'Entree' : 'Sortie'}
          </Text>
          <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" className="ml-2" />
        </TouchableOpacity>

        {/* Stats bar */}
        <View className="mt-4 mx-4">
          <TicketScanStats stats={todayStats} compact />
        </View>
      </View>

      {/* Flash toggle */}
      <View className="absolute top-4 right-4">
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

      {/* Bottom controls */}
      <View className="absolute bottom-0 left-0 right-0 pb-8 px-6">
        <Text className="text-white text-center text-lg font-medium mb-6">
          Scannez le QR code du billet
        </Text>

        <View className="flex-row space-x-3">
          <TouchableOpacity
            onPress={() => setViewMode('manual')}
            className="flex-1 bg-white/20 py-3 rounded-xl flex-row items-center justify-center"
          >
            <Ionicons name="keypad-outline" size={20} color="#FFFFFF" />
            <Text className="text-white font-medium ml-2">Manuel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setViewMode('history')}
            className="flex-1 bg-white/20 py-3 rounded-xl flex-row items-center justify-center"
          >
            <Ionicons name="list-outline" size={20} color="#FFFFFF" />
            <Text className="text-white font-medium ml-2">Historique</Text>
          </TouchableOpacity>
        </View>

        {!isScanning && (
          <TouchableOpacity
            onPress={() => setIsScanning(true)}
            className="mt-3 bg-primary py-3 rounded-xl"
          >
            <Text className="text-white font-medium text-center">Scanner a nouveau</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Result overlay */}
      {lastScanResult && (
        <ScanResultOverlay
          visible={showResultOverlay}
          resultType={lastScanResult.resultType}
          scanMode={lastScanResult.scanMode}
          holderName={lastScanResult.holderName}
          ticketTypeName={lastScanResult.ticketTypeName}
          message={lastScanResult.message}
          entryCount={lastScanResult.entryCount}
          onDismiss={handleResultDismiss}
        />
      )}
    </View>
  );
}
