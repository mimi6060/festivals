import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  nfcManager,
  isNFCSupported,
  isNFCEnabled,
  openNFCSettings,
  NFCTag,
  NFCError,
} from '@/lib/nfc';

interface NFCReaderProps {
  onTagScanned: (tag: NFCTag) => void;
  onError?: (error: NFCError) => void;
  title?: string;
  description?: string;
  autoStart?: boolean;
  showManualInput?: boolean;
  onManualInput?: () => void;
}

type ReaderState = 'idle' | 'checking' | 'ready' | 'scanning' | 'success' | 'error' | 'unsupported' | 'disabled';

export default function NFCReader({
  onTagScanned,
  onError,
  title = 'Scanner NFC',
  description = 'Approchez le bracelet NFC',
  autoStart = false,
  showManualInput = false,
  onManualInput,
}: NFCReaderProps) {
  const [state, setState] = useState<ReaderState>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pulseAnim = new Animated.Value(1);
  const rotateAnim = new Animated.Value(0);

  useEffect(() => {
    checkNFCStatus();
    return () => {
      nfcManager.stopNFCSession();
    };
  }, []);

  useEffect(() => {
    if (state === 'scanning') {
      startPulseAnimation();
    }
  }, [state]);

  const checkNFCStatus = async () => {
    setState('checking');

    const supported = await isNFCSupported();
    if (!supported) {
      setState('unsupported');
      return;
    }

    const enabled = await isNFCEnabled();
    if (!enabled) {
      setState('disabled');
      return;
    }

    setState('ready');

    if (autoStart) {
      startScanning();
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startScanning = async () => {
    setState('scanning');
    setErrorMessage(null);

    try {
      const tag = await nfcManager.readTag('Approchez le bracelet NFC');
      setState('success');
      onTagScanned(tag);
    } catch (error: any) {
      const nfcError: NFCError = {
        code: error.code || 'UNKNOWN',
        message: error.message || 'Erreur lors du scan',
      };

      if (nfcError.code === 'CANCELLED') {
        setState('ready');
      } else {
        setState('error');
        setErrorMessage(nfcError.message);
        onError?.(nfcError);
      }
    }
  };

  const stopScanning = async () => {
    await nfcManager.stopNFCSession();
    setState('ready');
  };

  const renderIcon = () => {
    switch (state) {
      case 'checking':
        return (
          <View className="w-32 h-32 rounded-full bg-gray-100 items-center justify-center">
            <Ionicons name="hourglass" size={48} color="#9CA3AF" />
          </View>
        );
      case 'unsupported':
        return (
          <View className="w-32 h-32 rounded-full bg-red-100 items-center justify-center">
            <Ionicons name="close-circle" size={48} color="#DC2626" />
          </View>
        );
      case 'disabled':
        return (
          <View className="w-32 h-32 rounded-full bg-yellow-100 items-center justify-center">
            <Ionicons name="warning" size={48} color="#D97706" />
          </View>
        );
      case 'ready':
      case 'idle':
        return (
          <View className="w-32 h-32 rounded-full bg-primary/10 items-center justify-center">
            <Ionicons name="card" size={48} color="#6366F1" />
          </View>
        );
      case 'scanning':
        return (
          <Animated.View
            style={{ transform: [{ scale: pulseAnim }] }}
            className="w-32 h-32 rounded-full bg-primary items-center justify-center"
          >
            <Ionicons name="radio" size={48} color="white" />
          </Animated.View>
        );
      case 'success':
        return (
          <View className="w-32 h-32 rounded-full bg-green-100 items-center justify-center">
            <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
          </View>
        );
      case 'error':
        return (
          <View className="w-32 h-32 rounded-full bg-red-100 items-center justify-center">
            <Ionicons name="alert-circle" size={48} color="#DC2626" />
          </View>
        );
    }
  };

  const renderContent = () => {
    switch (state) {
      case 'checking':
        return (
          <>
            <Text className="text-lg font-semibold text-gray-900 mt-6">Verification NFC...</Text>
            <Text className="text-gray-500 text-center mt-2 px-8">
              Verification de la disponibilite du NFC
            </Text>
          </>
        );

      case 'unsupported':
        return (
          <>
            <Text className="text-lg font-semibold text-gray-900 mt-6">NFC non supporte</Text>
            <Text className="text-gray-500 text-center mt-2 px-8">
              Votre appareil ne supporte pas le NFC
            </Text>
            {showManualInput && (
              <TouchableOpacity
                onPress={onManualInput}
                className="mt-6 bg-primary rounded-xl px-6 py-3"
              >
                <Text className="text-white font-medium">Entrer manuellement</Text>
              </TouchableOpacity>
            )}
          </>
        );

      case 'disabled':
        return (
          <>
            <Text className="text-lg font-semibold text-gray-900 mt-6">NFC desactive</Text>
            <Text className="text-gray-500 text-center mt-2 px-8">
              Veuillez activer le NFC dans les parametres
            </Text>
            {Platform.OS === 'android' && (
              <TouchableOpacity
                onPress={openNFCSettings}
                className="mt-6 bg-primary rounded-xl px-6 py-3"
              >
                <Text className="text-white font-medium">Ouvrir les parametres</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={checkNFCStatus}
              className="mt-3 border border-gray-300 rounded-xl px-6 py-3"
            >
              <Text className="text-gray-600 font-medium">Reessayer</Text>
            </TouchableOpacity>
          </>
        );

      case 'ready':
      case 'idle':
        return (
          <>
            <Text className="text-lg font-semibold text-gray-900 mt-6">{title}</Text>
            <Text className="text-gray-500 text-center mt-2 px-8">{description}</Text>
            <TouchableOpacity
              onPress={startScanning}
              className="mt-6 bg-primary rounded-xl px-8 py-4 flex-row items-center"
            >
              <Ionicons name="scan" size={24} color="white" />
              <Text className="ml-2 text-white font-semibold">Commencer le scan</Text>
            </TouchableOpacity>
          </>
        );

      case 'scanning':
        return (
          <>
            <Text className="text-lg font-semibold text-gray-900 mt-6">Scan en cours...</Text>
            <Text className="text-gray-500 text-center mt-2 px-8">
              Approchez le bracelet NFC du telephone
            </Text>
            <TouchableOpacity
              onPress={stopScanning}
              className="mt-6 border border-gray-300 rounded-xl px-6 py-3"
            >
              <Text className="text-gray-600 font-medium">Annuler</Text>
            </TouchableOpacity>
          </>
        );

      case 'success':
        return (
          <>
            <Text className="text-lg font-semibold text-green-700 mt-6">Bracelet detecte!</Text>
            <Text className="text-gray-500 text-center mt-2 px-8">
              Traitement en cours...
            </Text>
          </>
        );

      case 'error':
        return (
          <>
            <Text className="text-lg font-semibold text-red-700 mt-6">Erreur de scan</Text>
            <Text className="text-gray-500 text-center mt-2 px-8">
              {errorMessage || 'Une erreur est survenue'}
            </Text>
            <TouchableOpacity
              onPress={startScanning}
              className="mt-6 bg-primary rounded-xl px-8 py-4 flex-row items-center"
            >
              <Ionicons name="refresh" size={24} color="white" />
              <Text className="ml-2 text-white font-semibold">Reessayer</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <View className="flex-1 items-center justify-center p-8">
      {renderIcon()}
      {renderContent()}
    </View>
  );
}
