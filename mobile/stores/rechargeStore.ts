import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PaymentMethod = 'CASH' | 'CARD';

export interface RechargeTransaction {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  customerId: string;
  customerName?: string;
  customerBalanceBefore: number;
  customerBalanceAfter: number;
  staffId: string;
  standId: string;
  createdAt: string;
}

export interface CustomerWallet {
  id: string;
  name: string;
  balance: number;
  email?: string;
  phone?: string;
}

interface RechargeState {
  // Today's stats
  todayRecharges: RechargeTransaction[];
  todayTotal: number;
  todayCashTotal: number;
  todayCardTotal: number;
  todayCount: number;

  // Current recharge session
  rechargeAmount: number;
  paymentMethod: PaymentMethod;
  scannedCustomer: CustomerWallet | null;

  // Actions
  setRechargeAmount: (amount: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setScannedCustomer: (customer: CustomerWallet | null) => void;

  // Transaction actions
  processRecharge: () => Promise<RechargeTransaction>;
  clearRechargeSession: () => void;
  loadTodayRecharges: () => void;
  resetDailyStats: () => void;
}

export const useRechargeStore = create<RechargeState>()(
  persist(
    (set, get) => ({
      // Initial state
      todayRecharges: [],
      todayTotal: 0,
      todayCashTotal: 0,
      todayCardTotal: 0,
      todayCount: 0,

      rechargeAmount: 0,
      paymentMethod: 'CASH',
      scannedCustomer: null,

      setRechargeAmount: (amount) => set({ rechargeAmount: amount }),

      setPaymentMethod: (method) => set({ paymentMethod: method }),

      setScannedCustomer: (customer) => set({ scannedCustomer: customer }),

      processRecharge: async () => {
        const state = get();

        if (!state.scannedCustomer) {
          throw new Error('No customer scanned');
        }

        if (state.rechargeAmount <= 0) {
          throw new Error('Invalid recharge amount');
        }

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        const transaction: RechargeTransaction = {
          id: `rch-${Date.now()}`,
          amount: state.rechargeAmount,
          paymentMethod: state.paymentMethod,
          customerId: state.scannedCustomer.id,
          customerName: state.scannedCustomer.name,
          customerBalanceBefore: state.scannedCustomer.balance,
          customerBalanceAfter: state.scannedCustomer.balance + state.rechargeAmount,
          staffId: 'staff-1', // Would come from auth store
          standId: 'recharge-stand-1', // Would come from staff store
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          todayRecharges: [transaction, ...state.todayRecharges],
          todayTotal: state.todayTotal + transaction.amount,
          todayCashTotal:
            transaction.paymentMethod === 'CASH'
              ? state.todayCashTotal + transaction.amount
              : state.todayCashTotal,
          todayCardTotal:
            transaction.paymentMethod === 'CARD'
              ? state.todayCardTotal + transaction.amount
              : state.todayCardTotal,
          todayCount: state.todayCount + 1,
          // Clear session
          rechargeAmount: 0,
          scannedCustomer: null,
        }));

        return transaction;
      },

      clearRechargeSession: () =>
        set({
          rechargeAmount: 0,
          paymentMethod: 'CASH',
          scannedCustomer: null,
        }),

      loadTodayRecharges: () => {
        // This would load from API in real implementation
        // For now, we use the persisted state
        // Check if stored data is from today, otherwise reset
        const state = get();
        if (state.todayRecharges.length > 0) {
          const lastRecharge = state.todayRecharges[0];
          const lastDate = new Date(lastRecharge.createdAt).toDateString();
          const today = new Date().toDateString();

          if (lastDate !== today) {
            // Reset if data is from a different day
            set({
              todayRecharges: [],
              todayTotal: 0,
              todayCashTotal: 0,
              todayCardTotal: 0,
              todayCount: 0,
            });
          }
        }
      },

      resetDailyStats: () =>
        set({
          todayRecharges: [],
          todayTotal: 0,
          todayCashTotal: 0,
          todayCardTotal: 0,
          todayCount: 0,
        }),
    }),
    {
      name: 'recharge-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        todayRecharges: state.todayRecharges,
        todayTotal: state.todayTotal,
        todayCashTotal: state.todayCashTotal,
        todayCardTotal: state.todayCardTotal,
        todayCount: state.todayCount,
      }),
    }
  )
);
