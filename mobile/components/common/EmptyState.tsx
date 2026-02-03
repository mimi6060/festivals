import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  iconColor?: string;
  iconSize?: number;
}

/**
 * Reusable empty state component for lists and screens
 * Shows an icon, title, description, and optional action button
 */
export function EmptyState({
  icon = 'folder-open-outline',
  title,
  description,
  actionLabel,
  onAction,
  iconColor = '#9CA3AF',
  iconSize = 64,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-8">
      {/* Icon Container */}
      <View className="bg-gray-100 rounded-full p-6 mb-6">
        <Ionicons name={icon} size={iconSize} color={iconColor} />
      </View>

      {/* Title */}
      <Text className="text-gray-900 text-xl font-semibold text-center mb-2">
        {title}
      </Text>

      {/* Description */}
      {description && (
        <Text className="text-gray-500 text-center text-base leading-6 mb-6">
          {description}
        </Text>
      )}

      {/* Action Button */}
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.7}
          className="bg-primary rounded-xl px-6 py-3 mt-2"
        >
          <Text className="text-white font-semibold text-base">
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Pre-configured empty states for common use cases
export const EmptyStatePresets = {
  noTickets: {
    icon: 'ticket-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Aucun billet',
    description: "Vous n'avez pas encore de billets. Achetez vos billets sur notre site web.",
  },
  noTransactions: {
    icon: 'receipt-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Aucune transaction',
    description: 'Vos transactions apparaitront ici apres votre premier achat.',
  },
  noResults: {
    icon: 'search-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Aucun resultat',
    description: 'Essayez de modifier vos criteres de recherche.',
  },
  noFavorites: {
    icon: 'heart-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Aucun favori',
    description: 'Appuyez sur le coeur pour ajouter des elements a vos favoris.',
  },
  noNotifications: {
    icon: 'notifications-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Aucune notification',
    description: 'Vous recevrez ici les notifications importantes du festival.',
  },
  noOrders: {
    icon: 'bag-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Aucune commande',
    description: 'Vos commandes apparaitront ici apres votre premier achat.',
  },
  noFriends: {
    icon: 'people-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Aucun ami',
    description: 'Ajoutez des amis pour partager vos moments de festival.',
  },
  noPhotos: {
    icon: 'images-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Aucune photo',
    description: 'Capturez vos souvenirs du festival et partagez-les ici.',
  },
  offline: {
    icon: 'cloud-offline-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Hors ligne',
    description: 'Connectez-vous a internet pour voir ce contenu.',
  },
};

export default EmptyState;
