import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Cart, CartItem, CartOptions } from '@/types'
import type { TicketType } from '@/lib/api'
import { getTicketTypes } from '@/lib/api'

export interface CartValidationResult {
  valid: boolean
  errors: CartValidationError[]
  updatedItems: CartItem[]
}

export interface CartValidationError {
  ticketTypeId: string
  type: 'unavailable' | 'price_changed' | 'insufficient_stock' | 'expired'
  message: string
  oldPrice?: number
  newPrice?: number
  requestedQuantity?: number
  availableQuantity?: number
}

interface CartState extends Cart {
  addItem: (ticketType: TicketType, quantity: number) => void
  removeItem: (ticketTypeId: string) => void
  updateQuantity: (ticketTypeId: string, quantity: number) => void
  setOptions: (options: Partial<CartOptions>) => void
  setFestivalId: (festivalId: string) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
  validateCart: () => Promise<CartValidationResult>
  lastValidated: number | null
}

const initialState: Cart & { lastValidated: number | null } = {
  items: [],
  options: {
    camping: false,
    parking: false,
  },
  festivalId: null,
  lastValidated: null,
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

      validateCart: async (): Promise<CartValidationResult> => {
        const { items, festivalId } = get()
        const errors: CartValidationError[] = []
        const updatedItems: CartItem[] = []

        if (!festivalId || items.length === 0) {
          return { valid: true, errors: [], updatedItems: items }
        }

        try {
          // Fetch current ticket types from server
          const currentTicketTypes = await getTicketTypes(festivalId)
          const ticketTypesMap = new Map(currentTicketTypes.map(tt => [tt.id, tt]))

          for (const item of items) {
            const serverTicketType = ticketTypesMap.get(item.ticketTypeId)

            // Check if ticket type still exists and is active
            if (!serverTicketType) {
              errors.push({
                ticketTypeId: item.ticketTypeId,
                type: 'unavailable',
                message: `Le billet "${item.ticketType.name}" n'est plus disponible.`,
              })
              continue
            }

            // Check if ticket type is still active
            if (serverTicketType.status !== 'ACTIVE') {
              errors.push({
                ticketTypeId: item.ticketTypeId,
                type: serverTicketType.status === 'SOLD_OUT' ? 'insufficient_stock' : 'unavailable',
                message: serverTicketType.status === 'SOLD_OUT'
                  ? `Le billet "${item.ticketType.name}" est epuise.`
                  : `Le billet "${item.ticketType.name}" n'est plus en vente.`,
              })
              continue
            }

            // Check if price has changed
            if (serverTicketType.price !== item.ticketType.price) {
              errors.push({
                ticketTypeId: item.ticketTypeId,
                type: 'price_changed',
                message: `Le prix du billet "${item.ticketType.name}" a change.`,
                oldPrice: item.ticketType.price,
                newPrice: serverTicketType.price,
              })
            }

            // Check available stock
            if (serverTicketType.available < item.quantity) {
              if (serverTicketType.available === 0) {
                errors.push({
                  ticketTypeId: item.ticketTypeId,
                  type: 'insufficient_stock',
                  message: `Le billet "${item.ticketType.name}" n'est plus disponible en quantite suffisante.`,
                  requestedQuantity: item.quantity,
                  availableQuantity: serverTicketType.available,
                })
                continue
              } else {
                errors.push({
                  ticketTypeId: item.ticketTypeId,
                  type: 'insufficient_stock',
                  message: `Seulement ${serverTicketType.available} billet(s) "${item.ticketType.name}" disponible(s).`,
                  requestedQuantity: item.quantity,
                  availableQuantity: serverTicketType.available,
                })
              }
            }

            // Check validity period
            const now = new Date()
            const validFrom = new Date(serverTicketType.validFrom)
            const validUntil = new Date(serverTicketType.validUntil)

            if (now < validFrom || now > validUntil) {
              errors.push({
                ticketTypeId: item.ticketTypeId,
                type: 'expired',
                message: `La vente du billet "${item.ticketType.name}" est terminee.`,
              })
              continue
            }

            // Add to updated items with server data
            updatedItems.push({
              ...item,
              ticketType: serverTicketType,
              quantity: Math.min(item.quantity, serverTicketType.available),
            })
          }

          // Update last validated timestamp
          set({ lastValidated: Date.now() })

          // If there are errors but some items are valid, update the cart
          if (updatedItems.length > 0 && updatedItems.length !== items.length) {
            set({ items: updatedItems })
          } else if (updatedItems.length > 0) {
            // Update prices if they changed
            set({ items: updatedItems })
          }

          return {
            valid: errors.length === 0,
            errors,
            updatedItems,
          }
        } catch (error) {
          // If validation fails due to network error, allow checkout to proceed
          // The server will validate again during order creation
          return {
            valid: true,
            errors: [],
            updatedItems: items,
          }
        }
      },

      lastValidated: null,
    }),
    {
      name: 'festival-cart',
    }
  )
)
