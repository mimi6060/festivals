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
  error: string | null;

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

// Check if we're in development mode
const __DEV__ = process.env.NODE_ENV === 'development' || process.env.EXPO_PUBLIC_ENV === 'development';

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      // Initial State - no mock data in production
      balance: 0,
      currencyName: 'Tokens',
      exchangeRate: 1,
      transactions: [],
      pendingTransactions: [],
      qrPayload: null,
      qrExpiresAt: null,
      isLoadingBalance: false,
      isLoadingTransactions: false,
      isLoadingQR: false,
      hasMoreTransactions: true,
      transactionPage: 0,
      transactionFilter: null,
      error: null,

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
        set({ isLoadingBalance: true, error: null });
        try {
          // TODO: Replace with actual API call
          // const response = await api.get('/wallet/balance');
          // set({ balance: response.data.balance, currencyName: response.data.currencyName });

          // For now, keep existing balance (will be populated from API in production)
          set({ isLoadingBalance: false });
        } catch (error) {
          console.error('Failed to fetch balance:', error);
          set({ isLoadingBalance: false, error: 'Failed to fetch balance' });
          throw error;
        }
      },

      fetchTransactions: async (page = 0, filter = null) => {
        set({ isLoadingTransactions: true, error: null });
        try {
          // TODO: Replace with actual API call
          // const response = await api.get('/wallet/transactions', {
          //   params: { page, limit: 10, type: filter }
          // });
          // const transactions = response.data.transactions;

          // For now, set empty state in production (will be populated from API)
          if (page === 0) {
            set({
              transactions: [],
              transactionPage: 0,
              hasMoreTransactions: false,
              transactionFilter: filter,
              isLoadingTransactions: false,
            });
          } else {
            set({ isLoadingTransactions: false });
          }
        } catch (error) {
          console.error('Failed to fetch transactions:', error);
          set({ isLoadingTransactions: false, error: 'Failed to fetch transactions' });
          throw error;
        }
      },

      generateQR: async () => {
        set({ isLoadingQR: true, error: null });
        try {
          // TODO: Replace with actual API call
          // const response = await api.post('/wallet/qr/generate');
          // return response.data;

          // Placeholder - in production this should call the API
          throw new Error('QR generation requires API connection');
        } catch (error) {
          console.error('Failed to generate QR:', error);
          set({ isLoadingQR: false, error: 'Failed to generate QR code' });
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
