import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const menuItems = [
    { icon: 'ticket-outline', label: 'Mes billets', route: '/tickets' },
    { icon: 'card-outline', label: 'Demander remboursement', route: '/refund' },
    { icon: 'settings-outline', label: 'Paramètres', route: '/settings' },
    { icon: 'help-circle-outline', label: 'Aide', route: '/help' },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4 space-y-4">
        {/* User info */}
        <View className="bg-white rounded-xl p-6 items-center">
          <View className="w-20 h-20 bg-primary rounded-full items-center justify-center">
            <Text className="text-white text-3xl font-bold">
              {user?.name?.charAt(0) || 'U'}
            </Text>
          </View>
          <Text className="text-xl font-semibold mt-4">
            {user?.name || 'Utilisateur'}
          </Text>
          <Text className="text-gray-500">{user?.email || 'email@example.com'}</Text>
        </View>

        {/* Menu */}
        <View className="bg-white rounded-xl">
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route as any)}
              className={`flex-row items-center p-4 ${
                index < menuItems.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <Ionicons name={item.icon as any} size={24} color="#6366F1" />
              <Text className="flex-1 ml-4 text-gray-900">{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Staff mode button */}
        {user?.roles?.some((r) => ['BARMAN', 'SCANNER', 'SECURITY'].includes(r)) && (
          <TouchableOpacity
            onPress={() => router.push('/(staff)')}
            className="bg-primary rounded-xl p-4 flex-row items-center justify-center"
          >
            <Ionicons name="briefcase-outline" size={24} color="white" />
            <Text className="text-white font-semibold ml-2">Mode Staff</Text>
          </TouchableOpacity>
        )}

        {/* Logout */}
        <TouchableOpacity
          onPress={logout}
          className="bg-white rounded-xl p-4 flex-row items-center justify-center"
        >
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          <Text className="text-red-500 font-semibold ml-2">Déconnexion</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
