import { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTicketStore, TicketStatus } from '@/stores/ticketStore';
import { TicketCard } from '@/components/tickets/TicketCard';
import {
  EmptyState,
  EmptyStatePresets,
  ErrorState,
  ErrorBanner,
  TicketCardSkeleton,
} from '@/components/common';
import haptics from '@/lib/haptics';

export default function TicketsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tickets, isLoading, error, fetchTickets, clearError } = useTicketStore();

  useEffect(() => {
    fetchTickets();
  }, []);

  const onRefresh = useCallback(async () => {
    haptics.pullToRefreshTrigger();
    clearError();
    await fetchTickets();
  }, [fetchTickets, clearError]);

  const handleTicketPress = (ticketId: string) => {
    router.push(`/ticket/${ticketId}`);
  };

  // Separate tickets by status
  const activeTickets = tickets.filter((t) => t.status === 'VALID');
  const pastTickets = tickets.filter((t) => ['USED', 'EXPIRED', 'CANCELLED', 'TRANSFERRED'].includes(t.status));

  const renderEmptyState = () => (
    <EmptyState
      {...EmptyStatePresets.noTickets}
      actionLabel="Acheter des billets"
      onAction={() => {
        haptics.buttonPress();
        // Open website or navigate to purchase
      }}
    />
  );

  const renderError = () => (
    <ErrorBanner
      message={error || 'Une erreur est survenue'}
      type="error"
      onRetry={() => {
        haptics.buttonPress();
        onRefresh();
      }}
      onDismiss={() => {
        clearError();
      }}
    />
  );

  const renderLoadingSkeleton = () => (
    <View className="px-4 pt-4">
      <TicketCardSkeleton />
      <TicketCardSkeleton />
      <TicketCardSkeleton />
    </View>
  );

  const renderSectionHeader = (title: string, count: number, icon: string) => (
    <View className="flex-row items-center mb-3 mt-6 first:mt-0">
      <Ionicons name={icon as any} size={20} color="#6366F1" />
      <Text className="text-gray-900 font-semibold text-lg ml-2">
        {title}
      </Text>
      <View className="bg-primary/10 rounded-full px-2 py-0.5 ml-2">
        <Text className="text-primary text-sm font-medium">{count}</Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Mes Billets</Text>
        <Text className="text-gray-500 text-sm mt-1">
          {tickets.length} billet{tickets.length !== 1 ? 's' : ''} au total
        </Text>
      </View>

      {isLoading && tickets.length === 0 ? (
        renderLoadingSkeleton()
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor="#6366F1"
              colors={['#6366F1']}
            />
          }
        >
          {error && renderError()}

          {tickets.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {/* Active Tickets */}
              {activeTickets.length > 0 && (
                <View>
                  {renderSectionHeader('Billets actifs', activeTickets.length, 'checkmark-circle')}
                  {activeTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onPress={() => handleTicketPress(ticket.id)}
                    />
                  ))}
                </View>
              )}

              {/* Past Tickets */}
              {pastTickets.length > 0 && (
                <View>
                  {renderSectionHeader('Historique', pastTickets.length, 'time')}
                  {pastTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onPress={() => handleTicketPress(ticket.id)}
                    />
                  ))}
                </View>
              )}
            </>
          )}

          {/* Info Card */}
          <View className="bg-primary/5 rounded-xl p-4 mt-4">
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={24} color="#6366F1" />
              <View className="ml-3 flex-1">
                <Text className="text-gray-900 font-medium mb-1">
                  Besoin d'aide ?
                </Text>
                <Text className="text-gray-600 text-sm">
                  Si vous avez des questions concernant vos billets, consultez notre FAQ ou contactez le support.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
