import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuthStore } from '@/stores/authStore';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { ThemeToggle } from '@/components/settings/ThemeToggle';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const BUILD_NUMBER = Constants.expoConfig?.ios?.buildNumber || '1';

type Theme = 'light' | 'dark' | 'system';
type Language = 'fr' | 'en' | 'es' | 'de';

interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'fr', label: 'French', nativeLabel: 'Francais' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Espanol' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();

  // Local state for settings (in production, these would come from a settings store)
  const [theme, setTheme] = useState<Theme>('system');
  const [language, setLanguage] = useState<Language>('fr');

  const handleLogout = () => {
    Alert.alert(
      'Deconnexion',
      'Etes-vous sur de vouloir vous deconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Deconnexion',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleLanguageSelect = () => {
    Alert.alert(
      'Langue',
      'Choisissez votre langue',
      LANGUAGES.map((lang) => ({
        text: lang.nativeLabel,
        onPress: () => setLanguage(lang.code),
        style: language === lang.code ? ('cancel' as const) : ('default' as const),
      })),
      { cancelable: true }
    );
  };

  const getLanguageLabel = () => {
    return LANGUAGES.find((l) => l.code === language)?.nativeLabel || 'Francais';
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://festival-app.example.com/privacy');
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://festival-app.example.com/terms');
  };

  const handleRateApp = () => {
    // In production, use expo-store-review or linking to app store
    Alert.alert('Merci !', 'Votre avis compte beaucoup pour nous.');
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@festival-app.example.com');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Parametres',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4">
          {/* Account Section */}
          <SettingsSection title="Compte">
            <SettingsRow
              type="link"
              icon="person-outline"
              iconColor="#6366F1"
              iconBgColor="bg-indigo-100"
              label="Informations du compte"
              description="Profil, mot de passe, securite"
              onPress={() => router.push('/settings/account')}
            />
          </SettingsSection>

          {/* Notifications Section */}
          <SettingsSection title="Notifications">
            <SettingsRow
              type="link"
              icon="notifications-outline"
              iconColor="#F59E0B"
              iconBgColor="bg-amber-100"
              label="Preferences de notifications"
              description="Push, email, SMS"
              onPress={() => router.push('/settings/notifications')}
              isLast
            />
          </SettingsSection>

          {/* Appearance Section */}
          <SettingsSection title="Apparence">
            <SettingsRow
              type="custom"
              icon="color-palette-outline"
              iconColor="#8B5CF6"
              iconBgColor="bg-purple-100"
              label="Theme"
              description="Personnalisez l'apparence de l'app"
            >
              <ThemeToggle value={theme} onChange={setTheme} />
            </SettingsRow>
            <SettingsRow
              type="value"
              icon="language-outline"
              iconColor="#10B981"
              iconBgColor="bg-emerald-100"
              label="Langue"
              value={getLanguageLabel()}
              onPress={handleLanguageSelect}
              isLast
            />
          </SettingsSection>

          {/* Support Section */}
          <SettingsSection title="Support">
            <SettingsRow
              type="link"
              icon="help-circle-outline"
              iconColor="#3B82F6"
              iconBgColor="bg-blue-100"
              label="Centre d'aide"
              onPress={() => router.push('/profile/help')}
            />
            <SettingsRow
              type="link"
              icon="mail-outline"
              iconColor="#3B82F6"
              iconBgColor="bg-blue-100"
              label="Contacter le support"
              onPress={handleContactSupport}
            />
            <SettingsRow
              type="link"
              icon="star-outline"
              iconColor="#F59E0B"
              iconBgColor="bg-amber-100"
              label="Noter l'application"
              onPress={handleRateApp}
              isLast
            />
          </SettingsSection>

          {/* Legal Section */}
          <SettingsSection title="Legal">
            <SettingsRow
              type="link"
              icon="document-text-outline"
              iconColor="#6B7280"
              iconBgColor="bg-gray-100"
              label="Politique de confidentialite"
              onPress={handlePrivacyPolicy}
            />
            <SettingsRow
              type="link"
              icon="shield-checkmark-outline"
              iconColor="#6B7280"
              iconBgColor="bg-gray-100"
              label="Conditions d'utilisation"
              onPress={handleTermsOfService}
              isLast
            />
          </SettingsSection>

          {/* About Section */}
          <SettingsSection title="A propos">
            <SettingsRow
              type="value"
              icon="information-circle-outline"
              iconColor="#6B7280"
              iconBgColor="bg-gray-100"
              label="Version"
              value={`${APP_VERSION} (${BUILD_NUMBER})`}
              isLast
            />
          </SettingsSection>

          {/* Logout Button */}
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-white rounded-xl p-4 flex-row items-center justify-center mt-2"
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            <Text className="text-red-500 font-semibold ml-2">Deconnexion</Text>
          </TouchableOpacity>

          {/* Footer */}
          <View className="items-center py-8">
            <Text className="text-gray-400 text-xs">Festival App</Text>
            <Text className="text-gray-300 text-xs mt-1">
              {new Date().getFullYear()} Tous droits reserves
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
