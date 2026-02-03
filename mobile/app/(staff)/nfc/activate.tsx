import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { nfcManager, NFCTag, NFCError } from '@/lib/nfc';
import NFCReader from '@/components/nfc/NFCReader';

type ActivationStep = 'scan' | 'input' | 'confirm' | 'success' | 'error';

interface ScannedBracelet {
  uid: string;
  timestamp: Date;
}

export default function ActivateBraceletScreen() {
  const [step, setStep] = useState<ActivationStep>('scan');
  const [scannedBracelet, setScannedBracelet] = useState<ScannedBracelet | null>(null);
  const [walletCode, setWalletCode] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTagScanned = useCallback((tag: NFCTag) => {
    setScannedBracelet({
      uid: tag.id,
      timestamp: new Date(),
    });
    setStep('input');
  }, []);

  const handleScanError = useCallback((err: NFCError) => {
    if (err.code !== 'CANCELLED') {
      setError(err.message);
      setStep('error');
    }
  }, []);

  const handleActivate = async () => {
    if (!scannedBracelet || !walletCode) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      // API call to activate bracelet
      // await api.nfc.activateBracelet({
      //   uid: scannedBracelet.uid,
      //   walletCode,
      //   userName,
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'activation');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('scan');
    setScannedBracelet(null);
    setWalletCode('');
    setUserName('');
    setError(null);
  };

  const renderScanStep = () => (
    <NFCReader
      onTagScanned={handleTagScanned}
      onError={handleScanError}
      title="Scanner le bracelet"
      description="Approchez le bracelet NFC du telephone"
      autoStart
    />
  );

  const renderInputStep = () => (
    <View className="flex-1 p-4">
      {/* Scanned Bracelet Info */}
      <View className="bg-green-50 rounded-xl p-4 border border-green-200 mb-6">
        <View className="flex-row items-center">
          <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
          <Text className="ml-2 text-green-700 font-medium">Bracelet scanne</Text>
        </View>
        <Text className="mt-2 text-gray-600 font-mono text-sm">
          UID: {scannedBracelet?.uid}
        </Text>
      </View>

      {/* Input Fields */}
      <View className="space-y-4">
        <View>
          <Text className="text-gray-700 font-medium mb-2">Code wallet / QR</Text>
          <TextInput
            value={walletCode}
            onChangeText={setWalletCode}
            placeholder="Scannez ou entrez le code wallet"
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
            autoCapitalize="characters"
          />
        </View>

        <View>
          <Text className="text-gray-700 font-medium mb-2">Nom du festivalier (optionnel)</Text>
          <TextInput
            value={userName}
            onChangeText={setUserName}
            placeholder="Nom du festivalier"
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
          />
        </View>
      </View>

      {/* Actions */}
      <View className="mt-8 space-y-3">
        <TouchableOpacity
          onPress={handleActivate}
          disabled={loading || !walletCode}
          className={`rounded-xl p-4 flex-row items-center justify-center ${
            loading || !walletCode ? 'bg-primary/50' : 'bg-primary'
          }`}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="white" />
              <Text className="ml-2 text-white font-semibold text-lg">Activer le bracelet</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleReset}
          className="rounded-xl p-4 flex-row items-center justify-center border border-gray-300"
        >
          <Ionicons name="refresh" size={24} color="#6B7280" />
          <Text className="ml-2 text-gray-600 font-medium">Recommencer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSuccessStep = () => (
    <View className="flex-1 items-center justify-center p-8">
      <View className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-6">
        <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
      </View>
      <Text className="text-2xl font-bold text-gray-900 text-center">Bracelet active!</Text>
      <Text className="text-gray-500 text-center mt-2">
        Le bracelet a ete associe au wallet avec succes.
      </Text>
      <View className="bg-gray-100 rounded-xl p-4 mt-6 w-full">
        <Text className="text-gray-500 text-sm">UID du bracelet</Text>
        <Text className="font-mono text-gray-900">{scannedBracelet?.uid}</Text>
        <Text className="text-gray-500 text-sm mt-3">Code wallet</Text>
        <Text className="font-mono text-gray-900">{walletCode}</Text>
        {userName && (
          <>
            <Text className="text-gray-500 text-sm mt-3">Festivalier</Text>
            <Text className="text-gray-900">{userName}</Text>
          </>
        )}
      </View>
      <View className="mt-8 w-full space-y-3">
        <TouchableOpacity
          onPress={handleReset}
          className="bg-primary rounded-xl p-4 flex-row items-center justify-center"
        >
          <Ionicons name="add" size={24} color="white" />
          <Text className="ml-2 text-white font-semibold">Activer un autre bracelet</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-xl p-4 flex-row items-center justify-center border border-gray-300"
        >
          <Text className="text-gray-600 font-medium">Retour au menu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderErrorStep = () => (
    <View className="flex-1 items-center justify-center p-8">
      <View className="w-24 h-24 rounded-full bg-red-100 items-center justify-center mb-6">
        <Ionicons name="close-circle" size={64} color="#DC2626" />
      </View>
      <Text className="text-2xl font-bold text-gray-900 text-center">Erreur</Text>
      <Text className="text-gray-500 text-center mt-2">{error}</Text>
      <TouchableOpacity
        onPress={handleReset}
        className="mt-8 bg-primary rounded-xl p-4 px-8 flex-row items-center justify-center"
      >
        <Ionicons name="refresh" size={24} color="white" />
        <Text className="ml-2 text-white font-semibold">Reessayer</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900 ml-2">Activer un bracelet</Text>
      </View>

      {/* Content */}
      {step === 'scan' && renderScanStep()}
      {step === 'input' && renderInputStep()}
      {step === 'success' && renderSuccessStep()}
      {step === 'error' && renderErrorStep()}
    </SafeAreaView>
  );
}
