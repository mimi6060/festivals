import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStaffStore, StaffTransaction } from '@/stores/staffStore';
import { useWalletStore } from '@/stores/walletStore';
import { useNetworkStore } from '@/stores/networkStore';
import {
  useOfflineTransactionStore,
  usePendingTransactionCount,
  useOfflineSyncStatus,
} from '@/stores/offlineTransactionStore';
import type { OfflineTransaction } from '@/lib/offline';

type FilterType = 'all' | 'payment' | 'refund' | 'pending';

export default function TransactionsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');

  const {
    todayTransactions,
    todayTotal,
    currentStand,
    refundTransaction,
    loadTodayTransactions,
  } = useStaffStore();

  const { currencyName } = useWalletStore();
  const { isOnline } = useNetworkStore();
  const pendingCount = usePendingTransactionCount();
  const { status: syncStatus, isSyncing, lastSyncTime } = useOfflineSyncStatus();
  const {
    pendingTransactions,
    loadPendingTransactions,
    syncPendingTransactions,
    loadSummary,
    summary,
  } = useOfflineTransactionStore();

  // Load pending transactions on mount
  useEffect(() => {
    loadPendingTransactions();
    loadSummary();
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      handleSync();
    }
  }, [isOnline]);

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
    await loadPendingTransactions();
    await loadSummary();
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleSync = async () => {
    if (!isOnline) {
      Alert.alert('Hors ligne', 'Connexion internet requise pour synchroniser');
      return;
    }

    const result = await syncPendingTransactions();

    if (result.success) {
      if (result.syncedCount > 0) {
        Alert.alert(
          'Synchronisation terminee',
          `${result.syncedCount} transaction${result.syncedCount > 1 ? 's' : ''} synchronisee${result.syncedCount > 1 ? 's' : ''}`
        );
      }
    } else {
      Alert.alert(
        'Synchronisation partielle',
        `${result.syncedCount} reussie${result.syncedCount > 1 ? 's' : ''}, ${result.failedCount} echec${result.failedCount > 1 ? 's' : ''}`
      );
    }

    await loadSummary();
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

  const formatRelativeTime = (isoString: string | null) => {
    if (!isoString) return 'Jamais';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'A l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return date.toLocaleDateString('fr-FR');
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

  const OfflineTransactionItem = ({ transaction }: { transaction: OfflineTransaction }) => {
    return (
      <View className="bg-white rounded-xl p-4 mb-3 border-l-4 border-amber-400">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full items-center justify-center bg-amber-100">
              <Ionicons name="cloud-upload-outline" size={20} color="#F59E0B" />
            </View>

            <View className="ml-3 flex-1">
              <View className="flex-row items-center">
                <Text className="font-medium">
                  {transaction.customerName || `Client #${transaction.walletId.slice(-6)}`}
                </Text>
                <View className="ml-2 bg-amber-100 px-2 py-0.5 rounded">
                  <Text className="text-amber-700 text-xs">En attente</Text>
                </View>
              </View>
              <Text className="text-gray-500 text-sm">{formatTime(transaction.createdAt)}</Text>
            </View>
          </View>

          <View className="items-end">
            <Text className="text-lg font-semibold text-amber-600">
              +{transaction.amount} {currencyName}
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
              {transaction.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ')}
            </Text>
          </View>
        )}

        {/* Receipt ID */}
        <View className="mt-2 flex-row items-center">
          <Ionicons name="receipt-outline" size={14} color="#9CA3AF" />
          <Text className="text-gray-400 text-xs ml-1 font-mono">{transaction.receiptId}</Text>
        </View>

        {/* Retry count */}
        {transaction.retryCount > 0 && (
          <View className="mt-2 flex-row items-center">
            <Ionicons name="refresh-outline" size={14} color="#EF4444" />
            <Text className="text-red-500 text-xs ml-1">
              {transaction.retryCount} tentative{transaction.retryCount > 1 ? 's' : ''} echouee{transaction.retryCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Offline Banner */}
      {!isOnline && (
        <View className="bg-amber-500 px-4 py-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="cloud-offline-outline" size={20} color="#FFFFFF" />
            <Text className="text-white font-medium ml-2">Mode hors ligne</Text>
          </View>
          {pendingCount > 0 && (
            <Text className="text-white/80 text-sm">
              {pendingCount} en attente
            </Text>
          )}
        </View>
      )}

      {/* Pending Sync Banner */}
      {isOnline && pendingCount > 0 && (
        <TouchableOpacity
          onPress={handleSync}
          disabled={isSyncing}
          className="bg-blue-50 px-4 py-3 flex-row items-center justify-between border-b border-blue-100"
        >
          <View className="flex-row items-center">
            <Ionicons
              name={isSyncing ? 'sync' : 'cloud-upload-outline'}
              size={20}
              color="#3B82F6"
            />
            <View className="ml-3">
              <Text className="text-blue-700 font-medium">
                {isSyncing ? 'Synchronisation en cours...' : `${pendingCount} transaction${pendingCount > 1 ? 's' : ''} en attente`}
              </Text>
              {lastSyncTime && (
                <Text className="text-blue-500 text-xs">
                  Derniere sync: {formatRelativeTime(lastSyncTime)}
                </Text>
              )}
            </View>
          </View>
          {!isSyncing && (
            <View className="bg-blue-500 px-3 py-1.5 rounded-full">
              <Text className="text-white font-medium text-sm">Synchroniser</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Stats Cards */}
      <View className="bg-white border-b border-gray-200 p-4">
        <View className="flex-row space-x-3">
          {/* Total Card */}
          <View className="flex-1 bg-success rounded-xl p-4">
            <Text className="text-white/80 text-sm">Total du jour</Text>
            <Text className="text-white text-2xl font-bold mt-1">
              {todayTotal + (summary?.pendingAmount || 0)} {currencyName}
            </Text>
            <Text className="text-white/60 text-sm mt-1">
              {paymentCount + pendingCount} vente{(paymentCount + pendingCount) !== 1 ? 's' : ''}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

            {pendingCount > 0 && (
              <TouchableOpacity
                onPress={() => setSelectedFilter('pending')}
                className={`px-4 py-2 rounded-full ${
                  selectedFilter === 'pending' ? 'bg-amber-500' : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`font-medium ${
                    selectedFilter === 'pending' ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  En attente ({pendingCount})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Transactions List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
      >
        {/* Pending Transactions Section */}
        {selectedFilter === 'pending' ? (
          pendingTransactions.length === 0 ? (
            <View className="items-center justify-center py-16">
              <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center">
                <Ionicons name="checkmark-circle-outline" size={40} color="#10B981" />
              </View>
              <Text className="text-gray-500 text-lg mt-4">Tout est synchronise</Text>
              <Text className="text-gray-400 text-center mt-2">
                Aucune transaction en attente
              </Text>
            </View>
          ) : (
            pendingTransactions.map((transaction) => (
              <OfflineTransactionItem key={transaction.id} transaction={transaction} />
            ))
          )
        ) : filteredTransactions.length === 0 ? (
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
            {/* Show pending first if not filtered */}
            {selectedFilter === 'all' && pendingTransactions.length > 0 && (
              <>
                <View className="flex-row items-center mb-3">
                  <View className="flex-1 h-px bg-amber-200" />
                  <Text className="text-amber-600 font-medium mx-3">En attente de sync</Text>
                  <View className="flex-1 h-px bg-amber-200" />
                </View>
                {pendingTransactions.map((transaction) => (
                  <OfflineTransactionItem key={transaction.id} transaction={transaction} />
                ))}
                <View className="flex-row items-center my-3">
                  <View className="flex-1 h-px bg-gray-200" />
                  <Text className="text-gray-400 font-medium mx-3">Synchronisees</Text>
                  <View className="flex-1 h-px bg-gray-200" />
                </View>
              </>
            )}

            {filteredTransactions.map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} />
            ))}
          </>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View className="bg-white border-t border-gray-200 p-4 pb-8">
        {pendingCount > 0 && isOnline ? (
          <TouchableOpacity
            onPress={handleSync}
            disabled={isSyncing}
            className={`flex-row items-center justify-center py-3 rounded-xl mb-3 ${
              isSyncing ? 'bg-blue-300' : 'bg-blue-500'
            }`}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
            <Text className="text-white font-medium ml-2">
              {isSyncing ? 'Synchronisation...' : `Synchroniser ${pendingCount} transaction${pendingCount > 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>
        ) : null}

        {todayTransactions.length > 0 && (
          <TouchableOpacity
            onPress={() => Alert.alert('Export', 'Fonctionnalite a venir')}
            className="flex-row items-center justify-center py-3 bg-gray-100 rounded-xl"
          >
            <Ionicons name="download-outline" size={20} color="#6B7280" />
            <Text className="text-gray-700 font-medium ml-2">Exporter le rapport</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
