import React from 'react';
import { TouchableOpacity, View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Stand, StandCategory, getStandCategoryIcon } from '@/stores/mapStore';
import { useFavoritesStore } from '@/stores/favoritesStore';

interface FavoriteStandCardProps {
  stand: Stand;
  onRemove?: () => void;
  onPress?: () => void;
}

const getCategoryLabel = (category: StandCategory): string => {
  const labels: Record<StandCategory, string> = {
    food: 'Nourriture',
    drink: 'Boissons',
    merch: 'Boutique',
    sponsor: 'Sponsor',
    craft: 'Artisanat',
  };
  return labels[category] || category;
};

const getCategoryColor = (category: StandCategory): string => {
  const colors: Record<StandCategory, string> = {
    food: '#F97316',
    drink: '#EAB308',
    merch: '#EC4899',
    sponsor: '#6366F1',
    craft: '#8B5CF6',
  };
  return colors[category] || '#6366F1';
};

export function FavoriteStandCard({ stand, onRemove, onPress }: FavoriteStandCardProps) {
  const router = useRouter();
  const { toggleFavorite } = useFavoritesStore();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Navigate to map with stand selected
      router.push({
        pathname: '/(tabs)/map',
        params: { standId: stand.id },
      });
    }
  };

  const handleRemoveFavorite = () => {
    toggleFavorite(stand.id, 'stand');
    onRemove?.();
  };

  const iconName = getStandCategoryIcon(stand.category);
  const categoryColor = getCategoryColor(stand.category);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100"
    >
      <View className="flex-row items-start">
        {/* Category Icon */}
        <View
          className="w-12 h-12 rounded-xl items-center justify-center"
          style={{ backgroundColor: `${categoryColor}20` }}
        >
          <Ionicons name={iconName as any} size={24} color={categoryColor} />
        </View>

        {/* Stand Info */}
        <View className="flex-1 ml-3">
          <Text className="font-semibold text-gray-900 text-base" numberOfLines={1}>
            {stand.name}
          </Text>

          {/* Category Badge */}
          <View className="flex-row items-center mt-1">
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${categoryColor}20` }}
            >
              <Text className="text-xs font-medium" style={{ color: categoryColor }}>
                {getCategoryLabel(stand.category)}
              </Text>
            </View>
            {stand.isCashless && (
              <View className="ml-2 flex-row items-center">
                <Ionicons name="card-outline" size={12} color="#10B981" />
                <Text className="text-xs text-green-600 ml-0.5">Cashless</Text>
              </View>
            )}
          </View>

          {/* Description */}
          <Text className="text-gray-500 text-sm mt-1" numberOfLines={2}>
            {stand.description}
          </Text>

          {/* Opening Hours */}
          <View className="flex-row items-center mt-2">
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text className="text-gray-600 text-xs ml-1">{stand.openingHours}</Text>
          </View>
        </View>

        {/* Favorite Button */}
        <TouchableOpacity
          onPress={handleRemoveFavorite}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="p-2"
        >
          <Ionicons name="heart" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Products Preview */}
      {stand.products.length > 0 && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text className="text-xs text-gray-400 mb-2">PRODUITS POPULAIRES</Text>
          <View className="flex-row flex-wrap">
            {stand.products.slice(0, 3).map((product) => (
              <View
                key={product.id}
                className={`mr-2 mb-1 px-2 py-1 rounded-full ${
                  product.available ? 'bg-gray-100' : 'bg-gray-50'
                }`}
              >
                <Text
                  className={`text-xs ${
                    product.available ? 'text-gray-700' : 'text-gray-400 line-through'
                  }`}
                >
                  {product.name} - {product.price}G
                </Text>
              </View>
            ))}
            {stand.products.length > 3 && (
              <View className="px-2 py-1 rounded-full bg-gray-100">
                <Text className="text-xs text-gray-500">
                  +{stand.products.length - 3} autres
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Compact version for quick lists
interface FavoriteStandCompactProps {
  stand: Stand;
  onPress?: () => void;
}

export function FavoriteStandCompact({ stand, onPress }: FavoriteStandCompactProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: '/(tabs)/map',
        params: { standId: stand.id },
      });
    }
  };

  const iconName = getStandCategoryIcon(stand.category);
  const categoryColor = getCategoryColor(stand.category);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className="bg-white rounded-lg p-3 mb-2 flex-row items-center border border-gray-100"
    >
      {/* Category Icon */}
      <View
        className="w-8 h-8 rounded-lg items-center justify-center"
        style={{ backgroundColor: `${categoryColor}20` }}
      >
        <Ionicons name={iconName as any} size={16} color={categoryColor} />
      </View>

      {/* Stand Info */}
      <View className="flex-1 ml-3">
        <Text className="font-medium text-gray-900" numberOfLines={1}>
          {stand.name}
        </Text>
        <Text className="text-gray-500 text-xs">{stand.openingHours}</Text>
      </View>

      {/* Navigate Icon */}
      <TouchableOpacity
        onPress={() => {
          router.push({
            pathname: '/(tabs)/map',
            params: { standId: stand.id, navigate: 'true' },
          });
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        className="p-2"
      >
        <Ionicons name="navigate-outline" size={20} color="#6366F1" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default FavoriteStandCard;
