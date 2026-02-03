import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Order,
  OrderStatus,
  OrderFilters,
  FestivalOption,
  getOrders,
  getOrderById,
  getReceiptUrl,
  getOrderFestivals,
} from '@/lib/api/orders';

interface OrderState {
  // State
  orders: Order[];
  selectedOrder: Order | null;
  festivals: FestivalOption[];
  isLoading: boolean;
  isLoadingOrder: boolean;
  isLoadingReceipt: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
  totalOrders: number;

  // Filters
  selectedFestivalId: string | null;
  selectedStatus: OrderStatus | null;

  // Actions
  fetchOrders: (refresh?: boolean) => Promise<void>;
  fetchMoreOrders: () => Promise<void>;
  fetchOrderById: (orderId: string) => Promise<Order | null>;
  fetchFestivals: () => Promise<void>;
  downloadReceipt: (orderId: string) => Promise<string | null>;
  setSelectedFestival: (festivalId: string | null) => void;
  setSelectedStatus: (status: OrderStatus | null) => void;
  getOrderById: (orderId: string) => Order | undefined;
  clearError: () => void;
  clearSelectedOrder: () => void;
}

// Mock orders data for demonstration
const mockOrders: Order[] = [
  {
    id: 'order-001',
    orderNumber: 'ORD-2026-001',
    festivalId: 'fest-001',
    festivalName: 'Festival des Griffons 2026',
    status: 'COMPLETED',
    items: [
      {
        id: 'item-001',
        name: 'Biere artisanale',
        quantity: 2,
        unitPrice: 8,
        totalPrice: 16,
        category: 'Boissons',
      },
      {
        id: 'item-002',
        name: 'Hot Dog',
        quantity: 1,
        unitPrice: 10,
        totalPrice: 10,
        category: 'Nourriture',
      },
    ],
    subtotal: 26,
    fees: 0,
    total: 26,
    currency: 'EUR',
    paymentMethod: 'Wallet',
    standName: 'Bar Main Stage',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date(Date.now() - 3500000).toISOString(),
    receiptUrl: 'https://example.com/receipts/order-001.pdf',
  },
  {
    id: 'order-002',
    orderNumber: 'ORD-2026-002',
    festivalId: 'fest-001',
    festivalName: 'Festival des Griffons 2026',
    status: 'COMPLETED',
    items: [
      {
        id: 'item-003',
        name: 'T-shirt Festival',
        description: 'Taille M',
        quantity: 1,
        unitPrice: 35,
        totalPrice: 35,
        category: 'Merchandising',
      },
    ],
    subtotal: 35,
    fees: 0,
    total: 35,
    currency: 'EUR',
    paymentMethod: 'Wallet',
    standName: 'Boutique Officielle',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    completedAt: new Date(Date.now() - 7100000).toISOString(),
    receiptUrl: 'https://example.com/receipts/order-002.pdf',
  },
  {
    id: 'order-003',
    orderNumber: 'ORD-2026-003',
    festivalId: 'fest-001',
    festivalName: 'Festival des Griffons 2026',
    status: 'REFUNDED',
    items: [
      {
        id: 'item-004',
        name: 'Cocktail Signature',
        quantity: 2,
        unitPrice: 15,
        totalPrice: 30,
        category: 'Boissons',
      },
    ],
    subtotal: 30,
    fees: 0,
    total: 30,
    currency: 'EUR',
    paymentMethod: 'Wallet',
    standName: 'VIP Lounge',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    receiptUrl: 'https://example.com/receipts/order-003.pdf',
  },
  {
    id: 'order-004',
    orderNumber: 'ORD-2025-001',
    festivalId: 'fest-002',
    festivalName: 'Winter Music Fest 2025',
    status: 'COMPLETED',
    items: [
      {
        id: 'item-005',
        name: 'Pizza Margherita',
        quantity: 1,
        unitPrice: 12,
        totalPrice: 12,
        category: 'Nourriture',
      },
      {
        id: 'item-006',
        name: 'Soda',
        quantity: 2,
        unitPrice: 5,
        totalPrice: 10,
        category: 'Boissons',
      },
    ],
    subtotal: 22,
    fees: 0,
    total: 22,
    currency: 'EUR',
    paymentMethod: 'Wallet',
    standName: 'Food Court',
    createdAt: new Date(Date.now() - 2592000000).toISOString(),
    completedAt: new Date(Date.now() - 2591900000).toISOString(),
    receiptUrl: 'https://example.com/receipts/order-004.pdf',
  },
  {
    id: 'order-005',
    orderNumber: 'ORD-2026-004',
    festivalId: 'fest-001',
    festivalName: 'Festival des Griffons 2026',
    status: 'PENDING',
    items: [
      {
        id: 'item-007',
        name: 'Casquette Festival',
        quantity: 1,
        unitPrice: 25,
        totalPrice: 25,
        category: 'Merchandising',
      },
    ],
    subtotal: 25,
    fees: 0,
    total: 25,
    currency: 'EUR',
    paymentMethod: 'Wallet',
    standName: 'Boutique Officielle',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

const mockFestivals: FestivalOption[] = [
  { id: 'fest-001', name: 'Festival des Griffons 2026', orderCount: 4 },
  { id: 'fest-002', name: 'Winter Music Fest 2025', orderCount: 1 },
];

// Mock API delay
const mockDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      // Initial State
      orders: [],
      selectedOrder: null,
      festivals: [],
      isLoading: false,
      isLoadingOrder: false,
      isLoadingReceipt: false,
      error: null,
      hasMore: true,
      currentPage: 0,
      totalOrders: 0,
      selectedFestivalId: null,
      selectedStatus: null,

      // Fetch orders (with optional refresh)
      fetchOrders: async (refresh = false) => {
        const { selectedFestivalId, selectedStatus } = get();

        set({ isLoading: true, error: null });

        if (refresh) {
          set({ currentPage: 0, orders: [] });
        }

        try {
          // Simulate API call
          await mockDelay(800);

          // In real implementation:
          // const response = await getOrders({
          //   festivalId: selectedFestivalId || undefined,
          //   status: selectedStatus || undefined,
          //   page: 0,
          //   limit: 20,
          // });

          // Filter mock data based on filters
          let filteredOrders = [...mockOrders];

          if (selectedFestivalId) {
            filteredOrders = filteredOrders.filter(
              (order) => order.festivalId === selectedFestivalId
            );
          }

          if (selectedStatus) {
            filteredOrders = filteredOrders.filter(
              (order) => order.status === selectedStatus
            );
          }

          // Sort by date (newest first)
          filteredOrders.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          set({
            orders: filteredOrders,
            isLoading: false,
            hasMore: false, // Mock data doesn't have pagination
            currentPage: 0,
            totalOrders: filteredOrders.length,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Impossible de charger les commandes. Veuillez reessayer.';
          set({ isLoading: false, error: errorMessage });
        }
      },

      // Fetch more orders (pagination)
      fetchMoreOrders: async () => {
        const { hasMore, isLoading, currentPage, orders, selectedFestivalId, selectedStatus } =
          get();

        if (!hasMore || isLoading) return;

        set({ isLoading: true, error: null });

        try {
          await mockDelay(500);

          // In real implementation:
          // const response = await getOrders({
          //   festivalId: selectedFestivalId || undefined,
          //   status: selectedStatus || undefined,
          //   page: currentPage + 1,
          //   limit: 20,
          // });

          // For mock, we don't have more data
          set({
            isLoading: false,
            hasMore: false,
            currentPage: currentPage + 1,
          });
        } catch (error) {
          set({ isLoading: false });
        }
      },

      // Fetch single order by ID
      fetchOrderById: async (orderId: string) => {
        set({ isLoadingOrder: true, error: null });

        try {
          await mockDelay(500);

          // In real implementation:
          // const order = await getOrderById(orderId);

          // Find in mock data
          const order = mockOrders.find((o) => o.id === orderId);

          if (!order) {
            throw new Error('Commande introuvable');
          }

          set({ selectedOrder: order, isLoadingOrder: false });
          return order;
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Impossible de charger la commande.';
          set({ isLoadingOrder: false, error: errorMessage });
          return null;
        }
      },

      // Fetch festivals for filter dropdown
      fetchFestivals: async () => {
        try {
          await mockDelay(300);

          // In real implementation:
          // const festivals = await getOrderFestivals();

          set({ festivals: mockFestivals });
        } catch (error) {
          console.error('Failed to fetch festivals:', error);
        }
      },

      // Download receipt
      downloadReceipt: async (orderId: string) => {
        set({ isLoadingReceipt: true });

        try {
          await mockDelay(500);

          // In real implementation:
          // const url = await getReceiptUrl(orderId);

          // Mock receipt URL
          const order = get().orders.find((o) => o.id === orderId);
          const url = order?.receiptUrl || null;

          set({ isLoadingReceipt: false });
          return url;
        } catch (error) {
          set({ isLoadingReceipt: false });
          return null;
        }
      },

      // Set selected festival filter
      setSelectedFestival: (festivalId: string | null) => {
        set({ selectedFestivalId: festivalId });
      },

      // Set selected status filter
      setSelectedStatus: (status: OrderStatus | null) => {
        set({ selectedStatus: status });
      },

      // Get order by ID from local state
      getOrderById: (orderId: string) => {
        return get().orders.find((order) => order.id === orderId);
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Clear selected order
      clearSelectedOrder: () => set({ selectedOrder: null }),
    }),
    {
      name: 'order-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        orders: state.orders,
        festivals: state.festivals,
        totalOrders: state.totalOrders,
      }),
    }
  )
);
