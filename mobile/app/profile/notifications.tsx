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
import { useUserStore, NotificationPreferences } from '@/stores/userStore';

interface NotificationCategory {
  key: 'transactions' | 'lineup' | 'promotions';
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: 'transactions',
    title: 'Transactions',
    description: 'Recharges, achats et remboursements',
    icon: 'receipt-outline',
  },
  {
    key: 'lineup',
    title: 'Programme',
    description: 'Changements de lineup et rappels de concerts',
    icon: 'calendar-outline',
  },
  {
    key: 'promotions',
    title: 'Promotions',
    description: 'Offres speciales et actualites',
    icon: 'gift-outline',
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notificationPreferences,
    updateNotificationPreferences,
    isUpdatingPreferences,
  } = useUserStore();

  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>(notificationPreferences);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalPrefs(notificationPreferences);
  }, [notificationPreferences]);

  const handleToggle = (
    channel: 'email' | 'push',
    category: 'transactions' | 'lineup' | 'promotions'
  ) => {
    const newPrefs: NotificationPreferences = {
      ...localPrefs,
      [channel]: {
        ...localPrefs[channel],
        [category]: !localPrefs[channel][category],
      },
    };
    setLocalPrefs(newPrefs);
    setHasChanges(true);
  };

  const handleToggleAllPush = () => {
    const allEnabled =
      localPrefs.push.transactions && localPrefs.push.lineup && localPrefs.push.promotions;
    const newPrefs: NotificationPreferences = {
      ...localPrefs,
      push: {
        transactions: !allEnabled,
        lineup: !allEnabled,
        promotions: !allEnabled,
      },
    };
    setLocalPrefs(newPrefs);
    setHasChanges(true);
  };

  const handleToggleAllEmail = () => {
    const allEnabled =
      localPrefs.email.transactions && localPrefs.email.lineup && localPrefs.email.promotions;
    const newPrefs: NotificationPreferences = {
      ...localPrefs,
      email: {
        transactions: !allEnabled,
        lineup: !allEnabled,
        promotions: !allEnabled,
      },
    };
    setLocalPrefs(newPrefs);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateNotificationPreferences(localPrefs);
      setHasChanges(false);
      Alert.alert('Succes', 'Vos preferences de notifications ont ete mises a jour');
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de la mise a jour des preferences');
    }
  };

  const isPushAllEnabled =
    localPrefs.push.transactions && localPrefs.push.lineup && localPrefs.push.promotions;
  const isEmailAllEnabled =
    localPrefs.email.transactions && localPrefs.email.lineup && localPrefs.email.promotions;

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
              <TouchableOpacity onPress={handleSave} disabled={isUpdatingPreferences}>
                {isUpdatingPreferences ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <Text className="text-primary font-semibold text-base">Enregistrer</Text>
                )}
              </TouchableOpacity>
            ) : null,
        }}
      />
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4 space-y-6">
          {/* Push Notifications Section */}
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View className="w-8 h-8 bg-primary rounded-full items-center justify-center">
                  <Ionicons name="notifications" size={16} color="white" />
                </View>
                <Text className="text-lg font-semibold ml-3">Notifications push</Text>
              </View>
              <Switch
                value={isPushAllEnabled}
                onValueChange={handleToggleAllPush}
                trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View className="bg-white rounded-xl">
              {NOTIFICATION_CATEGORIES.map((category, index) => (
                <View
                  key={category.key}
                  className={`flex-row items-center p-4 ${
                    index < NOTIFICATION_CATEGORIES.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                    <Ionicons name={category.icon} size={20} color="#6366F1" />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-gray-900 font-medium">{category.title}</Text>
                    <Text className="text-xs text-gray-500">{category.description}</Text>
                  </View>
                  <Switch
                    value={localPrefs.push[category.key]}
                    onValueChange={() => handleToggle('push', category.key)}
                    trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Email Notifications Section */}
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View className="w-8 h-8 bg-gray-400 rounded-full items-center justify-center">
                  <Ionicons name="mail" size={16} color="white" />
                </View>
                <Text className="text-lg font-semibold ml-3">Notifications email</Text>
              </View>
              <Switch
                value={isEmailAllEnabled}
                onValueChange={handleToggleAllEmail}
                trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View className="bg-white rounded-xl">
              {NOTIFICATION_CATEGORIES.map((category, index) => (
                <View
                  key={category.key}
                  className={`flex-row items-center p-4 ${
                    index < NOTIFICATION_CATEGORIES.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                    <Ionicons name={category.icon} size={20} color="#9CA3AF" />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-gray-900 font-medium">{category.title}</Text>
                    <Text className="text-xs text-gray-500">{category.description}</Text>
                  </View>
                  <Switch
                    value={localPrefs.email[category.key]}
                    onValueChange={() => handleToggle('email', category.key)}
                    trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Info Text */}
          <View className="px-2">
            <Text className="text-xs text-gray-400 text-center">
              Vous pouvez a tout moment modifier vos preferences de notifications.
              Les notifications de securite seront toujours envoyees.
            </Text>
          </View>

          {/* Save Button */}
          {hasChanges && (
            <TouchableOpacity
              onPress={handleSave}
              disabled={isUpdatingPreferences}
              className={`rounded-xl p-4 flex-row items-center justify-center ${
                isUpdatingPreferences ? 'bg-gray-300' : 'bg-primary'
              }`}
            >
              {isUpdatingPreferences ? (
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
