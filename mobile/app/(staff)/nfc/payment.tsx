import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Vibration, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { nfcManager, NFCTag, NFCError } from '@/lib/nfc';
import Numpad from '@/components/staff/Numpad';
import NFCReader from '@/components/nfc/NFCReader';

type PaymentStep = 'amount' | 'scan' | 'processing' | 'success' | 'error';

interface PaymentResult {
  transactionId: string;
  amount: number;
  newBalance: number;
  braceletUid: string;
}

export default function NFCPaymentScreen() {
  const [step, setStep] = useState<PaymentStep>('amount');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = parseFloat(amount) || 0;

  const handleAmountConfirm = () => {
    if (numericAmount <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }
    setStep('scan');
  };

  const handleTagScanned = useCallback(async (tag: NFCTag) => {
    setStep('processing');
    Vibration.vibrate(100);

    try {
      // API call to process payment
      // const response = await api.nfc.processPayment({
      //   uid: tag.id,
      //   amount: Math.round(numericAmount * 100), // Convert to cents
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockResult: PaymentResult = {
        transactionId: `TXN-${Date.now()}`,
        amount: numericAmount,
        newBalance: 45.50,
        braceletUid: tag.id,
      };

      setResult(mockResult);
      setStep('success');
      Vibration.vibrate([0, 100, 100, 100]); // Success vibration pattern
    } catch (err: any) {
      setError(err.message || 'Erreur lors du paiement');
      setStep('error');
      Vibration.vibrate([0, 500]); // Error vibration
    }
  }, [numericAmount]);

  const handleScanError = useCallback((err: NFCError) => {
    if (err.code !== 'CANCELLED') {
      setError(err.message);
      setStep('error');
    } else {
      setStep('amount');
    }
  }, []);

  const handleReset = () => {
    setStep('amount');
    setAmount('');
    setResult(null);
    setError(null);
  };

  const handleNewPayment = () => {
    setStep('amount');
    setAmount('');
    setResult(null);
    setError(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const renderAmountStep = () => (
    <View className="flex-1 p-4">
      <Text className="text-lg font-semibold text-gray-900 mb-4 text-center">
        Entrez le montant a debiter
      </Text>

      <Numpad
        value={amount}
        onChange={setAmount}
        maxValue={999}
        currencySymbol="EUR"
      />

      <TouchableOpacity
        onPress={handleAmountConfirm}
        disabled={numericAmount <= 0}
        className={`mt-6 rounded-xl p-4 flex-row items-center justify-center ${
          numericAmount <= 0 ? 'bg-gray-300' : 'bg-primary'
        }`}
      >
        <Ionicons name="card" size={24} color="white" />
        <Text className="ml-2 text-white font-semibold text-lg">
          Scanner le bracelet
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderScanStep = () => (
    <View className="flex-1">
      {/* Amount Display */}
      <View className="bg-primary p-6 items-center">
        <Text className="text-white/80 text-sm">Montant a debiter</Text>
        <Text className="text-white text-4xl font-bold mt-1">
          {formatCurrency(numericAmount)}
        </Text>
      </View>

      {/* NFC Reader */}
      <NFCReader
        onTagScanned={handleTagScanned}
        onError={handleScanError}
        title="Scanner le bracelet"
        description="Approchez le bracelet NFC pour effectuer le paiement"
        autoStart
      />

      {/* Cancel Button */}
      <View className="p-4">
        <TouchableOpacity
          onPress={() => setStep('amount')}
          className="rounded-xl p-4 flex-row items-center justify-center border border-gray-300"
        >
          <Text className="text-gray-600 font-medium">Modifier le montant</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderProcessingStep = () => (
    <View className="flex-1 items-center justify-center p-8">
      <ActivityIndicator size="large" color="#6366F1" />
      <Text className="text-xl font-semibold text-gray-900 mt-6">Traitement en cours...</Text>
      <Text className="text-gray-500 text-center mt-2">
        Veuillez maintenir le bracelet pres du telephone
      </Text>
    </View>
  );

  const renderSuccessStep = () => (
    <View className="flex-1 items-center justify-center p-8">
      <View className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-6">
        <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
      </View>
      <Text className="text-2xl font-bold text-gray-900 text-center">Paiement reussi!</Text>

      <View className="bg-gray-100 rounded-xl p-6 mt-6 w-full">
        <View className="items-center">
          <Text className="text-gray-500 text-sm">Montant debite</Text>
          <Text className="text-3xl font-bold text-gray-900 mt-1">
            {formatCurrency(result?.amount || 0)}
          </Text>
        </View>

        <View className="h-px bg-gray-300 my-4" />

        <View className="flex-row justify-between">
          <Text className="text-gray-500">Nouveau solde</Text>
          <Text className="font-semibold text-gray-900">
            {formatCurrency(result?.newBalance || 0)}
          </Text>
        </View>

        <View className="flex-row justify-between mt-2">
          <Text className="text-gray-500">Transaction</Text>
          <Text className="font-mono text-gray-600 text-sm">{result?.transactionId}</Text>
        </View>

        <View className="flex-row justify-between mt-2">
          <Text className="text-gray-500">Bracelet</Text>
          <Text className="font-mono text-gray-600 text-sm">
            {result?.braceletUid?.substring(0, 16)}...
          </Text>
        </View>
      </View>

      <View className="mt-8 w-full space-y-3">
        <TouchableOpacity
          onPress={handleNewPayment}
          className="bg-primary rounded-xl p-4 flex-row items-center justify-center"
        >
          <Ionicons name="add" size={24} color="white" />
          <Text className="ml-2 text-white font-semibold">Nouveau paiement</Text>
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
      <Text className="text-2xl font-bold text-gray-900 text-center">Paiement echoue</Text>
      <Text className="text-gray-500 text-center mt-2">{error}</Text>

      <View className="mt-8 w-full space-y-3">
        <TouchableOpacity
          onPress={() => setStep('scan')}
          className="bg-primary rounded-xl p-4 flex-row items-center justify-center"
        >
          <Ionicons name="refresh" size={24} color="white" />
          <Text className="ml-2 text-white font-semibold">Reessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleReset}
          className="rounded-xl p-4 flex-row items-center justify-center border border-gray-300"
        >
          <Text className="text-gray-600 font-medium">Modifier le montant</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900 ml-2">Paiement NFC</Text>
      </View>

      {/* Content */}
      {step === 'amount' && renderAmountStep()}
      {step === 'scan' && renderScanStep()}
      {step === 'processing' && renderProcessingStep()}
      {step === 'success' && renderSuccessStep()}
      {step === 'error' && renderErrorStep()}
    </SafeAreaView>
  );
}
