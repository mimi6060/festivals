import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ErrorType = 'network' | 'server' | 'notFound' | 'unauthorized' | 'generic';

export interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  showIcon?: boolean;
}

interface ErrorConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  title: string;
  message: string;
}

const errorConfigs: Record<ErrorType, ErrorConfig> = {
  network: {
    icon: 'cloud-offline-outline',
    iconColor: '#F59E0B',
    bgColor: 'bg-yellow-50',
    title: 'Pas de connexion',
    message: 'Verifiez votre connexion internet et reessayez.',
  },
  server: {
    icon: 'server-outline',
    iconColor: '#EF4444',
    bgColor: 'bg-red-50',
    title: 'Erreur serveur',
    message: 'Une erreur est survenue sur nos serveurs. Veuillez reessayer plus tard.',
  },
  notFound: {
    icon: 'search-outline',
    iconColor: '#6366F1',
    bgColor: 'bg-primary-50',
    title: 'Non trouve',
    message: "L'element que vous recherchez n'existe pas ou a ete supprime.",
  },
  unauthorized: {
    icon: 'lock-closed-outline',
    iconColor: '#EF4444',
    bgColor: 'bg-red-50',
    title: 'Acces refuse',
    message: "Vous n'avez pas les droits necessaires pour acceder a cette ressource.",
  },
  generic: {
    icon: 'alert-circle-outline',
    iconColor: '#EF4444',
    bgColor: 'bg-red-50',
    title: 'Une erreur est survenue',
    message: "Quelque chose s'est mal passe. Veuillez reessayer.",
  },
};

/**
 * Error state component with retry functionality
 * Supports different error types: network, server, notFound, unauthorized, generic
 */
export function ErrorState({
  type = 'generic',
  title,
  message,
  onRetry,
  retryLabel = 'Reessayer',
  showIcon = true,
}: ErrorStateProps) {
  const config = errorConfigs[type];
  const displayTitle = title || config.title;
  const displayMessage = message || config.message;

  return (
    <View className="flex-1 items-center justify-center py-16 px-8">
      {/* Icon */}
      {showIcon && (
        <View className={`${config.bgColor} rounded-full p-6 mb-6`}>
          <Ionicons name={config.icon} size={48} color={config.iconColor} />
        </View>
      )}

      {/* Title */}
      <Text className="text-gray-900 text-xl font-semibold text-center mb-2">
        {displayTitle}
      </Text>

      {/* Message */}
      <Text className="text-gray-500 text-center text-base leading-6 mb-6">
        {displayMessage}
      </Text>

      {/* Retry Button */}
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.7}
          className="bg-primary rounded-xl px-6 py-3 flex-row items-center"
        >
          <Ionicons name="refresh-outline" size={20} color="white" />
          <Text className="text-white font-semibold text-base ml-2">
            {retryLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Inline error banner for showing errors within content
 */
export interface ErrorBannerProps {
  message: string;
  type?: 'error' | 'warning';
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function ErrorBanner({
  message,
  type = 'error',
  onDismiss,
  onRetry,
}: ErrorBannerProps) {
  const isError = type === 'error';
  const bgColor = isError ? 'bg-red-50' : 'bg-yellow-50';
  const iconColor = isError ? '#EF4444' : '#F59E0B';
  const textColor = isError ? 'text-red-700' : 'text-yellow-700';
  const icon = isError ? 'alert-circle' : 'warning';

  return (
    <View className={`${bgColor} rounded-xl p-4 mx-4 my-2`}>
      <View className="flex-row items-start">
        <Ionicons name={icon} size={20} color={iconColor} />
        <Text className={`${textColor} ml-3 flex-1 text-sm`}>{message}</Text>

        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} className="ml-2">
            <Ionicons name="close" size={20} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>

      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          className="mt-3 flex-row items-center justify-center"
        >
          <Ionicons name="refresh-outline" size={16} color={iconColor} />
          <Text className={`${textColor} font-medium ml-1`}>Reessayer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default ErrorState;
