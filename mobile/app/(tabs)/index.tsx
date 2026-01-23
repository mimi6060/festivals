import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useWalletStore } from '@/stores/walletStore';
import { useNetworkStore } from '@/stores/networkStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useLineupStore } from '@/stores/lineupStore';

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTimeUntil(isoString: string): string {
  const now = new Date();
  const target = new Date(isoString);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs < 0) return 'En cours';

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `Dans ${diffMins} min`;

  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  if (remainingMins === 0) return `Dans ${diffHours}h`;
  return `Dans ${diffHours}h${remainingMins}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { balance, currencyName } = useWalletStore();
  const isOnline = useNetworkStore((state) => state.isOnline);
  const {
    upcomingFavoritePerformances,
    favoriteArtists,
    fetchUpcomingFavoritePerformances,
    getNextFavoritePerformance,
  } = useFavoritesStore();
  const { getUpcomingPerformances, getArtistById, getStageById } = useLineupStore();

  // Fetch upcoming favorites on mount
  useEffect(() => {
    fetchUpcomingFavoritePerformances();
  }, []);

  // Get next favorite performance
  const nextFavorite = getNextFavoritePerformance();

  // Get general upcoming performances
  const upcomingPerformances = useMemo(() => {
    return getUpcomingPerformances(3);
  }, [getUpcomingPerformances]);

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
          {isOnline ? 'En ligne' : 'Hors ligne'}
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
            = {(balance * 0.1).toFixed(2)} EUR
          </Text>
          <TouchableOpacity className="bg-white/20 rounded-lg px-4 py-2 mt-4 self-start">
            <Text className="text-white font-medium">+ Recharger</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Your Upcoming Favorites - Only show if user has favorites */}
        {favoriteArtists.length > 0 && (
          <View className="bg-white rounded-xl p-4 border border-red-100">
            <View className="flex-row items-center mb-3">
              <Ionicons name="heart" size={20} color="#EF4444" />
              <Text className="text-lg font-semibold ml-2">Vos favoris a venir</Text>
            </View>

            {nextFavorite ? (
              <TouchableOpacity
                onPress={() => router.push(`/artist/${nextFavorite.artistId}`)}
                className="flex-row items-center bg-red-50 rounded-lg p-3"
              >
                {nextFavorite.artistPhoto ? (
                  <Image
                    source={{ uri: nextFavorite.artistPhoto }}
                    className="w-12 h-12 rounded-full bg-gray-200"
                  />
                ) : (
                  <View className="w-12 h-12 rounded-full bg-red-100 items-center justify-center">
                    <Ionicons name="musical-notes" size={20} color="#EF4444" />
                  </View>
                )}
                <View className="flex-1 ml-3">
                  <Text className="font-semibold text-gray-900">{nextFavorite.artistName}</Text>
                  <View className="flex-row items-center mt-0.5">
                    <View
                      className="w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: nextFavorite.stageColor || '#6366F1' }}
                    />
                    <Text className="text-gray-500 text-sm">{nextFavorite.stageName}</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-primary font-bold">{formatTime(nextFavorite.startTime)}</Text>
                  <Text className="text-gray-500 text-xs">{getTimeUntil(nextFavorite.startTime)}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View className="bg-gray-50 rounded-lg p-3 items-center">
                <Text className="text-gray-500 text-sm">Aucun concert a venir</Text>
              </View>
            )}

            {upcomingFavoritePerformances.length > 1 && (
              <TouchableOpacity
                onPress={() => router.push('/favorites')}
                className="mt-3"
              >
                <Text className="text-red-500 text-center font-medium">
                  Voir tous vos favoris ({upcomingFavoritePerformances.length}) {'>'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Next Artists */}
        <View className="bg-white rounded-xl p-4">
          <Text className="text-lg font-semibold mb-3">Prochainement</Text>
          <View className="space-y-2">
            {upcomingPerformances.length > 0 ? (
              upcomingPerformances.map((performance) => {
                const artist = getArtistById(performance.artistId);
                const stage = getStageById(performance.stageId);
                if (!artist || !stage) return null;

                return (
                  <TouchableOpacity
                    key={performance.id}
                    onPress={() => router.push(`/artist/${artist.id}`)}
                    className="flex-row justify-between items-center py-2 border-b border-gray-100"
                  >
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-1.5 h-10 rounded-full mr-3"
                        style={{ backgroundColor: stage.color }}
                      />
                      <View>
                        <Text className="font-medium">{artist.name}</Text>
                        <Text className="text-gray-500 text-sm">{stage.name}</Text>
                      </View>
                    </View>
                    <Text className="text-primary font-medium">{formatTime(performance.startTime)}</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <>
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
              </>
            )}
          </View>
          <TouchableOpacity
            onPress={() => router.push('/program')}
            className="mt-3"
          >
            <Text className="text-primary text-center font-medium">
              Voir le programme complet {'>'}
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
