/**
 * OfflineReceipt component
 * Displays receipt for offline transactions with pending sync status
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OfflineTransaction, OfflineTransactionItem } from '@/lib/offline';

interface OfflineReceiptProps {
  visible: boolean;
  transaction: OfflineTransaction | null;
  currencyName: string;
  onDismiss: () => void;
  onNewSale: () => void;
}

export default function OfflineReceipt({
  visible,
  transaction,
  currencyName,
  onDismiss,
  onNewSale,
}: OfflineReceiptProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Entry animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse animation for pending indicator
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleShare = async () => {
    if (!transaction) return;

    const receiptText = generateReceiptText(transaction, currencyName);

    try {
      await Share.share({
        message: receiptText,
        title: `Recu ${transaction.receiptId}`,
      });
    } catch (error) {
      console.error('Error sharing receipt:', error);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (!transaction) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        <Animated.View
          className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }}
        >
          {/* Header */}
          <View className="bg-success pt-6 pb-8 px-6 items-center">
            <View className="w-16 h-16 bg-white rounded-full items-center justify-center mb-3">
              <Ionicons name="checkmark" size={40} color="#10B981" />
            </View>
            <Text className="text-white text-xl font-bold">Paiement Accepte</Text>
            <Text className="text-white/80 text-sm mt-1">Mode Hors Ligne</Text>

            {/* Pending Sync Indicator */}
            <Animated.View
              className="mt-3 bg-white/20 px-4 py-2 rounded-full flex-row items-center"
              style={{ transform: [{ scale: pulseAnim }] }}
            >
              <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
              <Text className="text-white text-sm font-medium ml-2">
                En attente de synchronisation
              </Text>
            </Animated.View>
          </View>

          {/* Receipt Content */}
          <View className="p-6">
            {/* Receipt ID */}
            <View className="items-center mb-4">
              <Text className="text-gray-500 text-sm">Recu N</Text>
              <Text className="text-lg font-bold font-mono">{transaction.receiptId}</Text>
            </View>

            {/* Divider */}
            <View className="border-b border-dashed border-gray-300 my-4" />

            {/* Amount */}
            <View className="items-center mb-4">
              <Text className="text-gray-500 text-sm">Montant</Text>
              <Text className="text-3xl font-bold text-gray-900">
                {transaction.amount} {currencyName}
              </Text>
            </View>

            {/* Customer Info */}
            <View className="bg-gray-50 rounded-xl p-4 mb-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-500">Client</Text>
                <Text className="font-medium">
                  {transaction.customerName || `#${transaction.walletId.slice(-6)}`}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Nouveau solde</Text>
                <Text className="font-medium">
                  {transaction.balanceAfter} {currencyName}
                </Text>
              </View>
            </View>

            {/* Items */}
            {transaction.items.length > 0 && (
              <View className="mb-4">
                <Text className="text-gray-500 text-sm mb-2">Articles</Text>
                {transaction.items.map((item, index) => (
                  <View
                    key={index}
                    className="flex-row justify-between py-2 border-b border-gray-100"
                  >
                    <View className="flex-row items-center">
                      <Text className="text-gray-600 w-6">{item.quantity}x</Text>
                      <Text className="font-medium">{item.productName}</Text>
                    </View>
                    <Text className="font-medium">
                      {item.totalPrice} {currencyName}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Transaction Details */}
            <View className="bg-gray-50 rounded-xl p-4 mb-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-500 text-sm">Stand</Text>
                <Text className="text-sm font-medium">{transaction.standName}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-500 text-sm">Date</Text>
                <Text className="text-sm font-medium">{formatDate(transaction.createdAt)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">Heure</Text>
                <Text className="text-sm font-medium">{formatTime(transaction.createdAt)}</Text>
              </View>
            </View>

            {/* Offline Notice */}
            <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <View className="flex-row items-start">
                <Ionicons name="information-circle" size={20} color="#F59E0B" />
                <View className="flex-1 ml-2">
                  <Text className="text-amber-800 font-medium text-sm">
                    Transaction hors ligne
                  </Text>
                  <Text className="text-amber-700 text-xs mt-1">
                    Cette transaction sera synchronisee automatiquement lorsque la connexion sera retablie.
                  </Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View className="border-b border-dashed border-gray-300 my-4" />

            {/* Verification Code */}
            <View className="items-center mb-4">
              <Text className="text-gray-500 text-xs">Code de verification</Text>
              <Text className="font-mono text-sm text-gray-700">
                {transaction.signature.substring(0, 16).toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View className="p-4 border-t border-gray-100">
            <TouchableOpacity
              onPress={onNewSale}
              className="bg-success py-4 rounded-xl mb-3"
            >
              <Text className="text-white font-semibold text-center text-lg">
                Nouvelle vente
              </Text>
            </TouchableOpacity>

            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={handleShare}
                className="flex-1 bg-gray-100 py-3 rounded-xl flex-row items-center justify-center"
              >
                <Ionicons name="share-outline" size={20} color="#374151" />
                <Text className="text-gray-700 font-medium ml-2">Partager</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onDismiss}
                className="flex-1 bg-gray-100 py-3 rounded-xl"
              >
                <Text className="text-gray-700 font-medium text-center">Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Generates plain text receipt for sharing
 */
function generateReceiptText(
  transaction: OfflineTransaction,
  currencyName: string
): string {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  let text = `
=============================
       RECU DE PAIEMENT
=============================

Recu N: ${transaction.receiptId}
Date: ${formatDate(transaction.createdAt)}
Heure: ${formatTime(transaction.createdAt)}

-----------------------------
`;

  if (transaction.items.length > 0) {
    transaction.items.forEach((item) => {
      text += `${item.quantity}x ${item.productName}`.padEnd(20);
      text += `${item.totalPrice} ${currencyName}\n`;
    });
    text += '-----------------------------\n';
  }

  text += `
TOTAL: ${transaction.amount} ${currencyName}

Client: ${transaction.customerName || `#${transaction.walletId.slice(-6)}`}
Nouveau solde: ${transaction.balanceAfter} ${currencyName}

Stand: ${transaction.standName}

-----------------------------
[TRANSACTION HORS LIGNE]
Sera synchronisee automatiquement

Code: ${transaction.signature.substring(0, 16).toUpperCase()}
=============================
`;

  return text;
}

/**
 * Compact receipt indicator for status bar
 */
export function OfflineReceiptBadge({
  pendingCount,
  onPress,
}: {
  pendingCount: number;
  onPress: () => void;
}) {
  if (pendingCount === 0) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-amber-100 px-3 py-2 rounded-full flex-row items-center"
    >
      <Ionicons name="cloud-upload-outline" size={16} color="#F59E0B" />
      <Text className="text-amber-700 font-medium text-sm ml-1">
        {pendingCount} en attente
      </Text>
    </TouchableOpacity>
  );
}
