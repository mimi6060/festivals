import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TransactionType = 'TOP_UP' | 'PURCHASE' | 'REFUND' | 'RECHARGE' | 'PAYMENT' | 'CANCEL';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  reference?: string;
  description?: string;
  standId?: string;
  standName?: string;
  idempotencyKey: string;
  offlineCreated: boolean;
  synced: boolean;
  createdAt: string;
}

export interface QRPayload {
  token: string;
  walletId: string;
  userId: string;
  expiresAt: number;
  signature: string;
}

interface WalletState {
  // State
  balance: number;
  currencyName: string;
  exchangeRate: number;
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  qrPayload: QRPayload | null;
  qrExpiresAt: number | null;
  isLoadingBalance: boolean;
  isLoadingTransactions: boolean;
  isLoadingQR: boolean;
  hasMoreTransactions: boolean;
  transactionPage: number;
  transactionFilter: TransactionType | null;

  // Actions
  setBalance: (balance: number) => void;
  setCurrencyName: (name: string) => void;
  addTransaction: (tx: Transaction) => void;
  markTransactionSynced: (id: string) => void;
  setTransactions: (transactions: Transaction[]) => void;
  appendTransactions: (transactions: Transaction[]) => void;
  setTransactionFilter: (filter: TransactionType | null) => void;

  // API Actions
  fetchBalance: () => Promise<void>;
  fetchTransactions: (page?: number, filter?: TransactionType | null) => Promise<void>;
  generateQR: () => Promise<QRPayload>;
  refreshQRIfNeeded: () => Promise<void>;
}

// Mock API delay
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock transaction data generator
const generateMockTransactions = (page: number, filter?: TransactionType | null): Transaction[] => {
  const types: TransactionType[] = filter ? [filter] : ['TOP_UP', 'PURCHASE', 'REFUND'];
  const mockData: Transaction[] = [];

  const descriptions: Record<TransactionType, string[]> = {
    TOP_UP: ['Recharge CB', 'Recharge Especes', 'Bonus parrainage'],
    PURCHASE: ['Bar Main Stage', 'Food Court', 'Merchandise Stand', 'VIP Lounge', 'Snack Bar'],
    REFUND: ['Remboursement annulation', 'Remboursement erreur'],
    RECHARGE: ['Recharge CB', 'Recharge Especes'],
    PAYMENT: ['Bar Main Stage', 'Food Court'],
    CANCEL: ['Annulation commande'],
  };

  for (let i = 0; i < 10; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const isCredit = type === 'TOP_UP' || type === 'REFUND' || type === 'RECHARGE';
    const amount = isCredit
      ? Math.floor(Math.random() * 50 + 10)
      : -Math.floor(Math.random() * 30 + 5);

    const date = new Date();
    date.setHours(date.getHours() - (page * 10 + i) * 2);

    mockData.push({
      id: `tx-${page}-${i}-${Date.now()}`,
      type,
      amount,
      balanceAfter: 100 + amount,
      reference: descriptions[type][Math.floor(Math.random() * descriptions[type].length)],
      description: descriptions[type][Math.floor(Math.random() * descriptions[type].length)],
      idempotencyKey: `key-${page}-${i}`,
      offlineCreated: false,
      synced: true,
      createdAt: date.toISOString(),
    });
  }

  return mockData;
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      // Initial State
      balance: 125,
      currencyName: 'Griffons',
      exchangeRate: 0.1,
      transactions: [
        {
          id: '1',
          type: 'TOP_UP',
          amount: 100,
          balanceAfter: 100,
          reference: 'Recharge CB',
          description: 'Recharge par carte bancaire',
          idempotencyKey: 'key-1',
          offlineCreated: false,
          synced: true,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          type: 'PURCHASE',
          amount: -15,
          balanceAfter: 85,
          reference: 'Bar Main Stage',
          description: '2x Biere, 1x Soft',
          standName: 'Bar Main Stage',
          idempotencyKey: 'key-2',
          offlineCreated: false,
          synced: true,
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '3',
          type: 'PURCHASE',
          amount: -8,
          balanceAfter: 77,
          reference: 'Food Court',
          description: 'Hot Dog',
          standName: 'Food Court',
          idempotencyKey: 'key-3',
          offlineCreated: false,
          synced: true,
          createdAt: new Date(Date.now() - 10800000).toISOString(),
        },
        {
          id: '4',
          type: 'TOP_UP',
          amount: 50,
          balanceAfter: 127,
          reference: 'Recharge Especes',
          description: 'Recharge en especes',
          idempotencyKey: 'key-4',
          offlineCreated: false,
          synced: true,
          createdAt: new Date(Date.now() - 14400000).toISOString(),
        },
        {
          id: '5',
          type: 'REFUND',
          amount: 12,
          balanceAfter: 139,
          reference: 'Remboursement',
          description: 'Remboursement commande annulee',
          idempotencyKey: 'key-5',
          offlineCreated: false,
          synced: true,
          createdAt: new Date(Date.now() - 18000000).toISOString(),
        },
      ],
      pendingTransactions: [],
      qrPayload: null,
      qrExpiresAt: null,
      isLoadingBalance: false,
      isLoadingTransactions: false,
      isLoadingQR: false,
      hasMoreTransactions: true,
      transactionPage: 0,
      transactionFilter: null,

      // Basic Actions
      setBalance: (balance) => set({ balance }),
      setCurrencyName: (currencyName) => set({ currencyName }),

      addTransaction: (tx) =>
        set((state) => ({
          transactions: [tx, ...state.transactions],
          balance: tx.balanceAfter,
          pendingTransactions: tx.offlineCreated
            ? [...state.pendingTransactions, tx]
            : state.pendingTransactions,
        })),

      markTransactionSynced: (id) =>
        set((state) => ({
          pendingTransactions: state.pendingTransactions.filter((tx) => tx.id !== id),
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, synced: true } : tx
          ),
        })),

      setTransactions: (transactions) => set({ transactions }),

      appendTransactions: (transactions) =>
        set((state) => ({
          transactions: [...state.transactions, ...transactions],
        })),

      setTransactionFilter: (filter) => set({ transactionFilter: filter }),

      // API Actions
      fetchBalance: async () => {
        set({ isLoadingBalance: true });
        try {
          // Simulate API call
          await mockDelay(500);

          // In real implementation, this would be:
          // const response = await api.get('/wallet/balance');
          // set({ balance: response.data.balance });

          // Mock: randomly adjust balance slightly
          const currentBalance = get().balance;
          set({
            balance: currentBalance,
            isLoadingBalance: false
          });
        } catch (error) {
          console.error('Failed to fetch balance:', error);
          set({ isLoadingBalance: false });
          throw error;
        }
      },

      fetchTransactions: async (page = 0, filter = null) => {
        set({ isLoadingTransactions: true });
        try {
          // Simulate API call
          await mockDelay(800);

          // In real implementation:
          // const response = await api.get('/wallet/transactions', {
          //   params: { page, limit: 10, type: filter }
          // });

          const mockTransactions = generateMockTransactions(page, filter);

          if (page === 0) {
            // First page - replace transactions
            set({
              transactions: mockTransactions,
              transactionPage: 0,
              hasMoreTransactions: mockTransactions.length === 10,
              transactionFilter: filter,
              isLoadingTransactions: false,
            });
          } else {
            // Subsequent pages - append
            set((state) => ({
              transactions: [...state.transactions, ...mockTransactions],
              transactionPage: page,
              hasMoreTransactions: mockTransactions.length === 10 && page < 5, // Limit to 5 pages for mock
              isLoadingTransactions: false,
            }));
          }
        } catch (error) {
          console.error('Failed to fetch transactions:', error);
          set({ isLoadingTransactions: false });
          throw error;
        }
      },

      generateQR: async () => {
        set({ isLoadingQR: true });
        try {
          // Simulate API call
          await mockDelay(300);

          // In real implementation:
          // const response = await api.post('/wallet/qr/generate');
          // return response.data;

          // Generate mock QR payload
          const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now
          const qrPayload: QRPayload = {
            token: `qr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            walletId: 'wallet_123',
            userId: 'user_456',
            expiresAt,
            signature: `sig_${Math.random().toString(36).substring(7)}`,
          };

          set({
            qrPayload,
            qrExpiresAt: expiresAt,
            isLoadingQR: false
          });

          return qrPayload;
        } catch (error) {
          console.error('Failed to generate QR:', error);
          set({ isLoadingQR: false });
          throw error;
        }
      },

      refreshQRIfNeeded: async () => {
        const { qrExpiresAt, generateQR } = get();

        // Refresh if QR expires in less than 1 minute or is already expired
        const shouldRefresh = !qrExpiresAt || qrExpiresAt - Date.now() < 60 * 1000;

        if (shouldRefresh) {
          await generateQR();
        }
      },
    }),
    {
      name: 'wallet-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        balance: state.balance,
        currencyName: state.currencyName,
        exchangeRate: state.exchangeRate,
        transactions: state.transactions,
        pendingTransactions: state.pendingTransactions,
      }),
    }
  )
);
