import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSocialStore, Friend } from '@/stores/socialStore';
import { useWalletStore } from '@/stores/walletStore';

interface SendMoneySheetProps {
  friend: Friend | null;
  onClose: () => void;
  onSuccess?: (amount: number) => void;
}

export interface SendMoneySheetRef {
  expand: () => void;
  close: () => void;
}

type SendState = 'input' | 'confirm' | 'loading' | 'success' | 'error';

const QUICK_AMOUNTS = [5, 10, 20, 50];

export const SendMoneySheet = forwardRef<SendMoneySheetRef, SendMoneySheetProps>(
  ({ friend, onClose, onSuccess }, ref) => {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['65%', '85%'], []);

    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [state, setState] = useState<SendState>('input');
    const [error, setError] = useState<string | null>(null);

    const { sendMoney, isSendingMoney } = useSocialStore();
    const { balance, currencyName } = useWalletStore();

    useImperativeHandle(ref, () => ({
      expand: () => {
        resetState();
        bottomSheetRef.current?.expand();
      },
      close: () => bottomSheetRef.current?.close(),
    }));

    const resetState = () => {
      setAmount('');
      setMessage('');
      setState('input');
      setError(null);
    };

    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index === -1) {
          resetState();
          onClose();
        }
      },
      [onClose]
    );

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      ),
      []
    );

    const numericAmount = parseFloat(amount) || 0;
    const isValidAmount = numericAmount > 0 && numericAmount <= balance;

    const handleQuickAmount = (value: number) => {
      setAmount(value.toString());
      setError(null);
    };

    const handleAmountChange = (text: string) => {
      // Only allow numbers and one decimal point
      const sanitized = text.replace(/[^0-9.]/g, '');
      const parts = sanitized.split('.');
      if (parts.length > 2) return;
      if (parts[1]?.length > 2) return;
      setAmount(sanitized);
      setError(null);
    };

    const handleContinue = () => {
      if (!isValidAmount) {
        if (numericAmount <= 0) {
          setError('Entrez un montant valide');
        } else if (numericAmount > balance) {
          setError('Solde insuffisant');
        }
        return;
      }
      setState('confirm');
    };

    const handleConfirm = async () => {
      if (!friend) return;

      setState('loading');
      setError(null);

      const result = await sendMoney({
        friendId: friend.id,
        amount: numericAmount,
        message: message.trim() || undefined,
      });

      if (result.success) {
        setState('success');
        setTimeout(() => {
          onSuccess?.(numericAmount);
          bottomSheetRef.current?.close();
        }, 2000);
      } else {
        setError(result.error || 'Une erreur est survenue');
        setState('error');
      }
    };

    const handleBack = () => {
      if (state === 'confirm') {
        setState('input');
      } else if (state === 'error') {
        setState('input');
        setError(null);
      }
    };

    if (!friend) return null;

    const renderInputState = () => (
      <>
        {/* Recipient */}
        <View className="items-center mb-6">
          <View className="w-16 h-16 bg-primary rounded-full items-center justify-center mb-2">
            <Text className="text-white text-2xl font-bold">
              {friend.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase()}
            </Text>
          </View>
          <Text className="text-gray-900 font-semibold text-lg">{friend.name}</Text>
          <Text className="text-gray-500">@{friend.username}</Text>
        </View>

        {/* Amount Input */}
        <View className="mb-4">
          <Text className="text-gray-600 text-sm mb-2 text-center">Montant a envoyer</Text>
          <View className="flex-row items-center justify-center bg-gray-100 rounded-xl py-4 px-6">
            <TextInput
              className="text-4xl font-bold text-gray-900 text-center min-w-[60px]"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={handleAmountChange}
              maxLength={10}
            />
            <Text className="text-2xl font-semibold text-gray-500 ml-2">{currencyName}</Text>
          </View>
          {error && <Text className="text-red-500 text-sm text-center mt-2">{error}</Text>}
          <Text className="text-gray-400 text-sm text-center mt-2">
            Solde disponible: {balance} {currencyName}
          </Text>
        </View>

        {/* Quick Amounts */}
        <View className="flex-row justify-center mb-6">
          {QUICK_AMOUNTS.map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => handleQuickAmount(value)}
              className={`px-4 py-2 rounded-full mx-1 ${
                amount === value.toString() ? 'bg-primary' : 'bg-gray-100'
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`font-medium ${
                  amount === value.toString() ? 'text-white' : 'text-gray-700'
                }`}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Message Input */}
        <View className="mb-6">
          <TextInput
            className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
            placeholder="Ajouter un message (optionnel)"
            placeholderTextColor="#9CA3AF"
            value={message}
            onChangeText={setMessage}
            maxLength={100}
          />
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleContinue}
          disabled={!isValidAmount}
          className={`rounded-xl p-4 items-center ${
            isValidAmount ? 'bg-primary' : 'bg-gray-300'
          }`}
          activeOpacity={0.8}
        >
          <Text className={`font-semibold text-lg ${isValidAmount ? 'text-white' : 'text-gray-500'}`}>
            Continuer
          </Text>
        </TouchableOpacity>
      </>
    );

    const renderConfirmState = () => (
      <>
        {/* Summary */}
        <View className="items-center mb-6">
          <View className="bg-primary/10 rounded-full p-4 mb-4">
            <Ionicons name="paper-plane" size={32} color="#6366F1" />
          </View>
          <Text className="text-gray-900 text-xl font-bold">Confirmer l'envoi</Text>
        </View>

        <View className="bg-gray-50 rounded-xl p-4 mb-6">
          <View className="flex-row items-center justify-between py-2 border-b border-gray-200">
            <Text className="text-gray-500">Destinataire</Text>
            <Text className="text-gray-900 font-medium">{friend.name}</Text>
          </View>
          <View className="flex-row items-center justify-between py-2 border-b border-gray-200">
            <Text className="text-gray-500">Montant</Text>
            <Text className="text-gray-900 font-semibold text-lg">
              {numericAmount} {currencyName}
            </Text>
          </View>
          {message && (
            <View className="py-2">
              <Text className="text-gray-500">Message</Text>
              <Text className="text-gray-900 mt-1">{message}</Text>
            </View>
          )}
        </View>

        <View className="flex-row space-x-3">
          <TouchableOpacity
            onPress={handleBack}
            className="flex-1 bg-gray-100 rounded-xl p-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-gray-700 font-semibold">Retour</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleConfirm}
            className="flex-1 bg-primary rounded-xl p-4 items-center ml-3"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold">Confirmer</Text>
          </TouchableOpacity>
        </View>
      </>
    );

    const renderLoadingState = () => (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="text-gray-600 mt-4 text-lg">Envoi en cours...</Text>
        <Text className="text-gray-400 mt-1">Veuillez patienter</Text>
      </View>
    );

    const renderSuccessState = () => (
      <View className="flex-1 items-center justify-center py-8">
        <View className="bg-green-100 rounded-full p-6 mb-4">
          <Ionicons name="checkmark-circle" size={64} color="#10B981" />
        </View>
        <Text className="text-gray-900 text-xl font-bold">Envoi reussi !</Text>
        <Text className="text-gray-500 text-center mt-2 px-4">
          {numericAmount} {currencyName} ont ete envoyes a {friend.name}
        </Text>
      </View>
    );

    const renderErrorState = () => (
      <View className="flex-1 items-center justify-center py-8">
        <View className="bg-red-100 rounded-full p-6 mb-4">
          <Ionicons name="close-circle" size={64} color="#EF4444" />
        </View>
        <Text className="text-gray-900 text-xl font-bold">Echec de l'envoi</Text>
        <Text className="text-gray-500 text-center mt-2 px-4">
          {error || 'Une erreur est survenue lors du transfert.'}
        </Text>
        <TouchableOpacity
          onPress={handleBack}
          className="bg-primary rounded-xl px-6 py-3 mt-6"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold">Reessayer</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: '#D1D5DB', width: 40 }}
        backgroundStyle={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <BottomSheetView style={{ flex: 1, padding: 20 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              {state === 'confirm' || state === 'error' ? (
                <TouchableOpacity onPress={handleBack} className="p-2 -ml-2">
                  <Ionicons name="arrow-back" size={24} color="#6B7280" />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 40 }} />
              )}
              <Text className="text-lg font-semibold text-gray-900">Envoyer de l'argent</Text>
              <TouchableOpacity onPress={() => bottomSheetRef.current?.close()} className="p-2 -mr-2">
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {state === 'input' && renderInputState()}
            {state === 'confirm' && renderConfirmState()}
            {state === 'loading' && renderLoadingState()}
            {state === 'success' && renderSuccessState()}
            {state === 'error' && renderErrorState()}
          </BottomSheetView>
        </KeyboardAvoidingView>
      </BottomSheet>
    );
  }
);

SendMoneySheet.displayName = 'SendMoneySheet';

export default SendMoneySheet;
