import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction, TransactionType } from '@/stores/walletStore';

interface TransactionItemProps {
  transaction: Transaction;
  currencyName: string;
  onPress?: (transaction: Transaction) => void;
  showBorder?: boolean;
}

// Transaction type configuration
const transactionConfig: Record<TransactionType, {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  bgColor: string;
  iconColor: string;
}> = {
  TOP_UP: {
    icon: 'arrow-down',
    label: 'Recharge',
    bgColor: 'bg-green-100',
    iconColor: '#10B981',
  },
  PURCHASE: {
    icon: 'cart-outline',
    label: 'Achat',
    bgColor: 'bg-gray-100',
    iconColor: '#6B7280',
  },
  REFUND: {
    icon: 'refresh-outline',
    label: 'Remboursement',
    bgColor: 'bg-blue-100',
    iconColor: '#3B82F6',
  },
  RECHARGE: {
    icon: 'arrow-down',
    label: 'Recharge',
    bgColor: 'bg-green-100',
    iconColor: '#10B981',
  },
  PAYMENT: {
    icon: 'arrow-up',
    label: 'Paiement',
    bgColor: 'bg-gray-100',
    iconColor: '#6B7280',
  },
  CANCEL: {
    icon: 'close-circle-outline',
    label: 'Annulation',
    bgColor: 'bg-orange-100',
    iconColor: '#F59E0B',
  },
};

// Format date for display
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "A l'instant";
  }
  if (diffMins < 60) {
    return `Il y a ${diffMins} min`;
  }
  if (diffHours < 24) {
    return `Il y a ${diffHours}h`;
  }
  if (diffDays === 1) {
    return `Hier, ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format amount with sign
const formatAmount = (amount: number, currencyName: string): string => {
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount} ${currencyName}`;
};

export default function TransactionItem({
  transaction,
  currencyName,
  onPress,
  showBorder = true,
}: TransactionItemProps) {
  const config = transactionConfig[transaction.type] || transactionConfig.PURCHASE;
  const isCredit = transaction.amount > 0;

  const content = (
    <View
      className={`flex-row items-center py-3 ${
        showBorder ? 'border-b border-gray-100' : ''
      }`}
    >
      {/* Icon */}
      <View
        className={`w-10 h-10 rounded-full items-center justify-center ${config.bgColor}`}
      >
        <Ionicons name={config.icon} size={20} color={config.iconColor} />
      </View>

      {/* Details */}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <Text className="font-medium text-gray-900">
            {transaction.reference || config.label}
          </Text>
          {!transaction.synced && (
            <View className="ml-2 px-1.5 py-0.5 bg-yellow-100 rounded">
              <Text className="text-yellow-700 text-xs">En attente</Text>
            </View>
          )}
        </View>
        <Text className="text-gray-500 text-sm mt-0.5">
          {formatDate(transaction.createdAt)}
        </Text>
        {transaction.description && (
          <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
            {transaction.description}
          </Text>
        )}
      </View>

      {/* Amount */}
      <View className="items-end">
        <Text
          className={`font-semibold ${
            isCredit ? 'text-green-600' : 'text-gray-900'
          }`}
        >
          {formatAmount(transaction.amount, currencyName)}
        </Text>
        <Text className="text-gray-400 text-xs">
          Solde: {transaction.balanceAfter} {currencyName}
        </Text>
      </View>

      {/* Chevron if clickable */}
      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color="#9CA3AF"
          style={{ marginLeft: 8 }}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={() => onPress(transaction)} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// Compact version for small lists
export function TransactionItemCompact({
  transaction,
  currencyName,
  onPress,
}: Omit<TransactionItemProps, 'showBorder'>) {
  const config = transactionConfig[transaction.type] || transactionConfig.PURCHASE;
  const isCredit = transaction.amount > 0;

  const content = (
    <View className="flex-row items-center justify-between py-2">
      <View className="flex-row items-center flex-1">
        <View
          className={`w-8 h-8 rounded-full items-center justify-center ${config.bgColor}`}
        >
          <Ionicons name={config.icon} size={16} color={config.iconColor} />
        </View>
        <Text className="ml-2 text-gray-700" numberOfLines={1}>
          {transaction.reference || config.label}
        </Text>
      </View>
      <Text
        className={`font-medium ${isCredit ? 'text-green-600' : 'text-gray-900'}`}
      >
        {formatAmount(transaction.amount, currencyName)}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={() => onPress(transaction)} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
