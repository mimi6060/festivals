import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWalletStore, Transaction, TransactionType } from '@/stores/walletStore';
import TransactionItem from '@/components/wallet/TransactionItem';

// Filter options
interface FilterOption {
  id: TransactionType | null;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const FILTER_OPTIONS: FilterOption[] = [
  { id: null, label: 'Tout', icon: 'list-outline' },
  { id: 'TOP_UP', label: 'Recharges', icon: 'arrow-down' },
  { id: 'PURCHASE', label: 'Achats', icon: 'cart-outline' },
  { id: 'REFUND', label: 'Remboursements', icon: 'refresh-outline' },
];

export default function TransactionsScreen() {
  const router = useRouter();
  const {
    transactions,
    currencyName,
    exchangeRate,
    isLoadingTransactions,
    hasMoreTransactions,
    transactionPage,
    transactionFilter,
    fetchTransactions,
    setTransactionFilter,
  } = useWalletStore();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Initial data fetch
  useEffect(() => {
    fetchTransactions(0, transactionFilter);
  }, []);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchTransactions(0, transactionFilter);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchTransactions, transactionFilter]);

  // Load more (infinite scroll)
  const onEndReached = useCallback(async () => {
    if (!isLoadingTransactions && hasMoreTransactions) {
      await fetchTransactions(transactionPage + 1, transactionFilter);
    }
  }, [isLoadingTransactions, hasMoreTransactions, transactionPage, transactionFilter, fetchTransactions]);

  // Handle filter change
  const handleFilterChange = async (filter: TransactionType | null) => {
    setTransactionFilter(filter);
    setShowFilters(false);
    await fetchTransactions(0, filter);
  };

  // Handle transaction tap
  const handleTransactionPress = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
  };

  // Format date for transaction detail
  const formatFullDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get current filter label
  const getCurrentFilterLabel = (): string => {
    const filter = FILTER_OPTIONS.find(f => f.id === transactionFilter);
    return filter?.label || 'Tout';
  };

  // Render transaction item
  const renderTransaction = useCallback(({ item, index }: { item: Transaction; index: number }) => (
    <View className="px-4">
      <TransactionItem
        transaction={item}
        currencyName={currencyName}
        onPress={handleTransactionPress}
        showBorder={index < transactions.length - 1}
      />
    </View>
  ), [currencyName, transactions.length]);

  // Render list header
  const renderHeader = () => (
    <View className="p-4 pb-2">
      {/* Filter Button */}
      <TouchableOpacity
        onPress={() => setShowFilters(true)}
        className="bg-white rounded-xl p-3 flex-row items-center justify-between border border-gray-200"
        activeOpacity={0.7}
      >
        <View className="flex-row items-center">
          <Ionicons name="filter-outline" size={20} color="#6366F1" />
          <Text className="ml-2 text-gray-700">Filtrer: {getCurrentFilterLabel()}</Text>
        </View>
        <Ionicons name="chevron-down" size={20} color="#6B7280" />
      </TouchableOpacity>

      {/* Stats Summary */}
      <View className="flex-row mt-4 space-x-3">
        <View className="flex-1 bg-green-50 rounded-xl p-3">
          <Text className="text-green-600 text-xs">Total recharges</Text>
          <Text className="text-green-700 font-bold text-lg">
            +{transactions
              .filter(t => t.amount > 0)
              .reduce((sum, t) => sum + t.amount, 0)
            } {currencyName}
          </Text>
        </View>
        <View className="flex-1 bg-gray-50 rounded-xl p-3">
          <Text className="text-gray-600 text-xs">Total depenses</Text>
          <Text className="text-gray-700 font-bold text-lg">
            {transactions
              .filter(t => t.amount < 0)
              .reduce((sum, t) => sum + t.amount, 0)
            } {currencyName}
          </Text>
        </View>
      </View>

      <Text className="text-gray-500 text-sm mt-4 mb-2">
        {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
      </Text>
    </View>
  );

  // Render empty state
  const renderEmpty = () => {
    if (isLoadingTransactions) {
      return null;
    }

    return (
      <View className="flex-1 items-center justify-center py-16">
        <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
        <Text className="text-gray-500 text-lg mt-4">Aucune transaction</Text>
        <Text className="text-gray-400 text-center mt-2 px-8">
          {transactionFilter
            ? `Aucune transaction de type "${getCurrentFilterLabel()}"`
            : 'Vos transactions apparaitront ici'}
        </Text>
        {transactionFilter && (
          <TouchableOpacity
            onPress={() => handleFilterChange(null)}
            className="mt-4 bg-primary/10 rounded-xl px-4 py-2"
          >
            <Text className="text-primary font-medium">Voir toutes les transactions</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render footer (loading indicator for infinite scroll)
  const renderFooter = () => {
    if (!isLoadingTransactions || refreshing) {
      return null;
    }

    return (
      <View className="py-4">
        <ActivityIndicator color="#6366F1" />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 20,
        }}
      />

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilters(false)}
      >
        <View className="flex-1 bg-white">
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <Text className="text-lg font-semibold">Filtrer par type</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)} className="p-2">
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Filter Options */}
          <ScrollView className="flex-1 p-4">
            {FILTER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id ?? 'all'}
                onPress={() => handleFilterChange(option.id)}
                className={`flex-row items-center p-4 rounded-xl mb-2 ${
                  transactionFilter === option.id
                    ? 'bg-primary'
                    : 'bg-gray-100'
                }`}
                activeOpacity={0.7}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    transactionFilter === option.id
                      ? 'bg-white/20'
                      : 'bg-white'
                  }`}
                >
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={transactionFilter === option.id ? 'white' : '#6366F1'}
                  />
                </View>
                <Text
                  className={`ml-3 font-medium flex-1 ${
                    transactionFilter === option.id
                      ? 'text-white'
                      : 'text-gray-900'
                  }`}
                >
                  {option.label}
                </Text>
                {transactionFilter === option.id && (
                  <Ionicons name="checkmark" size={24} color="white" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Transaction Detail Modal */}
      <Modal
        visible={!!selectedTransaction}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedTransaction(null)}
      >
        {selectedTransaction && (
          <View className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold">Detail transaction</Text>
              <TouchableOpacity
                onPress={() => setSelectedTransaction(null)}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView className="flex-1 p-4">
              {/* Amount */}
              <View className="items-center py-6">
                <Text
                  className={`text-4xl font-bold ${
                    selectedTransaction.amount > 0 ? 'text-green-600' : 'text-gray-900'
                  }`}
                >
                  {selectedTransaction.amount > 0 ? '+' : ''}
                  {selectedTransaction.amount} {currencyName}
                </Text>
                <Text className="text-gray-500 mt-2">
                  = {Math.abs(selectedTransaction.amount * exchangeRate).toFixed(2)} EUR
                </Text>
              </View>

              {/* Details */}
              <View className="bg-gray-50 rounded-xl p-4 space-y-4">
                <View className="flex-row justify-between">
                  <Text className="text-gray-500">Type</Text>
                  <Text className="font-medium">
                    {selectedTransaction.type === 'TOP_UP' && 'Recharge'}
                    {selectedTransaction.type === 'PURCHASE' && 'Achat'}
                    {selectedTransaction.type === 'REFUND' && 'Remboursement'}
                    {selectedTransaction.type === 'RECHARGE' && 'Recharge'}
                    {selectedTransaction.type === 'PAYMENT' && 'Paiement'}
                    {selectedTransaction.type === 'CANCEL' && 'Annulation'}
                  </Text>
                </View>

                {selectedTransaction.reference && (
                  <View className="flex-row justify-between">
                    <Text className="text-gray-500">Reference</Text>
                    <Text className="font-medium">{selectedTransaction.reference}</Text>
                  </View>
                )}

                {selectedTransaction.description && (
                  <View className="flex-row justify-between">
                    <Text className="text-gray-500">Description</Text>
                    <Text className="font-medium flex-1 text-right ml-4">
                      {selectedTransaction.description}
                    </Text>
                  </View>
                )}

                {selectedTransaction.standName && (
                  <View className="flex-row justify-between">
                    <Text className="text-gray-500">Stand</Text>
                    <Text className="font-medium">{selectedTransaction.standName}</Text>
                  </View>
                )}

                <View className="flex-row justify-between">
                  <Text className="text-gray-500">Date</Text>
                  <Text className="font-medium">
                    {formatFullDate(selectedTransaction.createdAt)}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-gray-500">Solde apres</Text>
                  <Text className="font-medium">
                    {selectedTransaction.balanceAfter} {currencyName}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-gray-500">Statut</Text>
                  <View className="flex-row items-center">
                    <View
                      className={`w-2 h-2 rounded-full mr-2 ${
                        selectedTransaction.synced ? 'bg-green-500' : 'bg-yellow-500'
                      }`}
                    />
                    <Text className="font-medium">
                      {selectedTransaction.synced ? 'Synchronise' : 'En attente'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-gray-500">ID</Text>
                  <Text className="font-mono text-xs text-gray-400">
                    {selectedTransaction.id}
                  </Text>
                </View>
              </View>

              {/* Help text */}
              {!selectedTransaction.synced && (
                <View className="bg-yellow-50 rounded-xl p-4 mt-4 flex-row">
                  <Ionicons name="warning" size={20} color="#F59E0B" />
                  <Text className="text-yellow-700 text-sm ml-2 flex-1">
                    Cette transaction sera synchronisee des que vous serez connecte a internet.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Actions */}
            <View className="p-4 border-t border-gray-200">
              <TouchableOpacity
                onPress={() => {
                  // Navigate to report issue screen with transaction context
                  const txId = selectedTransaction?.id;
                  setSelectedTransaction(null);
                  if (txId) {
                    router.push({
                      pathname: '/support/report',
                      params: { transactionId: txId }
                    });
                  }
                }}
                className="bg-gray-100 rounded-xl p-4 flex-row items-center justify-center"
              >
                <Ionicons name="flag-outline" size={20} color="#6B7280" />
                <Text className="text-gray-700 font-medium ml-2">
                  Signaler un probleme
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}
