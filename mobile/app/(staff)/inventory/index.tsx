import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryStore, InventoryItem } from '@/stores/inventoryStore';
import { useStaffStore } from '@/stores/staffStore';
import { StockCard } from '@/components/inventory/StockCard';
import { StockLevelBadge } from '@/components/inventory/StockLevelBadge';

type FilterType = 'all' | 'low' | 'out';

export default function InventoryIndexScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { currentStand } = useStaffStore();
  const {
    items,
    alerts,
    summary,
    isLoading,
    loadStandInventory,
    loadAlerts,
    adjustStock,
  } = useInventoryStore();

  useEffect(() => {
    if (currentStand?.id) {
      loadStandInventory(currentStand.id);
      loadAlerts(currentStand.id);
    }
  }, [currentStand?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (currentStand?.id) {
      await loadStandInventory(currentStand.id);
      await loadAlerts(currentStand.id);
    }
    setRefreshing(false);
  };

  // Filter and search items
  const filteredItems = useMemo(() => {
    let result = items;

    // Apply filter
    if (selectedFilter === 'low') {
      result = result.filter((item) => item.isLowStock);
    } else if (selectedFilter === 'out') {
      result = result.filter((item) => item.isOutOfStock);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.productName.toLowerCase().includes(query) ||
          item.productSku?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [items, selectedFilter, searchQuery]);

  const handleQuickAdjust = (item: InventoryItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 0) {
      Alert.alert('Erreur', 'Le stock ne peut pas etre negatif');
      return;
    }

    Alert.alert(
      'Confirmer l\'ajustement',
      `${delta > 0 ? 'Ajouter' : 'Retirer'} ${Math.abs(delta)} ${item.productName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            const success = await adjustStock(
              item.productId,
              delta,
              delta > 0 ? 'IN' : 'OUT',
              delta > 0 ? 'Reception stock' : 'Sortie manuelle'
            );
            if (success) {
              Alert.alert('Succes', 'Stock ajuste avec succes');
            }
          },
        },
      ]
    );
  };

  const handleProductPress = (item: InventoryItem) => {
    router.push({
      pathname: '/(staff)/inventory/adjust',
      params: { productId: item.productId, productName: item.productName },
    });
  };

  const activeAlertsCount = alerts.filter((a) => a.status === 'ACTIVE').length;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search Bar */}
      {showSearch ? (
        <View className="bg-white border-b border-gray-200 px-4 py-3">
          <View className="flex-row items-center bg-gray-100 rounded-xl px-4">
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher un produit..."
              className="flex-1 py-3 px-3 text-gray-900"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="ml-2"
            >
              <Text className="text-primary font-medium">Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {/* Stats Cards */}
          <View className="bg-white border-b border-gray-200 p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-gray-900">Inventaire</Text>
              <TouchableOpacity
                onPress={() => setShowSearch(true)}
                className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
              >
                <Ionicons name="search" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View className="flex-row space-x-3">
              {/* Total Stock Card */}
              <View className="flex-1 bg-blue-500 rounded-xl p-4">
                <Text className="text-white/80 text-sm">Stock total</Text>
                <Text className="text-white text-2xl font-bold mt-1">
                  {summary?.totalQuantity || 0}
                </Text>
                <Text className="text-white/60 text-sm mt-1">
                  {summary?.totalItems || 0} produits
                </Text>
              </View>

              {/* Alerts Card */}
              <TouchableOpacity
                className="flex-1 bg-gray-100 rounded-xl p-4"
                onPress={() => setSelectedFilter(selectedFilter === 'low' ? 'all' : 'low')}
              >
                <Text className="text-gray-500 text-sm">Alertes</Text>
                <View className="flex-row items-center mt-1">
                  {activeAlertsCount > 0 && (
                    <View className="bg-red-500 rounded-full w-6 h-6 items-center justify-center mr-2">
                      <Text className="text-white text-xs font-bold">{activeAlertsCount}</Text>
                    </View>
                  )}
                  <Text className="text-gray-900 text-xl font-semibold">
                    {summary?.lowStockCount || 0} bas
                  </Text>
                </View>
                <Text className="text-gray-400 text-sm mt-1">
                  {summary?.outOfStockCount || 0} rupture{(summary?.outOfStockCount || 0) > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Alerts Banner */}
          {activeAlertsCount > 0 && (
            <View className="bg-orange-50 border-b border-orange-200 p-3">
              <View className="flex-row items-center">
                <Ionicons name="warning" size={20} color="#F97316" />
                <Text className="ml-2 text-orange-700 font-medium flex-1">
                  {activeAlertsCount} alerte{activeAlertsCount > 1 ? 's' : ''} de stock
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedFilter('out')}
                  className="bg-orange-500 px-3 py-1 rounded-full"
                >
                  <Text className="text-white text-sm font-medium">Voir</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}

      {/* Filter Tabs */}
      <View className="bg-white px-4 py-2 border-b border-gray-200">
        <View className="flex-row space-x-2">
          <TouchableOpacity
            onPress={() => setSelectedFilter('all')}
            className={`px-4 py-2 rounded-full ${
              selectedFilter === 'all' ? 'bg-primary' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`font-medium ${
                selectedFilter === 'all' ? 'text-white' : 'text-gray-600'
              }`}
            >
              Tout ({items.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedFilter('low')}
            className={`px-4 py-2 rounded-full flex-row items-center ${
              selectedFilter === 'low' ? 'bg-yellow-500' : 'bg-gray-100'
            }`}
          >
            <StockLevelBadge level="low" showLabel={false} size="small" />
            <Text
              className={`font-medium ml-1 ${
                selectedFilter === 'low' ? 'text-white' : 'text-gray-600'
              }`}
            >
              Bas ({summary?.lowStockCount || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedFilter('out')}
            className={`px-4 py-2 rounded-full flex-row items-center ${
              selectedFilter === 'out' ? 'bg-red-500' : 'bg-gray-100'
            }`}
          >
            <StockLevelBadge level="out" showLabel={false} size="small" />
            <Text
              className={`font-medium ml-1 ${
                selectedFilter === 'out' ? 'text-white' : 'text-gray-600'
              }`}
            >
              Rupture ({summary?.outOfStockCount || 0})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Results Info */}
      {searchQuery.trim() && (
        <View className="bg-blue-50 px-4 py-2 border-b border-blue-200">
          <Text className="text-blue-700">
            {filteredItems.length} resultat{filteredItems.length > 1 ? 's' : ''} pour "{searchQuery}"
          </Text>
        </View>
      )}

      {/* Inventory List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
      >
        {isLoading && items.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Text className="text-gray-500">Chargement...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View className="items-center justify-center py-16">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center">
              <Ionicons name="cube-outline" size={40} color="#9CA3AF" />
            </View>
            <Text className="text-gray-500 text-lg mt-4">
              {searchQuery.trim() ? 'Aucun resultat' : 'Aucun produit'}
            </Text>
            <Text className="text-gray-400 text-center mt-2">
              {searchQuery.trim()
                ? `Aucun produit ne correspond a "${searchQuery}"`
                : selectedFilter === 'all'
                ? "L'inventaire de ce stand est vide"
                : selectedFilter === 'low'
                ? 'Aucun produit avec un stock bas'
                : 'Aucun produit en rupture'}
            </Text>
          </View>
        ) : (
          <>
            {filteredItems.map((item) => (
              <StockCard
                key={item.id}
                item={item}
                onPress={() => handleProductPress(item)}
                onQuickAdd={() => handleQuickAdjust(item, 10)}
                onQuickRemove={() => handleQuickAdjust(item, -1)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View className="bg-white border-t border-gray-200 p-4 pb-8">
        <View className="flex-row space-x-3">
          <TouchableOpacity
            onPress={() => router.push('/(staff)/inventory/adjust')}
            className="flex-1 flex-row items-center justify-center py-3 bg-gray-100 rounded-xl"
          >
            <Ionicons name="add-circle-outline" size={20} color="#6B7280" />
            <Text className="text-gray-700 font-semibold ml-2">Ajustement</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(staff)/inventory/count')}
            className="flex-1 flex-row items-center justify-center py-3 bg-primary rounded-xl"
          >
            <Ionicons name="clipboard-outline" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">Inventaire</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
