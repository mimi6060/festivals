import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NFCTag, NFCError } from '@/lib/nfc';
import NFCReader from '@/components/nfc/NFCReader';
import BraceletInfo from '@/components/nfc/BraceletInfo';

type InfoStep = 'scan' | 'loading' | 'info' | 'error';

interface BraceletData {
  uid: string;
  status: 'ACTIVE' | 'UNASSIGNED' | 'BLOCKED' | 'LOST';
  walletId?: string;
  walletBalance: number;
  holderName?: string;
  holderEmail?: string;
  ticketType?: string;
  activatedAt?: string;
  lastUsedAt?: string;
  transactionCount: number;
  totalSpent: number;
}

export default function BraceletInfoScreen() {
  const [step, setStep] = useState<InfoStep>('scan');
  const [braceletData, setBraceletData] = useState<BraceletData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTagScanned = useCallback(async (tag: NFCTag) => {
    setStep('loading');

    try {
      // API call to get bracelet info
      // const response = await api.nfc.getBraceletInfo(tag.id);
      // setBraceletData(response);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockData: BraceletData = {
        uid: tag.id,
        status: 'ACTIVE',
        walletId: 'wallet-123',
        walletBalance: 45.50,
        holderName: 'Jean Dupont',
        holderEmail: 'jean.dupont@email.com',
        ticketType: 'Pass 3 Jours',
        activatedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        transactionCount: 12,
        totalSpent: 85.30,
      };

      setBraceletData(mockData);
      setStep('info');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la recuperation des informations');
      setStep('error');
    }
  }, []);

  const handleScanError = useCallback((err: NFCError) => {
    if (err.code !== 'CANCELLED') {
      setError(err.message);
      setStep('error');
    }
  }, []);

  const handleRescan = () => {
    setStep('scan');
    setBraceletData(null);
    setError(null);
  };

  const handleBlockBracelet = async () => {
    if (!braceletData) return;

    try {
      // await api.nfc.blockBracelet(braceletData.uid, 'Bloque par staff');
      setBraceletData({ ...braceletData, status: 'BLOCKED' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReportLost = async () => {
    if (!braceletData) return;

    try {
      // await api.nfc.reportLost(braceletData.uid);
      setBraceletData({ ...braceletData, status: 'LOST' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const renderScanStep = () => (
    <NFCReader
      onTagScanned={handleTagScanned}
      onError={handleScanError}
      title="Scanner un bracelet"
      description="Approchez le bracelet NFC pour consulter ses informations"
      autoStart
    />
  );

  const renderLoadingStep = () => (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" color="#6366F1" />
      <Text className="text-gray-600 mt-4">Chargement des informations...</Text>
    </View>
  );

  const renderInfoStep = () => (
    <ScrollView className="flex-1">
      {braceletData && (
        <BraceletInfo
          data={braceletData}
          onBlock={handleBlockBracelet}
          onReportLost={handleReportLost}
        />
      )}

      <View className="p-4 space-y-3">
        <TouchableOpacity
          onPress={handleRescan}
          className="bg-primary rounded-xl p-4 flex-row items-center justify-center"
        >
          <Ionicons name="scan" size={24} color="white" />
          <Text className="ml-2 text-white font-semibold">Scanner un autre bracelet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-xl p-4 flex-row items-center justify-center border border-gray-300"
        >
          <Text className="text-gray-600 font-medium">Retour au menu</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderErrorStep = () => (
    <View className="flex-1 items-center justify-center p-8">
      <View className="w-24 h-24 rounded-full bg-red-100 items-center justify-center mb-6">
        <Ionicons name="close-circle" size={64} color="#DC2626" />
      </View>
      <Text className="text-2xl font-bold text-gray-900 text-center">Erreur</Text>
      <Text className="text-gray-500 text-center mt-2">{error}</Text>
      <TouchableOpacity
        onPress={handleRescan}
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
        <Text className="text-lg font-semibold text-gray-900 ml-2">Info bracelet</Text>
      </View>

      {/* Content */}
      {step === 'scan' && renderScanStep()}
      {step === 'loading' && renderLoadingStep()}
      {step === 'info' && renderInfoStep()}
      {step === 'error' && renderErrorStep()}
    </SafeAreaView>
  );
}
