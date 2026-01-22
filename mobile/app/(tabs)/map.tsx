import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MapScreen() {
  const filters = [
    { icon: 'beer-outline', label: 'Bars' },
    { icon: 'fast-food-outline', label: 'Food' },
    { icon: 'water-outline', label: 'WC' },
    { icon: 'musical-notes-outline', label: 'Scènes' },
    { icon: 'medkit-outline', label: 'Secours' },
  ];

  return (
    <View className="flex-1 bg-gray-100">
      {/* Map placeholder */}
      <View className="flex-1 bg-gray-200 items-center justify-center">
        <Ionicons name="map-outline" size={80} color="#9CA3AF" />
        <Text className="text-gray-500 mt-4">Carte interactive</Text>
        <Text className="text-gray-400 text-sm">MapLibre + OpenStreetMap</Text>
      </View>

      {/* Filters */}
      <View className="bg-white p-4 border-t border-gray-200">
        <Text className="text-sm font-medium text-gray-700 mb-3">Filtres</Text>
        <View className="flex-row flex-wrap">
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.label}
              className="flex-row items-center bg-gray-100 rounded-full px-3 py-2 mr-2 mb-2"
            >
              <Ionicons name={filter.icon as any} size={18} color="#6366F1" />
              <Text className="text-gray-700 text-sm ml-2">{filter.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* My location button */}
      <TouchableOpacity className="absolute right-4 bottom-24 bg-white rounded-full p-3 shadow-lg">
        <Ionicons name="locate" size={24} color="#6366F1" />
      </TouchableOpacity>
    </View>
  );
}
