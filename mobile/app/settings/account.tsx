import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const { profile } = useUserStore();

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const renderAvatar = () => {
    if (profile?.avatarUrl) {
      return (
        <Image
          source={{ uri: profile.avatarUrl }}
          className="w-20 h-20 rounded-full"
          resizeMode="cover"
        />
      );
    }

    const initials =
      profile?.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2) || 'U';

    return (
      <View className="w-20 h-20 bg-primary rounded-full items-center justify-center">
        <Text className="text-white text-2xl font-bold">{initials}</Text>
      </View>
    );
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe actuel');
      return;
    }
    if (!newPassword) {
      Alert.alert('Erreur', 'Veuillez entrer un nouveau mot de passe');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      Alert.alert('Succes', 'Votre mot de passe a ete mis a jour', [
        {
          text: 'OK',
          onPress: () => {
            setIsChangingPassword(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors du changement de mot de passe');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Etes-vous sur de vouloir supprimer votre compte ? Cette action est irreversible et toutes vos donnees seront perdues.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ],
      { cancelable: true }
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Confirmation finale',
      'Tapez "SUPPRIMER" pour confirmer la suppression de votre compte.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Je comprends',
          style: 'destructive',
          onPress: executeDeleteAccount,
        },
      ],
      { cancelable: true }
    );
  };

  const executeDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert('Compte supprime', 'Votre compte a ete supprime avec succes.', [
        {
          text: 'OK',
          onPress: () => {
            logout();
            router.replace('/(auth)/login');
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression du compte');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Compte',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 bg-gray-50">
          <View className="p-4">
            {/* Profile Info Section */}
            <SettingsSection title="Informations du profil">
              <View className="p-4">
                <View className="flex-row items-center">
                  {renderAvatar()}
                  <View className="flex-1 ml-4">
                    <Text className="text-lg font-semibold text-gray-900">
                      {profile?.name || 'Utilisateur'}
                    </Text>
                    <Text className="text-gray-500">{profile?.email}</Text>
                    {profile?.phone && (
                      <Text className="text-gray-400 text-sm mt-1">{profile.phone}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/profile/edit')}
                  className="mt-4 bg-gray-100 rounded-lg py-3 flex-row items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Ionicons name="pencil-outline" size={18} color="#6366F1" />
                  <Text className="text-primary font-medium ml-2">Modifier le profil</Text>
                </TouchableOpacity>
              </View>
            </SettingsSection>

            {/* Security Section */}
            <SettingsSection title="Securite">
              {!isChangingPassword ? (
                <SettingsRow
                  type="link"
                  icon="lock-closed-outline"
                  iconColor="#6366F1"
                  iconBgColor="bg-indigo-100"
                  label="Changer le mot de passe"
                  onPress={() => setIsChangingPassword(true)}
                  isLast
                />
              ) : (
                <View className="p-4">
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 bg-indigo-100 rounded-full items-center justify-center mr-3">
                      <Ionicons name="lock-closed-outline" size={20} color="#6366F1" />
                    </View>
                    <Text className="text-gray-900 font-semibold flex-1">
                      Changer le mot de passe
                    </Text>
                    <TouchableOpacity onPress={() => setIsChangingPassword(false)}>
                      <Ionicons name="close" size={24} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>

                  {/* Current Password */}
                  <View className="mb-3">
                    <Text className="text-sm font-medium text-gray-500 mb-2">
                      Mot de passe actuel
                    </Text>
                    <View className="flex-row items-center bg-gray-50 rounded-lg">
                      <TextInput
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        placeholder="Entrez votre mot de passe actuel"
                        secureTextEntry={!showCurrentPassword}
                        className="flex-1 px-4 py-3 text-gray-900"
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="px-3"
                      >
                        <Ionicons
                          name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* New Password */}
                  <View className="mb-3">
                    <Text className="text-sm font-medium text-gray-500 mb-2">
                      Nouveau mot de passe
                    </Text>
                    <View className="flex-row items-center bg-gray-50 rounded-lg">
                      <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Minimum 8 caracteres"
                        secureTextEntry={!showNewPassword}
                        className="flex-1 px-4 py-3 text-gray-900"
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowNewPassword(!showNewPassword)}
                        className="px-3"
                      >
                        <Ionicons
                          name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Confirm Password */}
                  <View className="mb-4">
                    <Text className="text-sm font-medium text-gray-500 mb-2">
                      Confirmer le mot de passe
                    </Text>
                    <View className="flex-row items-center bg-gray-50 rounded-lg">
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirmez votre nouveau mot de passe"
                        secureTextEntry={!showConfirmPassword}
                        className="flex-1 px-4 py-3 text-gray-900"
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="px-3"
                      >
                        <Ionicons
                          name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Save Button */}
                  <TouchableOpacity
                    onPress={handleChangePassword}
                    disabled={isUpdatingPassword}
                    className={`rounded-lg py-3 flex-row items-center justify-center ${
                      isUpdatingPassword ? 'bg-gray-300' : 'bg-primary'
                    }`}
                    activeOpacity={0.7}
                  >
                    {isUpdatingPassword ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={20} color="white" />
                        <Text className="text-white font-semibold ml-2">
                          Mettre a jour le mot de passe
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </SettingsSection>

            {/* Connected Accounts Section */}
            <SettingsSection title="Comptes connectes">
              <SettingsRow
                type="value"
                icon="logo-google"
                iconColor="#EA4335"
                iconBgColor="bg-red-50"
                label="Google"
                value="Non connecte"
                onPress={() => Alert.alert('Google', 'Connexion Google non disponible')}
              />
              <SettingsRow
                type="value"
                icon="logo-apple"
                iconColor="#000000"
                iconBgColor="bg-gray-100"
                label="Apple"
                value="Non connecte"
                onPress={() => Alert.alert('Apple', 'Connexion Apple non disponible')}
                isLast
              />
            </SettingsSection>

            {/* Danger Zone */}
            <SettingsSection title="Zone de danger">
              <TouchableOpacity
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="p-4 flex-row items-center"
                activeOpacity={0.7}
              >
                <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center mr-3">
                  {isDeletingAccount ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-red-500 font-medium">Supprimer mon compte</Text>
                  <Text className="text-xs text-gray-500">
                    Cette action est irreversible
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#EF4444" />
              </TouchableOpacity>
            </SettingsSection>

            {/* Footer Note */}
            <View className="px-2 mt-2 mb-8">
              <Text className="text-xs text-gray-400 text-center">
                Si vous avez des questions concernant votre compte, contactez notre support a
                support@festival-app.example.com
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
