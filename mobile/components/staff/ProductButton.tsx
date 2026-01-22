import React from 'react';
import { View, Text, TouchableOpacity, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '@/stores/staffStore';

interface ProductButtonProps {
  product: Product;
  quantity?: number;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  currencySymbol?: string;
}

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  DRINK: 'beer-outline',
  FOOD: 'fast-food-outline',
  MERCH: 'shirt-outline',
  OTHER: 'cube-outline',
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  DRINK: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-500' },
  FOOD: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-500' },
  MERCH: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-500' },
  OTHER: { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-500' },
};

export default function ProductButton({
  product,
  quantity = 0,
  onPress,
  onLongPress,
  disabled = false,
  currencySymbol = '',
}: ProductButtonProps) {
  const colors = CATEGORY_COLORS[product.category] || CATEGORY_COLORS.OTHER;
  const icon = CATEGORY_ICONS[product.category] || CATEGORY_ICONS.OTHER;

  const handlePress = () => {
    if (disabled) return;
    Vibration.vibrate(10);
    onPress();
  };

  const handleLongPress = () => {
    if (disabled || !onLongPress) return;
    Vibration.vibrate(20);
    onLongPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={disabled}
      className={`relative rounded-xl p-3 ${colors.bg} ${
        disabled ? 'opacity-50' : 'active:opacity-80'
      }`}
      style={{ minWidth: 100 }}
    >
      {/* Quantity badge */}
      {quantity > 0 && (
        <View className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${colors.badge} items-center justify-center z-10`}>
          <Text className="text-white text-xs font-bold">{quantity}</Text>
        </View>
      )}

      <View className="items-center">
        <Ionicons name={icon} size={24} color={colors.text.replace('text-', '').replace('-700', '')} />
        <Text className={`${colors.text} font-medium text-center mt-1`} numberOfLines={1}>
          {product.name}
        </Text>
        <Text className={`${colors.text} text-sm opacity-70 mt-0.5`}>
          {product.price} {currencySymbol}
        </Text>
      </View>

      {!product.available && (
        <View className="absolute inset-0 bg-white/80 rounded-xl items-center justify-center">
          <Text className="text-red-500 font-medium text-xs">Indisponible</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

interface ProductGridProps {
  products: Product[];
  cart: { product: Product; quantity: number }[];
  onProductPress: (product: Product) => void;
  onProductLongPress?: (product: Product) => void;
  currencySymbol?: string;
}

export function ProductGrid({
  products,
  cart,
  onProductPress,
  onProductLongPress,
  currencySymbol,
}: ProductGridProps) {
  const getQuantity = (productId: string) => {
    const item = cart.find((item) => item.product.id === productId);
    return item?.quantity || 0;
  };

  return (
    <View className="flex-row flex-wrap gap-2">
      {products.map((product) => (
        <ProductButton
          key={product.id}
          product={product}
          quantity={getQuantity(product.id)}
          onPress={() => onProductPress(product)}
          onLongPress={onProductLongPress ? () => onProductLongPress(product) : undefined}
          disabled={!product.available}
          currencySymbol={currencySymbol}
        />
      ))}
    </View>
  );
}
