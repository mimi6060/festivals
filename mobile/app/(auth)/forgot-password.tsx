import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validateEmail = () => {
    if (!email) {
      setError('Email requis');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Email invalide');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateEmail()) return;

    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'envoyer le lien');
    }
  };

  if (success) {
    return (
      <View className="flex-1 bg-white px-6 py-8 justify-center">
        <View className="items-center">
          <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 text-center">
            Email envoye !
          </Text>
          <Text className="text-gray-500 text-center mt-3 px-4">
            Un lien de reinitialisation a ete envoye a{' '}
            <Text className="font-medium text-gray-700">{email}</Text>
          </Text>
          <Text className="text-gray-400 text-center mt-2 text-sm">
            Verifiez vos spams si vous ne trouvez pas l'email
          </Text>

          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-primary rounded-xl py-4 px-8 mt-8"
          >
            <Text className="text-white font-semibold">Retour a la connexion</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSuccess(false)}
            className="mt-4"
          >
            <Text className="text-primary font-medium">Renvoyer l'email</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 px-6 py-8">
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center mb-8"
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
          <Text className="text-gray-700 ml-2 font-medium">Retour</Text>
        </TouchableOpacity>

        {/* Header */}
        <View className="mb-8">
          <View className="w-16 h-16 bg-primary/10 rounded-2xl items-center justify-center mb-4">
            <Ionicons name="key-outline" size={32} color="#6366F1" />
          </View>
          <Text className="text-2xl font-bold text-gray-900">
            Mot de passe oublie ?
          </Text>
          <Text className="text-gray-500 mt-2">
            Entrez votre email et nous vous enverrons un lien pour reinitialiser votre mot de passe.
          </Text>
        </View>

        {/* Email Input */}
        <View className="mb-6">
          <Text className="text-gray-700 font-medium mb-2">Email</Text>
          <View
            className={`flex-row items-center border rounded-xl px-4 py-3 ${
              error ? 'border-red-500' : 'border-gray-200'
            }`}
          >
            <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
            <TextInput
              className="flex-1 ml-3 text-gray-900"
              placeholder="votre@email.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!isLoading}
            />
          </View>
          {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isLoading}
          className={`rounded-xl py-4 items-center ${
            isLoading ? 'bg-primary/50' : 'bg-primary'
          }`}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-lg">
              Envoyer le lien
            </Text>
          )}
        </TouchableOpacity>

        {/* Help Text */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500">Vous vous souvenez ? </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary font-semibold">Se connecter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
