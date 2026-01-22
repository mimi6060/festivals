import React from 'react';
import { View, Text, TouchableOpacity, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  maxValue?: number;
  currencySymbol?: string;
}

const NUMPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'delete'],
];

export default function Numpad({ value, onChange, maxValue = 9999, currencySymbol }: NumpadProps) {
  const handleKeyPress = (key: string) => {
    Vibration.vibrate(10);

    if (key === 'delete') {
      if (value.length > 0) {
        onChange(value.slice(0, -1));
      }
      return;
    }

    // Handle decimal point
    if (key === '.') {
      if (value.includes('.')) return;
      if (value === '') {
        onChange('0.');
        return;
      }
      onChange(value + '.');
      return;
    }

    // Prevent multiple leading zeros
    if (key === '0' && value === '0') return;

    // Limit decimal places to 2
    if (value.includes('.')) {
      const decimals = value.split('.')[1];
      if (decimals && decimals.length >= 2) return;
    }

    const newValue = value === '0' && key !== '.' ? key : value + key;
    const numericValue = parseFloat(newValue) || 0;

    if (numericValue <= maxValue) {
      onChange(newValue);
    }
  };

  const handleClear = () => {
    Vibration.vibrate(20);
    onChange('');
  };

  const displayValue = value || '0';
  const numericDisplay = parseFloat(displayValue) || 0;

  return (
    <View className="bg-white rounded-2xl p-4">
      {/* Display */}
      <View className="bg-gray-50 rounded-xl p-4 mb-4">
        <Text className="text-gray-500 text-sm text-center">Montant</Text>
        <View className="flex-row items-center justify-center mt-2">
          <Text className="text-4xl font-bold text-gray-900">
            {numericDisplay.toFixed(value.includes('.') ? (value.split('.')[1]?.length || 0) : 0)}
          </Text>
          {currencySymbol && (
            <Text className="text-2xl font-semibold text-gray-500 ml-2">{currencySymbol}</Text>
          )}
        </View>
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
                className={`flex-1 h-16 rounded-xl items-center justify-center ${
                  key === 'delete' ? 'bg-gray-100' : 'bg-gray-50'
                } active:bg-gray-200`}
              >
                {key === 'delete' ? (
                  <Ionicons name="backspace-outline" size={28} color="#6B7280" />
                ) : (
                  <Text className="text-2xl font-semibold text-gray-900">{key}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      {/* Quick amounts */}
      <View className="flex-row justify-between mt-4 space-x-2">
        {[5, 10, 15, 20].map((amount) => (
          <TouchableOpacity
            key={amount}
            onPress={() => {
              Vibration.vibrate(10);
              onChange(amount.toString());
            }}
            className="flex-1 py-2 bg-primary-50 rounded-lg items-center"
          >
            <Text className="text-primary font-semibold">{amount}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
