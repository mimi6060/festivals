import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWalletStore } from '@/stores/walletStore';

// Preset amounts for quick selection
const PRESET_AMOUNTS = [10, 20, 50, 100];

// Payment methods
type PaymentMethod = 'card' | 'apple_pay' | 'google_pay';

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  available: boolean;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: 'card', name: 'Carte bancaire', icon: 'card-outline', available: true },
  { id: 'apple_pay', name: 'Apple Pay', icon: 'logo-apple', available: Platform.OS === 'ios' },
  { id: 'google_pay', name: 'Google Pay', icon: 'logo-google', available: Platform.OS === 'android' },
];

export default function TopUpScreen() {
  const router = useRouter();
  const { balance, currencyName, exchangeRate, addTransaction } = useWalletStore();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('card');
  const [isProcessing, setIsProcessing] = useState(false);

  // Get the actual amount (either preset or custom)
  const getAmount = useCallback((): number => {
    if (selectedAmount !== null) {
      return selectedAmount;
    }
    const parsed = parseFloat(customAmount);
    return isNaN(parsed) ? 0 : parsed;
  }, [selectedAmount, customAmount]);

  // Calculate tokens from EUR
  const tokensFromEur = useCallback((eur: number): number => {
    return Math.floor(eur / exchangeRate);
  }, [exchangeRate]);

  // Handle preset amount selection
  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  // Handle custom amount change
  const handleCustomAmountChange = (text: string) => {
    // Only allow numbers and decimal point
    const filtered = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = filtered.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filtered;

    setCustomAmount(formatted);
    setSelectedAmount(null);
  };

  // Handle payment
  const handlePayment = async () => {
    const amount = getAmount();

    if (amount < 5) {
      Alert.alert('Montant minimum', 'Le montant minimum de recharge est de 5 EUR.');
      return;
    }

    if (amount > 500) {
      Alert.alert('Montant maximum', 'Le montant maximum de recharge est de 500 EUR.');
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate payment processing
      // In production, this would integrate with Stripe:
      //
      // 1. Create PaymentIntent on backend
      // const { clientSecret } = await api.post('/payments/create-intent', { amount });
      //
      // 2. Confirm payment with Stripe SDK
      // const { paymentIntent } = await stripe.confirmPayment(clientSecret, {
      //   paymentMethodType: selectedPaymentMethod === 'card' ? 'Card' : 'ApplePay',
      // });
      //
      // 3. Verify payment on backend and credit wallet
      // await api.post('/wallet/topup', { paymentIntentId: paymentIntent.id });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate successful payment - add transaction
      const tokens = tokensFromEur(amount);
      const newTransaction = {
        id: `topup-${Date.now()}`,
        type: 'TOP_UP' as const,
        amount: tokens,
        balanceAfter: balance + tokens,
        reference: 'Recharge CB',
        description: `Recharge de ${amount.toFixed(2)} EUR`,
        idempotencyKey: `topup-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        offlineCreated: false,
        synced: true,
        createdAt: new Date().toISOString(),
      };

      addTransaction(newTransaction);

      // Show success and navigate back
      Alert.alert(
        'Recharge reussie !',
        `Vous avez recharge ${tokens} ${currencyName} pour ${amount.toFixed(2)} EUR`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Payment failed:', error);
      Alert.alert(
        'Erreur de paiement',
        'Une erreur est survenue lors du paiement. Veuillez reessayer.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const amount = getAmount();
  const tokens = tokensFromEur(amount);
  const isValidAmount = amount >= 5 && amount <= 500;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4 space-y-6">
          {/* Current Balance */}
          <View className="bg-primary/10 rounded-xl p-4 flex-row items-center justify-between">
            <View>
              <Text className="text-gray-600 text-sm">Solde actuel</Text>
              <Text className="text-primary text-2xl font-bold">
                {balance} {currencyName}
              </Text>
            </View>
            <Ionicons name="wallet" size={32} color="#6366F1" />
          </View>

          {/* Amount Selection */}
          <View>
            <Text className="text-lg font-semibold mb-3">Montant a recharger</Text>

            {/* Preset Amounts */}
            <View className="flex-row flex-wrap -mx-1">
              {PRESET_AMOUNTS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => handlePresetSelect(preset)}
                  className={`w-1/2 p-1`}
                  activeOpacity={0.7}
                >
                  <View
                    className={`rounded-xl p-4 items-center border-2 ${
                      selectedAmount === preset
                        ? 'bg-primary border-primary'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-2xl font-bold ${
                        selectedAmount === preset ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {preset} EUR
                    </Text>
                    <Text
                      className={`text-sm mt-1 ${
                        selectedAmount === preset ? 'text-white/80' : 'text-gray-500'
                      }`}
                    >
                      = {tokensFromEur(preset)} {currencyName}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Amount */}
            <View className="mt-4">
              <Text className="text-gray-600 mb-2">Ou entrez un montant personnalise</Text>
              <View className="bg-white rounded-xl border-2 border-gray-200 flex-row items-center px-4">
                <TextInput
                  value={customAmount}
                  onChangeText={handleCustomAmountChange}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  className="flex-1 py-4 text-xl"
                  placeholderTextColor="#9CA3AF"
                />
                <Text className="text-gray-500 text-lg ml-2">EUR</Text>
              </View>
              {customAmount && !isNaN(parseFloat(customAmount)) && (
                <Text className="text-gray-500 text-sm mt-2">
                  = {tokensFromEur(parseFloat(customAmount))} {currencyName}
                </Text>
              )}
            </View>

            {/* Min/Max info */}
            <View className="flex-row justify-between mt-3">
              <Text className="text-gray-400 text-xs">Min: 5 EUR</Text>
              <Text className="text-gray-400 text-xs">Max: 500 EUR</Text>
            </View>
          </View>

          {/* Payment Method */}
          <View>
            <Text className="text-lg font-semibold mb-3">Mode de paiement</Text>

            <View className="space-y-2">
              {PAYMENT_METHODS.filter(m => m.available).map((method) => (
                <TouchableOpacity
                  key={method.id}
                  onPress={() => setSelectedPaymentMethod(method.id)}
                  className={`bg-white rounded-xl p-4 flex-row items-center border-2 ${
                    selectedPaymentMethod === method.id
                      ? 'border-primary'
                      : 'border-gray-200'
                  }`}
                  activeOpacity={0.7}
                >
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      selectedPaymentMethod === method.id
                        ? 'bg-primary'
                        : 'bg-gray-100'
                    }`}
                  >
                    <Ionicons
                      name={method.icon}
                      size={20}
                      color={selectedPaymentMethod === method.id ? 'white' : '#6B7280'}
                    />
                  </View>
                  <Text className="ml-3 font-medium flex-1">{method.name}</Text>
                  {selectedPaymentMethod === method.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Exchange Rate Info */}
          <View className="bg-blue-50 rounded-xl p-4 flex-row">
            <Ionicons name="information-circle" size={24} color="#3B82F6" />
            <View className="flex-1 ml-3">
              <Text className="text-blue-900 font-medium">Taux de change</Text>
              <Text className="text-blue-700 text-sm mt-1">
                1 EUR = {Math.floor(1 / exchangeRate)} {currencyName}
              </Text>
            </View>
          </View>

          {/* Security Notice */}
          <View className="flex-row items-center justify-center py-2">
            <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
            <Text className="text-gray-400 text-sm ml-2">
              Paiement securise par Stripe
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View className="bg-white border-t border-gray-200 p-4">
        {/* Summary */}
        {isValidAmount && (
          <View className="flex-row justify-between items-center mb-4 bg-gray-50 rounded-xl p-3">
            <View>
              <Text className="text-gray-500 text-sm">Vous recevrez</Text>
              <Text className="text-xl font-bold text-primary">
                {tokens} {currencyName}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-gray-500 text-sm">A payer</Text>
              <Text className="text-xl font-bold">{amount.toFixed(2)} EUR</Text>
            </View>
          </View>
        )}

        {/* Pay Button */}
        <TouchableOpacity
          onPress={handlePayment}
          disabled={!isValidAmount || isProcessing}
          className={`rounded-xl p-4 flex-row items-center justify-center ${
            isValidAmount && !isProcessing
              ? 'bg-primary'
              : 'bg-gray-300'
          }`}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <>
              <ActivityIndicator color="white" />
              <Text className="text-white font-semibold ml-2">Traitement en cours...</Text>
            </>
          ) : (
            <>
              <Ionicons name="card-outline" size={24} color="white" />
              <Text className="text-white font-semibold ml-2 text-lg">
                {isValidAmount
                  ? `Payer ${amount.toFixed(2)} EUR`
                  : 'Selectionnez un montant'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-3 py-2"
          disabled={isProcessing}
        >
          <Text className="text-gray-500 text-center">Annuler</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
