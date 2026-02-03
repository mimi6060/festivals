import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  available: boolean;
}

export interface Stand {
  id: string;
  name: string;
  category: string;
  products: Product[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface StaffTransaction {
  id: string;
  type: 'PAYMENT' | 'REFUND';
  amount: number;
  customerId: string;
  customerName?: string;
  items: CartItem[];
  standId: string;
  staffId: string;
  createdAt: string;
  refundable: boolean;
  refundedAt?: string;
}

export interface CustomerWallet {
  id: string;
  name: string;
  balance: number;
  currencyName: string;
}

interface StaffState {
  // Stand info
  currentStand: Stand | null;
  products: Product[];

  // Cart
  cart: CartItem[];
  cartTotal: number;

  // Transactions
  todayTransactions: StaffTransaction[];
  todayTotal: number;

  // Scanned customer
  scannedCustomer: CustomerWallet | null;

  // Actions
  setCurrentStand: (stand: Stand) => void;
  setProducts: (products: Product[]) => void;

  // Cart actions
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQuantity: (productId: string, quantity: number) => void;
  setCartAmount: (amount: number) => void;
  clearCart: () => void;

  // Customer actions
  setScannedCustomer: (customer: CustomerWallet | null) => void;

  // Transaction actions
  processPayment: (customerId: string) => Promise<StaffTransaction>;
  refundTransaction: (transactionId: string) => Promise<boolean>;
  loadTodayTransactions: () => void;
}

export const useStaffStore = create<StaffState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStand: {
        id: 'stand-1',
        name: 'Bar Main Stage',
        category: 'BAR',
        products: [],
      },
      products: [
        { id: 'p1', name: 'Biere', price: 5, category: 'DRINK', available: true },
        { id: 'p2', name: 'Cocktail', price: 8, category: 'DRINK', available: true },
        { id: 'p3', name: 'Soft', price: 3, category: 'DRINK', available: true },
        { id: 'p4', name: 'Eau', price: 2, category: 'DRINK', available: true },
        { id: 'p5', name: 'Shot', price: 4, category: 'DRINK', available: true },
        { id: 'p6', name: 'Vin', price: 6, category: 'DRINK', available: true },
      ],
      cart: [],
      cartTotal: 0,
      todayTransactions: [],
      todayTotal: 0,
      scannedCustomer: null,

      setCurrentStand: (stand) => set({ currentStand: stand, products: stand.products }),

      setProducts: (products) => set({ products }),

      addToCart: (product) =>
        set((state) => {
          const existingItem = state.cart.find((item) => item.product.id === product.id);
          let newCart: CartItem[];

          if (existingItem) {
            newCart = state.cart.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            );
          } else {
            newCart = [...state.cart, { product, quantity: 1 }];
          }

          const cartTotal = newCart.reduce(
            (sum, item) => sum + item.product.price * item.quantity,
            0
          );

          return { cart: newCart, cartTotal };
        }),

      removeFromCart: (productId) =>
        set((state) => {
          const newCart = state.cart.filter((item) => item.product.id !== productId);
          const cartTotal = newCart.reduce(
            (sum, item) => sum + item.product.price * item.quantity,
            0
          );
          return { cart: newCart, cartTotal };
        }),

      updateCartItemQuantity: (productId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            const newCart = state.cart.filter((item) => item.product.id !== productId);
            const cartTotal = newCart.reduce(
              (sum, item) => sum + item.product.price * item.quantity,
              0
            );
            return { cart: newCart, cartTotal };
          }

          const newCart = state.cart.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item
          );
          const cartTotal = newCart.reduce(
            (sum, item) => sum + item.product.price * item.quantity,
            0
          );
          return { cart: newCart, cartTotal };
        }),

      setCartAmount: (amount) => set({ cartTotal: amount, cart: [] }),

      clearCart: () => set({ cart: [], cartTotal: 0 }),

      setScannedCustomer: (customer) => set({ scannedCustomer: customer }),

      processPayment: async (customerId) => {
        const state = get();

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        const transaction: StaffTransaction = {
          id: `tx-${Date.now()}`,
          type: 'PAYMENT',
          amount: state.cartTotal,
          customerId,
          customerName: state.scannedCustomer?.name,
          items: [...state.cart],
          standId: state.currentStand?.id || '',
          staffId: 'staff-1', // Would come from auth store
          createdAt: new Date().toISOString(),
          refundable: true,
        };

        set((state) => ({
          todayTransactions: [transaction, ...state.todayTransactions],
          todayTotal: state.todayTotal + transaction.amount,
          cart: [],
          cartTotal: 0,
          scannedCustomer: null,
        }));

        return transaction;
      },

      refundTransaction: async (transactionId) => {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        set((state) => {
          const transaction = state.todayTransactions.find((tx) => tx.id === transactionId);
          if (!transaction || !transaction.refundable) return state;

          const refundTx: StaffTransaction = {
            id: `tx-${Date.now()}`,
            type: 'REFUND',
            amount: -transaction.amount,
            customerId: transaction.customerId,
            customerName: transaction.customerName,
            items: transaction.items,
            standId: transaction.standId,
            staffId: transaction.staffId,
            createdAt: new Date().toISOString(),
            refundable: false,
          };

          return {
            todayTransactions: [
              refundTx,
              ...state.todayTransactions.map((tx) =>
                tx.id === transactionId ? { ...tx, refundable: false, refundedAt: new Date().toISOString() } : tx
              ),
            ],
            todayTotal: state.todayTotal - transaction.amount,
          };
        });

        return true;
      },

      loadTodayTransactions: () => {
        // This would load from API in real implementation
        // For now, we use the persisted state
      },
    }),
    {
      name: 'staff-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentStand: state.currentStand,
        todayTransactions: state.todayTransactions,
        todayTotal: state.todayTotal,
      }),
    }
  )
);
