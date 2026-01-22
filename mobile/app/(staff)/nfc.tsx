import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { isNFCSupported, isNFCEnabled, openNFCSettings } from '@/lib/nfc';

interface NFCStats {
  totalBracelets: number;
  activeBracelets: number;
  todayTransactions: number;
  todayVolume: number;
}

export default function NFCDashboardScreen() {
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [nfcEnabled, setNfcEnabled] = useState<boolean | null>(null);
  const [stats, setStats] = useState<NFCStats>({
    totalBracelets: 0,
    activeBracelets: 0,
    todayTransactions: 0,
    todayVolume: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkNFCStatus();
    loadStats();
  }, []);

  const checkNFCStatus = async () => {
    const supported = await isNFCSupported();
    setNfcSupported(supported);
    if (supported) {
      const enabled = await isNFCEnabled();
      setNfcEnabled(enabled);
    }
  };

  const loadStats = async () => {
    // Mock stats - replace with actual API call
    setStats({
      totalBracelets: 5234,
      activeBracelets: 4521,
      todayTransactions: 1234,
      todayVolume: 45678.50,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([checkNFCStatus(), loadStats()]);
    setRefreshing(false);
  };

  const navigateTo = (path: string) => {
    router.push(path as any);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-4 py-6 bg-white border-b border-gray-200">
          <Text className="text-2xl font-bold text-gray-900">NFC Bracelets</Text>
          <Text className="text-gray-500 mt-1">Gerez les bracelets NFC du festival</Text>
        </View>

        {/* NFC Status Banner */}
        {nfcSupported === false && (
          <View className="mx-4 mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
            <View className="flex-row items-center">
              <Ionicons name="close-circle" size={24} color="#DC2626" />
              <Text className="ml-2 text-red-700 font-medium">NFC non supporte</Text>
            </View>
            <Text className="mt-2 text-red-600 text-sm">
              Votre appareil ne supporte pas le NFC. Vous ne pourrez pas scanner les bracelets.
            </Text>
          </View>
        )}

        {nfcSupported === true && nfcEnabled === false && (
          <TouchableOpacity
            onPress={openNFCSettings}
            className="mx-4 mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Ionicons name="warning" size={24} color="#D97706" />
                <View className="ml-3 flex-1">
                  <Text className="text-yellow-700 font-medium">NFC desactive</Text>
                  <Text className="text-yellow-600 text-sm mt-1">
                    Activez le NFC pour scanner les bracelets
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D97706" />
            </View>
          </TouchableOpacity>
        )}

        {nfcSupported === true && nfcEnabled === true && (
          <View className="mx-4 mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
              <Text className="ml-2 text-green-700 font-medium">NFC actif et pret</Text>
            </View>
          </View>
        )}

        {/* Stats Cards */}
        <View className="px-4 mt-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Statistiques du jour</Text>
          <View className="flex-row flex-wrap -mx-1.5">
            <View className="w-1/2 px-1.5 mb-3">
              <View className="bg-white rounded-xl p-4 border border-gray-100">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
                    <Ionicons name="card" size={20} color="#3B82F6" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-2xl font-bold text-gray-900">{stats.totalBracelets}</Text>
                    <Text className="text-gray-500 text-sm">Total bracelets</Text>
                  </View>
                </View>
              </View>
            </View>
            <View className="w-1/2 px-1.5 mb-3">
              <View className="bg-white rounded-xl p-4 border border-gray-100">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center">
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-2xl font-bold text-gray-900">{stats.activeBracelets}</Text>
                    <Text className="text-gray-500 text-sm">Actifs</Text>
                  </View>
                </View>
              </View>
            </View>
            <View className="w-1/2 px-1.5 mb-3">
              <View className="bg-white rounded-xl p-4 border border-gray-100">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-purple-100 items-center justify-center">
                    <Ionicons name="swap-horizontal" size={20} color="#9333EA" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-2xl font-bold text-gray-900">{stats.todayTransactions}</Text>
                    <Text className="text-gray-500 text-sm">Transactions</Text>
                  </View>
                </View>
              </View>
            </View>
            <View className="w-1/2 px-1.5 mb-3">
              <View className="bg-white rounded-xl p-4 border border-gray-100">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center">
                    <Ionicons name="cash" size={20} color="#EA580C" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-xl font-bold text-gray-900">
                      {formatCurrency(stats.todayVolume)}
                    </Text>
                    <Text className="text-gray-500 text-sm">Volume</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-4 mt-6 mb-8">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Actions rapides</Text>
          <View className="space-y-3">
            <TouchableOpacity
              onPress={() => navigateTo('/(staff)/nfc/payment')}
              className="bg-primary rounded-xl p-4 flex-row items-center"
              disabled={!nfcEnabled}
              style={{ opacity: nfcEnabled ? 1 : 0.5 }}
            >
              <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center">
                <Ionicons name="card" size={24} color="white" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-white font-semibold text-lg">Paiement NFC</Text>
                <Text className="text-white/80 text-sm">Scanner un bracelet pour paiement</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigateTo('/(staff)/nfc/activate')}
              className="bg-white rounded-xl p-4 flex-row items-center border border-gray-200"
              disabled={!nfcEnabled}
              style={{ opacity: nfcEnabled ? 1 : 0.5 }}
            >
              <View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center">
                <Ionicons name="add-circle" size={24} color="#16A34A" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-gray-900 font-semibold text-lg">Activer bracelet</Text>
                <Text className="text-gray-500 text-sm">Associer un bracelet a un wallet</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigateTo('/(staff)/nfc/info')}
              className="bg-white rounded-xl p-4 flex-row items-center border border-gray-200"
              disabled={!nfcEnabled}
              style={{ opacity: nfcEnabled ? 1 : 0.5 }}
            >
              <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
                <Ionicons name="information-circle" size={24} color="#3B82F6" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-gray-900 font-semibold text-lg">Info bracelet</Text>
                <Text className="text-gray-500 text-sm">Consulter les details d'un bracelet</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigateTo('/(staff)/recharge')}
              className="bg-white rounded-xl p-4 flex-row items-center border border-gray-200"
            >
              <View className="w-12 h-12 rounded-full bg-orange-100 items-center justify-center">
                <Ionicons name="wallet" size={24} color="#EA580C" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-gray-900 font-semibold text-lg">Recharger wallet</Text>
                <Text className="text-gray-500 text-sm">Ajouter du solde via NFC</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
