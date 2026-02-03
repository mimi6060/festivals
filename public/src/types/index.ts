// Re-export all types from API
export type {
  Festival,
  TicketType,
  Artist,
  Stage,
  Performance,
  Lineup,
  Order,
  OrderItem,
  CreateOrderRequest,
  UserTicket,
  FAQ,
  FestivalInfo,
} from '@/lib/api'

// Cart types
export interface CartItem {
  ticketTypeId: string
  ticketType: import('@/lib/api').TicketType
  quantity: number
}

export interface CartOptions {
  camping: boolean
  parking: boolean
}

export interface Cart {
  items: CartItem[]
  options: CartOptions
  festivalId: string | null
}

// Form types
export interface CustomerInfo {
  email: string
  firstName: string
  lastName: string
  phone: string
}

// Schedule filter types
export interface ScheduleFilters {
  day: string | null
  stage: string | null
  search: string
}
