import { View, Text, ScrollView, Image, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLineupStore } from '@/stores/lineupStore';

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins.toString().padStart(2, '0')}`;
}

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    getArtistById,
    getPerformancesByArtist,
    getStageById,
    toggleFavorite,
    isFavorite,
  } = useLineupStore();

  const artist = getArtistById(id);
  const performances = getPerformancesByArtist(id);
  const favorited = isFavorite(id);

  const handleOpenLink = async (url: string | undefined) => {
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Could not open URL:', error);
    }
  };

  const handleFavoritePress = () => {
    toggleFavorite(id);
  };

  if (!artist) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Stack.Screen options={{ title: 'Artiste' }} />
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="text-gray-500 mt-4">Chargement...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title: artist.name,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#1F2937',
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleFavoritePress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="mr-2"
            >
              <Ionicons
                name={favorited ? 'heart' : 'heart-outline'}
                size={24}
                color={favorited ? '#EF4444' : '#6B7280'}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View className="relative">
          <Image
            source={{ uri: artist.photo }}
            className="w-full h-72 bg-gray-200"
            resizeMode="cover"
          />
          <View className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Genre Badge */}
          <View className="absolute bottom-4 left-4">
            <View className="bg-primary/90 rounded-full px-3 py-1">
              <Text className="text-white text-sm font-medium">{artist.genre}</Text>
            </View>
          </View>

          {/* Country */}
          <View className="absolute bottom-4 right-4">
            <View className="bg-white/90 rounded-full px-3 py-1 flex-row items-center">
              <Ionicons name="location" size={14} color="#6B7280" />
              <Text className="text-gray-700 text-sm font-medium ml-1">{artist.country}</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          {/* Artist Name */}
          <Text className="text-2xl font-bold text-gray-900 mb-2">{artist.name}</Text>

          {/* Social Links */}
          <View className="flex-row mb-6">
            {artist.socialLinks.instagram && (
              <TouchableOpacity
                onPress={() => handleOpenLink(artist.socialLinks.instagram)}
                className="flex-row items-center bg-gradient-to-r from-purple-500 to-pink-500 rounded-full px-4 py-2 mr-3"
                activeOpacity={0.8}
              >
                <Ionicons name="logo-instagram" size={18} color="white" />
                <Text className="text-white font-medium ml-2">Instagram</Text>
              </TouchableOpacity>
            )}

            {artist.socialLinks.spotify && (
              <TouchableOpacity
                onPress={() => handleOpenLink(artist.socialLinks.spotify)}
                className="flex-row items-center bg-green-500 rounded-full px-4 py-2 mr-3"
                activeOpacity={0.8}
              >
                <Ionicons name="logo-spotify" size={18} color="white" />
                <Text className="text-white font-medium ml-2">Spotify</Text>
              </TouchableOpacity>
            )}

            {artist.socialLinks.website && (
              <TouchableOpacity
                onPress={() => handleOpenLink(artist.socialLinks.website)}
                className="flex-row items-center bg-gray-700 rounded-full px-4 py-2"
                activeOpacity={0.8}
              >
                <Ionicons name="globe-outline" size={18} color="white" />
                <Text className="text-white font-medium ml-2">Site</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bio */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">Biographie</Text>
            <Text className="text-gray-700 text-base leading-6">{artist.bio}</Text>
          </View>

          {/* Performances */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-500 uppercase mb-3">
              Performances au festival ({performances.length})
            </Text>

            {performances.length === 0 ? (
              <View className="bg-gray-100 rounded-xl p-4 items-center">
                <Ionicons name="calendar-outline" size={32} color="#9CA3AF" />
                <Text className="text-gray-500 mt-2">Aucune performance programmee</Text>
              </View>
            ) : (
              performances.map((performance) => {
                const stage = getStageById(performance.stageId);
                if (!stage) return null;

                const now = new Date();
                const startTime = new Date(performance.startTime);
                const endTime = new Date(performance.endTime);
                const isNow = now >= startTime && now <= endTime;
                const isPast = now > endTime;

                return (
                  <View
                    key={performance.id}
                    className={`bg-white rounded-xl p-4 mb-3 border ${
                      isNow ? 'border-primary border-2' : 'border-gray-100'
                    }`}
                  >
                    {isNow && (
                      <View className="flex-row items-center mb-2">
                        <View className="w-2 h-2 rounded-full bg-danger mr-2" />
                        <Text className="text-danger text-xs font-semibold">EN DIRECT</Text>
                      </View>
                    )}

                    {/* Date */}
                    <Text className={`text-sm font-medium ${isPast ? 'text-gray-400' : 'text-gray-900'}`}>
                      {formatDate(performance.startTime)}
                    </Text>

                    {/* Time */}
                    <View className="flex-row items-center mt-1">
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={isPast ? '#9CA3AF' : '#6366F1'}
                      />
                      <Text className={`ml-1 font-semibold ${isPast ? 'text-gray-400' : 'text-primary'}`}>
                        {formatTime(performance.startTime)} - {formatTime(performance.endTime)}
                      </Text>
                      <Text className={`ml-2 text-sm ${isPast ? 'text-gray-300' : 'text-gray-400'}`}>
                        ({getDuration(performance.startTime, performance.endTime)})
                      </Text>
                    </View>

                    {/* Stage */}
                    <View className="flex-row items-center mt-2">
                      <View
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: stage.color }}
                      />
                      <Ionicons name="musical-notes" size={14} color={stage.color} />
                      <Text className={`ml-1 ${isPast ? 'text-gray-400' : 'text-gray-700'}`}>
                        {stage.name}
                      </Text>
                    </View>

                    {/* Location */}
                    <View className="flex-row items-center mt-1">
                      <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                      <Text className="text-gray-400 text-sm ml-1">{stage.location}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Add to Favorites Button */}
          <TouchableOpacity
            onPress={handleFavoritePress}
            className={`flex-row items-center justify-center py-4 rounded-xl ${
              favorited ? 'bg-gray-100' : 'bg-primary'
            }`}
            activeOpacity={0.8}
          >
            <Ionicons
              name={favorited ? 'heart' : 'heart-outline'}
              size={24}
              color={favorited ? '#EF4444' : 'white'}
            />
            <Text
              className={`font-semibold text-lg ml-2 ${
                favorited ? 'text-gray-700' : 'text-white'
              }`}
            >
              {favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
