import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, Platform, AppState, AppStateStatus } from 'react-native';
import { useWalletStore, QRPayload } from '@/stores/walletStore';
import * as Brightness from 'expo-brightness';

// We'll use a simple SVG-based QR code generation
// In production, install: expo install react-native-qrcode-svg or expo-barcode-generator
// For now, we'll create a placeholder that shows the QR data

interface QRCodeProps {
  size?: number;
  showTimer?: boolean;
}

// Simple QR code visualization component
// In production, replace with react-native-qrcode-svg:
// import QRCode from 'react-native-qrcode-svg';
const QRCodeSVG: React.FC<{ value: string; size: number }> = ({ value, size }) => {
  // Generate a simple pattern based on the value hash
  const generatePattern = (str: string): boolean[][] => {
    const gridSize = 25;
    const pattern: boolean[][] = [];

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    // Generate pattern with fixed corners (like real QR codes)
    for (let y = 0; y < gridSize; y++) {
      pattern[y] = [];
      for (let x = 0; x < gridSize; x++) {
        // Finder patterns (top-left, top-right, bottom-left corners)
        const isFinderPattern =
          (x < 7 && y < 7) || // Top-left
          (x >= gridSize - 7 && y < 7) || // Top-right
          (x < 7 && y >= gridSize - 7); // Bottom-left

        if (isFinderPattern) {
          // Create the finder pattern
          const isOuterBorder =
            x === 0 || y === 0 ||
            x === 6 || y === 6 ||
            x === gridSize - 1 || y === gridSize - 1 ||
            x === gridSize - 7 || y === gridSize - 7;
          const isInnerSquare =
            (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
            (x >= gridSize - 5 && x <= gridSize - 3 && y >= 2 && y <= 4) ||
            (x >= 2 && x <= 4 && y >= gridSize - 5 && y <= gridSize - 3);

          pattern[y][x] = isOuterBorder || isInnerSquare;
        } else {
          // Generate pseudo-random pattern for data area
          const seed = (hash + x * 31 + y * 17) & 0xFFFFFFFF;
          pattern[y][x] = (seed % 3) !== 0;
        }
      }
    }

    return pattern;
  };

  const pattern = generatePattern(value);
  const cellSize = size / pattern.length;

  return (
    <View style={{ width: size, height: size, flexDirection: 'column' }}>
      {pattern.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.map((cell, x) => (
            <View
              key={`${x}-${y}`}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: cell ? '#000000' : '#FFFFFF',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

export default function WalletQRCode({ size = 200, showTimer = true }: QRCodeProps) {
  const {
    qrPayload,
    qrExpiresAt,
    isLoadingQR,
    generateQR,
    refreshQRIfNeeded
  } = useWalletStore();

  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [originalBrightness, setOriginalBrightness] = useState<number | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Generate QR payload to string for encoding
  const getQRValue = useCallback((payload: QRPayload): string => {
    return JSON.stringify({
      t: payload.token,
      w: payload.walletId,
      u: payload.userId,
      e: payload.expiresAt,
      s: payload.signature,
    });
  }, []);

  // Handle brightness
  const increaseBrightness = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await Brightness.requestPermissionsAsync();
        if (status === 'granted') {
          const current = await Brightness.getBrightnessAsync();
          setOriginalBrightness(current);
          await Brightness.setBrightnessAsync(1);
        }
      }
    } catch (error) {
      console.warn('Failed to increase brightness:', error);
    }
  }, []);

  const restoreBrightness = useCallback(async () => {
    try {
      if (Platform.OS !== 'web' && originalBrightness !== null) {
        await Brightness.setBrightnessAsync(originalBrightness);
        setOriginalBrightness(null);
      }
    } catch (error) {
      console.warn('Failed to restore brightness:', error);
    }
  }, [originalBrightness]);

  // Update timer countdown
  const updateTimer = useCallback(() => {
    if (qrExpiresAt) {
      const remaining = Math.max(0, Math.floor((qrExpiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);
    }
  }, [qrExpiresAt]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - refresh QR if needed
        refreshQRIfNeeded();
        increaseBrightness();
      } else if (nextAppState.match(/inactive|background/)) {
        // App going to background - restore brightness
        restoreBrightness();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [refreshQRIfNeeded, increaseBrightness, restoreBrightness]);

  // Initial QR generation and brightness
  useEffect(() => {
    generateQR();
    increaseBrightness();

    return () => {
      restoreBrightness();
    };
  }, []);

  // Setup auto-refresh interval (every 4 minutes)
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      refreshQRIfNeeded();
    }, 4 * 60 * 1000); // 4 minutes

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshQRIfNeeded]);

  // Setup timer countdown
  useEffect(() => {
    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [updateTimer]);

  // Format time remaining
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get timer color based on time remaining
  const getTimerColor = (): string => {
    if (timeRemaining <= 30) return '#EF4444'; // red
    if (timeRemaining <= 60) return '#F59E0B'; // yellow/orange
    return '#6B7280'; // gray
  };

  if (isLoadingQR && !qrPayload) {
    return (
      <View
        className="bg-white rounded-xl items-center justify-center"
        style={{ width: size + 32, height: size + 32 }}
      >
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="text-gray-500 mt-2">Generation du QR...</Text>
      </View>
    );
  }

  if (!qrPayload) {
    return (
      <View
        className="bg-white rounded-xl items-center justify-center"
        style={{ width: size + 32, height: size + 32 }}
      >
        <Text className="text-red-500">Erreur de generation</Text>
      </View>
    );
  }

  const qrValue = getQRValue(qrPayload);

  return (
    <View className="items-center">
      <View
        className="bg-white rounded-xl p-4"
        style={{ width: size + 32, height: size + 32 }}
      >
        {/*
          In production, use:
          <QRCode value={qrValue} size={size} />

          Install with: npm install react-native-qrcode-svg react-native-svg
          or: expo install react-native-svg && npm install react-native-qrcode-svg
        */}
        <QRCodeSVG value={qrValue} size={size} />
      </View>

      {showTimer && (
        <View className="mt-2 flex-row items-center">
          <View
            className="w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: getTimerColor() }}
          />
          <Text
            className="text-sm"
            style={{ color: getTimerColor() }}
          >
            Expire dans {formatTime(timeRemaining)}
          </Text>
        </View>
      )}

      {isLoadingQR && (
        <View className="absolute inset-0 bg-white/80 items-center justify-center rounded-xl">
          <ActivityIndicator size="small" color="#6366F1" />
        </View>
      )}
    </View>
  );
}
