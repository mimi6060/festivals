import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OrderItem } from '@/lib/api/orders';

interface OrderItemRowProps {
  item: OrderItem;
  currency: string;
  showBorder?: boolean;
}

// Category icon mapping
const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Boissons: 'beer-outline',
  Nourriture: 'fast-food-outline',
  Merchandising: 'shirt-outline',
  Tickets: 'ticket-outline',
  default: 'cube-outline',
};

// Format price
const formatPrice = (amount: number, currency: string): string => {
  return `${amount.toFixed(2)} ${currency}`;
};

export function OrderItemRow({ item, currency, showBorder = true }: OrderItemRowProps) {
  const iconName = categoryIcons[item.category || 'default'] || categoryIcons.default;

  return (
    <View
      className={`flex-row items-center py-3 ${
        showBorder ? 'border-b border-gray-100' : ''
      }`}
    >
      {/* Icon */}
      <View className="bg-gray-100 rounded-lg p-2">
        <Ionicons name={iconName} size={20} color="#6B7280" />
      </View>

      {/* Details */}
      <View className="flex-1 ml-3">
        <Text className="text-gray-900 font-medium" numberOfLines={1}>
          {item.name}
        </Text>
        {item.description && (
          <Text className="text-gray-500 text-sm" numberOfLines={1}>
            {item.description}
          </Text>
        )}
        <Text className="text-gray-400 text-sm">
          {item.quantity} x {formatPrice(item.unitPrice, currency)}
        </Text>
      </View>

      {/* Total */}
      <Text className="text-gray-900 font-semibold">
        {formatPrice(item.totalPrice, currency)}
      </Text>
    </View>
  );
}

// Compact version for lists
export function OrderItemRowCompact({
  item,
  currency,
}: Omit<OrderItemRowProps, 'showBorder'>) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <View className="flex-row items-center flex-1">
        <Text className="text-gray-700">{item.quantity}x</Text>
        <Text className="text-gray-900 ml-2 flex-1" numberOfLines={1}>
          {item.name}
        </Text>
      </View>
      <Text className="text-gray-700 ml-2">
        {formatPrice(item.totalPrice, currency)}
      </Text>
    </View>
  );
}

export default OrderItemRow;
