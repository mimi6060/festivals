# JavaScript/TypeScript SDK

This guide covers using the Festivals API from JavaScript and TypeScript applications.

## Installation

### NPM Package

```bash
npm install @festivals/sdk
# or
yarn add @festivals/sdk
# or
pnpm add @festivals/sdk
```

### CDN (Browser)

```html
<script src="https://cdn.festivals.app/sdk/v1/festivals.min.js"></script>
```

## Quick Start

### Initialize the Client

```typescript
import { FestivalsClient } from '@festivals/sdk';

const client = new FestivalsClient({
  baseUrl: 'https://api.festivals.app',
  apiKey: 'your-api-key',
  // Optional: for user-authenticated requests
  getAccessToken: async () => {
    return await auth.getAccessToken();
  },
});
```

### Basic Usage

```typescript
// Get all festivals
const festivals = await client.festivals.list();

// Get a specific festival
const festival = await client.festivals.get('fest-123');

// Get wallet balance
const wallet = await client.wallets.get('wallet-123');

// Process a payment
const transaction = await client.payments.create({
  walletId: 'wallet-123',
  standId: 'stand-456',
  amount: 1500,
  items: [
    { productId: 'prod-789', quantity: 2 },
  ],
});
```

## Authentication

### API Key Authentication

For server-to-server communication:

```typescript
const client = new FestivalsClient({
  baseUrl: 'https://api.festivals.app',
  apiKey: process.env.FESTIVALS_API_KEY,
});
```

### User Token Authentication

For user-authenticated requests:

```typescript
import { FestivalsClient } from '@festivals/sdk';
import { useAuth0 } from '@auth0/auth0-react';

function useClient() {
  const { getAccessTokenSilently } = useAuth0();

  const client = new FestivalsClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getAccessToken: async () => {
      return await getAccessTokenSilently({
        authorizationParams: {
          audience: 'https://api.festivals.app',
        },
      });
    },
  });

  return client;
}
```

### Hybrid Authentication

```typescript
const client = new FestivalsClient({
  baseUrl: 'https://api.festivals.app',
  apiKey: 'your-api-key', // Fallback
  getAccessToken: async () => {
    // Use user token when available
    const token = await auth.getToken();
    return token || null;
  },
});
```

## API Reference

### Festivals

```typescript
// List all public festivals
const festivals = await client.festivals.list({
  status: 'active',
  limit: 20,
  offset: 0,
});

// Get festival details
const festival = await client.festivals.get('fest-123');

// Get festival lineup
const lineup = await client.festivals.getLineup('fest-123', {
  date: '2025-07-15',
  stage: 'main-stage',
});

// Get festival map
const map = await client.festivals.getMap('fest-123');

// Get festival stands
const stands = await client.festivals.getStands('fest-123', {
  type: 'food',
});
```

### Wallets

```typescript
// Get user's wallets
const wallets = await client.wallets.list();

// Get wallet details
const wallet = await client.wallets.get('wallet-123');

// Get wallet transactions
const transactions = await client.wallets.getTransactions('wallet-123', {
  type: 'payment',
  from: '2025-07-01',
  to: '2025-07-15',
  limit: 50,
});

// Top up wallet
const topup = await client.wallets.topup('wallet-123', {
  amount: 5000,
  paymentMethodId: 'pm_xxx',
});

// Request refund
const refund = await client.wallets.requestRefund('wallet-123', {
  amount: 2500,
  reason: 'Event cancelled',
});
```

### Payments

```typescript
// Process payment
const payment = await client.payments.create({
  walletId: 'wallet-123',
  standId: 'stand-456',
  amount: 1500,
  items: [
    { productId: 'prod-789', quantity: 2 },
  ],
  // Optional: offline mode
  offlineSignature: 'signed-payload',
});

// Get payment details
const paymentDetails = await client.payments.get('tx-123');

// Refund payment
const refund = await client.payments.refund('tx-123', {
  amount: 500, // Partial refund
  reason: 'Item unavailable',
});
```

### Tickets

```typescript
// Get user's tickets
const tickets = await client.tickets.list({
  festivalId: 'fest-123',
  status: 'valid',
});

// Get ticket details
const ticket = await client.tickets.get('ticket-123');

// Validate ticket (staff)
const validation = await client.tickets.validate('ticket-123', {
  gate: 'entrance-a',
  deviceId: 'device-123',
});

// Transfer ticket
const transfer = await client.tickets.transfer('ticket-123', {
  recipientEmail: 'friend@example.com',
});
```

### NFC Tags

```typescript
// Link NFC tag to wallet
const link = await client.nfc.link({
  tagId: 'nfc-abc123',
  walletId: 'wallet-123',
});

// Get NFC tag status
const tag = await client.nfc.get('nfc-abc123');

// Unlink NFC tag
await client.nfc.unlink('nfc-abc123');

// Get wallet by NFC tag
const wallet = await client.nfc.getWallet('nfc-abc123');
```

## TypeScript Support

### Full Type Definitions

```typescript
import {
  FestivalsClient,
  Festival,
  Wallet,
  Transaction,
  Ticket,
  PaymentRequest,
  ApiError,
} from '@festivals/sdk';

// Types are fully available
const handlePayment = async (request: PaymentRequest): Promise<Transaction> => {
  try {
    return await client.payments.create(request);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error: ${error.code} - ${error.message}`);
    }
    throw error;
  }
};
```

### Generic Response Types

```typescript
import { PaginatedResponse, ApiResponse } from '@festivals/sdk';

// Paginated responses
const response: PaginatedResponse<Festival> = await client.festivals.list();
console.log(response.data); // Festival[]
console.log(response.meta.total); // number
console.log(response.meta.hasMore); // boolean

// Single item responses
const festivalResponse: ApiResponse<Festival> = await client.festivals.get('fest-123');
console.log(festivalResponse.data); // Festival
```

## Error Handling

### Error Types

```typescript
import { ApiError, NetworkError, ValidationError } from '@festivals/sdk';

try {
  await client.payments.create(paymentRequest);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
    console.log('Validation failed:', error.fields);
    // { amount: 'must be positive', walletId: 'required' }
  } else if (error instanceof ApiError) {
    // Handle API errors
    switch (error.code) {
      case 'INSUFFICIENT_BALANCE':
        showTopUpPrompt();
        break;
      case 'WALLET_FROZEN':
        showContactSupport();
        break;
      case 'RATE_LIMITED':
        await delay(error.retryAfter * 1000);
        break;
      default:
        showGenericError(error.message);
    }
  } else if (error instanceof NetworkError) {
    // Handle network errors
    showOfflineMessage();
  }
}
```

### Retry Logic

```typescript
const client = new FestivalsClient({
  baseUrl: 'https://api.festivals.app',
  apiKey: 'your-api-key',
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
    retryOn: [429, 500, 502, 503, 504],
  },
});
```

### Custom Error Handler

```typescript
const client = new FestivalsClient({
  baseUrl: 'https://api.festivals.app',
  apiKey: 'your-api-key',
  onError: (error) => {
    // Log to error tracking service
    Sentry.captureException(error);

    // Return true to suppress default error handling
    return false;
  },
});
```

## React Integration

### React Query (TanStack Query)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFestivalsClient } from './hooks/useFestivalsClient';

// Fetch festivals
export function useFestivals() {
  const client = useFestivalsClient();

  return useQuery({
    queryKey: ['festivals'],
    queryFn: () => client.festivals.list(),
  });
}

// Fetch wallet
export function useWallet(walletId: string) {
  const client = useFestivalsClient();

  return useQuery({
    queryKey: ['wallet', walletId],
    queryFn: () => client.wallets.get(walletId),
    enabled: !!walletId,
  });
}

// Process payment mutation
export function usePayment() {
  const client = useFestivalsClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: PaymentRequest) => client.payments.create(request),
    onSuccess: (transaction) => {
      // Invalidate wallet query to refresh balance
      queryClient.invalidateQueries({
        queryKey: ['wallet', transaction.walletId],
      });
    },
  });
}
```

### React Context Provider

```typescript
import { createContext, useContext, useMemo } from 'react';
import { FestivalsClient } from '@festivals/sdk';
import { useAuth0 } from '@auth0/auth0-react';

const FestivalsContext = createContext<FestivalsClient | null>(null);

export function FestivalsProvider({ children }: { children: React.ReactNode }) {
  const { getAccessTokenSilently } = useAuth0();

  const client = useMemo(() => {
    return new FestivalsClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL!,
      getAccessToken: getAccessTokenSilently,
    });
  }, [getAccessTokenSilently]);

  return (
    <FestivalsContext.Provider value={client}>
      {children}
    </FestivalsContext.Provider>
  );
}

export function useFestivalsClient() {
  const client = useContext(FestivalsContext);
  if (!client) {
    throw new Error('useFestivalsClient must be used within FestivalsProvider');
  }
  return client;
}
```

### Component Example

```tsx
import { useWallet, usePayment } from './hooks';

export function WalletCard({ walletId }: { walletId: string }) {
  const { data: wallet, isLoading, error } = useWallet(walletId);
  const payment = usePayment();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  const handlePayment = async () => {
    try {
      await payment.mutateAsync({
        walletId: wallet.id,
        standId: 'stand-123',
        amount: 1500,
        items: [{ productId: 'prod-456', quantity: 1 }],
      });
      toast.success('Payment successful!');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="wallet-card">
      <h3>{wallet.festivalName}</h3>
      <p className="balance">{formatCurrency(wallet.balance)}</p>
      <button onClick={handlePayment} disabled={payment.isPending}>
        {payment.isPending ? 'Processing...' : 'Pay'}
      </button>
    </div>
  );
}
```

## Next.js Integration

### Server Components

```typescript
// app/festivals/page.tsx
import { FestivalsClient } from '@festivals/sdk';

async function getFestivals() {
  const client = new FestivalsClient({
    baseUrl: process.env.API_URL!,
    apiKey: process.env.FESTIVALS_API_KEY!,
  });

  return client.festivals.list({ status: 'active' });
}

export default async function FestivalsPage() {
  const festivals = await getFestivals();

  return (
    <div>
      {festivals.data.map((festival) => (
        <FestivalCard key={festival.id} festival={festival} />
      ))}
    </div>
  );
}
```

### API Routes

```typescript
// app/api/payments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { FestivalsClient } from '@festivals/sdk';
import { getSession } from '@auth0/nextjs-auth0';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const client = new FestivalsClient({
    baseUrl: process.env.API_URL!,
    getAccessToken: async () => session.accessToken,
  });

  try {
    const payment = await client.payments.create(body);
    return NextResponse.json(payment);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
```

## Webhooks

### Webhook Handler

```typescript
import { FestivalsWebhookHandler, WebhookEvent } from '@festivals/sdk';

const handler = new FestivalsWebhookHandler({
  secret: process.env.WEBHOOK_SECRET!,
});

// Express.js example
app.post('/webhooks/festivals', async (req, res) => {
  const signature = req.headers['x-festivals-signature'];

  try {
    const event = handler.verify(req.body, signature);

    switch (event.type) {
      case 'payment.completed':
        await handlePaymentCompleted(event.data);
        break;
      case 'ticket.validated':
        await handleTicketValidated(event.data);
        break;
      case 'wallet.topup':
        await handleWalletTopup(event.data);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Invalid signature' });
  }
});
```

### Event Types

```typescript
import { WebhookEvent } from '@festivals/sdk';

// Type-safe event handling
function handleEvent(event: WebhookEvent) {
  switch (event.type) {
    case 'payment.completed':
      // event.data is typed as PaymentCompletedData
      console.log(`Payment ${event.data.transactionId} completed`);
      break;

    case 'ticket.validated':
      // event.data is typed as TicketValidatedData
      console.log(`Ticket ${event.data.ticketId} validated at ${event.data.gate}`);
      break;

    case 'wallet.topup':
      // event.data is typed as WalletTopupData
      console.log(`Wallet ${event.data.walletId} topped up: ${event.data.amount}`);
      break;
  }
}
```

## Offline Support

### Enable Offline Mode

```typescript
const client = new FestivalsClient({
  baseUrl: 'https://api.festivals.app',
  apiKey: 'your-api-key',
  offline: {
    enabled: true,
    storage: 'indexeddb', // or 'localstorage'
    syncInterval: 30000, // 30 seconds
  },
});
```

### Offline Payments

```typescript
// Check if online
const isOnline = client.isOnline();

// Create offline payment
const payment = await client.payments.create({
  walletId: 'wallet-123',
  standId: 'stand-456',
  amount: 1500,
  items: [{ productId: 'prod-789', quantity: 1 }],
});

// Payment is queued if offline
if (payment.status === 'pending_sync') {
  console.log('Payment queued for sync');
}

// Listen for sync events
client.on('sync:complete', (results) => {
  console.log('Synced payments:', results.synced);
  console.log('Failed payments:', results.failed);
});

// Manual sync trigger
await client.sync();
```

## Advanced Configuration

### Full Configuration Options

```typescript
const client = new FestivalsClient({
  // Required
  baseUrl: 'https://api.festivals.app',

  // Authentication (at least one required)
  apiKey: 'your-api-key',
  getAccessToken: async () => token,

  // Request configuration
  timeout: 30000,
  headers: {
    'X-Custom-Header': 'value',
  },

  // Retry configuration
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
    retryOn: [429, 500, 502, 503, 504],
    backoff: 'exponential',
  },

  // Cache configuration
  cache: {
    enabled: true,
    ttl: 60000, // 1 minute
    maxSize: 100,
  },

  // Offline configuration
  offline: {
    enabled: true,
    storage: 'indexeddb',
    syncInterval: 30000,
  },

  // Hooks
  onRequest: (config) => {
    console.log('Request:', config.url);
    return config;
  },
  onResponse: (response) => {
    console.log('Response:', response.status);
    return response;
  },
  onError: (error) => {
    Sentry.captureException(error);
    return false;
  },
});
```

## Testing

### Mock Client

```typescript
import { createMockClient, mockFestival, mockWallet } from '@festivals/sdk/testing';

describe('PaymentFlow', () => {
  const mockClient = createMockClient();

  beforeEach(() => {
    mockClient.reset();
  });

  it('should process payment successfully', async () => {
    mockClient.wallets.get.mockResolvedValue(mockWallet({ balance: 5000 }));
    mockClient.payments.create.mockResolvedValue({
      id: 'tx-123',
      status: 'completed',
    });

    const result = await processPayment(mockClient, {
      walletId: 'wallet-123',
      amount: 1500,
    });

    expect(result.status).toBe('completed');
    expect(mockClient.payments.create).toHaveBeenCalledWith(
      expect.objectContaining({ walletId: 'wallet-123' })
    );
  });
});
```

### Integration Testing

```typescript
import { FestivalsClient } from '@festivals/sdk';

describe('Festivals API Integration', () => {
  const client = new FestivalsClient({
    baseUrl: process.env.TEST_API_URL!,
    apiKey: process.env.TEST_API_KEY!,
  });

  it('should fetch festivals', async () => {
    const festivals = await client.festivals.list();

    expect(festivals.data).toBeInstanceOf(Array);
    expect(festivals.meta.total).toBeGreaterThanOrEqual(0);
  });
});
```

## Related Documentation

- [API Authentication](./authentication.md)
- [API Errors](./errors.md)
- [Mobile SDK](./MOBILE.md)
- [Webhooks](./webhooks.md)
