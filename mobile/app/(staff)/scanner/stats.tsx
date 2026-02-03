import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useScanStatsStore } from '@/stores/scanStatsStore';
import { useTicketScanStore } from '@/stores/ticketScanStore';
import ScanStatsCard, { DashboardStatCard } from '@/components/scanner/ScanStatsCard';
import ScanChart, { PeakHoursSummary, CompactScanChart } from '@/components/scanner/ScanChart';
import RecentScans from '@/components/scanner/RecentScans';

export default function ScannerStatsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');

  const {
    totalToday,
    validToday,
    invalidToday,
    hourlyData,
    invalidReasons,
    peakHour,
    peakHourScans,
    recentScans,
    historicalStats,
    lastSyncedAt,
    isSyncing,
    checkAndResetIfNewDay,
    syncStats,
    getValidPercentage,
  } = useScanStatsStore();

  const { todayStats } = useTicketScanStore();

  useEffect(() => {
    // Check if we need to reset stats for a new day
    checkAndResetIfNewDay();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncStats();
    } catch (error) {
      console.error('Failed to sync stats:', error);
    }
    setRefreshing(false);
  }, [syncStats]);

  const validPercentage = getValidPercentage();

  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}h`;

  const formatLastSync = () => {
    if (!lastSyncedAt) return 'Jamais';
    const date = new Date(lastSyncedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'A l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary pt-4 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity onPress={() => router.back()} className="p-2">
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-semibold">Statistiques Scanner</Text>
          <TouchableOpacity onPress={onRefresh} className="p-2" disabled={isSyncing}>
            {isSyncing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="sync-outline" size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Quick stats summary */}
        <View className="bg-white/10 rounded-xl p-4">
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-3xl font-bold text-white">{totalToday}</Text>
              <Text className="text-white/70 text-sm">Total scans</Text>
            </View>
            <View className="w-px bg-white/20" />
            <View className="items-center">
              <Text className="text-3xl font-bold text-green-300">{validPercentage}%</Text>
              <Text className="text-white/70 text-sm">Taux valide</Text>
            </View>
            <View className="w-px bg-white/20" />
            <View className="items-center">
              <Text className="text-3xl font-bold text-white">{formatHour(peakHour)}</Text>
              <Text className="text-white/70 text-sm">Heure pointe</Text>
            </View>
          </View>
        </View>

        {/* Last sync info */}
        <View className="flex-row items-center justify-center mt-3">
          <Ionicons name="cloud-done-outline" size={14} color="rgba(255,255,255,0.6)" />
          <Text className="text-white/60 text-xs ml-1">
            Derniere sync: {formatLastSync()}
          </Text>
        </View>
      </View>

      {/* Tab selector */}
      <View className="flex-row px-4 pt-4 pb-2">
        <TouchableOpacity
          onPress={() => setActiveTab('today')}
          className={`flex-1 py-2 rounded-lg mr-2 ${
            activeTab === 'today' ? 'bg-primary' : 'bg-white'
          }`}
        >
          <Text
            className={`text-center font-medium ${
              activeTab === 'today' ? 'text-white' : 'text-gray-600'
            }`}
          >
            Aujourd'hui
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-lg ${
            activeTab === 'history' ? 'bg-primary' : 'bg-white'
          }`}
        >
          <Text
            className={`text-center font-medium ${
              activeTab === 'history' ? 'text-white' : 'text-gray-600'
            }`}
          >
            Historique
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'today' ? (
          <TodayStatsView
            totalToday={totalToday}
            validToday={validToday}
            invalidToday={invalidToday}
            validPercentage={validPercentage}
            hourlyData={hourlyData}
            invalidReasons={invalidReasons}
            peakHour={peakHour}
            peakHourScans={peakHourScans}
            recentScans={recentScans}
            todayStats={todayStats}
          />
        ) : (
          <HistoryStatsView historicalStats={historicalStats} />
        )}
      </ScrollView>
    </View>
  );
}

interface TodayStatsViewProps {
  totalToday: number;
  validToday: number;
  invalidToday: number;
  validPercentage: number;
  hourlyData: any[];
  invalidReasons: any[];
  peakHour: number;
  peakHourScans: number;
  recentScans: any[];
  todayStats: any;
}

function TodayStatsView({
  totalToday,
  validToday,
  invalidToday,
  validPercentage,
  hourlyData,
  invalidReasons,
  peakHour,
  peakHourScans,
  recentScans,
  todayStats,
}: TodayStatsViewProps) {
  return (
    <View>
      {/* Main stats cards */}
      <View className="flex-row mb-4">
        <View className="flex-1 mr-2">
          <DashboardStatCard
            icon="scan-outline"
            value={totalToday}
            label="Total scans"
            color="blue"
          />
        </View>
        <View className="flex-1 ml-2">
          <DashboardStatCard
            icon="checkmark-circle-outline"
            value={validPercentage}
            label="Taux de reussite"
            color="green"
            suffix="%"
          />
        </View>
      </View>

      <View className="flex-row mb-4">
        <View className="flex-1 mr-2">
          <DashboardStatCard
            icon="checkmark"
            value={validToday}
            label="Valides"
            color="green"
          />
        </View>
        <View className="flex-1 ml-2">
          <DashboardStatCard
            icon="close"
            value={invalidToday}
            label="Invalides"
            color="red"
          />
        </View>
      </View>

      {/* Entry/Exit stats from ticketScanStore */}
      <View className="bg-white rounded-2xl p-4 mb-4">
        <Text className="text-lg font-semibold text-gray-900 mb-3">Flux d'entrees</Text>
        <View className="flex-row justify-around">
          <View className="items-center">
            <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center mb-2">
              <Ionicons name="enter-outline" size={24} color="#10B981" />
            </View>
            <Text className="text-2xl font-bold text-gray-900">{todayStats.entries}</Text>
            <Text className="text-xs text-gray-500">Entrees</Text>
          </View>
          <View className="items-center">
            <View className="w-12 h-12 bg-red-100 rounded-full items-center justify-center mb-2">
              <Ionicons name="exit-outline" size={24} color="#EF4444" />
            </View>
            <Text className="text-2xl font-bold text-gray-900">{todayStats.exits}</Text>
            <Text className="text-xs text-gray-500">Sorties</Text>
          </View>
          <View className="items-center">
            <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mb-2">
              <Ionicons name="people" size={24} color="#3B82F6" />
            </View>
            <Text className="text-2xl font-bold text-gray-900">{todayStats.currentlyInside}</Text>
            <Text className="text-xs text-gray-500">Sur place</Text>
          </View>
        </View>
      </View>

      {/* Hourly chart */}
      <View className="mb-4">
        <ScanChart
          data={hourlyData}
          height={200}
          animated={true}
          highlightPeakHour={true}
        />
      </View>

      {/* Peak hours */}
      <View className="mb-4">
        <PeakHoursSummary data={hourlyData} />
      </View>

      {/* Invalid reasons breakdown */}
      {invalidToday > 0 && (
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Raisons des echecs
          </Text>
          {invalidReasons
            .filter((r) => r.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((reason) => {
              const percentage = Math.round((reason.count / invalidToday) * 100);
              return (
                <View key={reason.reason} className="mb-3">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-gray-700">{reason.label}</Text>
                    <Text className="font-semibold text-gray-900">
                      {reason.count} ({percentage}%)
                    </Text>
                  </View>
                  <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <View
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </View>
                </View>
              );
            })}
        </View>
      )}

      {/* Recent scans */}
      <View className="mb-4">
        <RecentScans scans={recentScans} maxItems={10} showViewAll={false} />
      </View>
    </View>
  );
}

interface HistoryStatsViewProps {
  historicalStats: any[];
}

function HistoryStatsView({ historicalStats }: HistoryStatsViewProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  if (historicalStats.length === 0) {
    return (
      <View className="bg-white rounded-2xl p-8 items-center">
        <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
        <Text className="text-gray-500 mt-3 text-center">Aucun historique disponible</Text>
        <Text className="text-gray-400 text-sm text-center mt-1">
          Les statistiques des jours precedents apparaitront ici
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Summary card */}
      <View className="bg-white rounded-2xl p-4 mb-4">
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Derniers {historicalStats.length} jours
        </Text>
        <View className="flex-row justify-around">
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-900">
              {historicalStats.reduce((sum, day) => sum + day.totalScans, 0).toLocaleString('fr-FR')}
            </Text>
            <Text className="text-xs text-gray-500">Total scans</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-green-600">
              {Math.round(
                historicalStats.reduce((sum, day) => sum + day.validPercentage, 0) /
                  historicalStats.length
              )}%
            </Text>
            <Text className="text-xs text-gray-500">Moyenne valide</Text>
          </View>
        </View>
      </View>

      {/* Daily breakdown */}
      {historicalStats.map((day) => (
        <View key={day.date} className="bg-white rounded-2xl p-4 mb-3">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-semibold text-gray-900 capitalize">{formatDate(day.date)}</Text>
            <View className="bg-gray-100 px-3 py-1 rounded-full">
              <Text className="text-sm text-gray-600">{day.totalScans} scans</Text>
            </View>
          </View>

          {/* Mini chart */}
          <View className="mb-3">
            <CompactScanChart data={day.hourlyData} height={40} />
          </View>

          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full bg-green-500 mr-1" />
              <Text className="text-sm text-gray-600">{day.validScans} valides</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full bg-red-500 mr-1" />
              <Text className="text-sm text-gray-600">{day.invalidScans} invalides</Text>
            </View>
            <Text className="text-sm font-semibold text-green-600">{day.validPercentage}%</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
