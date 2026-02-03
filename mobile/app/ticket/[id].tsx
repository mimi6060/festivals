import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTicketStore, TicketStatus } from '@/stores/ticketStore';
import { TicketQR } from '@/components/tickets/TicketQR';

const statusConfig: Record<TicketStatus, { label: string; bgColor: string; textColor: string; icon: string }> = {
  VALID: {
    label: 'Valide',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: 'checkmark-circle',
  },
  USED: {
    label: 'Utilise',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    icon: 'checkmark-done',
  },
  CANCELLED: {
    label: 'Annule',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    icon: 'close-circle',
  },
  TRANSFERRED: {
    label: 'Transfere',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: 'arrow-forward-circle',
  },
  EXPIRED: {
    label: 'Expire',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    icon: 'time',
  },
};

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const getTicketById = useTicketStore((state) => state.getTicketById);

  const ticket = getTicketById(id);

  if (!ticket) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-4">
        <Stack.Screen options={{ title: 'Billet' }} />
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="text-gray-900 text-xl font-semibold mt-4">
          Billet introuvable
        </Text>
        <Text className="text-gray-500 text-center mt-2">
          Ce billet n'existe pas ou a ete supprime.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-primary rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = statusConfig[ticket.status];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleTransfer = () => {
    if (!ticket.transferable) {
      Alert.alert(
        'Transfert non disponible',
        'Ce billet ne peut pas etre transfere.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (ticket.status !== 'VALID') {
      Alert.alert(
        'Transfert non disponible',
        'Seuls les billets valides peuvent etre transferes.',
        [{ text: 'OK' }]
      );
      return;
    }

    router.push({
      pathname: '/ticket/transfer',
      params: { ticketId: ticket.id },
    });
  };

  const handleAddToWallet = () => {
    // Placeholder for Apple Wallet / Google Pay integration
    Alert.alert(
      'Bientot disponible',
      Platform.OS === 'ios'
        ? 'L\'ajout a Apple Wallet sera bientot disponible.'
        : 'L\'ajout a Google Pay sera bientot disponible.',
      [{ text: 'OK' }]
    );
  };

  const renderInfoRow = (icon: string, label: string, value: string) => (
    <View className="flex-row items-center py-3 border-b border-gray-100">
      <Ionicons name={icon as any} size={20} color="#6B7280" />
      <Text className="text-gray-500 ml-3 w-28">{label}</Text>
      <Text className="text-gray-900 flex-1 font-medium">{value}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title: 'Mon Billet',
          headerBackTitle: 'Retour',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { fontWeight: '600' },
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Status Banner */}
        <View className={`${status.bgColor} px-4 py-3`}>
          <View className="flex-row items-center justify-center">
            <Ionicons name={status.icon as any} size={20} color={status.textColor.replace('text-', '')} />
            <Text className={`${status.textColor} font-semibold ml-2`}>
              Billet {status.label}
            </Text>
          </View>
        </View>

        {/* QR Code Section */}
        <View className="py-8 bg-white">
          <TicketQR
            qrCode={ticket.qrCode}
            ticketCode={ticket.ticketCode}
            holderName={ticket.holderName}
            eventName={ticket.eventName}
            boostBrightness={ticket.status === 'VALID'}
          />
        </View>

        {/* Ticket Information */}
        <View className="mx-4 mt-4 bg-white rounded-xl p-4">
          <Text className="text-gray-900 font-semibold text-lg mb-2">
            Informations du billet
          </Text>

          {renderInfoRow('ticket', 'Type', ticket.ticketTypeName)}
          {renderInfoRow('person', 'Titulaire', ticket.holderName)}
          {renderInfoRow('mail', 'Email', ticket.holderEmail)}
          {renderInfoRow('calendar', 'Evenement', formatDate(ticket.eventDate))}
          {renderInfoRow('location', 'Lieu', ticket.eventLocation)}
          {renderInfoRow('time', 'Valide du', formatDateTime(ticket.validFrom))}
          {renderInfoRow('time', 'Jusqu\'au', formatDateTime(ticket.validUntil))}
          {renderInfoRow('pricetag', 'Prix', `${ticket.price.toFixed(2)} ${ticket.currency}`)}

          <View className="flex-row items-center py-3">
            <Ionicons name="swap-horizontal" size={20} color="#6B7280" />
            <Text className="text-gray-500 ml-3 w-28">Transferable</Text>
            <Text className={`flex-1 font-medium ${ticket.transferable ? 'text-green-600' : 'text-red-600'}`}>
              {ticket.transferable ? 'Oui' : 'Non'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        {ticket.status === 'VALID' && (
          <View className="mx-4 mt-4 space-y-3">
            {/* Transfer Button */}
            {ticket.transferable && (
              <TouchableOpacity
                onPress={handleTransfer}
                className="bg-primary rounded-xl p-4 flex-row items-center justify-center"
              >
                <Ionicons name="swap-horizontal" size={24} color="white" />
                <Text className="text-white font-semibold ml-2">
                  Transferer ce billet
                </Text>
              </TouchableOpacity>
            )}

            {/* Add to Wallet Button */}
            <TouchableOpacity
              onPress={handleAddToWallet}
              className="bg-white border-2 border-gray-200 rounded-xl p-4 flex-row items-center justify-center mt-3"
            >
              <Ionicons
                name={Platform.OS === 'ios' ? 'wallet' : 'card'}
                size={24}
                color="#374151"
              />
              <Text className="text-gray-900 font-semibold ml-2">
                {Platform.OS === 'ios' ? 'Ajouter a Apple Wallet' : 'Ajouter a Google Pay'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Purchase Info */}
        <View className="mx-4 mt-4 bg-gray-100 rounded-xl p-4">
          <View className="flex-row items-center">
            <Ionicons name="receipt-outline" size={20} color="#6B7280" />
            <Text className="text-gray-600 ml-2 text-sm">
              Achete le {formatDate(ticket.purchaseDate)}
            </Text>
          </View>
          <Text className="text-gray-400 text-xs mt-1">
            Ref: {ticket.id}
          </Text>
        </View>

        {/* Help Section */}
        <View className="mx-4 mt-4 bg-primary/5 rounded-xl p-4">
          <View className="flex-row items-start">
            <Ionicons name="help-circle-outline" size={24} color="#6366F1" />
            <View className="ml-3 flex-1">
              <Text className="text-gray-900 font-medium mb-1">
                Un probleme avec ce billet ?
              </Text>
              <Text className="text-gray-600 text-sm">
                Contactez notre support pour toute question concernant votre billet ou pour signaler un probleme.
              </Text>
              <TouchableOpacity className="mt-2">
                <Text className="text-primary font-medium">
                  Contacter le support
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
