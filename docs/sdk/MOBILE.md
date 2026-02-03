# Mobile SDK Integration Guide

This guide covers integrating the Festivals platform with mobile applications using React Native and Expo.

## Overview

The Festivals mobile SDK provides:

- Wallet management and payments
- Ticket display and validation
- NFC tag reading/writing
- Offline payment support
- Push notifications
- Deep linking

## Installation

### React Native / Expo

```bash
# Core SDK
npm install @festivals/mobile-sdk

# Required peer dependencies
npm install @react-native-async-storage/async-storage
npm install react-native-secure-storage
npm install expo-crypto

# Optional: NFC support
npm install react-native-nfc-manager

# Optional: Biometric auth
npm install expo-local-authentication

# Optional: Push notifications
npm install expo-notifications
```

### Expo Configuration

```json
// app.json
{
  "expo": {
    "plugins": [
      [
        "react-native-nfc-manager",
        {
          "nfcPermission": "Festival app needs NFC to read wristbands"
        }
      ],
      [
        "expo-local-authentication",
        {
          "faceIDPermission": "Allow $(PRODUCT_NAME) to use Face ID for secure payments"
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NFCReaderUsageDescription": "This app uses NFC to read festival wristbands",
        "NSFaceIDUsageDescription": "Use Face ID for secure payments"
      }
    }
  }
}
```

## Quick Start

### Initialize the SDK

```typescript
// lib/festivals.ts
import { FestivalsSDK } from '@festivals/mobile-sdk';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const festivalsSDK = new FestivalsSDK({
  baseUrl: process.env.EXPO_PUBLIC_API_URL!,
  storage: {
    secure: SecureStore,
    async: AsyncStorage,
  },
  auth: {
    getAccessToken: async () => {
      return await SecureStore.getItemAsync('access_token');
    },
  },
});

// Initialize on app start
await festivalsSDK.initialize();
```

### Provider Setup

```tsx
// App.tsx
import { FestivalsProvider } from '@festivals/mobile-sdk';
import { festivalsSDK } from './lib/festivals';

export default function App() {
  return (
    <FestivalsProvider sdk={festivalsSDK}>
      <Navigation />
    </FestivalsProvider>
  );
}
```

## Authentication

### Auth0 Integration

```typescript
// hooks/useAuth.ts
import { useAuth0 } from 'react-native-auth0';
import { festivalsSDK } from '../lib/festivals';

export function useAuth() {
  const { authorize, clearSession, user, getCredentials } = useAuth0();

  const login = async () => {
    try {
      await authorize({
        audience: 'https://api.festivals.app',
        scope: 'openid profile email offline_access',
      });

      const credentials = await getCredentials();
      if (credentials?.accessToken) {
        await festivalsSDK.setAccessToken(credentials.accessToken);
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = async () => {
    await clearSession();
    await festivalsSDK.clearAuth();
  };

  return { login, logout, user, isAuthenticated: !!user };
}
```

### Biometric Authentication

```typescript
import { useBiometricAuth } from '@festivals/mobile-sdk';

function PaymentScreen() {
  const { authenticate, isAvailable, biometryType } = useBiometricAuth();

  const handlePayment = async () => {
    if (isAvailable) {
      const authenticated = await authenticate({
        promptMessage: 'Confirm payment',
        fallbackLabel: 'Use passcode',
      });

      if (!authenticated) {
        return; // User cancelled or failed
      }
    }

    // Proceed with payment
    await processPayment();
  };

  return (
    <Button onPress={handlePayment}>
      Pay with {biometryType === 'facial' ? 'Face ID' : 'Touch ID'}
    </Button>
  );
}
```

## Wallet Management

### Wallet Hook

```typescript
import { useWallet } from '@festivals/mobile-sdk';

function WalletScreen() {
  const { wallet, loading, error, refetch, topup } = useWallet();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <Text style={styles.festivalName}>{wallet.festivalName}</Text>
      <Text style={styles.balance}>
        {formatCurrency(wallet.balance)}
      </Text>

      <TopUpButton onTopUp={topup} />
      <TransactionHistory walletId={wallet.id} />
    </View>
  );
}
```

### Top-Up Flow

```typescript
import { useTopUp } from '@festivals/mobile-sdk';
import { useStripe } from '@stripe/stripe-react-native';

function TopUpScreen() {
  const { walletId } = useRoute().params;
  const { createPaymentIntent, confirmTopUp } = useTopUp(walletId);
  const { presentPaymentSheet, initPaymentSheet } = useStripe();

  const handleTopUp = async (amount: number) => {
    // Create payment intent on backend
    const { clientSecret, paymentIntentId } = await createPaymentIntent(amount);

    // Initialize Stripe payment sheet
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: 'Festivals',
    });

    if (initError) {
      Alert.alert('Error', initError.message);
      return;
    }

    // Present payment sheet
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        return; // User cancelled
      }
      Alert.alert('Payment failed', presentError.message);
      return;
    }

    // Confirm top-up with backend
    await confirmTopUp(paymentIntentId);
    Alert.alert('Success', `Topped up ${formatCurrency(amount)}`);
  };

  return (
    <View>
      <AmountSelector onSelect={handleTopUp} />
    </View>
  );
}
```

### Transaction History

```typescript
import { useTransactions } from '@festivals/mobile-sdk';

function TransactionHistory({ walletId }: { walletId: string }) {
  const {
    transactions,
    loading,
    loadMore,
    hasMore,
    refresh,
    refreshing,
  } = useTransactions(walletId);

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TransactionRow transaction={item} />
      )}
      onEndReached={() => hasMore && loadMore()}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
      ListEmptyComponent={<EmptyState message="No transactions yet" />}
    />
  );
}
```

## Payments

### Payment Flow

```typescript
import { usePayment } from '@festivals/mobile-sdk';

function PaymentScreen({ standId, cart }: PaymentScreenProps) {
  const { processPayment, loading, error } = usePayment();

  const handlePayment = async () => {
    try {
      const result = await processPayment({
        standId,
        items: cart.items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });

      navigation.navigate('PaymentSuccess', { transaction: result });
    } catch (error) {
      if (error.code === 'INSUFFICIENT_BALANCE') {
        navigation.navigate('TopUp', {
          required: error.details.required,
          current: error.details.current,
        });
      } else {
        Alert.alert('Payment Failed', error.message);
      }
    }
  };

  return (
    <View>
      <CartSummary cart={cart} />
      <PaymentButton
        onPress={handlePayment}
        loading={loading}
        amount={cart.total}
      />
    </View>
  );
}
```

### Payment Success Animation

```typescript
import { usePaymentAnimation } from '@festivals/mobile-sdk';
import LottieView from 'lottie-react-native';

function PaymentSuccess({ transaction }: PaymentSuccessProps) {
  const { animationRef, playSuccess } = usePaymentAnimation();

  useEffect(() => {
    playSuccess();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <View style={styles.container}>
      <LottieView
        ref={animationRef}
        source={require('../assets/success.json')}
        style={styles.animation}
      />
      <Text style={styles.amount}>
        {formatCurrency(transaction.amount)}
      </Text>
      <Text style={styles.stand}>
        {transaction.standName}
      </Text>
    </View>
  );
}
```

## NFC Integration

### NFC Reading

```typescript
import { useNFC } from '@festivals/mobile-sdk';

function NFCPaymentScreen() {
  const { startReading, stopReading, isReading, lastTag, error } = useNFC();

  useEffect(() => {
    // Start reading when screen mounts
    startReading();

    return () => {
      stopReading();
    };
  }, []);

  useEffect(() => {
    if (lastTag) {
      // Process the NFC tag
      handleTagRead(lastTag);
    }
  }, [lastTag]);

  const handleTagRead = async (tag: NFCTag) => {
    try {
      // Get wallet associated with NFC tag
      const wallet = await festivalsSDK.nfc.getWallet(tag.id);

      // Navigate to payment confirmation
      navigation.navigate('ConfirmPayment', { wallet });
    } catch (error) {
      if (error.code === 'NFC_NOT_LINKED') {
        Alert.alert('Unknown Wristband', 'This wristband is not linked to a wallet');
      }
    }
  };

  return (
    <View style={styles.container}>
      <NFCAnimation isReading={isReading} />
      <Text style={styles.instruction}>
        {isReading ? 'Hold wristband near phone' : 'NFC not available'}
      </Text>
      {error && <Text style={styles.error}>{error.message}</Text>}
    </View>
  );
}
```

### NFC Linking

```typescript
import { useNFCLink } from '@festivals/mobile-sdk';

function LinkWristbandScreen({ walletId }: LinkWristbandScreenProps) {
  const { startLinking, isLinking, progress, error } = useNFCLink();

  const handleLink = async () => {
    try {
      const result = await startLinking({
        walletId,
        timeout: 30000, // 30 seconds
      });

      Alert.alert('Success', 'Wristband linked successfully');
      navigation.goBack();
    } catch (error) {
      if (error.code === 'NFC_TIMEOUT') {
        Alert.alert('Timeout', 'No wristband detected. Please try again.');
      } else if (error.code === 'NFC_ALREADY_LINKED') {
        Alert.alert('Already Linked', 'This wristband is already linked to another wallet.');
      }
    }
  };

  return (
    <View>
      <Text>Place wristband on your phone to link</Text>
      <Button onPress={handleLink} loading={isLinking}>
        Start Linking
      </Button>
      {progress && <ProgressBar progress={progress} />}
    </View>
  );
}
```

## Offline Support

### Enable Offline Mode

```typescript
import { useOfflineMode } from '@festivals/mobile-sdk';

function App() {
  const { isOnline, pendingCount, sync, isSyncing } = useOfflineMode();

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      sync();
    }
  }, [isOnline]);

  return (
    <View>
      {!isOnline && (
        <OfflineBanner pendingCount={pendingCount} />
      )}
      {isSyncing && (
        <SyncingIndicator />
      )}
      <Navigation />
    </View>
  );
}
```

### Offline Payments

```typescript
import { useOfflinePayment } from '@festivals/mobile-sdk';

function OfflinePaymentScreen() {
  const { processOfflinePayment, canProcessOffline } = useOfflinePayment();

  const handlePayment = async () => {
    if (!canProcessOffline) {
      Alert.alert(
        'Offline Not Available',
        'Please enable offline mode and download wallet data first.'
      );
      return;
    }

    try {
      const result = await processOfflinePayment({
        standId: currentStand.id,
        items: cart.items,
      });

      if (result.status === 'pending_sync') {
        Alert.alert(
          'Payment Queued',
          'Payment will be processed when you\'re back online.'
        );
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View>
      <OfflineIndicator />
      <PaymentButton onPress={handlePayment} />
    </View>
  );
}
```

### Sync Management

```typescript
import { useSyncStatus } from '@festivals/mobile-sdk';

function SyncStatusScreen() {
  const {
    pendingTransactions,
    failedTransactions,
    lastSyncTime,
    sync,
    isSyncing,
    retryFailed,
  } = useSyncStatus();

  return (
    <View>
      <Text>Last sync: {formatTime(lastSyncTime)}</Text>

      <Section title="Pending">
        {pendingTransactions.map((tx) => (
          <TransactionRow key={tx.id} transaction={tx} status="pending" />
        ))}
      </Section>

      <Section title="Failed">
        {failedTransactions.map((tx) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            status="failed"
            error={tx.error}
          />
        ))}
        {failedTransactions.length > 0 && (
          <Button onPress={retryFailed}>Retry Failed</Button>
        )}
      </Section>

      <Button onPress={sync} loading={isSyncing}>
        Sync Now
      </Button>
    </View>
  );
}
```

## Tickets

### Ticket Display

```typescript
import { useTickets } from '@festivals/mobile-sdk';

function TicketsScreen() {
  const { tickets, loading, error } = useTickets();

  return (
    <FlatList
      data={tickets}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TicketCard ticket={item} onPress={() => showTicket(item)} />
      )}
    />
  );
}

function TicketCard({ ticket, onPress }: TicketCardProps) {
  return (
    <TouchableOpacity onPress={onPress}>
      <View style={styles.card}>
        <Text style={styles.festivalName}>{ticket.festivalName}</Text>
        <Text style={styles.ticketType}>{ticket.typeName}</Text>
        <Text style={styles.date}>{formatDate(ticket.validDate)}</Text>
        <StatusBadge status={ticket.status} />
      </View>
    </TouchableOpacity>
  );
}
```

### Ticket QR Code

```typescript
import { useTicketQR } from '@festivals/mobile-sdk';
import QRCode from 'react-native-qrcode-svg';

function TicketQRScreen({ ticketId }: TicketQRScreenProps) {
  const { qrData, refresh, expiresAt, timeLeft } = useTicketQR(ticketId);

  // Auto-refresh QR code before expiration
  useEffect(() => {
    const timer = setInterval(() => {
      if (timeLeft < 30) {
        refresh();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  return (
    <View style={styles.container}>
      <QRCode
        value={qrData}
        size={250}
        backgroundColor="white"
        color="black"
      />
      <Text style={styles.timer}>
        Refreshes in {timeLeft}s
      </Text>
      <BrightnessMaximizer />
    </View>
  );
}
```

### Apple/Google Wallet

```typescript
import { useWalletPass } from '@festivals/mobile-sdk';

function TicketDetailScreen({ ticketId }: TicketDetailScreenProps) {
  const { addToWallet, isAdding, isSupported, passType } = useWalletPass(ticketId);

  return (
    <View>
      <TicketDetails ticketId={ticketId} />

      {isSupported && (
        <TouchableOpacity onPress={addToWallet} disabled={isAdding}>
          {passType === 'apple' ? (
            <Image source={require('../assets/add-to-apple-wallet.png')} />
          ) : (
            <Image source={require('../assets/add-to-google-wallet.png')} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
```

## Push Notifications

### Setup

```typescript
import { usePushNotifications } from '@festivals/mobile-sdk';

function NotificationSetup() {
  const {
    requestPermission,
    hasPermission,
    preferences,
    updatePreferences,
  } = usePushNotifications();

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, []);

  return (
    <View>
      <SwitchRow
        label="Payment Notifications"
        value={preferences.payments}
        onValueChange={(value) => updatePreferences({ payments: value })}
      />
      <SwitchRow
        label="Lineup Updates"
        value={preferences.lineup}
        onValueChange={(value) => updatePreferences({ lineup: value })}
      />
      <SwitchRow
        label="Low Balance Alerts"
        value={preferences.lowBalance}
        onValueChange={(value) => updatePreferences({ lowBalance: value })}
      />
    </View>
  );
}
```

### Handle Notifications

```typescript
import { useNotificationHandler } from '@festivals/mobile-sdk';

function App() {
  useNotificationHandler({
    onNotificationReceived: (notification) => {
      // Handle foreground notification
      showInAppNotification(notification);
    },
    onNotificationPressed: (notification) => {
      // Handle notification tap
      switch (notification.data.type) {
        case 'payment':
          navigation.navigate('TransactionDetail', {
            id: notification.data.transactionId,
          });
          break;
        case 'lineup':
          navigation.navigate('Lineup');
          break;
        case 'ticket':
          navigation.navigate('Tickets');
          break;
      }
    },
  });

  return <Navigation />;
}
```

## Deep Linking

### Configuration

```typescript
// lib/linking.ts
import { LinkingOptions } from '@react-navigation/native';
import { festivalsSDK } from './festivals';

export const linking: LinkingOptions = {
  prefixes: ['festivals://', 'https://app.festivals.app'],
  config: {
    screens: {
      Festival: 'festival/:id',
      Ticket: 'ticket/:id',
      Wallet: 'wallet/:id',
      Payment: 'pay/:standId',
      TopUp: 'topup',
    },
  },
  async getInitialURL() {
    // Handle initial deep link
    const url = await Linking.getInitialURL();
    return url;
  },
  subscribe(listener) {
    // Handle deep links while app is open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      listener(url);
    });

    return () => subscription.remove();
  },
};
```

### Handle Deep Links

```typescript
function PaymentDeepLinkScreen() {
  const { standId } = useRoute().params;
  const { stand, loading, error } = useStand(standId);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} />;

  return <PaymentScreen stand={stand} />;
}
```

## Error Handling

### Global Error Handler

```typescript
import { setGlobalErrorHandler } from '@festivals/mobile-sdk';

setGlobalErrorHandler((error) => {
  // Log to crash reporting
  Sentry.captureException(error);

  // Show user-friendly message
  if (error.isNetworkError) {
    showToast('Network error. Please check your connection.');
  } else if (error.code === 'SESSION_EXPIRED') {
    // Redirect to login
    navigation.reset({
      routes: [{ name: 'Login' }],
    });
  } else {
    showToast(error.userMessage || 'An error occurred');
  }
});
```

### Error Boundaries

```typescript
import { FestivalsErrorBoundary } from '@festivals/mobile-sdk';

function App() {
  return (
    <FestivalsErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorScreen
          error={error}
          onRetry={resetError}
        />
      )}
      onError={(error) => {
        Sentry.captureException(error);
      }}
    >
      <Navigation />
    </FestivalsErrorBoundary>
  );
}
```

## Performance

### Optimize List Rendering

```typescript
import { useTransactionList } from '@festivals/mobile-sdk';

function TransactionList() {
  const {
    transactions,
    loadMore,
    hasMore,
    loading,
  } = useTransactionList({
    pageSize: 20,
    prefetch: true,
  });

  const renderItem = useCallback(({ item }) => (
    <TransactionRow transaction={item} />
  ), []);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <FlashList
      data={transactions}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={72}
      onEndReached={() => hasMore && loadMore()}
      onEndReachedThreshold={0.5}
    />
  );
}
```

### Image Caching

```typescript
import { useCachedImage } from '@festivals/mobile-sdk';
import FastImage from 'react-native-fast-image';

function FestivalImage({ uri }: { uri: string }) {
  const { cachedUri, isLoading } = useCachedImage(uri);

  return (
    <FastImage
      source={{ uri: cachedUri }}
      style={styles.image}
      resizeMode={FastImage.resizeMode.cover}
    />
  );
}
```

## Testing

### Mock SDK

```typescript
import { createMockSDK } from '@festivals/mobile-sdk/testing';

describe('PaymentScreen', () => {
  const mockSDK = createMockSDK();

  beforeEach(() => {
    mockSDK.reset();
  });

  it('should process payment successfully', async () => {
    mockSDK.payments.processPayment.mockResolvedValue({
      id: 'tx-123',
      status: 'completed',
    });

    const { getByText, findByText } = render(
      <FestivalsProvider sdk={mockSDK}>
        <PaymentScreen standId="stand-123" cart={mockCart} />
      </FestivalsProvider>
    );

    fireEvent.press(getByText('Pay'));

    await findByText('Payment Successful');
    expect(mockSDK.payments.processPayment).toHaveBeenCalled();
  });
});
```

## Related Documentation

- [JavaScript SDK](./JAVASCRIPT.md)
- [API Authentication](../api/authentication.md)
- [Offline Support](../api/VERSIONING.md)
- [Push Notifications](../operations/ALERTING.md)
