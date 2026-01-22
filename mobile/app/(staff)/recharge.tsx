import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Vibration } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRechargeStore, PaymentMethod } from '@/stores/rechargeStore';
import { useWalletStore } from '@/stores/walletStore';

const QUICK_AMOUNTS = [10, 20, 50, 100];

const NUMPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'delete'],
];

export default function RechargeScreen() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');

  const {
    todayTotal,
    todayCount,
    todayCashTotal,
    todayCardTotal,
    paymentMethod,
    setRechargeAmount,
    setPaymentMethod,
    loadTodayRecharges,
  } = useRechargeStore();

  const { currencyName } = useWalletStore();

  useEffect(() => {
    loadTodayRecharges();
  }, []);

  const numericValue = parseFloat(inputValue) || 0;

  const handleKeyPress = (key: string) => {
    Vibration.vibrate(10);

    if (key === 'delete') {
      if (inputValue.length > 0) {
        setInputValue(inputValue.slice(0, -1));
      }
      return;
    }

    // Handle decimal point
    if (key === '.') {
      if (inputValue.includes('.')) return;
      if (inputValue === '') {
        setInputValue('0.');
        return;
      }
      setInputValue(inputValue + '.');
      return;
    }

    // Prevent multiple leading zeros
    if (key === '0' && inputValue === '0') return;

    // Limit decimal places to 2
    if (inputValue.includes('.')) {
      const decimals = inputValue.split('.')[1];
      if (decimals && decimals.length >= 2) return;
    }

    const newValue = inputValue === '0' && key !== '.' ? key : inputValue + key;
    const newNumericValue = parseFloat(newValue) || 0;

    // Max amount limit
    if (newNumericValue <= 9999) {
      setInputValue(newValue);
    }
  };

  const handleClear = () => {
    Vibration.vibrate(20);
    setInputValue('');
  };

  const handleQuickAmount = (amount: number) => {
    Vibration.vibrate(10);
    setInputValue(amount.toString());
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    Vibration.vibrate(10);
    setPaymentMethod(method);
  };

  const handleScanWallet = () => {
    if (numericValue <= 0) {
      return;
    }
    setRechargeAmount(numericValue);
    router.push('/(staff)/recharge/scan');
  };

  const displayValue = inputValue || '0';

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Today's Stats Card */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-lg font-semibold mb-3">Recharges du jour</Text>
          <View className="flex-row justify-between">
            <View className="flex-1 items-center">
              <Text className="text-3xl font-bold text-success">{todayCount}</Text>
              <Text className="text-gray-500 text-sm mt-1">Recharges</Text>
            </View>
            <View className="w-px bg-gray-200" />
            <View className="flex-1 items-center">
              <Text className="text-3xl font-bold text-primary">{todayTotal}</Text>
              <Text className="text-gray-500 text-sm mt-1">{currencyName}</Text>
            </View>
          </View>

          {/* Cash/Card breakdown */}
          <View className="flex-row mt-4 pt-4 border-t border-gray-100">
            <View className="flex-1 flex-row items-center justify-center">
              <Ionicons name="cash-outline" size={18} color="#10B981" />
              <Text className="text-gray-600 ml-2">{todayCashTotal} {currencyName}</Text>
            </View>
            <View className="flex-1 flex-row items-center justify-center">
              <Ionicons name="card-outline" size={18} color="#6366F1" />
              <Text className="text-gray-600 ml-2">{todayCardTotal} {currencyName}</Text>
            </View>
          </View>
        </View>

        {/* Amount Input Card */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          {/* Display */}
          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <Text className="text-gray-500 text-sm text-center">Montant a recharger</Text>
            <View className="flex-row items-center justify-center mt-2">
              <Text className="text-4xl font-bold text-gray-900">
                {parseFloat(displayValue).toFixed(
                  inputValue.includes('.') ? inputValue.split('.')[1]?.length || 0 : 0
                )}
              </Text>
              <Text className="text-2xl font-semibold text-gray-500 ml-2">{currencyName}</Text>
            </View>
          </View>

          {/* Quick Amounts */}
          <View className="flex-row justify-between mb-4 space-x-2">
            {QUICK_AMOUNTS.map((amount) => (
              <TouchableOpacity
                key={amount}
                onPress={() => handleQuickAmount(amount)}
                className={`flex-1 py-3 rounded-xl items-center ${
                  numericValue === amount ? 'bg-success' : 'bg-success/10'
                }`}
              >
                <Text
                  className={`font-semibold text-lg ${
                    numericValue === amount ? 'text-white' : 'text-success'
                  }`}
                >
                  {amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Numpad Grid */}
          <View className="space-y-2">
            {NUMPAD_KEYS.map((row, rowIndex) => (
              <View key={rowIndex} className="flex-row justify-between space-x-2">
                {row.map((key) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handleKeyPress(key)}
                    onLongPress={key === 'delete' ? handleClear : undefined}
                    className={`flex-1 h-14 rounded-xl items-center justify-center ${
                      key === 'delete' ? 'bg-gray-100' : 'bg-gray-50'
                    } active:bg-gray-200`}
                  >
                    {key === 'delete' ? (
                      <Ionicons name="backspace-outline" size={26} color="#6B7280" />
                    ) : (
                      <Text className="text-2xl font-semibold text-gray-900">{key}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Payment Method Selection */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-lg font-semibold mb-3">Mode de paiement</Text>
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
      </ScrollView>

      {/* Bottom Scan Button */}
      <View className="bg-white border-t border-gray-200 p-4 pb-8">
        <TouchableOpacity
          onPress={handleScanWallet}
          disabled={numericValue <= 0}
          className={`flex-row items-center justify-center py-4 rounded-xl ${
            numericValue > 0 ? 'bg-success' : 'bg-gray-300'
          }`}
        >
          <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
          <Text className="text-white font-semibold text-lg ml-2">Scanner le wallet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
