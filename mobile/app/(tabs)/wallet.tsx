import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWalletStore, Transaction } from '@/stores/walletStore';
import WalletQRCode from '@/components/wallet/QRCode';
import TransactionItem from '@/components/wallet/TransactionItem';

export default function WalletScreen() {
  const router = useRouter();
  const {
    balance,
    currencyName,
    exchangeRate,
    transactions,
    isLoadingBalance,
    isLoadingTransactions,
    fetchBalance,
    fetchTransactions,
  } = useWalletStore();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Initial data fetch
  useEffect(() => {
    fetchBalance();
  }, []);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchBalance(),
        fetchTransactions(0),
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchBalance, fetchTransactions]);

  // Handle transaction tap
  const handleTransactionPress = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
  };

  // Navigate to top up
  const handleTopUp = () => {
    router.push('/wallet/topup' as any);
  };

  // Navigate to full transactions list
  const handleViewAllTransactions = () => {
    router.push('/wallet/transactions' as any);
  };

  // Format date for transaction detail modal
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

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6366F1"
          colors={['#6366F1']}
        />
      }
    >
      <View className="p-4 space-y-4">
        {/* Balance Card with QR Code */}
        <View className="bg-primary rounded-2xl p-6 items-center">
          <Text className="text-white/80">Mon solde</Text>

          {isLoadingBalance ? (
            <ActivityIndicator color="white" className="my-4" />
          ) : (
            <>
              <Text className="text-white text-5xl font-bold mt-2">
                {balance} {currencyName}
              </Text>
              <Text className="text-white/60 mt-1">
                = {(balance * exchangeRate).toFixed(2)} EUR
              </Text>
            </>
          )}

          {/* QR Code */}
          <View className="mt-6">
            <WalletQRCode size={200} showTimer={true} />
          </View>

          <Text className="text-white/60 text-sm mt-4 text-center">
            Presentez ce QR code au stand pour payer
          </Text>
        </View>

        {/* Top Up Button */}
        <TouchableOpacity
          onPress={handleTopUp}
          className="bg-white rounded-xl p-4 flex-row items-center justify-center border-2 border-primary"
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={24} color="#6366F1" />
          <Text className="text-primary font-semibold ml-2 text-lg">
            Recharger mon wallet
          </Text>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View className="flex-row space-x-3">
          <TouchableOpacity
            onPress={handleViewAllTransactions}
            className="flex-1 bg-white rounded-xl p-4 flex-row items-center justify-center"
            activeOpacity={0.7}
          >
            <Ionicons name="list-outline" size={20} color="#6366F1" />
            <Text className="text-gray-700 font-medium ml-2">Historique</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              // TODO: Implement support/help
            }}
            className="flex-1 bg-white rounded-xl p-4 flex-row items-center justify-center"
            activeOpacity={0.7}
          >
            <Ionicons name="help-circle-outline" size={20} color="#6366F1" />
            <Text className="text-gray-700 font-medium ml-2">Aide</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View className="bg-white rounded-xl p-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold">Transactions recentes</Text>
            {isLoadingTransactions && (
              <ActivityIndicator size="small" color="#6366F1" />
            )}
          </View>

          {transactions.length === 0 ? (
            <View className="py-8 items-center">
              <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
              <Text className="text-gray-500 text-center mt-4">
                Aucune transaction
              </Text>
              <Text className="text-gray-400 text-center text-sm mt-1">
                Vos transactions apparaitront ici
              </Text>
            </View>
          ) : (
            <View>
              {transactions.slice(0, 5).map((tx, index) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  currencyName={currencyName}
                  onPress={handleTransactionPress}
                  showBorder={index < Math.min(transactions.length, 5) - 1}
                />
              ))}
            </View>
          )}

          {transactions.length > 0 && (
            <TouchableOpacity
              onPress={handleViewAllTransactions}
              className="mt-4 py-2"
              activeOpacity={0.7}
            >
              <Text className="text-primary text-center font-medium">
                Voir tout l'historique ({transactions.length} transactions)
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info Card */}
        <View className="bg-blue-50 rounded-xl p-4 flex-row">
          <Ionicons name="information-circle" size={24} color="#3B82F6" />
          <View className="flex-1 ml-3">
            <Text className="text-blue-900 font-medium">
              Comment utiliser votre wallet ?
            </Text>
            <Text className="text-blue-700 text-sm mt-1">
              Presentez votre QR code aux stands du festival. Le montant sera
              automatiquement debite de votre solde.
            </Text>
          </View>
        </View>
      </View>

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
                  // TODO: Implement report issue
                  setSelectedTransaction(null);
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
    </ScrollView>
  );
}
