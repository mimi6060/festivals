import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ticket, TicketStatus } from '@/stores/ticketStore';

interface TicketCardProps {
  ticket: Ticket;
  onPress: () => void;
}

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

const ticketTypeColors: Record<string, string> = {
  DAY_PASS: 'bg-indigo-500',
  WEEKEND_PASS: 'bg-purple-500',
  VIP: 'bg-amber-500',
  CAMPING: 'bg-emerald-500',
  EARLY_BIRD: 'bg-pink-500',
};

export function TicketCard({ ticket, onPress }: TicketCardProps) {
  const status = statusConfig[ticket.status];
  const ticketColor = ticketTypeColors[ticket.ticketType] || 'bg-primary';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="bg-white rounded-2xl overflow-hidden shadow-sm mb-4"
    >
      {/* Ticket Header with Color Strip */}
      <View className={`${ticketColor} px-4 py-3`}>
        <View className="flex-row justify-between items-center">
          <Text className="text-white font-bold text-lg" numberOfLines={1}>
            {ticket.eventName}
          </Text>
          <View className={`${status.bgColor} px-2 py-1 rounded-full flex-row items-center`}>
            <Ionicons name={status.icon as any} size={12} color={status.textColor.replace('text-', '')} />
            <Text className={`${status.textColor} text-xs font-medium ml-1`}>
              {status.label}
            </Text>
          </View>
        </View>
        <Text className="text-white/80 text-sm mt-1">
          {formatDate(ticket.eventDate)}
          {ticket.eventEndDate && ` - ${formatDate(ticket.eventEndDate)}`}
        </Text>
      </View>

      {/* Ticket Body */}
      <View className="p-4">
        <View className="flex-row items-center">
          {/* Left Section - Ticket Info */}
          <View className="flex-1">
            <View className="flex-row items-center mb-2">
              <Ionicons name="ticket-outline" size={16} color="#6366F1" />
              <Text className="text-gray-900 font-semibold ml-2">
                {ticket.ticketTypeName}
              </Text>
            </View>

            <View className="flex-row items-center mb-2">
              <Ionicons name="location-outline" size={16} color="#6B7280" />
              <Text className="text-gray-600 text-sm ml-2" numberOfLines={1}>
                {ticket.eventLocation}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Ionicons name="person-outline" size={16} color="#6B7280" />
              <Text className="text-gray-600 text-sm ml-2">
                {ticket.holderName}
              </Text>
            </View>
          </View>

          {/* Right Section - Mini QR Preview */}
          <View className="ml-4">
            <View className="bg-gray-100 rounded-lg p-2 items-center justify-center w-16 h-16">
              <Ionicons name="qr-code" size={40} color="#374151" />
            </View>
            <Text className="text-gray-400 text-xs text-center mt-1">
              QR Code
            </Text>
          </View>
        </View>

        {/* Dashed Separator */}
        <View className="flex-row items-center my-3">
          <View className="flex-1 border-t border-dashed border-gray-200" />
        </View>

        {/* Ticket Footer */}
        <View className="flex-row justify-between items-center">
          <Text className="text-gray-400 text-xs">
            Code: {ticket.ticketCode}
          </Text>
          <View className="flex-row items-center">
            {ticket.transferable && ticket.status === 'VALID' && (
              <View className="flex-row items-center mr-3">
                <Ionicons name="swap-horizontal" size={14} color="#6366F1" />
                <Text className="text-primary text-xs ml-1">Transferable</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
        </View>
      </View>

      {/* Ticket Perforations */}
      <View className="absolute left-0 top-1/2 -translate-y-2 w-4 h-4 bg-gray-50 rounded-r-full" />
      <View className="absolute right-0 top-1/2 -translate-y-2 w-4 h-4 bg-gray-50 rounded-l-full" />
    </TouchableOpacity>
  );
}

export default TicketCard;
