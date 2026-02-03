import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Dimensions,
  Alert,
  Animated,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTicketScanStore, ScanResult, ScanMode } from '@/stores/ticketScanStore';
import { useScanStatsStore } from '@/stores/scanStatsStore';
import ScanResultOverlay from '@/components/staff/ScanResultOverlay';
import { CompactScanStatsCard } from '@/components/scanner/ScanStatsCard';
import { CompactScanChart } from '@/components/scanner/ScanChart';
import { RecentScansPreview } from '@/components/scanner/RecentScans';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.65;

type ViewMode = 'scanner' | 'manual' | 'history';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('scanner');
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [showQuickStats, setShowQuickStats] = useState(false);

  // Animation for quick stats overlay
  const quickStatsAnim = useRef(new Animated.Value(0)).current;

  const {
    scanMode,
    setScanMode,
    scanTicket,
    recentScans: ticketRecentScans,
    todayStats,
    lastScanResult,
    clearLastScanResult,
    isScanning: isProcessing,
  } = useTicketScanStore();

  const {
    totalToday,
    validToday,
    invalidToday,
    hourlyData,
    recentScans: statsRecentScans,
    recordScan,
    checkAndResetIfNewDay,
    getValidPercentage,
  } = useScanStatsStore();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
    // Check for day reset on mount
    checkAndResetIfNewDay();
  }, [permission]);

  // Animate quick stats overlay
  useEffect(() => {
    Animated.spring(quickStatsAnim, {
      toValue: showQuickStats ? 1 : 0,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [showQuickStats]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (!isScanning || isProcessing) return;
      setIsScanning(false);

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
        // Record scan in stats store
        recordScan(result);
        setShowResultOverlay(true);
      } catch (error) {
        Alert.alert('Erreur', 'Impossible de traiter ce code QR');
        setIsScanning(true);
      }
    },
    [isScanning, isProcessing, scanTicket, recordScan]
  );

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un code de billet');
      return;
    }

    const result = await scanTicket(manualCode.trim());
    // Record scan in stats store
    recordScan(result);
    setShowResultOverlay(true);
    setManualCode('');
  };

  const handleResultDismiss = () => {
    setShowResultOverlay(false);
    clearLastScanResult();
    setIsScanning(true);
  };

  const toggleScanMode = () => {
    const newMode: ScanMode = scanMode === 'entry' ? 'exit' : 'entry';
    setScanMode(newMode);
  };

  const navigateToStats = () => {
    setShowQuickStats(false);
    router.push('/scanner/stats');
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

  const validPercentage = getValidPercentage();

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
            <TouchableOpacity onPress={navigateToStats} className="p-2">
              <Ionicons name="stats-chart" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Quick Stats Banner */}
          <QuickStatsBanner
            totalToday={totalToday}
            validPercentage={validPercentage}
            currentlyInside={todayStats.currentlyInside}
            onPress={navigateToStats}
          />

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
          {statsRecentScans.length > 0 && (
            <View className="mt-4">
              <RecentScansPreview
                scans={statsRecentScans}
                maxItems={3}
                onViewAll={() => setViewMode('history')}
              />
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
            <TouchableOpacity onPress={navigateToStats} className="p-2">
              <Ionicons name="stats-chart" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Quick Stats Banner */}
          <QuickStatsBanner
            totalToday={totalToday}
            validPercentage={validPercentage}
            currentlyInside={todayStats.currentlyInside}
            onPress={navigateToStats}
          />

          {/* Scans list */}
          <View className="mt-4">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Scans recents ({statsRecentScans.length})
            </Text>

            {statsRecentScans.length === 0 ? (
              <View className="bg-white rounded-xl p-8 items-center">
                <Ionicons name="scan-outline" size={48} color="#D1D5DB" />
                <Text className="text-gray-500 mt-3 text-center">
                  Aucun scan effectue
                </Text>
              </View>
            ) : (
              statsRecentScans.map((scan) => (
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

      {/* Header with stats button */}
      <View className="absolute top-0 left-0 right-0 pt-4 pb-4 px-4">
        {/* Top row with back and stats */}
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-black/30 rounded-full items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Stats button */}
          <TouchableOpacity
            onPress={() => setShowQuickStats(!showQuickStats)}
            className="flex-row items-center bg-black/30 rounded-full px-4 py-2"
          >
            <Ionicons name="stats-chart" size={18} color="#FFFFFF" />
            <Text className="text-white font-semibold ml-2">{totalToday}</Text>
            <Text className="text-white/70 text-xs ml-1">scans</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFlashEnabled(!flashEnabled)}
            className="w-10 h-10 bg-black/30 rounded-full items-center justify-center"
          >
            <Ionicons
              name={flashEnabled ? 'flash' : 'flash-outline'}
              size={20}
              color={flashEnabled ? '#FCD34D' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>

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
      </View>

      {/* Quick Stats Overlay */}
      <Animated.View
        style={[
          styles.quickStatsOverlay,
          {
            opacity: quickStatsAnim,
            transform: [
              {
                translateY: quickStatsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={showQuickStats ? 'auto' : 'none'}
      >
        <View className="bg-white rounded-2xl p-4 mx-4 mt-28">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">Stats rapides</Text>
            <TouchableOpacity onPress={() => setShowQuickStats(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Stats grid */}
          <View className="flex-row justify-around mb-4">
            <CompactScanStatsCard
              icon="scan-outline"
              value={totalToday}
              label="Total"
              color="blue"
            />
            <CompactScanStatsCard
              icon="checkmark-circle"
              value={validToday}
              label="Valides"
              color="green"
            />
            <CompactScanStatsCard
              icon="close-circle"
              value={invalidToday}
              label="Invalides"
              color="red"
            />
            <CompactScanStatsCard
              icon="trending-up"
              value={validPercentage}
              label="Taux"
              color="green"
              suffix="%"
            />
          </View>

          {/* Mini chart */}
          <View className="mb-4">
            <Text className="text-sm text-gray-500 mb-2">Scans par heure</Text>
            <CompactScanChart data={hourlyData} height={50} />
          </View>

          {/* View full stats button */}
          <TouchableOpacity
            onPress={navigateToStats}
            className="bg-primary py-3 rounded-xl flex-row items-center justify-center"
          >
            <Text className="text-white font-semibold mr-2">Voir toutes les stats</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Animated.View>

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

// Quick stats banner component for non-scanner views
function QuickStatsBanner({
  totalToday,
  validPercentage,
  currentlyInside,
  onPress,
}: {
  totalToday: number;
  validPercentage: number;
  currentlyInside: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-primary rounded-2xl p-4"
      activeOpacity={0.8}
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-row justify-around flex-1">
          <View className="items-center">
            <Text className="text-white/70 text-xs">Scans</Text>
            <Text className="text-white text-xl font-bold">{totalToday}</Text>
          </View>
          <View className="w-px bg-white/20" />
          <View className="items-center">
            <Text className="text-white/70 text-xs">Valides</Text>
            <Text className="text-green-300 text-xl font-bold">{validPercentage}%</Text>
          </View>
          <View className="w-px bg-white/20" />
          <View className="items-center">
            <Text className="text-white/70 text-xs">Sur place</Text>
            <Text className="text-white text-xl font-bold">{currentlyInside}</Text>
          </View>
        </View>
        <View className="ml-4">
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  quickStatsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
});
