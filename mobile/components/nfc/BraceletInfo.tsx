import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BraceletData {
  uid: string;
  status: 'ACTIVE' | 'UNASSIGNED' | 'BLOCKED' | 'LOST';
  walletId?: string;
  walletBalance: number;
  holderName?: string;
  holderEmail?: string;
  ticketType?: string;
  activatedAt?: string;
  lastUsedAt?: string;
  transactionCount: number;
  totalSpent: number;
}

interface BraceletInfoProps {
  data: BraceletData;
  onBlock?: () => void;
  onReportLost?: () => void;
  onTransfer?: () => void;
  onDeactivate?: () => void;
}

const statusConfig = {
  ACTIVE: {
    label: 'Actif',
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: 'checkmark-circle' as const,
    iconColor: '#16A34A',
  },
  UNASSIGNED: {
    label: 'Non assigne',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    icon: 'remove-circle' as const,
    iconColor: '#6B7280',
  },
  BLOCKED: {
    label: 'Bloque',
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: 'ban' as const,
    iconColor: '#DC2626',
  },
  LOST: {
    label: 'Perdu',
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    icon: 'warning' as const,
    iconColor: '#EA580C',
  },
};

export default function BraceletInfo({
  data,
  onBlock,
  onReportLost,
  onTransfer,
  onDeactivate,
}: BraceletInfoProps) {
  const status = statusConfig[data.status];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleBlock = () => {
    Alert.alert(
      'Bloquer le bracelet',
      'Etes-vous sur de vouloir bloquer ce bracelet ? Cette action peut etre annulee par un administrateur.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Bloquer', style: 'destructive', onPress: onBlock },
      ]
    );
  };

  const handleReportLost = () => {
    Alert.alert(
      'Signaler comme perdu',
      'Signaler ce bracelet comme perdu ? Le solde pourra etre transfere vers un nouveau bracelet.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Signaler', onPress: onReportLost },
      ]
    );
  };

  return (
    <View className="p-4">
      {/* Status Banner */}
      <View className={`${status.bg} rounded-xl p-4 flex-row items-center`}>
        <Ionicons name={status.icon} size={24} color={status.iconColor} />
        <Text className={`ml-2 font-semibold ${status.text}`}>{status.label}</Text>
      </View>

      {/* UID */}
      <View className="bg-white rounded-xl p-4 mt-4 border border-gray-100">
        <Text className="text-gray-500 text-sm">UID du bracelet</Text>
        <Text className="font-mono text-gray-900 mt-1">{data.uid}</Text>
      </View>

      {/* Balance */}
      {data.walletId && (
        <View className="bg-white rounded-xl p-4 mt-4 border border-gray-100">
          <Text className="text-gray-500 text-sm">Solde du wallet</Text>
          <Text className="text-3xl font-bold text-gray-900 mt-1">
            {formatCurrency(data.walletBalance)}
          </Text>
        </View>
      )}

      {/* Holder Info */}
      {(data.holderName || data.holderEmail) && (
        <View className="bg-white rounded-xl p-4 mt-4 border border-gray-100">
          <Text className="text-gray-500 text-sm mb-2">Festivalier</Text>
          {data.holderName && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="person" size={18} color="#6B7280" />
              <Text className="ml-2 text-gray-900">{data.holderName}</Text>
            </View>
          )}
          {data.holderEmail && (
            <View className="flex-row items-center">
              <Ionicons name="mail" size={18} color="#6B7280" />
              <Text className="ml-2 text-gray-600">{data.holderEmail}</Text>
            </View>
          )}
        </View>
      )}

      {/* Ticket Type */}
      {data.ticketType && (
        <View className="bg-white rounded-xl p-4 mt-4 border border-gray-100">
          <Text className="text-gray-500 text-sm">Type de billet</Text>
          <View className="flex-row items-center mt-1">
            <Ionicons name="ticket" size={18} color="#6366F1" />
            <Text className="ml-2 text-gray-900 font-medium">{data.ticketType}</Text>
          </View>
        </View>
      )}

      {/* Stats */}
      <View className="flex-row mt-4 -mx-2">
        <View className="flex-1 px-2">
          <View className="bg-white rounded-xl p-4 border border-gray-100 items-center">
            <Text className="text-gray-500 text-sm">Transactions</Text>
            <Text className="text-2xl font-bold text-gray-900 mt-1">{data.transactionCount}</Text>
          </View>
        </View>
        <View className="flex-1 px-2">
          <View className="bg-white rounded-xl p-4 border border-gray-100 items-center">
            <Text className="text-gray-500 text-sm">Total depense</Text>
            <Text className="text-xl font-bold text-gray-900 mt-1">
              {formatCurrency(data.totalSpent)}
            </Text>
          </View>
        </View>
      </View>

      {/* Dates */}
      <View className="bg-white rounded-xl p-4 mt-4 border border-gray-100">
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-500">Active le</Text>
          <Text className="text-gray-900">{formatDate(data.activatedAt)}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-500">Derniere utilisation</Text>
          <Text className="text-gray-900">{formatDate(data.lastUsedAt)}</Text>
        </View>
      </View>

      {/* Actions */}
      {data.status === 'ACTIVE' && (
        <View className="mt-6 space-y-3">
          {onTransfer && (
            <TouchableOpacity
              onPress={onTransfer}
              className="bg-blue-50 rounded-xl p-4 flex-row items-center"
            >
              <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
                <Ionicons name="swap-horizontal" size={20} color="#3B82F6" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-blue-700 font-medium">Transferer le solde</Text>
                <Text className="text-blue-500 text-sm">Vers un autre bracelet</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
            </TouchableOpacity>
          )}

          {onReportLost && (
            <TouchableOpacity
              onPress={handleReportLost}
              className="bg-orange-50 rounded-xl p-4 flex-row items-center"
            >
              <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center">
                <Ionicons name="warning" size={20} color="#EA580C" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-orange-700 font-medium">Signaler comme perdu</Text>
                <Text className="text-orange-500 text-sm">Bloquer et preparer le transfert</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#EA580C" />
            </TouchableOpacity>
          )}

          {onBlock && (
            <TouchableOpacity
              onPress={handleBlock}
              className="bg-red-50 rounded-xl p-4 flex-row items-center"
            >
              <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
                <Ionicons name="ban" size={20} color="#DC2626" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-red-700 font-medium">Bloquer le bracelet</Text>
                <Text className="text-red-500 text-sm">Desactiver immediatement</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#DC2626" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {data.status === 'BLOCKED' && (
        <View className="mt-6 bg-red-50 rounded-xl p-4">
          <View className="flex-row items-center">
            <Ionicons name="information-circle" size={20} color="#DC2626" />
            <Text className="ml-2 text-red-700 font-medium">Bracelet bloque</Text>
          </View>
          <Text className="text-red-600 text-sm mt-2">
            Ce bracelet est bloque et ne peut plus etre utilise. Contactez un administrateur pour le debloquer.
          </Text>
        </View>
      )}

      {data.status === 'LOST' && (
        <View className="mt-6 bg-orange-50 rounded-xl p-4">
          <View className="flex-row items-center">
            <Ionicons name="information-circle" size={20} color="#EA580C" />
            <Text className="ml-2 text-orange-700 font-medium">Bracelet perdu</Text>
          </View>
          <Text className="text-orange-600 text-sm mt-2">
            Ce bracelet a ete signale comme perdu. Le solde peut etre transfere vers un nouveau bracelet.
          </Text>
        </View>
      )}
    </View>
  );
}
