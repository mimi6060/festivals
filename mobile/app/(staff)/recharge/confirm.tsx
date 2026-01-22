import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRechargeStore, PaymentMethod, RechargeTransaction } from '@/stores/rechargeStore';
import { useWalletStore } from '@/stores/walletStore';
import RechargeReceipt from '@/components/staff/RechargeReceipt';

type RechargeState = 'confirm' | 'processing' | 'success' | 'error';

export default function RechargeConfirmScreen() {
  const router = useRouter();
  const [rechargeState, setRechargeState] = useState<RechargeState>('confirm');
  const [errorMessage, setErrorMessage] = useState('');
  const [completedTransaction, setCompletedTransaction] = useState<RechargeTransaction | null>(null);

  const {
    scannedCustomer,
    rechargeAmount,
    paymentMethod,
    setPaymentMethod,
    processRecharge,
    clearRechargeSession,
  } = useRechargeStore();

  const { currencyName } = useWalletStore();

  // Animation values
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const checkmarkOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const receiptSlide = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (rechargeState === 'success') {
      // Success animation
      Animated.parallel([
        Animated.spring(checkmarkScale, {
          toValue: 1,
          tension: 50,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.timing(checkmarkOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Slide in receipt
      Animated.timing(receiptSlide, {
        toValue: 0,
        duration: 400,
        delay: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [rechargeState]);

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method);
  };

  const handleConfirmRecharge = async () => {
    if (!scannedCustomer) return;

    setRechargeState('processing');

    try {
      const transaction = await processRecharge();
      setCompletedTransaction(transaction);
      setRechargeState('success');
    } catch (error) {
      setRechargeState('error');
      setErrorMessage('Une erreur est survenue lors de la recharge');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Annuler la recharge ?',
      'Voulez-vous vraiment annuler cette recharge ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: () => {
            clearRechargeSession();
            router.back();
          },
        },
      ]
    );
  };

  const handleDone = () => {
    clearRechargeSession();
    router.replace('/(staff)/recharge');
  };

  const handleRetry = () => {
    setRechargeState('confirm');
    setErrorMessage('');
  };

  if (!scannedCustomer) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-6">
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="text-xl font-semibold mt-4">Erreur</Text>
        <Text className="text-gray-500 text-center mt-2">
          Aucun client scanne. Veuillez recommencer.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-primary px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Success State
  if (rechargeState === 'success' && completedTransaction) {
    return (
      <View className="flex-1 bg-success">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
          {/* Success Animation */}
          <View className="items-center mb-8">
            <Animated.View
              style={{
                transform: [{ scale: checkmarkScale }],
                opacity: checkmarkOpacity,
              }}
            >
              <Animated.View
                className="w-28 h-28 bg-white rounded-full items-center justify-center"
                style={{ transform: [{ scale: pulseAnim }] }}
              >
                <Ionicons name="checkmark" size={56} color="#10B981" />
              </Animated.View>
            </Animated.View>

            <Text className="text-white text-3xl font-bold mt-6">Recharge reussie !</Text>
            <Text className="text-white/80 text-lg mt-2">
              +{rechargeAmount} {currencyName}
            </Text>
          </View>

          {/* Receipt */}
          <Animated.View style={{ transform: [{ translateY: receiptSlide }] }}>
            <RechargeReceipt transaction={completedTransaction} currencyName={currencyName} />
          </Animated.View>
        </ScrollView>

        {/* Bottom Button */}
        <View className="p-4 pb-8">
          <TouchableOpacity
            onPress={handleDone}
            className="bg-white py-4 rounded-xl"
          >
            <Text className="text-success font-semibold text-lg text-center">
              Nouvelle recharge
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Error State
  if (rechargeState === 'error') {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-6">
        <View className="w-24 h-24 bg-red-100 rounded-full items-center justify-center">
          <Ionicons name="close" size={48} color="#EF4444" />
        </View>

        <Text className="text-2xl font-bold mt-6">Echec de la recharge</Text>
        <Text className="text-gray-500 text-center mt-2">{errorMessage}</Text>

        <View className="w-full mt-8 space-y-3">
          <TouchableOpacity
            onPress={handleRetry}
            className="bg-success py-4 rounded-xl"
          >
            <Text className="text-white font-semibold text-center text-lg">Reessayer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDone}
            className="bg-gray-200 py-4 rounded-xl"
          >
            <Text className="text-gray-700 font-semibold text-center">Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Processing State
  if (rechargeState === 'processing') {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-6">
        <View className="w-24 h-24 bg-success/20 rounded-full items-center justify-center">
          <Ionicons name="hourglass-outline" size={48} color="#10B981" />
        </View>
        <Text className="text-xl font-semibold mt-6">Traitement en cours...</Text>
        <Text className="text-gray-500 mt-2">Veuillez patienter</Text>
      </View>
    );
  }

  // Confirm State (default)
  const newBalance = scannedCustomer.balance + rechargeAmount;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-success pt-12 pb-6 px-4">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={handleCancel} className="p-2">
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-semibold flex-1 text-center mr-8">
            Confirmer la recharge
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Customer Info Card */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <View className="flex-row items-center">
            <View className="w-14 h-14 bg-success/10 rounded-full items-center justify-center">
              <Ionicons name="person-outline" size={28} color="#10B981" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-lg font-semibold">{scannedCustomer.name}</Text>
              <Text className="text-gray-500 text-sm">ID: {scannedCustomer.id.slice(-8)}</Text>
            </View>
          </View>

          <View className="mt-4 bg-gray-50 rounded-xl p-4">
            <Text className="text-gray-500 text-sm">Solde actuel</Text>
            <View className="flex-row items-baseline mt-1">
              <Text className="text-2xl font-bold text-gray-900">
                {scannedCustomer.balance}
              </Text>
              <Text className="text-gray-500 ml-1">{currencyName}</Text>
            </View>
          </View>
        </View>

        {/* Recharge Amount Card */}
        <View className="bg-success rounded-2xl p-6 mb-4">
          <Text className="text-white/80 text-center">Montant a recharger</Text>
          <Text className="text-white text-4xl font-bold text-center mt-2">
            +{rechargeAmount} {currencyName}
          </Text>

          <View className="mt-4 pt-4 border-t border-white/20">
            <View className="flex-row justify-between">
              <Text className="text-white/60">Nouveau solde client</Text>
              <Text className="text-white font-medium">
                {newBalance} {currencyName}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Method Selection */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-lg font-semibold mb-3">Mode de paiement recu</Text>
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={() => handlePaymentMethodChange('CASH')}
              className={`flex-1 flex-row items-center justify-center py-4 rounded-xl border-2 ${
                paymentMethod === 'CASH'
                  ? 'border-success bg-success/10'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <Ionicons
                name="cash-outline"
                size={24}
                color={paymentMethod === 'CASH' ? '#10B981' : '#6B7280'}
              />
              <Text
                className={`font-semibold text-lg ml-2 ${
                  paymentMethod === 'CASH' ? 'text-success' : 'text-gray-600'
                }`}
              >
                Especes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handlePaymentMethodChange('CARD')}
              className={`flex-1 flex-row items-center justify-center py-4 rounded-xl border-2 ${
                paymentMethod === 'CARD'
                  ? 'border-primary bg-primary/10'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <Ionicons
                name="card-outline"
                size={24}
                color={paymentMethod === 'CARD' ? '#6366F1' : '#6B7280'}
              />
              <Text
                className={`font-semibold text-lg ml-2 ${
                  paymentMethod === 'CARD' ? 'text-primary' : 'text-gray-600'
                }`}
              >
                Carte
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment reminder */}
        <View className="bg-amber-50 rounded-xl p-4 flex-row items-center">
          <Ionicons name="information-circle-outline" size={24} color="#F59E0B" />
          <Text className="text-amber-800 ml-3 flex-1">
            Assurez-vous d'avoir recu le paiement de{' '}
            <Text className="font-bold">{rechargeAmount} EUR</Text> en{' '}
            {paymentMethod === 'CASH' ? 'especes' : 'carte'} avant de confirmer.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View className="bg-white border-t border-gray-200 p-4 pb-8">
        <TouchableOpacity
          onPress={handleConfirmRecharge}
          className="py-4 rounded-xl flex-row items-center justify-center bg-success"
        >
          <Ionicons name="checkmark-circle-outline" size={24} color="#FFFFFF" />
          <Text className="text-white font-semibold text-lg ml-2">
            Confirmer la recharge
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCancel}
          className="mt-3 py-3 rounded-xl bg-gray-100"
        >
          <Text className="text-gray-700 font-medium text-center">Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
