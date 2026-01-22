import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Transaction {
  id: string;
  type: 'RECHARGE' | 'PAYMENT' | 'REFUND' | 'CANCEL';
  amount: number;
  balanceAfter: number;
  reference?: string;
  standId?: string;
  idempotencyKey: string;
  offlineCreated: boolean;
  synced: boolean;
  createdAt: string;
}

interface WalletState {
  balance: number;
  currencyName: string;
  exchangeRate: number;
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  setBalance: (balance: number) => void;
  setCurrencyName: (name: string) => void;
  addTransaction: (tx: Transaction) => void;
  markTransactionSynced: (id: string) => void;
  setTransactions: (transactions: Transaction[]) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      balance: 125,
      currencyName: 'Griffons',
      exchangeRate: 0.1,
      transactions: [
        {
          id: '1',
          type: 'RECHARGE',
          amount: 100,
          balanceAfter: 100,
          reference: 'Recharge CB',
          idempotencyKey: 'key-1',
          offlineCreated: false,
          synced: true,
          createdAt: 'Aujourd\'hui, 18:00',
        },
        {
          id: '2',
          type: 'PAYMENT',
          amount: -15,
          balanceAfter: 85,
          reference: 'Bar Main Stage',
          idempotencyKey: 'key-2',
          offlineCreated: false,
          synced: true,
          createdAt: 'Aujourd\'hui, 21:34',
        },
      ],
      pendingTransactions: [],
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
    }),
    {
      name: 'wallet-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
