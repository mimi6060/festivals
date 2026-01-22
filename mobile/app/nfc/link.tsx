import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNFCStore } from '@/stores/nfcStore';
import { useWalletStore } from '@/stores/walletStore';
import { NFCTag, NFCError, openNFCSettings } from '@/lib/nfc';
import NFCScanModal from '@/components/nfc/NFCScanModal';

type LinkStep = 'intro' | 'scanning' | 'confirm' | 'linking' | 'success' | 'error';

export default function NFCLinkScreen() {
  const router = useRouter();
  const {
    linkedTag,
    isNFCSupported,
    isNFCEnabled,
    checkNFCAvailability,
    scanForTag,
    linkTagToWallet,
  } = useNFCStore();

  const { balance } = useWalletStore();

  const [step, setStep] = useState<LinkStep>('intro');
  const [scannedTag, setScannedTag] = useState<NFCTag | null>(null);
  const [error, setError] = useState<NFCError | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);

  // Check NFC availability on mount
  useEffect(() => {
    checkNFCAvailability();
  }, []);

  // Handle already linked tag
  useEffect(() => {
    if (linkedTag?.status === 'active') {
      Alert.alert(
        'Bracelet deja lie',
        'Un bracelet NFC est deja lie a votre compte. Voulez-vous le remplacer?',
        [
          { text: 'Annuler', onPress: () => router.back() },
          { text: 'Remplacer', onPress: () => {} },
        ]
      );
    }
  }, [linkedTag]);

  const handleStartScan = useCallback(async () => {
    // Check NFC availability
    const { supported, enabled } = await checkNFCAvailability();

    if (!supported) {
      Alert.alert(
        'NFC non disponible',
        'Votre appareil ne supporte pas le NFC.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }

    if (!enabled) {
      Alert.alert(
        'NFC desactive',
        'Veuillez activer le NFC dans les parametres de votre appareil.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Parametres', onPress: () => openNFCSettings() },
        ]
      );
      return;
    }

    setStep('scanning');
    setShowScanModal(true);
  }, [checkNFCAvailability, router]);

  const handleScanSuccess = useCallback((tag: NFCTag) => {
    setScannedTag(tag);
    setShowScanModal(false);
    setStep('confirm');
  }, []);

  const handleScanError = useCallback((err: NFCError) => {
    setError(err);
    setShowScanModal(false);

    if (err.code === 'CANCELLED') {
      setStep('intro');
    } else {
      setStep('error');
    }
  }, []);

  const handleScanCancel = useCallback(() => {
    setShowScanModal(false);
    setStep('intro');
  }, []);

  const handleConfirmLink = useCallback(async () => {
    if (!scannedTag?.id) {
      return;
    }

    setStep('linking');

    try {
      // Link tag to wallet (mock wallet ID)
      await linkTagToWallet(scannedTag.id, 'wallet_123');
      setStep('success');
    } catch (err) {
      setError(err as NFCError);
      setStep('error');
    }
  }, [scannedTag, linkTagToWallet]);

  const handleRetry = useCallback(() => {
    setError(null);
    setScannedTag(null);
    setStep('intro');
  }, []);

  const handleFinish = useCallback(() => {
    router.replace('/nfc/info');
  }, [router]);

  const renderIntro = () => (
    <View className="flex-1 items-center justify-center p-6">
      <View className="w-32 h-32 bg-primary/10 rounded-full items-center justify-center mb-8">
        <Ionicons name="wifi" size={64} color="#6366F1" />
      </View>

      <Text className="text-2xl font-bold text-gray-900 text-center mb-4">
        Lier un bracelet NFC
      </Text>

      <Text className="text-gray-600 text-center mb-8 px-4">
        Liez votre bracelet NFC a votre portefeuille pour payer plus rapidement
        aux stands du festival.
      </Text>

      <View className="bg-gray-50 rounded-xl p-4 mb-8 w-full">
        <View className="flex-row items-center mb-3">
          <View className="w-8 h-8 bg-primary rounded-full items-center justify-center mr-3">
            <Text className="text-white font-bold">1</Text>
          </View>
          <Text className="text-gray-700 flex-1">
            Preparez votre bracelet NFC du festival
          </Text>
        </View>

        <View className="flex-row items-center mb-3">
          <View className="w-8 h-8 bg-primary rounded-full items-center justify-center mr-3">
            <Text className="text-white font-bold">2</Text>
          </View>
          <Text className="text-gray-700 flex-1">
            Approchez-le du dos de votre telephone
          </Text>
        </View>

        <View className="flex-row items-center">
          <View className="w-8 h-8 bg-primary rounded-full items-center justify-center mr-3">
            <Text className="text-white font-bold">3</Text>
          </View>
          <Text className="text-gray-700 flex-1">
            Confirmez la liaison
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleStartScan}
        className="bg-primary rounded-xl py-4 px-8 w-full"
      >
        <Text className="text-white font-semibold text-center text-lg">
          Scanner mon bracelet
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        className="mt-4 py-2"
      >
        <Text className="text-gray-500">Annuler</Text>
      </TouchableOpacity>
    </View>
  );

  const renderConfirm = () => (
    <View className="flex-1 items-center justify-center p-6">
      <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6">
        <Ionicons name="checkmark-circle" size={56} color="#22C55E" />
      </View>

      <Text className="text-2xl font-bold text-gray-900 text-center mb-4">
        Bracelet detecte!
      </Text>

      <View className="bg-gray-50 rounded-xl p-4 mb-6 w-full">
        <Text className="text-gray-500 text-sm mb-1">ID du bracelet</Text>
        <Text className="text-gray-900 font-mono text-lg">
          {scannedTag?.id || 'Unknown'}
        </Text>
      </View>

      <View className="bg-blue-50 rounded-xl p-4 mb-8 w-full">
        <View className="flex-row items-center">
          <Ionicons name="information-circle" size={24} color="#3B82F6" />
          <Text className="text-blue-700 ml-2 flex-1">
            Ce bracelet sera lie a votre portefeuille ({balance} credits).
            Vous pourrez payer aux stands en approchant simplement votre bracelet.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleConfirmLink}
        className="bg-primary rounded-xl py-4 px-8 w-full mb-3"
      >
        <Text className="text-white font-semibold text-center text-lg">
          Confirmer la liaison
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleRetry}
        className="py-3"
      >
        <Text className="text-gray-500">Scanner un autre bracelet</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLinking = () => (
    <View className="flex-1 items-center justify-center p-6">
      <ActivityIndicator size="large" color="#6366F1" />
      <Text className="text-gray-600 mt-4">Liaison en cours...</Text>
    </View>
  );

  const renderSuccess = () => (
    <View className="flex-1 items-center justify-center p-6">
      <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6">
        <Ionicons name="checkmark-circle" size={56} color="#22C55E" />
      </View>

      <Text className="text-2xl font-bold text-gray-900 text-center mb-4">
        Bracelet lie!
      </Text>

      <Text className="text-gray-600 text-center mb-8 px-4">
        Votre bracelet NFC est maintenant lie a votre portefeuille.
        Vous pouvez payer en approchant simplement votre bracelet des terminaux.
      </Text>

      <View className="bg-green-50 rounded-xl p-4 mb-8 w-full">
        <View className="flex-row items-center">
          <Ionicons name="shield-checkmark" size={24} color="#22C55E" />
          <Text className="text-green-700 ml-2 flex-1">
            Votre bracelet est securise. En cas de perte, vous pouvez le
            desactiver depuis l'application.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleFinish}
        className="bg-primary rounded-xl py-4 px-8 w-full"
      >
        <Text className="text-white font-semibold text-center text-lg">
          Voir mon bracelet
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View className="flex-1 items-center justify-center p-6">
      <View className="w-24 h-24 bg-red-100 rounded-full items-center justify-center mb-6">
        <Ionicons name="close-circle" size={56} color="#EF4444" />
      </View>

      <Text className="text-2xl font-bold text-gray-900 text-center mb-4">
        Erreur
      </Text>

      <Text className="text-gray-600 text-center mb-4 px-4">
        {error?.message || 'Une erreur est survenue lors de la liaison.'}
      </Text>

      {error?.code === 'TAG_LOST' && (
        <Text className="text-gray-500 text-center mb-8 px-4">
          Maintenez votre bracelet contre le telephone jusqu'a la fin du scan.
        </Text>
      )}

      <TouchableOpacity
        onPress={handleRetry}
        className="bg-primary rounded-xl py-4 px-8 w-full mb-3"
      >
        <Text className="text-white font-semibold text-center text-lg">
          Reessayer
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        className="py-3"
      >
        <Text className="text-gray-500">Annuler</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 'intro':
        return renderIntro();
      case 'scanning':
        return renderIntro(); // Show intro behind modal
      case 'confirm':
        return renderConfirm();
      case 'linking':
        return renderLinking();
      case 'success':
        return renderSuccess();
      case 'error':
        return renderError();
      default:
        return renderIntro();
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2"
        >
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">
          Bracelet NFC
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {renderContent()}
      </ScrollView>

      {/* NFC Scan Modal */}
      <NFCScanModal
        visible={showScanModal}
        onSuccess={handleScanSuccess}
        onError={handleScanError}
        onCancel={handleScanCancel}
        title="Scanner le bracelet"
        message="Approchez votre bracelet NFC du dos de votre telephone"
      />
    </View>
  );
}
