import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';

interface NotificationSettings {
  push: {
    enabled: boolean;
    transactions: boolean;
    lineup: boolean;
    promotions: boolean;
    reminders: boolean;
    security: boolean;
  };
  email: {
    enabled: boolean;
    transactions: boolean;
    lineup: boolean;
    promotions: boolean;
    newsletter: boolean;
  };
  sms: {
    enabled: boolean;
    transactions: boolean;
    security: boolean;
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  push: {
    enabled: true,
    transactions: true,
    lineup: true,
    promotions: true,
    reminders: true,
    security: true,
  },
  email: {
    enabled: true,
    transactions: true,
    lineup: true,
    promotions: false,
    newsletter: false,
  },
  sms: {
    enabled: false,
    transactions: false,
    security: true,
  },
};

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateSetting = <
    T extends keyof NotificationSettings,
    K extends keyof NotificationSettings[T]
  >(
    category: T,
    key: K,
    value: boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const toggleCategory = (category: keyof NotificationSettings) => {
    const currentEnabled = settings[category].enabled;
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        enabled: !currentEnabled,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 800));
      setHasChanges(false);
      Alert.alert('Succes', 'Vos preferences de notifications ont ete mises a jour');
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notifications',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
          ),
          headerRight: () =>
            hasChanges ? (
              <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <Text className="text-primary font-semibold text-base">Enregistrer</Text>
                )}
              </TouchableOpacity>
            ) : null,
        }}
      />
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4">
          {/* Push Notifications Section */}
          <SettingsSection title="Notifications push">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-primary rounded-full items-center justify-center mr-3">
                  <Ionicons name="notifications" size={20} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-semibold">Notifications push</Text>
                  <Text className="text-xs text-gray-500">Activer toutes les notifications push</Text>
                </View>
              </View>
              <Switch
                value={settings.push.enabled}
                onValueChange={() => toggleCategory('push')}
                trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {settings.push.enabled && (
              <>
                <SettingsRow
                  type="toggle"
                  icon="receipt-outline"
                  label="Transactions"
                  description="Achats, recharges et remboursements"
                  value={settings.push.transactions}
                  onValueChange={(v) => updateSetting('push', 'transactions', v)}
                />
                <SettingsRow
                  type="toggle"
                  icon="calendar-outline"
                  label="Programme"
                  description="Changements de lineup et horaires"
                  value={settings.push.lineup}
                  onValueChange={(v) => updateSetting('push', 'lineup', v)}
                />
                <SettingsRow
                  type="toggle"
                  icon="gift-outline"
                  label="Promotions"
                  description="Offres speciales et reductions"
                  value={settings.push.promotions}
                  onValueChange={(v) => updateSetting('push', 'promotions', v)}
                />
                <SettingsRow
                  type="toggle"
                  icon="alarm-outline"
                  label="Rappels"
                  description="Rappels de concerts favoris"
                  value={settings.push.reminders}
                  onValueChange={(v) => updateSetting('push', 'reminders', v)}
                />
                <SettingsRow
                  type="toggle"
                  icon="shield-outline"
                  label="Securite"
                  description="Alertes de securite importantes"
                  value={settings.push.security}
                  onValueChange={(v) => updateSetting('push', 'security', v)}
                  isLast
                />
              </>
            )}
          </SettingsSection>

          {/* Email Notifications Section */}
          <SettingsSection title="Notifications email">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-blue-500 rounded-full items-center justify-center mr-3">
                  <Ionicons name="mail" size={20} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-semibold">Notifications email</Text>
                  <Text className="text-xs text-gray-500">Activer les notifications par email</Text>
                </View>
              </View>
              <Switch
                value={settings.email.enabled}
                onValueChange={() => toggleCategory('email')}
                trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {settings.email.enabled && (
              <>
                <SettingsRow
                  type="toggle"
                  icon="receipt-outline"
                  label="Transactions"
                  description="Confirmations d'achats et recharges"
                  value={settings.email.transactions}
                  onValueChange={(v) => updateSetting('email', 'transactions', v)}
                />
                <SettingsRow
                  type="toggle"
                  icon="calendar-outline"
                  label="Programme"
                  description="Mises a jour du programme"
                  value={settings.email.lineup}
                  onValueChange={(v) => updateSetting('email', 'lineup', v)}
                />
                <SettingsRow
                  type="toggle"
                  icon="gift-outline"
                  label="Promotions"
                  description="Offres speciales et reductions"
                  value={settings.email.promotions}
                  onValueChange={(v) => updateSetting('email', 'promotions', v)}
                />
                <SettingsRow
                  type="toggle"
                  icon="newspaper-outline"
                  label="Newsletter"
                  description="Actualites et nouveautes"
                  value={settings.email.newsletter}
                  onValueChange={(v) => updateSetting('email', 'newsletter', v)}
                  isLast
                />
              </>
            )}
          </SettingsSection>

          {/* SMS Notifications Section */}
          <SettingsSection title="Notifications SMS">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-emerald-500 rounded-full items-center justify-center mr-3">
                  <Ionicons name="chatbubble" size={20} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-semibold">Notifications SMS</Text>
                  <Text className="text-xs text-gray-500">Activer les notifications par SMS</Text>
                </View>
              </View>
              <Switch
                value={settings.sms.enabled}
                onValueChange={() => toggleCategory('sms')}
                trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {settings.sms.enabled && (
              <>
                <SettingsRow
                  type="toggle"
                  icon="receipt-outline"
                  label="Transactions"
                  description="Confirmations de transactions importantes"
                  value={settings.sms.transactions}
                  onValueChange={(v) => updateSetting('sms', 'transactions', v)}
                />
                <SettingsRow
                  type="toggle"
                  icon="shield-outline"
                  label="Securite"
                  description="Codes de verification et alertes"
                  value={settings.sms.security}
                  onValueChange={(v) => updateSetting('sms', 'security', v)}
                  isLast
                />
              </>
            )}
          </SettingsSection>

          {/* Info Text */}
          <View className="px-2 mt-2">
            <Text className="text-xs text-gray-400 text-center">
              Les notifications de securite critiques seront toujours envoyees, meme si les
              notifications sont desactivees.
            </Text>
          </View>

          {/* Save Button */}
          {hasChanges && (
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              className={`mt-6 rounded-xl p-4 flex-row items-center justify-center ${
                isSaving ? 'bg-gray-300' : 'bg-primary'
              }`}
              activeOpacity={0.7}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={24} color="white" />
                  <Text className="text-white font-semibold ml-2">Enregistrer les preferences</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </>
  );
}
