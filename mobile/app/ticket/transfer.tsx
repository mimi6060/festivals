import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTicketStore } from '@/stores/ticketStore';

type TransferState = 'input' | 'confirm' | 'loading' | 'success' | 'error';

export default function TransferTicketScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const router = useRouter();
  const { getTicketById, transferTicket, isLoading, error, clearError } = useTicketStore();

  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [transferState, setTransferState] = useState<TransferState>('input');
  const [transferError, setTransferError] = useState<string | null>(null);

  const ticket = getTicketById(ticketId);

  useEffect(() => {
    return () => {
      clearError();
    };
  }, []);

  if (!ticket) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-4">
        <Stack.Screen options={{ title: 'Transferer' }} />
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="text-gray-900 text-xl font-semibold mt-4">
          Billet introuvable
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-primary rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('Veuillez entrer une adresse email');
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError('Adresse email invalide');
      return false;
    }
    if (email.toLowerCase() === ticket.holderEmail.toLowerCase()) {
      setEmailError('Vous ne pouvez pas transferer le billet a vous-meme');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleContinue = () => {
    if (validateEmail(recipientEmail)) {
      setTransferState('confirm');
    }
  };

  const handleConfirmTransfer = async () => {
    setTransferState('loading');
    setTransferError(null);

    const result = await transferTicket({
      ticketId: ticket.id,
      recipientEmail: recipientEmail.trim().toLowerCase(),
    });

    if (result.success) {
      setTransferState('success');
    } else {
      setTransferError(result.error || 'Une erreur est survenue');
      setTransferState('error');
    }
  };

  const handleGoBack = () => {
    if (transferState === 'confirm') {
      setTransferState('input');
    } else {
      router.back();
    }
  };

  const handleDone = () => {
    router.replace('/(tabs)/tickets');
  };

  const handleRetry = () => {
    setTransferState('input');
    setTransferError(null);
  };

  const renderInputState = () => (
    <>
      {/* Ticket Preview */}
      <View className="bg-white rounded-xl p-4 mx-4 mb-6">
        <Text className="text-gray-500 text-sm mb-1">Billet a transferer</Text>
        <Text className="text-gray-900 font-semibold text-lg">
          {ticket.ticketTypeName}
        </Text>
        <Text className="text-gray-600">
          {ticket.eventName}
        </Text>
      </View>

      {/* Email Input */}
      <View className="mx-4">
        <Text className="text-gray-900 font-semibold mb-2">
          Email du destinataire
        </Text>
        <View className={`flex-row items-center bg-white rounded-xl px-4 py-3 border-2 ${
          emailError ? 'border-red-300' : 'border-gray-200'
        }`}>
          <Ionicons name="mail-outline" size={20} color="#6B7280" />
          <TextInput
            className="flex-1 ml-3 text-gray-900 text-base"
            placeholder="exemple@email.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={recipientEmail}
            onChangeText={(text) => {
              setRecipientEmail(text);
              if (emailError) setEmailError('');
            }}
          />
        </View>
        {emailError && (
          <Text className="text-red-500 text-sm mt-2">{emailError}</Text>
        )}
        <Text className="text-gray-500 text-sm mt-2">
          Le destinataire recevra un email avec les instructions pour accepter le transfert.
        </Text>
      </View>

      {/* Warning */}
      <View className="mx-4 mt-6 bg-yellow-50 rounded-xl p-4">
        <View className="flex-row items-start">
          <Ionicons name="warning" size={24} color="#F59E0B" />
          <View className="ml-3 flex-1">
            <Text className="text-yellow-800 font-medium mb-1">
              Attention
            </Text>
            <Text className="text-yellow-700 text-sm">
              Une fois le transfert confirme, vous ne pourrez plus utiliser ce billet.
              Cette action est irreversible.
            </Text>
          </View>
        </View>
      </View>

      {/* Continue Button */}
      <View className="mx-4 mt-6">
        <TouchableOpacity
          onPress={handleContinue}
          className="bg-primary rounded-xl p-4 items-center"
        >
          <Text className="text-white font-semibold text-lg">Continuer</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderConfirmState = () => (
    <>
      <View className="items-center py-8">
        <View className="bg-primary/10 rounded-full p-6">
          <Ionicons name="swap-horizontal" size={48} color="#6366F1" />
        </View>
        <Text className="text-gray-900 text-xl font-bold mt-4">
          Confirmer le transfert
        </Text>
      </View>

      {/* Transfer Summary */}
      <View className="bg-white rounded-xl p-4 mx-4 mb-4">
        <View className="flex-row items-center py-3 border-b border-gray-100">
          <Ionicons name="ticket-outline" size={20} color="#6B7280" />
          <Text className="text-gray-500 ml-3 flex-1">Billet</Text>
          <Text className="text-gray-900 font-medium">{ticket.ticketTypeName}</Text>
        </View>
        <View className="flex-row items-center py-3 border-b border-gray-100">
          <Ionicons name="calendar-outline" size={20} color="#6B7280" />
          <Text className="text-gray-500 ml-3 flex-1">Evenement</Text>
          <Text className="text-gray-900 font-medium">{ticket.eventName}</Text>
        </View>
        <View className="flex-row items-center py-3">
          <Ionicons name="mail-outline" size={20} color="#6B7280" />
          <Text className="text-gray-500 ml-3 flex-1">Destinataire</Text>
          <Text className="text-gray-900 font-medium">{recipientEmail}</Text>
        </View>
      </View>

      {/* Confirm/Cancel Buttons */}
      <View className="mx-4 mt-4 space-y-3">
        <TouchableOpacity
          onPress={handleConfirmTransfer}
          className="bg-primary rounded-xl p-4 items-center"
        >
          <Text className="text-white font-semibold text-lg">
            Confirmer le transfert
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleGoBack}
          className="bg-gray-100 rounded-xl p-4 items-center mt-3"
        >
          <Text className="text-gray-700 font-semibold text-lg">Annuler</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderLoadingState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color="#6366F1" />
      <Text className="text-gray-600 mt-4 text-lg">Transfert en cours...</Text>
      <Text className="text-gray-400 mt-2">Veuillez patienter</Text>
    </View>
  );

  const renderSuccessState = () => (
    <View className="flex-1 items-center justify-center px-4">
      <View className="bg-green-100 rounded-full p-6">
        <Ionicons name="checkmark-circle" size={64} color="#10B981" />
      </View>
      <Text className="text-gray-900 text-2xl font-bold mt-6 text-center">
        Transfert reussi !
      </Text>
      <Text className="text-gray-600 text-center mt-3 px-4">
        Le billet a ete transfere a {recipientEmail}. Le destinataire recevra un email avec les details.
      </Text>

      <View className="bg-gray-100 rounded-xl p-4 mt-8 w-full">
        <View className="flex-row items-center">
          <Ionicons name="information-circle" size={24} color="#6B7280" />
          <Text className="text-gray-600 ml-3 flex-1">
            Ce billet n'apparaitra plus dans votre liste.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleDone}
        className="bg-primary rounded-xl p-4 items-center mt-8 w-full"
      >
        <Text className="text-white font-semibold text-lg">Terminer</Text>
      </TouchableOpacity>
    </View>
  );

  const renderErrorState = () => (
    <View className="flex-1 items-center justify-center px-4">
      <View className="bg-red-100 rounded-full p-6">
        <Ionicons name="close-circle" size={64} color="#EF4444" />
      </View>
      <Text className="text-gray-900 text-2xl font-bold mt-6 text-center">
        Echec du transfert
      </Text>
      <Text className="text-gray-600 text-center mt-3 px-4">
        {transferError || 'Une erreur est survenue lors du transfert. Veuillez reessayer.'}
      </Text>

      <View className="mt-8 w-full space-y-3">
        <TouchableOpacity
          onPress={handleRetry}
          className="bg-primary rounded-xl p-4 items-center"
        >
          <Text className="text-white font-semibold text-lg">Reessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-gray-100 rounded-xl p-4 items-center mt-3"
        >
          <Text className="text-gray-700 font-semibold text-lg">Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen
        options={{
          title: 'Transferer un billet',
          headerBackTitle: 'Retour',
          headerLeft: transferState === 'success' || transferState === 'loading'
            ? () => null
            : undefined,
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {transferState === 'input' && renderInputState()}
        {transferState === 'confirm' && renderConfirmState()}
        {transferState === 'loading' && renderLoadingState()}
        {transferState === 'success' && renderSuccessState()}
        {transferState === 'error' && renderErrorState()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
