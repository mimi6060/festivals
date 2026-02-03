import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { SocialLoginButton } from '@/components/auth/SocialLoginButton';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, loginWithAuth0, isLoading } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = 'Nom requis';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Minimum 2 caracteres';
    }

    if (!email) {
      newErrors.email = 'Email requis';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email invalide';
    }

    if (!password) {
      newErrors.password = 'Mot de passe requis';
    } else if (password.length < 8) {
      newErrors.password = 'Minimum 8 caracteres';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password = 'Doit contenir majuscule, minuscule et chiffre';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmation requise';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    if (!acceptTerms) {
      newErrors.terms = 'Vous devez accepter les conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      await register(name.trim(), email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de creer le compte');
    }
  };

  const handleSocialSignup = async (provider: 'google' | 'apple' | 'facebook') => {
    try {
      await loginWithAuth0(provider);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de se connecter');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 py-8">
          {/* Header */}
          <View className="items-center mt-8 mb-6">
            <View className="w-16 h-16 bg-primary rounded-2xl items-center justify-center mb-3">
              <Ionicons name="musical-notes" size={32} color="white" />
            </View>
            <Text className="text-2xl font-bold text-gray-900">Creer un compte</Text>
            <Text className="text-gray-500 mt-1 text-center">
              Rejoignez la communaute Festivals
            </Text>
          </View>

          {/* Social Signup Buttons */}
          <View className="space-y-3 mb-4">
            <SocialLoginButton
              provider="google"
              onPress={() => handleSocialSignup('google')}
              disabled={isLoading}
              label="Continuer avec Google"
            />
            {Platform.OS === 'ios' && (
              <SocialLoginButton
                provider="apple"
                onPress={() => handleSocialSignup('apple')}
                disabled={isLoading}
                label="Continuer avec Apple"
              />
            )}
          </View>

          {/* Divider */}
          <View className="flex-row items-center my-4">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="mx-4 text-gray-500 text-sm">ou par email</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* Registration Form */}
          <View className="space-y-4">
            {/* Name Input */}
            <View>
              <Text className="text-gray-700 font-medium mb-2">Nom complet</Text>
              <View
                className={`flex-row items-center border rounded-xl px-4 py-3 ${
                  errors.name ? 'border-red-500' : 'border-gray-200'
                }`}
              >
                <Ionicons name="person-outline" size={20} color="#9CA3AF" />
                <TextInput
                  className="flex-1 ml-3 text-gray-900"
                  placeholder="Jean Dupont"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errors.name) setErrors({ ...errors, name: undefined });
                  }}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>
              {errors.name && (
                <Text className="text-red-500 text-sm mt-1">{errors.name}</Text>
              )}
            </View>

            {/* Email Input */}
            <View>
              <Text className="text-gray-700 font-medium mb-2">Email</Text>
              <View
                className={`flex-row items-center border rounded-xl px-4 py-3 ${
                  errors.email ? 'border-red-500' : 'border-gray-200'
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
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {errors.email && (
                <Text className="text-red-500 text-sm mt-1">{errors.email}</Text>
              )}
            </View>

            {/* Password Input */}
            <View>
              <Text className="text-gray-700 font-medium mb-2">Mot de passe</Text>
              <View
                className={`flex-row items-center border rounded-xl px-4 py-3 ${
                  errors.password ? 'border-red-500' : 'border-gray-200'
                }`}
              >
                <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
                <TextInput
                  className="flex-1 ml-3 text-gray-900"
                  placeholder="Minimum 8 caracteres"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text className="text-red-500 text-sm mt-1">{errors.password}</Text>
              )}
            </View>

            {/* Confirm Password Input */}
            <View>
              <Text className="text-gray-700 font-medium mb-2">Confirmer le mot de passe</Text>
              <View
                className={`flex-row items-center border rounded-xl px-4 py-3 ${
                  errors.confirmPassword ? 'border-red-500' : 'border-gray-200'
                }`}
              >
                <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
                <TextInput
                  className="flex-1 ml-3 text-gray-900"
                  placeholder="Confirmez votre mot de passe"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword)
                      setErrors({ ...errors, confirmPassword: undefined });
                  }}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
              </View>
              {errors.confirmPassword && (
                <Text className="text-red-500 text-sm mt-1">{errors.confirmPassword}</Text>
              )}
            </View>

            {/* Terms Checkbox */}
            <TouchableOpacity
              onPress={() => {
                setAcceptTerms(!acceptTerms);
                if (errors.terms) setErrors({ ...errors, terms: undefined });
              }}
              className="flex-row items-start mt-2"
              disabled={isLoading}
            >
              <View
                className={`w-6 h-6 rounded-md border-2 items-center justify-center mr-3 ${
                  acceptTerms ? 'bg-primary border-primary' : 'border-gray-300'
                } ${errors.terms ? 'border-red-500' : ''}`}
              >
                {acceptTerms && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <Text className="flex-1 text-gray-600 text-sm">
                J'accepte les{' '}
                <Text className="text-primary font-medium">Conditions d'utilisation</Text> et la{' '}
                <Text className="text-primary font-medium">Politique de confidentialite</Text>
              </Text>
            </TouchableOpacity>
            {errors.terms && (
              <Text className="text-red-500 text-sm mt-1">{errors.terms}</Text>
            )}

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading}
              className={`rounded-xl py-4 items-center mt-4 ${
                isLoading ? 'bg-primary/50' : 'bg-primary'
              }`}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-lg">Creer mon compte</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <View className="flex-row justify-center mt-6 mb-4">
            <Text className="text-gray-500">Deja un compte ? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-primary font-semibold">Se connecter</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
