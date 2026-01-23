import { View, Text, ScrollView, TouchableOpacity, Image, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore, Festival } from '@/stores/userStore';
import { ProfileSkeleton, ListItemSkeleton } from '@/components/common';
import haptics from '@/lib/haptics';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  badge?: number;
}

interface MenuSection {
  title?: string;
  items: MenuItem[];
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { profile, festivals, activeFestivalId, setActiveFestival, getActiveFestival, isLoading, fetchProfile } =
    useUserStore();

  const [refreshing, setRefreshing] = useState(false);
  const activeFestival = getActiveFestival();

  const onRefresh = useCallback(async () => {
    haptics.pullToRefreshTrigger();
    setRefreshing(true);
    try {
      await fetchProfile();
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfile]);

  const menuSections: MenuSection[] = [
    {
      items: [
        { icon: 'ticket-outline', label: 'Mes billets', route: '/tickets' },
        {
          icon: 'receipt-outline',
          label: 'Historique des transactions',
          route: '/wallet/transactions',
        },
        { icon: 'wifi-outline', label: 'Bracelet NFC', route: '/profile/nfc' },
      ],
    },
    {
      title: 'Parametres',
      items: [
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          route: '/profile/notifications',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: 'help-circle-outline', label: 'Aide & FAQ', route: '/profile/help' },
        { icon: 'information-circle-outline', label: 'A propos', route: '/profile/about' },
      ],
    },
  ];

  const handleLogout = () => {
    haptics.warning();
    Alert.alert(
      'Deconnexion',
      'Etes-vous sur de vouloir vous deconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Deconnexion',
          style: 'destructive',
          onPress: () => {
            haptics.buttonPressHeavy();
            logout();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleFestivalChange = (festival: Festival) => {
    haptics.selection();
    setActiveFestival(festival.id);
  };

  const handleMenuItemPress = (route: string) => {
    haptics.buttonPress();
    router.push(route as any);
  };

  const renderAvatar = () => {
    if (profile?.avatarUrl) {
      return (
        <Image
          source={{ uri: profile.avatarUrl }}
          className="w-24 h-24 rounded-full"
          resizeMode="cover"
        />
      );
    }

    const initials = profile?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'U';

    return (
      <View className="w-24 h-24 bg-primary rounded-full items-center justify-center">
        <Text className="text-white text-3xl font-bold">{initials}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6366F1"
          colors={['#6366F1']}
        />
      }
    >
      <View className="p-4 space-y-4">
        {/* User Info Section */}
        <View className="bg-white rounded-xl p-6 items-center">
          {renderAvatar()}
          <Text className="text-xl font-semibold mt-4">
            {profile?.name || user?.name || 'Utilisateur'}
          </Text>
          <Text className="text-gray-500">
            {profile?.email || user?.email || 'email@example.com'}
          </Text>

          <TouchableOpacity
            onPress={() => {
              haptics.buttonPress();
              router.push('/profile/edit');
            }}
            className="mt-4 px-6 py-2 border border-primary rounded-full flex-row items-center"
          >
            <Ionicons name="pencil-outline" size={16} color="#6366F1" />
            <Text className="text-primary font-medium ml-2">Modifier le profil</Text>
          </TouchableOpacity>
        </View>

        {/* Festival Selector */}
        {festivals.length > 0 && (
          <View className="bg-white rounded-xl p-4">
            <Text className="text-sm font-medium text-gray-500 mb-3">Festival actif</Text>
            {festivals.map((festival) => (
              <TouchableOpacity
                key={festival.id}
                onPress={() => handleFestivalChange(festival)}
                className={`flex-row items-center p-3 rounded-lg mb-2 ${
                  festival.id === activeFestivalId
                    ? 'bg-primary/10 border border-primary'
                    : 'bg-gray-50'
                }`}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    festival.id === activeFestivalId ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <Ionicons
                    name="musical-notes"
                    size={20}
                    color={festival.id === activeFestivalId ? '#FFFFFF' : '#6B7280'}
                  />
                </View>
                <View className="flex-1 ml-3">
                  <Text
                    className={`font-medium ${
                      festival.id === activeFestivalId ? 'text-primary' : 'text-gray-900'
                    }`}
                  >
                    {festival.name}
                  </Text>
                  <Text className="text-xs text-gray-500">{festival.location}</Text>
                </View>
                {festival.id === activeFestivalId && (
                  <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
          <View key={sectionIndex}>
            {section.title && (
              <Text className="text-sm font-medium text-gray-500 mb-2 px-1">
                {section.title}
              </Text>
            )}
            <View className="bg-white rounded-xl">
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => handleMenuItemPress(item.route)}
                  className={`flex-row items-center p-4 ${
                    index < section.items.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                    <Ionicons name={item.icon} size={20} color="#6366F1" />
                  </View>
                  <Text className="flex-1 ml-3 text-gray-900 font-medium">{item.label}</Text>
                  {item.badge !== undefined && item.badge > 0 && (
                    <View className="bg-red-500 rounded-full px-2 py-1 mr-2">
                      <Text className="text-white text-xs font-bold">{item.badge}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Staff Mode Button */}
        {user?.roles?.some((r) => ['BARMAN', 'SCANNER', 'SECURITY'].includes(r)) && (
          <TouchableOpacity
            onPress={() => {
              haptics.buttonPressHeavy();
              router.push('/(staff)');
            }}
            className="bg-primary rounded-xl p-4 flex-row items-center justify-center"
          >
            <Ionicons name="briefcase-outline" size={24} color="white" />
            <Text className="text-white font-semibold ml-2">Mode Staff</Text>
          </TouchableOpacity>
        )}

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-white rounded-xl p-4 flex-row items-center justify-center"
        >
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          <Text className="text-red-500 font-semibold ml-2">Deconnexion</Text>
        </TouchableOpacity>

        {/* App Version */}
        <View className="items-center py-4">
          <Text className="text-gray-400 text-sm">Version {APP_VERSION}</Text>
          <Text className="text-gray-300 text-xs mt-1">
            {activeFestival?.name || 'Aucun festival selectionne'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
