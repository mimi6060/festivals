import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore } from '@/stores/orderStore';
import { OrderItemRow } from '@/components/orders/OrderItemRow';
import { ReceiptButton } from '@/components/orders/ReceiptButton';
import { OrderStatus } from '@/lib/api/orders';

// Status configuration
const statusConfig: Record<
  OrderStatus,
  {
    label: string;
    bgColor: string;
    textColor: string;
    icon: keyof typeof Ionicons.glyphMap;
    description: string;
  }
> = {
  PENDING: {
    label: 'En attente',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    icon: 'time-outline',
    description: 'Votre commande est en cours de traitement.',
  },
  CONFIRMED: {
    label: 'Confirmee',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: 'checkmark-circle-outline',
    description: 'Votre commande a ete confirmee et est en preparation.',
  },
  COMPLETED: {
    label: 'Terminee',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: 'checkmark-circle',
    description: 'Votre commande a ete finalisee avec succes.',
  },
  CANCELLED: {
    label: 'Annulee',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    icon: 'close-circle',
    description: 'Cette commande a ete annulee.',
  },
  REFUNDED: {
    label: 'Remboursee',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    icon: 'refresh-circle',
    description: 'Cette commande a ete remboursee.',
  },
};

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

// Format time
const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format price
const formatPrice = (amount: number, currency: string): string => {
  return `${amount.toFixed(2)} ${currency}`;
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    selectedOrder: order,
    isLoadingOrder,
    error,
    fetchOrderById,
    downloadReceipt,
    clearSelectedOrder,
    getOrderById,
  } = useOrderStore();

  // Fetch order on mount
  useEffect(() => {
    if (id) {
      // First check if we already have it in state
      const existingOrder = getOrderById(id);
      if (existingOrder) {
        // Use store's setSelectedOrder equivalent
        fetchOrderById(id);
      } else {
        fetchOrderById(id);
      }
    }

    // Cleanup on unmount
    return () => {
      clearSelectedOrder();
    };
  }, [id]);

  // Handle support contact
  const handleContactSupport = () => {
    Alert.alert(
      'Contacter le support',
      'Comment souhaitez-vous nous contacter ?',
      [
        {
          text: 'Par email',
          onPress: () => {
            Linking.openURL(
              `mailto:support@festival.com?subject=Commande ${order?.orderNumber}&body=Bonjour,%0D%0A%0D%0AJe vous contacte concernant ma commande ${order?.orderNumber}.%0D%0A%0D%0A`
            );
          },
        },
        {
          text: 'Par telephone',
          onPress: () => {
            Linking.openURL('tel:+33123456789');
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  // Loading state
  if (isLoadingOrder && !order) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Stack.Screen options={{ title: 'Commande' }} />
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="text-gray-500 mt-4">Chargement de la commande...</Text>
      </View>
    );
  }

  // Error state
  if (!order && !isLoadingOrder) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-4">
        <Stack.Screen options={{ title: 'Commande' }} />
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="text-gray-900 text-xl font-semibold mt-4">
          Commande introuvable
        </Text>
        <Text className="text-gray-500 text-center mt-2">
          {error || 'Cette commande n\'existe pas ou a ete supprimee.'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-primary rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = statusConfig[order.status];
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title: order.orderNumber,
          headerBackTitle: 'Retour',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { fontWeight: '600' },
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Status Banner */}
        <View className={`${status.bgColor} px-4 py-4`}>
          <View className="flex-row items-center justify-center">
            <Ionicons
              name={status.icon}
              size={24}
              color={
                status.textColor.includes('yellow')
                  ? '#A16207'
                  : status.textColor.includes('blue')
                  ? '#1D4ED8'
                  : status.textColor.includes('green')
                  ? '#15803D'
                  : status.textColor.includes('red')
                  ? '#B91C1C'
                  : '#C2410C'
              }
            />
            <Text className={`${status.textColor} font-semibold text-lg ml-2`}>
              Commande {status.label}
            </Text>
          </View>
          <Text className={`${status.textColor} text-center mt-1 opacity-80`}>
            {status.description}
          </Text>
        </View>

        {/* Order Summary */}
        <View className="mx-4 mt-4 bg-white rounded-xl p-4">
          <View className="flex-row items-center mb-3">
            <Ionicons name="receipt-outline" size={20} color="#6366F1" />
            <Text className="text-gray-900 font-semibold text-lg ml-2">
              Resume de la commande
            </Text>
          </View>

          {/* Order Info */}
          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Numero</Text>
              <Text className="text-gray-900 font-medium">{order.orderNumber}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Date</Text>
              <Text className="text-gray-900">{formatDate(order.createdAt)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Heure</Text>
              <Text className="text-gray-900">{formatTime(order.createdAt)}</Text>
            </View>
            {order.completedAt && (
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Finalisee le</Text>
                <Text className="text-gray-900">
                  {formatDate(order.completedAt)} a {formatTime(order.completedAt)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Festival & Stand */}
        <View className="mx-4 mt-4 bg-white rounded-xl p-4">
          <View className="flex-row items-center mb-3">
            <Ionicons name="musical-notes-outline" size={20} color="#6366F1" />
            <Text className="text-gray-900 font-semibold text-lg ml-2">
              Lieu d'achat
            </Text>
          </View>

          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Festival</Text>
              <Text className="text-gray-900 flex-1 text-right ml-4" numberOfLines={2}>
                {order.festivalName}
              </Text>
            </View>
            {order.standName && (
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Stand</Text>
                <Text className="text-gray-900">{order.standName}</Text>
              </View>
            )}
            {order.paymentMethod && (
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Paiement</Text>
                <Text className="text-gray-900">{order.paymentMethod}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Items List */}
        <View className="mx-4 mt-4 bg-white rounded-xl p-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Ionicons name="cart-outline" size={20} color="#6366F1" />
              <Text className="text-gray-900 font-semibold text-lg ml-2">
                Articles
              </Text>
            </View>
            <View className="bg-primary/10 rounded-full px-2 py-0.5">
              <Text className="text-primary text-sm font-medium">
                {totalItems} article{totalItems > 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {order.items.map((item, index) => (
            <OrderItemRow
              key={item.id}
              item={item}
              currency={order.currency}
              showBorder={index < order.items.length - 1}
            />
          ))}
        </View>

        {/* Price Summary */}
        <View className="mx-4 mt-4 bg-white rounded-xl p-4">
          <View className="flex-row items-center mb-3">
            <Ionicons name="pricetag-outline" size={20} color="#6366F1" />
            <Text className="text-gray-900 font-semibold text-lg ml-2">
              Total
            </Text>
          </View>

          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Sous-total</Text>
              <Text className="text-gray-900">
                {formatPrice(order.subtotal, order.currency)}
              </Text>
            </View>
            {order.fees > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Frais</Text>
                <Text className="text-gray-900">
                  {formatPrice(order.fees, order.currency)}
                </Text>
              </View>
            )}
            <View className="border-t border-gray-100 pt-2 mt-2">
              <View className="flex-row justify-between">
                <Text className="text-gray-900 font-semibold text-lg">Total</Text>
                <Text className="text-gray-900 font-bold text-xl">
                  {formatPrice(order.total, order.currency)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Receipt Download */}
        {order.receiptUrl && (
          <View className="mx-4 mt-4">
            <ReceiptButton
              orderId={order.id}
              orderNumber={order.orderNumber}
              receiptUrl={order.receiptUrl}
              onDownload={downloadReceipt}
            />
          </View>
        )}

        {/* Support Section */}
        <View className="mx-4 mt-4 bg-primary/5 rounded-xl p-4">
          <View className="flex-row items-start">
            <Ionicons name="help-circle-outline" size={24} color="#6366F1" />
            <View className="ml-3 flex-1">
              <Text className="text-gray-900 font-medium mb-1">
                Un probleme avec cette commande ?
              </Text>
              <Text className="text-gray-600 text-sm">
                Notre equipe support est disponible pour vous aider avec toute question
                ou probleme concernant cette commande.
              </Text>
              <TouchableOpacity onPress={handleContactSupport} className="mt-3">
                <View className="flex-row items-center">
                  <Ionicons name="chatbubble-outline" size={18} color="#6366F1" />
                  <Text className="text-primary font-medium ml-2">
                    Contacter le support
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Order ID */}
        <View className="mx-4 mt-4 bg-gray-100 rounded-xl p-4">
          <View className="flex-row items-center">
            <Ionicons name="finger-print-outline" size={20} color="#6B7280" />
            <Text className="text-gray-500 ml-2 text-sm">
              Reference: {order.id}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
