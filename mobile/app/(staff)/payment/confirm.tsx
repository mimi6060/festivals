import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStaffStore } from '@/stores/staffStore';
import { useWalletStore } from '@/stores/walletStore';

type PaymentState = 'confirm' | 'processing' | 'success' | 'error';

export default function ConfirmScreen() {
  const router = useRouter();
  const [paymentState, setPaymentState] = useState<PaymentState>('confirm');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    scannedCustomer,
    cart,
    cartTotal,
    processPayment,
    clearCart,
    setScannedCustomer,
  } = useStaffStore();

  const { currencyName } = useWalletStore();

  // Animation values
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const checkmarkOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (paymentState === 'success') {
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

      // Auto return after success
      const timeout = setTimeout(() => {
        handleDone();
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [paymentState]);

  const handleConfirmPayment = async () => {
    if (!scannedCustomer) return;

    // Check balance
    if (scannedCustomer.balance < cartTotal) {
      Alert.alert(
        'Solde insuffisant',
        `Le client n'a que ${scannedCustomer.balance} ${currencyName} (besoin de ${cartTotal} ${currencyName})`,
        [{ text: 'OK' }]
      );
      return;
    }

    setPaymentState('processing');

    try {
      await processPayment(scannedCustomer.id);
      setPaymentState('success');
    } catch (error) {
      setPaymentState('error');
      setErrorMessage('Une erreur est survenue lors du paiement');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Annuler le paiement ?',
      'Voulez-vous vraiment annuler ce paiement ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: () => {
            setScannedCustomer(null);
            router.back();
          },
        },
      ]
    );
  };

  const handleDone = () => {
    clearCart();
    setScannedCustomer(null);
    router.replace('/(staff)/payment');
  };

  const handleRetry = () => {
    setPaymentState('confirm');
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
  if (paymentState === 'success') {
    return (
      <View className="flex-1 bg-success items-center justify-center p-6">
        <Animated.View
          style={{
            transform: [{ scale: checkmarkScale }],
            opacity: checkmarkOpacity,
          }}
        >
          <Animated.View
            className="w-32 h-32 bg-white rounded-full items-center justify-center"
            style={{ transform: [{ scale: pulseAnim }] }}
          >
            <Ionicons name="checkmark" size={64} color="#10B981" />
          </Animated.View>
        </Animated.View>

        <Text className="text-white text-3xl font-bold mt-8">Paiement reussi !</Text>
        <Text className="text-white/80 text-lg mt-2">
          {cartTotal} {currencyName} debites
        </Text>

        <View className="bg-white/20 rounded-xl p-4 mt-8 w-full">
          <View className="flex-row justify-between">
            <Text className="text-white/80">Client</Text>
            <Text className="text-white font-medium">{scannedCustomer.name}</Text>
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-white/80">Nouveau solde</Text>
            <Text className="text-white font-medium">
              {scannedCustomer.balance - cartTotal} {currencyName}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleDone}
          className="mt-8 bg-white px-8 py-4 rounded-xl"
        >
          <Text className="text-success font-semibold text-lg">Nouvelle vente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Error State
  if (paymentState === 'error') {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-6">
        <View className="w-24 h-24 bg-red-100 rounded-full items-center justify-center">
          <Ionicons name="close" size={48} color="#EF4444" />
        </View>

        <Text className="text-2xl font-bold mt-6">Echec du paiement</Text>
        <Text className="text-gray-500 text-center mt-2">{errorMessage}</Text>

        <View className="w-full mt-8 space-y-3">
          <TouchableOpacity
            onPress={handleRetry}
            className="bg-primary py-4 rounded-xl"
          >
            <Text className="text-white font-semibold text-center text-lg">Reessayer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCancel}
            className="bg-gray-200 py-4 rounded-xl"
          >
            <Text className="text-gray-700 font-semibold text-center">Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Processing State
  if (paymentState === 'processing') {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-6">
        <View className="w-24 h-24 bg-primary-100 rounded-full items-center justify-center">
          <Ionicons name="hourglass-outline" size={48} color="#6366F1" />
        </View>
        <Text className="text-xl font-semibold mt-6">Traitement en cours...</Text>
        <Text className="text-gray-500 mt-2">Veuillez patienter</Text>
      </View>
    );
  }

  // Confirm State (default)
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-success pt-12 pb-6 px-4">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={handleCancel} className="p-2">
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-semibold flex-1 text-center mr-8">
            Confirmer le paiement
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Customer Info Card */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <View className="flex-row items-center">
            <View className="w-14 h-14 bg-gray-100 rounded-full items-center justify-center">
              <Ionicons name="person-outline" size={28} color="#6B7280" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-lg font-semibold">{scannedCustomer.name}</Text>
              <Text className="text-gray-500 text-sm">ID: {scannedCustomer.id.slice(-8)}</Text>
            </View>
          </View>

          <View className="mt-4 bg-gray-50 rounded-xl p-4">
            <Text className="text-gray-500 text-sm">Solde disponible</Text>
            <View className="flex-row items-baseline mt-1">
              <Text
                className={`text-2xl font-bold ${
                  scannedCustomer.balance >= cartTotal ? 'text-success' : 'text-danger'
                }`}
              >
                {scannedCustomer.balance}
              </Text>
              <Text className="text-gray-500 ml-1">{currencyName}</Text>
            </View>
            {scannedCustomer.balance < cartTotal && (
              <View className="flex-row items-center mt-2">
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text className="text-danger text-sm ml-1">Solde insuffisant</Text>
              </View>
            )}
          </View>
        </View>

        {/* Products List */}
        {cart.length > 0 && (
          <View className="bg-white rounded-2xl p-4 mb-4">
            <Text className="text-lg font-semibold mb-3">Articles</Text>
            <View className="space-y-2">
              {cart.map((item) => (
                <View
                  key={item.product.id}
                  className="flex-row justify-between items-center py-2 border-b border-gray-100"
                >
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 bg-gray-100 rounded-lg items-center justify-center">
                      <Text className="font-medium text-gray-600">{item.quantity}</Text>
                    </View>
                    <Text className="font-medium ml-3">{item.product.name}</Text>
                  </View>
                  <Text className="font-semibold">
                    {item.product.price * item.quantity} {currencyName}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Amount Card */}
        <View className="bg-primary rounded-2xl p-6">
          <Text className="text-white/80 text-center">Montant a debiter</Text>
          <Text className="text-white text-4xl font-bold text-center mt-2">
            {cartTotal} {currencyName}
          </Text>

          <View className="mt-4 pt-4 border-t border-white/20">
            <View className="flex-row justify-between">
              <Text className="text-white/60">Nouveau solde client</Text>
              <Text className="text-white font-medium">
                {scannedCustomer.balance - cartTotal} {currencyName}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View className="bg-white border-t border-gray-200 p-4 pb-8">
        <TouchableOpacity
          onPress={handleConfirmPayment}
          disabled={scannedCustomer.balance < cartTotal}
          className={`py-4 rounded-xl flex-row items-center justify-center ${
            scannedCustomer.balance >= cartTotal ? 'bg-success' : 'bg-gray-300'
          }`}
        >
          <Ionicons name="checkmark-circle-outline" size={24} color="#FFFFFF" />
          <Text className="text-white font-semibold text-lg ml-2">
            Confirmer le paiement
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
