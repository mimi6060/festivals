import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { SocialLoginButton } from '@/components/auth/SocialLoginButton';
import {
  KeyboardAvoidingWrapper,
  SafeAreaContainer,
  HapticTouchable,
} from '@/components/common';
import haptics from '@/lib/haptics';

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithEmail, loginWithAuth0, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = 'Email requis';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email invalide';
    }

    if (!password) {
      newErrors.password = 'Mot de passe requis';
    } else if (password.length < 6) {
      newErrors.password = 'Minimum 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailLogin = async () => {
    if (!validateForm()) {
      haptics.error();
      return;
    }

    haptics.buttonPressHeavy();
    try {
      await loginWithEmail(email, password);
      haptics.success();
      router.replace('/(tabs)');
    } catch (error: any) {
      haptics.error();
      Alert.alert('Erreur', error.message || 'Impossible de se connecter');
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'facebook') => {
    haptics.buttonPress();
    try {
      await loginWithAuth0(provider);
      haptics.success();
      router.replace('/(tabs)');
    } catch (error: any) {
      haptics.error();
      Alert.alert('Erreur', error.message || 'Impossible de se connecter');
    }
  };

  return (
    <SafeAreaContainer backgroundColor="#FFFFFF" edges={['top', 'bottom']}>
      <KeyboardAvoidingWrapper
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}
      >
          {/* Header / Branding */}
          <View className="items-center mt-12 mb-8">
            <View className="w-20 h-20 bg-primary rounded-2xl items-center justify-center mb-4">
              <Ionicons name="musical-notes" size={40} color="white" />
            </View>
            <Text className="text-3xl font-bold text-gray-900">Festivals</Text>
            <Text className="text-gray-500 mt-2">Connectez-vous pour continuer</Text>
          </View>

          {/* Social Login Buttons */}
          <View className="space-y-3 mb-6">
            <SocialLoginButton
              provider="google"
              onPress={() => handleSocialLogin('google')}
              disabled={isLoading}
            />
            {Platform.OS === 'ios' && (
              <SocialLoginButton
                provider="apple"
                onPress={() => handleSocialLogin('apple')}
                disabled={isLoading}
              />
            )}
            <SocialLoginButton
              provider="facebook"
              onPress={() => handleSocialLogin('facebook')}
              disabled={isLoading}
            />
          </View>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="mx-4 text-gray-500">ou</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* Email/Password Form */}
          <View className="space-y-4">
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
                  placeholder="Votre mot de passe"
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

            {/* Forgot Password Link */}
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity className="self-end">
                <Text className="text-primary font-medium">Mot de passe oublie ?</Text>
              </TouchableOpacity>
            </Link>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleEmailLogin}
              disabled={isLoading}
              className={`rounded-xl py-4 items-center mt-4 ${
                isLoading ? 'bg-primary/50' : 'bg-primary'
              }`}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-lg">Se connecter</Text>
              )}
            </TouchableOpacity>
          </View>

        {/* Register Link */}
        <View className="flex-row justify-center mt-8">
          <Text className="text-gray-500">Pas encore de compte ? </Text>
          <Link href="/(auth)/register" asChild>
            <HapticTouchable hapticType="light">
              <Text className="text-primary font-semibold">S'inscrire</Text>
            </HapticTouchable>
          </Link>
        </View>
      </KeyboardAvoidingWrapper>
    </SafeAreaContainer>
  );
}
