import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWalletStore } from '@/stores/walletStore';

export default function WalletScreen() {
  const router = useRouter();
  const { balance, currencyName, transactions } = useWalletStore();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4 space-y-4">
        {/* Balance Card */}
        <View className="bg-primary rounded-2xl p-6 items-center">
          <Text className="text-white/80">Mon solde</Text>
          <Text className="text-white text-5xl font-bold mt-2">
            {balance} {currencyName}
          </Text>
          <Text className="text-white/60 mt-1">≈ {(balance * 0.1).toFixed(2)} €</Text>

          {/* QR Code placeholder */}
          <View className="bg-white rounded-xl p-4 mt-6">
            <View className="w-48 h-48 bg-gray-200 rounded-lg items-center justify-center">
              <Ionicons name="qr-code-outline" size={100} color="#6366F1" />
            </View>
          </View>

          <Text className="text-white/60 text-sm mt-4">
            Présentez ce QR code pour payer
          </Text>
        </View>

        {/* Recharge Button */}
        <TouchableOpacity className="bg-white rounded-xl p-4 flex-row items-center justify-center border-2 border-primary">
          <Ionicons name="add-circle-outline" size={24} color="#6366F1" />
          <Text className="text-primary font-semibold ml-2">Recharger mon wallet</Text>
        </TouchableOpacity>

        {/* Transactions */}
        <View className="bg-white rounded-xl p-4">
          <Text className="text-lg font-semibold mb-3">Historique</Text>

          {transactions.length === 0 ? (
            <Text className="text-gray-500 text-center py-4">
              Aucune transaction
            </Text>
          ) : (
            <View className="space-y-2">
              {transactions.slice(0, 5).map((tx) => (
                <View
                  key={tx.id}
                  className="flex-row justify-between items-center py-3 border-b border-gray-100"
                >
                  <View className="flex-row items-center">
                    <View className={`w-10 h-10 rounded-full items-center justify-center ${
                      tx.amount > 0 ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Ionicons
                        name={tx.amount > 0 ? 'arrow-down' : 'arrow-up'}
                        size={20}
                        color={tx.amount > 0 ? '#10B981' : '#6B7280'}
                      />
                    </View>
                    <View className="ml-3">
                      <Text className="font-medium">{tx.reference || 'Transaction'}</Text>
                      <Text className="text-gray-500 text-sm">{tx.createdAt}</Text>
                    </View>
                  </View>
                  <Text className={`font-semibold ${
                    tx.amount > 0 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} {currencyName}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity className="mt-3">
            <Text className="text-primary text-center font-medium">
              Voir tout l'historique →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
