import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStaffStore } from '@/stores/staffStore';
import { useWalletStore } from '@/stores/walletStore';
import { useNetworkStore } from '@/stores/networkStore';
import { useOfflineTransactionStore, usePendingTransactionCount } from '@/stores/offlineTransactionStore';
import Numpad from '@/components/staff/Numpad';
import { ProductGrid } from '@/components/staff/ProductButton';
import { OfflineReceiptBadge } from '@/components/staff/OfflineReceipt';

type InputMode = 'numpad' | 'products';

export default function PaymentScreen() {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<InputMode>('products');
  const [manualAmount, setManualAmount] = useState('');

  const {
    products,
    cart,
    cartTotal,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    setCartAmount,
    clearCart,
  } = useStaffStore();

  const { currencyName } = useWalletStore();
  const { isOnline } = useNetworkStore();
  const pendingCount = usePendingTransactionCount();
  const { loadPendingTransactions } = useOfflineTransactionStore();

  // Load pending transactions on mount
  useEffect(() => {
    loadPendingTransactions();
  }, []);

  const handleViewPendingTransactions = () => {
    router.push('/(staff)/transactions');
  };

  const totalAmount = inputMode === 'numpad' ? parseFloat(manualAmount) || 0 : cartTotal;
  const hasItems = inputMode === 'products' ? cart.length > 0 : totalAmount > 0;

  const handleProductPress = (product: typeof products[0]) => {
    addToCart(product);
  };

  const handleProductLongPress = (product: typeof products[0]) => {
    const cartItem = cart.find((item) => item.product.id === product.id);
    if (cartItem) {
      Alert.alert(
        product.name,
        `Quantite: ${cartItem.quantity}`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: () => removeFromCart(product.id),
          },
          {
            text: '-1',
            onPress: () => updateCartItemQuantity(product.id, cartItem.quantity - 1),
          },
        ]
      );
    }
  };

  const handleScanToPay = () => {
    if (!hasItems) {
      Alert.alert('Panier vide', 'Ajoutez des produits ou entrez un montant');
      return;
    }

    if (inputMode === 'numpad') {
      setCartAmount(totalAmount);
    }

    router.push('/(staff)/payment/scan');
  };

  const handleClearCart = () => {
    clearCart();
    setManualAmount('');
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Offline Mode Banner */}
      {!isOnline && (
        <View className="bg-amber-500 px-4 py-3 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Ionicons name="cloud-offline-outline" size={20} color="#FFFFFF" />
            <View className="ml-3 flex-1">
              <Text className="text-white font-semibold">Mode hors ligne</Text>
              <Text className="text-white/80 text-sm">
                Les paiements seront synchronises automatiquement
              </Text>
            </View>
          </View>
          {pendingCount > 0 && (
            <TouchableOpacity
              onPress={handleViewPendingTransactions}
              className="bg-white/20 px-3 py-1.5 rounded-full"
            >
              <Text className="text-white font-medium text-sm">
                {pendingCount} en attente
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Online Pending Indicator */}
      {isOnline && pendingCount > 0 && (
        <View className="bg-blue-50 px-4 py-2 flex-row items-center justify-between border-b border-blue-100">
          <View className="flex-row items-center">
            <Ionicons name="sync-outline" size={18} color="#3B82F6" />
            <Text className="text-blue-700 ml-2 text-sm">
              Synchronisation de {pendingCount} transaction{pendingCount > 1 ? 's' : ''}...
            </Text>
          </View>
          <TouchableOpacity onPress={handleViewPendingTransactions}>
            <Text className="text-blue-600 font-medium text-sm">Voir</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mode Toggle */}
      <View className="bg-white border-b border-gray-200 p-2">
        <View className="flex-row bg-gray-100 rounded-lg p-1">
          <TouchableOpacity
            onPress={() => setInputMode('products')}
            className={`flex-1 py-2 rounded-md ${
              inputMode === 'products' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text
              className={`text-center font-medium ${
                inputMode === 'products' ? 'text-primary' : 'text-gray-500'
              }`}
            >
              Produits
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setInputMode('numpad')}
            className={`flex-1 py-2 rounded-md ${
              inputMode === 'numpad' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text
              className={`text-center font-medium ${
                inputMode === 'numpad' ? 'text-primary' : 'text-gray-500'
              }`}
            >
              Montant libre
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {inputMode === 'products' ? (
          <>
            {/* Product Grid */}
            <View className="bg-white rounded-2xl p-4 mb-4">
              <Text className="text-lg font-semibold mb-3">Produits</Text>
              <ProductGrid
                products={products}
                cart={cart}
                onProductPress={handleProductPress}
                onProductLongPress={handleProductLongPress}
                currencySymbol={currencyName}
              />
            </View>

            {/* Cart Summary */}
            {cart.length > 0 && (
              <View className="bg-white rounded-2xl p-4 mb-4">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-lg font-semibold">Panier</Text>
                  <TouchableOpacity onPress={handleClearCart}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                <View className="space-y-2">
                  {cart.map((item) => (
                    <View
                      key={item.product.id}
                      className="flex-row justify-between items-center py-2 border-b border-gray-100"
                    >
                      <View className="flex-row items-center">
                        <Text className="text-gray-600">{item.quantity}x</Text>
                        <Text className="font-medium ml-2">{item.product.name}</Text>
                      </View>
                      <Text className="font-semibold">
                        {item.product.price * item.quantity} {currencyName}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          /* Numpad */
          <Numpad
            value={manualAmount}
            onChange={setManualAmount}
            currencySymbol={currencyName}
          />
        )}
      </ScrollView>

      {/* Bottom Total & Scan Button */}
      <View className="bg-white border-t border-gray-200 p-4 pb-8">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-gray-600 text-lg">Total</Text>
          <Text className="text-3xl font-bold">
            {totalAmount} {currencyName}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleScanToPay}
          disabled={!hasItems}
          className={`flex-row items-center justify-center py-4 rounded-xl ${
            hasItems ? 'bg-success' : 'bg-gray-300'
          }`}
        >
          <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
          <Text className="text-white font-semibold text-lg ml-2">Scanner pour payer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
