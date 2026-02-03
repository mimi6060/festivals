import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore } from '@/stores/orderStore';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderStatus } from '@/lib/api/orders';

// Status filter options
const statusOptions: { value: OrderStatus | null; label: string }[] = [
  { value: null, label: 'Tous les statuts' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirmee' },
  { value: 'COMPLETED', label: 'Terminee' },
  { value: 'CANCELLED', label: 'Annulee' },
  { value: 'REFUNDED', label: 'Remboursee' },
];

export default function OrdersScreen() {
  const router = useRouter();
  const {
    orders,
    festivals,
    isLoading,
    error,
    totalOrders,
    selectedFestivalId,
    selectedStatus,
    fetchOrders,
    fetchFestivals,
    setSelectedFestival,
    setSelectedStatus,
    clearError,
  } = useOrderStore();

  const [showFestivalFilter, setShowFestivalFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);

  // Initial data fetch
  useEffect(() => {
    fetchOrders(true);
    fetchFestivals();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchOrders(true);
  }, [selectedFestivalId, selectedStatus]);

  // Pull to refresh handler
  const onRefresh = useCallback(() => {
    clearError();
    fetchOrders(true);
  }, [fetchOrders, clearError]);

  // Navigate to order detail
  const handleOrderPress = (orderId: string) => {
    router.push(`/order/${orderId}`);
  };

  // Get current filter labels
  const selectedFestivalName =
    festivals.find((f) => f.id === selectedFestivalId)?.name || 'Tous les festivals';
  const selectedStatusName =
    statusOptions.find((s) => s.value === selectedStatus)?.label || 'Tous les statuts';

  // Check if any filters are active
  const hasActiveFilters = selectedFestivalId !== null || selectedStatus !== null;

  // Clear all filters
  const clearFilters = () => {
    setSelectedFestival(null);
    setSelectedStatus(null);
  };

  // Render empty state
  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <View className="bg-gray-100 rounded-full p-6 mb-4">
        <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
      </View>
      <Text className="text-gray-900 text-xl font-semibold mb-2">
        Aucune commande
      </Text>
      <Text className="text-gray-500 text-center px-8">
        {hasActiveFilters
          ? 'Aucune commande ne correspond a vos filtres. Essayez de modifier vos criteres.'
          : 'Vos commandes apparaitront ici apres vos achats sur les festivals.'}
      </Text>
      {hasActiveFilters && (
        <TouchableOpacity
          onPress={clearFilters}
          className="mt-4 bg-primary/10 rounded-full px-4 py-2"
        >
          <Text className="text-primary font-medium">Effacer les filtres</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Render error state
  const renderError = () => (
    <View className="bg-red-50 rounded-xl p-4 mx-4 my-2">
      <View className="flex-row items-center">
        <Ionicons name="warning-outline" size={24} color="#EF4444" />
        <Text className="text-red-700 ml-3 flex-1">{error}</Text>
      </View>
    </View>
  );

  // Festival filter modal
  const renderFestivalFilterModal = () => (
    <Modal
      visible={showFestivalFilter}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFestivalFilter(false)}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <Text className="text-lg font-semibold">Filtrer par festival</Text>
          <TouchableOpacity onPress={() => setShowFestivalFilter(false)} className="p-2">
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <ScrollView className="flex-1">
          <TouchableOpacity
            onPress={() => {
              setSelectedFestival(null);
              setShowFestivalFilter(false);
            }}
            className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100"
          >
            <Text className="text-gray-900 text-base">Tous les festivals</Text>
            {selectedFestivalId === null && (
              <Ionicons name="checkmark" size={24} color="#6366F1" />
            )}
          </TouchableOpacity>

          {festivals.map((festival) => (
            <TouchableOpacity
              key={festival.id}
              onPress={() => {
                setSelectedFestival(festival.id);
                setShowFestivalFilter(false);
              }}
              className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100"
            >
              <View className="flex-1">
                <Text className="text-gray-900 text-base">{festival.name}</Text>
                <Text className="text-gray-500 text-sm">
                  {festival.orderCount} commande{festival.orderCount > 1 ? 's' : ''}
                </Text>
              </View>
              {selectedFestivalId === festival.id && (
                <Ionicons name="checkmark" size={24} color="#6366F1" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  // Status filter modal
  const renderStatusFilterModal = () => (
    <Modal
      visible={showStatusFilter}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowStatusFilter(false)}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <Text className="text-lg font-semibold">Filtrer par statut</Text>
          <TouchableOpacity onPress={() => setShowStatusFilter(false)} className="p-2">
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <ScrollView className="flex-1">
          {statusOptions.map((option) => (
            <TouchableOpacity
              key={option.value || 'all'}
              onPress={() => {
                setSelectedStatus(option.value);
                setShowStatusFilter(false);
              }}
              className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100"
            >
              <Text className="text-gray-900 text-base">{option.label}</Text>
              {selectedStatus === option.value && (
                <Ionicons name="checkmark" size={24} color="#6366F1" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Mes Commandes</Text>
        <Text className="text-gray-500 text-sm mt-1">
          {totalOrders} commande{totalOrders !== 1 ? 's' : ''} au total
        </Text>
      </View>

      {/* Filters */}
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row space-x-2">
            {/* Festival Filter */}
            <TouchableOpacity
              onPress={() => setShowFestivalFilter(true)}
              className={`flex-row items-center px-3 py-2 rounded-full border ${
                selectedFestivalId
                  ? 'bg-primary/10 border-primary'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Ionicons
                name="musical-notes-outline"
                size={16}
                color={selectedFestivalId ? '#6366F1' : '#6B7280'}
              />
              <Text
                className={`ml-1.5 text-sm ${
                  selectedFestivalId ? 'text-primary font-medium' : 'text-gray-700'
                }`}
                numberOfLines={1}
              >
                {selectedFestivalName}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedFestivalId ? '#6366F1' : '#6B7280'}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>

            {/* Status Filter */}
            <TouchableOpacity
              onPress={() => setShowStatusFilter(true)}
              className={`flex-row items-center px-3 py-2 rounded-full border ${
                selectedStatus
                  ? 'bg-primary/10 border-primary'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Ionicons
                name="filter-outline"
                size={16}
                color={selectedStatus ? '#6366F1' : '#6B7280'}
              />
              <Text
                className={`ml-1.5 text-sm ${
                  selectedStatus ? 'text-primary font-medium' : 'text-gray-700'
                }`}
              >
                {selectedStatusName}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedStatus ? '#6366F1' : '#6B7280'}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <TouchableOpacity
                onPress={clearFilters}
                className="flex-row items-center px-3 py-2 rounded-full bg-gray-100"
              >
                <Ionicons name="close-circle" size={16} color="#6B7280" />
                <Text className="ml-1 text-sm text-gray-600">Effacer</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Content */}
      {isLoading && orders.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366F1" />
          <Text className="text-gray-500 mt-4">Chargement des commandes...</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && orders.length > 0}
              onRefresh={onRefresh}
              tintColor="#6366F1"
              colors={['#6366F1']}
            />
          }
        >
          {error && renderError()}

          {orders.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPress={() => handleOrderPress(order.id)}
                />
              ))}
            </>
          )}

          {/* Info Card */}
          <View className="bg-primary/5 rounded-xl p-4 mt-2">
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={24} color="#6366F1" />
              <View className="ml-3 flex-1">
                <Text className="text-gray-900 font-medium mb-1">
                  Besoin d'aide ?
                </Text>
                <Text className="text-gray-600 text-sm">
                  Pour toute question concernant une commande, consultez les details de la commande ou contactez notre support.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Filter Modals */}
      {renderFestivalFilterModal()}
      {renderStatusFilterModal()}
    </View>
  );
}
