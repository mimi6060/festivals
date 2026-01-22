import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'LOSS' | 'RETURN';
export type AlertType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVER_STOCK';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
export type CountStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productSku?: string;
  standId: string;
  standName?: string;
  festivalId: string;
  quantity: number;
  minThreshold: number;
  maxCapacity?: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  lastRestockAt?: string;
  lastCountAt?: string;
}

export interface StockAlert {
  id: string;
  inventoryItemId: string;
  productId: string;
  productName: string;
  standId: string;
  standName?: string;
  type: AlertType;
  status: AlertStatus;
  currentQty: number;
  thresholdQty: number;
  message: string;
  createdAt: string;
}

export interface InventoryCount {
  id: string;
  standId: string;
  standName?: string;
  festivalId: string;
  status: CountStatus;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
}

export interface InventoryCountItem {
  id: string;
  countId: string;
  inventoryItemId: string;
  productId: string;
  productName: string;
  productSku?: string;
  expectedQty: number;
  countedQty?: number;
  variance?: number;
  notes?: string;
  countedAt?: string;
}

export interface StockSummary {
  totalItems: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  activeAlerts: number;
}

interface InventoryState {
  // Stand inventory
  items: InventoryItem[];
  isLoading: boolean;
  error: string | null;

  // Alerts
  alerts: StockAlert[];

  // Summary
  summary: StockSummary | null;

  // Current count session
  currentCount: InventoryCount | null;
  countItems: InventoryCountItem[];

  // Actions
  setItems: (items: InventoryItem[]) => void;
  setAlerts: (alerts: StockAlert[]) => void;
  setSummary: (summary: StockSummary) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Count actions
  startCount: (count: InventoryCount, items: InventoryCountItem[]) => void;
  updateCountItem: (itemId: string, countedQty: number, notes?: string) => void;
  completeCount: () => void;
  cancelCount: () => void;

  // Stock operations
  adjustStock: (productId: string, delta: number, type: MovementType, reason?: string) => Promise<boolean>;

  // Load data
  loadStandInventory: (standId: string) => Promise<void>;
  loadAlerts: (standId: string) => Promise<void>;

  // Reset
  reset: () => void;
}

// Mock data for demo purposes
const mockItems: InventoryItem[] = [
  {
    id: '1',
    productId: 'p1',
    productName: 'Biere',
    standId: 'stand-1',
    standName: 'Bar Main Stage',
    festivalId: 'fest-1',
    quantity: 45,
    minThreshold: 20,
    isLowStock: false,
    isOutOfStock: false,
  },
  {
    id: '2',
    productId: 'p2',
    productName: 'Cocktail',
    standId: 'stand-1',
    standName: 'Bar Main Stage',
    festivalId: 'fest-1',
    quantity: 15,
    minThreshold: 20,
    isLowStock: true,
    isOutOfStock: false,
  },
  {
    id: '3',
    productId: 'p3',
    productName: 'Soft',
    standId: 'stand-1',
    standName: 'Bar Main Stage',
    festivalId: 'fest-1',
    quantity: 0,
    minThreshold: 10,
    isLowStock: false,
    isOutOfStock: true,
  },
  {
    id: '4',
    productId: 'p4',
    productName: 'Eau',
    standId: 'stand-1',
    standName: 'Bar Main Stage',
    festivalId: 'fest-1',
    quantity: 120,
    minThreshold: 30,
    maxCapacity: 200,
    isLowStock: false,
    isOutOfStock: false,
  },
  {
    id: '5',
    productId: 'p5',
    productName: 'Shot',
    standId: 'stand-1',
    standName: 'Bar Main Stage',
    festivalId: 'fest-1',
    quantity: 8,
    minThreshold: 15,
    isLowStock: true,
    isOutOfStock: false,
  },
];

const mockAlerts: StockAlert[] = [
  {
    id: 'a1',
    inventoryItemId: '3',
    productId: 'p3',
    productName: 'Soft',
    standId: 'stand-1',
    standName: 'Bar Main Stage',
    type: 'OUT_OF_STOCK',
    status: 'ACTIVE',
    currentQty: 0,
    thresholdQty: 10,
    message: 'Rupture de stock',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'a2',
    inventoryItemId: '2',
    productId: 'p2',
    productName: 'Cocktail',
    standId: 'stand-1',
    standName: 'Bar Main Stage',
    type: 'LOW_STOCK',
    status: 'ACTIVE',
    currentQty: 15,
    thresholdQty: 20,
    message: 'Stock bas: 15 restants',
    createdAt: new Date().toISOString(),
  },
];

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      isLoading: false,
      error: null,
      alerts: [],
      summary: null,
      currentCount: null,
      countItems: [],

      setItems: (items) => set({ items }),
      setAlerts: (alerts) => set({ alerts }),
      setSummary: (summary) => set({ summary }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      startCount: (count, items) =>
        set({
          currentCount: count,
          countItems: items,
        }),

      updateCountItem: (itemId, countedQty, notes) =>
        set((state) => ({
          countItems: state.countItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  countedQty,
                  variance: countedQty - item.expectedQty,
                  notes,
                  countedAt: new Date().toISOString(),
                }
              : item
          ),
        })),

      completeCount: () => {
        const state = get();
        if (!state.currentCount) return;

        // Update inventory items based on count
        const updatedItems = state.items.map((item) => {
          const countItem = state.countItems.find((ci) => ci.inventoryItemId === item.id);
          if (countItem && countItem.countedQty !== undefined) {
            return {
              ...item,
              quantity: countItem.countedQty,
              isLowStock: countItem.countedQty > 0 && countItem.countedQty <= item.minThreshold,
              isOutOfStock: countItem.countedQty === 0,
              lastCountAt: new Date().toISOString(),
            };
          }
          return item;
        });

        set({
          items: updatedItems,
          currentCount: null,
          countItems: [],
        });
      },

      cancelCount: () =>
        set({
          currentCount: null,
          countItems: [],
        }),

      adjustStock: async (productId, delta, type, reason) => {
        try {
          set({ isLoading: true, error: null });

          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 500));

          set((state) => ({
            items: state.items.map((item) => {
              if (item.productId === productId) {
                const newQty = Math.max(0, item.quantity + delta);
                return {
                  ...item,
                  quantity: newQty,
                  isLowStock: newQty > 0 && newQty <= item.minThreshold,
                  isOutOfStock: newQty === 0,
                  lastRestockAt: delta > 0 ? new Date().toISOString() : item.lastRestockAt,
                };
              }
              return item;
            }),
            isLoading: false,
          }));

          // Update summary
          const updatedItems = get().items;
          set({
            summary: {
              totalItems: updatedItems.length,
              totalQuantity: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
              lowStockCount: updatedItems.filter((item) => item.isLowStock).length,
              outOfStockCount: updatedItems.filter((item) => item.isOutOfStock).length,
              activeAlerts: get().alerts.filter((a) => a.status === 'ACTIVE').length,
            },
          });

          return true;
        } catch (error) {
          set({ error: 'Erreur lors de l\'ajustement du stock', isLoading: false });
          return false;
        }
      },

      loadStandInventory: async (standId) => {
        try {
          set({ isLoading: true, error: null });

          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Use mock data for demo
          const items = mockItems.filter((item) => item.standId === standId);
          const summary: StockSummary = {
            totalItems: items.length,
            totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
            lowStockCount: items.filter((item) => item.isLowStock).length,
            outOfStockCount: items.filter((item) => item.isOutOfStock).length,
            activeAlerts: mockAlerts.filter((a) => a.standId === standId && a.status === 'ACTIVE').length,
          };

          set({ items, summary, isLoading: false });
        } catch (error) {
          set({ error: 'Erreur lors du chargement de l\'inventaire', isLoading: false });
        }
      },

      loadAlerts: async (standId) => {
        try {
          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 200));

          const alerts = mockAlerts.filter((a) => a.standId === standId);
          set({ alerts });
        } catch (error) {
          console.error('Error loading alerts:', error);
        }
      },

      reset: () =>
        set({
          items: [],
          isLoading: false,
          error: null,
          alerts: [],
          summary: null,
          currentCount: null,
          countItems: [],
        }),
    }),
    {
      name: 'inventory-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentCount: state.currentCount,
        countItems: state.countItems,
      }),
    }
  )
);
