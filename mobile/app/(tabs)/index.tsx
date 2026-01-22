import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWalletStore } from '@/stores/walletStore';
import { useNetworkStore } from '@/stores/networkStore';

export default function HomeScreen() {
  const router = useRouter();
  const { balance, currencyName } = useWalletStore();
  const isOnline = useNetworkStore((state) => state.isOnline);

  const shortcuts = [
    { icon: 'map-outline', label: 'Carte', route: '/map' },
    { icon: 'beer-outline', label: 'Bars', route: '/map?filter=bar' },
    { icon: 'water-outline', label: 'WC', route: '/map?filter=wc' },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Network indicator */}
      <View className={`px-4 py-2 ${isOnline ? 'bg-green-100' : 'bg-red-100'}`}>
        <Text className={`text-center text-sm ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
          {isOnline ? '🟢 En ligne' : '🔴 Hors ligne'}
        </Text>
      </View>

      <View className="p-4 space-y-4">
        {/* Wallet Card */}
        <TouchableOpacity
          onPress={() => router.push('/wallet')}
          className="bg-primary rounded-2xl p-6"
        >
          <Text className="text-white/80 text-sm">Mon solde</Text>
          <Text className="text-white text-4xl font-bold mt-1">
            {balance} {currencyName}
          </Text>
          <Text className="text-white/60 text-sm mt-1">
            ≈ {(balance * 0.1).toFixed(2)} €
          </Text>
          <TouchableOpacity className="bg-white/20 rounded-lg px-4 py-2 mt-4 self-start">
            <Text className="text-white font-medium">+ Recharger</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Next Artists */}
        <View className="bg-white rounded-xl p-4">
          <Text className="text-lg font-semibold mb-3">🎵 Prochainement</Text>
          <View className="space-y-2">
            <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
              <View>
                <Text className="font-medium">DJ Max</Text>
                <Text className="text-gray-500 text-sm">Main Stage</Text>
              </View>
              <Text className="text-primary font-medium">22h00</Text>
            </View>
            <View className="flex-row justify-between items-center py-2">
              <View>
                <Text className="font-medium">The Band</Text>
                <Text className="text-gray-500 text-sm">Tent 2</Text>
              </View>
              <Text className="text-primary font-medium">23h30</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/program')}
            className="mt-3"
          >
            <Text className="text-primary text-center font-medium">
              Voir le programme complet →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Shortcuts */}
        <View className="flex-row justify-between">
          {shortcuts.map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route as any)}
              className="bg-white rounded-xl p-4 items-center flex-1 mx-1"
            >
              <Ionicons name={item.icon as any} size={24} color="#6366F1" />
              <Text className="text-gray-700 text-sm mt-2">{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SOS Button */}
        <TouchableOpacity
          onPress={() => router.push('/sos')}
          className="bg-red-500 rounded-xl p-4 flex-row items-center justify-center"
        >
          <Ionicons name="warning-outline" size={24} color="white" />
          <Text className="text-white font-semibold ml-2">Besoin d'aide ?</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
