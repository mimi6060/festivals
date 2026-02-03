import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Cart, CartItem, CartOptions } from '@/types'
import type { TicketType } from '@/lib/api'

interface CartState extends Cart {
  addItem: (ticketType: TicketType, quantity: number) => void
  removeItem: (ticketTypeId: string) => void
  updateQuantity: (ticketTypeId: string, quantity: number) => void
  setOptions: (options: Partial<CartOptions>) => void
  setFestivalId: (festivalId: string) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
}

const initialState: Cart = {
  items: [],
  options: {
    camping: false,
    parking: false,
  },
  festivalId: null,
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addItem: (ticketType: TicketType, quantity: number) => {
        const { items, festivalId } = get()

        // If cart has items from a different festival, clear it
        if (festivalId && festivalId !== ticketType.festivalId) {
          set({
            items: [{ ticketTypeId: ticketType.id, ticketType, quantity }],
            festivalId: ticketType.festivalId,
          })
          return
        }

        const existingItem = items.find((item) => item.ticketTypeId === ticketType.id)

        if (existingItem) {
          set({
            items: items.map((item) =>
              item.ticketTypeId === ticketType.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ),
            festivalId: ticketType.festivalId,
          })
        } else {
          set({
            items: [...items, { ticketTypeId: ticketType.id, ticketType, quantity }],
            festivalId: ticketType.festivalId,
          })
        }
      },

      removeItem: (ticketTypeId: string) => {
        const { items } = get()
        const newItems = items.filter((item) => item.ticketTypeId !== ticketTypeId)
        set({
          items: newItems,
          festivalId: newItems.length > 0 ? get().festivalId : null,
        })
      },

      updateQuantity: (ticketTypeId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(ticketTypeId)
          return
        }

        const { items } = get()
        set({
          items: items.map((item) =>
            item.ticketTypeId === ticketTypeId ? { ...item, quantity } : item
          ),
        })
      },

      setOptions: (options: Partial<CartOptions>) => {
        set({ options: { ...get().options, ...options } })
      },

      setFestivalId: (festivalId: string) => {
        set({ festivalId })
      },

      clearCart: () => {
        set(initialState)
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      getTotalPrice: () => {
        const { items, options } = get()
        let total = items.reduce(
          (sum, item) => sum + item.ticketType.price * item.quantity,
          0
        )

        // Add options pricing (example: camping 50EUR, parking 20EUR)
        if (options.camping) total += 5000 // 50 EUR in cents
        if (options.parking) total += 2000 // 20 EUR in cents

        return total
      },
    }),
    {
      name: 'festival-cart',
    }
  )
)
