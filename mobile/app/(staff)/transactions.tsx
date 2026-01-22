import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStaffStore, StaffTransaction } from '@/stores/staffStore';
import { useWalletStore } from '@/stores/walletStore';

export default function TransactionsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'payment' | 'refund'>('all');

  const {
    todayTransactions,
    todayTotal,
    currentStand,
    refundTransaction,
    loadTodayTransactions,
  } = useStaffStore();

  const { currencyName } = useWalletStore();

  const filteredTransactions = todayTransactions.filter((tx) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'payment') return tx.type === 'PAYMENT';
    if (selectedFilter === 'refund') return tx.type === 'REFUND';
    return true;
  });

  const paymentCount = todayTransactions.filter((tx) => tx.type === 'PAYMENT').length;
  const refundCount = todayTransactions.filter((tx) => tx.type === 'REFUND').length;

  const onRefresh = async () => {
    setRefreshing(true);
    loadTodayTransactions();
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleRefund = (transaction: StaffTransaction) => {
    if (!transaction.refundable) {
      Alert.alert('Remboursement impossible', 'Cette transaction a deja ete remboursee');
      return;
    }

    Alert.alert(
      'Confirmer le remboursement',
      `Rembourser ${transaction.amount} ${currencyName} a ${transaction.customerName || 'Client'} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rembourser',
          style: 'destructive',
          onPress: async () => {
            const success = await refundTransaction(transaction.id);
            if (success) {
              Alert.alert('Succes', 'Le remboursement a ete effectue');
            } else {
              Alert.alert('Erreur', 'Le remboursement a echoue');
            }
          },
        },
      ]
    );
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const TransactionItem = ({ transaction }: { transaction: StaffTransaction }) => {
    const isRefund = transaction.type === 'REFUND';
    const isRefunded = !!transaction.refundedAt;

    return (
      <TouchableOpacity
        onLongPress={() => !isRefund && handleRefund(transaction)}
        className={`bg-white rounded-xl p-4 mb-3 ${isRefunded ? 'opacity-60' : ''}`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isRefund ? 'bg-orange-100' : 'bg-green-100'
              }`}
            >
              <Ionicons
                name={isRefund ? 'arrow-undo-outline' : 'arrow-down-outline'}
                size={20}
                color={isRefund ? '#F97316' : '#10B981'}
              />
            </View>

            <View className="ml-3 flex-1">
              <View className="flex-row items-center">
                <Text className="font-medium">
                  {transaction.customerName || 'Client'}
                </Text>
                {isRefunded && (
                  <View className="ml-2 bg-gray-200 px-2 py-0.5 rounded">
                    <Text className="text-gray-600 text-xs">Rembourse</Text>
                  </View>
                )}
              </View>
              <Text className="text-gray-500 text-sm">{formatTime(transaction.createdAt)}</Text>
            </View>
          </View>

          <View className="items-end">
            <Text
              className={`text-lg font-semibold ${
                isRefund ? 'text-orange-500' : 'text-green-600'
              }`}
            >
              {isRefund ? '-' : '+'}{Math.abs(transaction.amount)} {currencyName}
            </Text>
            {transaction.items.length > 0 && (
              <Text className="text-gray-400 text-sm">
                {transaction.items.length} article{transaction.items.length > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Items preview */}
        {transaction.items.length > 0 && (
          <View className="mt-3 pt-3 border-t border-gray-100">
            <Text className="text-gray-500 text-sm">
              {transaction.items.map((item) => `${item.quantity}x ${item.product.name}`).join(', ')}
            </Text>
          </View>
        )}

        {/* Refund hint */}
        {!isRefund && transaction.refundable && !isRefunded && (
          <Text className="text-gray-400 text-xs mt-2">
            Appui long pour rembourser
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Stats Cards */}
      <View className="bg-white border-b border-gray-200 p-4">
        <View className="flex-row space-x-3">
          {/* Total Card */}
          <View className="flex-1 bg-success rounded-xl p-4">
            <Text className="text-white/80 text-sm">Total du jour</Text>
            <Text className="text-white text-2xl font-bold mt-1">
              {todayTotal} {currencyName}
            </Text>
            <Text className="text-white/60 text-sm mt-1">
              {paymentCount} vente{paymentCount !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Stand Card */}
          <View className="flex-1 bg-gray-100 rounded-xl p-4">
            <Text className="text-gray-500 text-sm">Stand</Text>
            <Text className="text-gray-900 font-semibold mt-1" numberOfLines={2}>
              {currentStand?.name || 'Non defini'}
            </Text>
            <Text className="text-gray-400 text-sm mt-1">
              {refundCount} remboursement{refundCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

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
              Tout ({todayTransactions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedFilter('payment')}
            className={`px-4 py-2 rounded-full ${
              selectedFilter === 'payment' ? 'bg-green-500' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`font-medium ${
                selectedFilter === 'payment' ? 'text-white' : 'text-gray-600'
              }`}
            >
              Ventes ({paymentCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedFilter('refund')}
            className={`px-4 py-2 rounded-full ${
              selectedFilter === 'refund' ? 'bg-orange-500' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`font-medium ${
                selectedFilter === 'refund' ? 'text-white' : 'text-gray-600'
              }`}
            >
              Remb. ({refundCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Transactions List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
      >
        {filteredTransactions.length === 0 ? (
          <View className="items-center justify-center py-16">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center">
              <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
            </View>
            <Text className="text-gray-500 text-lg mt-4">Aucune transaction</Text>
            <Text className="text-gray-400 text-center mt-2">
              Les transactions apparaitront ici{'\n'}au fur et a mesure des ventes
            </Text>
          </View>
        ) : (
          <>
            {filteredTransactions.map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} />
            ))}
          </>
        )}
      </ScrollView>

      {/* Export Button */}
      {todayTransactions.length > 0 && (
        <View className="bg-white border-t border-gray-200 p-4 pb-8">
          <TouchableOpacity
            onPress={() => Alert.alert('Export', 'Fonctionnalite a venir')}
            className="flex-row items-center justify-center py-3 bg-gray-100 rounded-xl"
          >
            <Ionicons name="download-outline" size={20} color="#6B7280" />
            <Text className="text-gray-700 font-medium ml-2">Exporter le rapport</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
