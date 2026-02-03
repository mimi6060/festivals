import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order, OrderStatus } from '@/lib/api/orders';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
}

const statusConfig: Record<
  OrderStatus,
  { label: string; bgColor: string; textColor: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  PENDING: {
    label: 'En attente',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    icon: 'time-outline',
  },
  CONFIRMED: {
    label: 'Confirmee',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: 'checkmark-circle-outline',
  },
  COMPLETED: {
    label: 'Terminee',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: 'checkmark-circle',
  },
  CANCELLED: {
    label: 'Annulee',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    icon: 'close-circle',
  },
  REFUNDED: {
    label: 'Remboursee',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    icon: 'refresh-circle',
  },
};

// Format date for display
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "A l'instant";
  }
  if (diffMins < 60) {
    return `Il y a ${diffMins} min`;
  }
  if (diffHours < 24) {
    return `Il y a ${diffHours}h`;
  }
  if (diffDays === 1) {
    return 'Hier';
  }
  if (diffDays < 7) {
    return `Il y a ${diffDays} jours`;
  }

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Format price
const formatPrice = (amount: number, currency: string): string => {
  return `${amount.toFixed(2)} ${currency}`;
};

export function OrderCard({ order, onPress }: OrderCardProps) {
  const status = statusConfig[order.status];
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-white rounded-xl overflow-hidden shadow-sm mb-3"
    >
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-100">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center flex-1">
            <View className="bg-primary/10 rounded-lg p-2">
              <Ionicons name="receipt-outline" size={20} color="#6366F1" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-gray-900 font-semibold" numberOfLines={1}>
                {order.orderNumber}
              </Text>
              <Text className="text-gray-500 text-sm">
                {formatDate(order.createdAt)}
              </Text>
            </View>
          </View>
          <View className={`${status.bgColor} px-2.5 py-1 rounded-full flex-row items-center`}>
            <Ionicons name={status.icon} size={12} color={status.textColor.includes('yellow') ? '#A16207' : status.textColor.includes('blue') ? '#1D4ED8' : status.textColor.includes('green') ? '#15803D' : status.textColor.includes('red') ? '#B91C1C' : '#C2410C'} />
            <Text className={`${status.textColor} text-xs font-medium ml-1`}>
              {status.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <View className="px-4 py-3">
        {/* Festival & Stand */}
        <View className="flex-row items-center mb-2">
          <Ionicons name="musical-notes-outline" size={14} color="#6B7280" />
          <Text className="text-gray-600 text-sm ml-2" numberOfLines={1}>
            {order.festivalName}
          </Text>
        </View>

        {order.standName && (
          <View className="flex-row items-center mb-2">
            <Ionicons name="storefront-outline" size={14} color="#6B7280" />
            <Text className="text-gray-600 text-sm ml-2" numberOfLines={1}>
              {order.standName}
            </Text>
          </View>
        )}

        {/* Items Preview */}
        <View className="flex-row items-center">
          <Ionicons name="cart-outline" size={14} color="#6B7280" />
          <Text className="text-gray-600 text-sm ml-2">
            {itemCount} article{itemCount > 1 ? 's' : ''}
          </Text>
        </View>

        {/* Items Summary */}
        <View className="mt-2 bg-gray-50 rounded-lg p-2">
          {order.items.slice(0, 2).map((item, index) => (
            <View key={item.id} className="flex-row justify-between items-center py-0.5">
              <Text className="text-gray-700 text-sm flex-1" numberOfLines={1}>
                {item.quantity}x {item.name}
              </Text>
              <Text className="text-gray-500 text-sm ml-2">
                {formatPrice(item.totalPrice, order.currency)}
              </Text>
            </View>
          ))}
          {order.items.length > 2 && (
            <Text className="text-gray-400 text-xs mt-1">
              +{order.items.length - 2} autre{order.items.length > 3 ? 's' : ''} article{order.items.length > 3 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Footer */}
      <View className="px-4 py-3 border-t border-gray-100 flex-row justify-between items-center">
        <View>
          <Text className="text-gray-500 text-xs">Total</Text>
          <Text className="text-gray-900 font-bold text-lg">
            {formatPrice(order.total, order.currency)}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-primary text-sm font-medium mr-1">Voir details</Text>
          <Ionicons name="chevron-forward" size={16} color="#6366F1" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default OrderCard;
