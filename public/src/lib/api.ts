const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export interface ApiResponse<T> {
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

// Festival API
export interface Festival {
  id: string
  name: string
  slug: string
  description: string
  startDate: string
  endDate: string
  location: string
  timezone: string
  currencyName: string
  exchangeRate: number
  settings: {
    logoUrl?: string
    primaryColor?: string
    secondaryColor?: string
    refundPolicy?: string
    reentryPolicy?: string
  }
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
}

export async function getFestival(idOrSlug: string): Promise<Festival> {
  return request<Festival>(`/api/public/festivals/${idOrSlug}`)
}

export async function getActiveFestivals(): Promise<Festival[]> {
  return request<Festival[]>('/api/public/festivals')
}

// Ticket Types API
export interface TicketType {
  id: string
  festivalId: string
  name: string
  description: string
  price: number
  priceDisplay: string
  quantity?: number
  quantitySold: number
  available: number
  validFrom: string
  validUntil: string
  benefits: string[]
  settings: {
    allowReentry: boolean
    includesTopUp: boolean
    topUpAmount: number
    requiresId: boolean
    transferAllowed: boolean
    maxTransfers: number
    color?: string
    accessZones?: string[]
  }
  status: 'ACTIVE' | 'INACTIVE' | 'SOLD_OUT'
}

export async function getTicketTypes(festivalId: string): Promise<TicketType[]> {
  return request<TicketType[]>(`/api/public/festivals/${festivalId}/ticket-types`)
}

// Lineup API
export interface Artist {
  id: string
  festivalId: string
  name: string
  description: string
  genre: string
  imageUrl?: string
  socialLinks: {
    website?: string
    instagram?: string
    twitter?: string
    facebook?: string
    spotify?: string
    youtube?: string
    soundcloud?: string
  }
}

export interface Stage {
  id: string
  festivalId: string
  name: string
  location: string
  capacity: number
  settings: {
    color?: string
    description?: string
    imageUrl?: string
    isIndoor: boolean
    hasSeating: boolean
  }
}

export interface Performance {
  id: string
  festivalId: string
  artistId: string
  stageId: string
  startTime: string
  endTime: string
  day: string
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'DELAYED'
  artist?: Artist
  stage?: Stage
}

export interface Lineup {
  festivalId: string
  days: string[]
  stages: Stage[]
  schedule: Record<string, Array<{
    stage: Stage
    performances: Performance[]
  }>>
}

export async function getLineup(festivalId: string): Promise<Lineup> {
  return request<Lineup>(`/api/public/festivals/${festivalId}/lineup`)
}

export async function getArtists(festivalId: string): Promise<Artist[]> {
  return request<Artist[]>(`/api/public/festivals/${festivalId}/artists`)
}

export async function getStages(festivalId: string): Promise<Stage[]> {
  return request<Stage[]>(`/api/public/festivals/${festivalId}/stages`)
}

export async function getDaySchedule(festivalId: string, day: string): Promise<Performance[]> {
  return request<Performance[]>(`/api/public/festivals/${festivalId}/schedule/${day}`)
}

// Order API
export interface OrderItem {
  ticketTypeId: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface CreateOrderRequest {
  festivalId: string
  items: Array<{
    ticketTypeId: string
    quantity: number
  }>
  customerInfo: {
    email: string
    firstName: string
    lastName: string
    phone?: string
  }
  options?: {
    camping?: boolean
    parking?: boolean
  }
}

export interface Order {
  id: string
  festivalId: string
  orderNumber: string
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED'
  items: OrderItem[]
  totalAmount: number
  customerEmail: string
  customerName: string
  paymentUrl?: string
  createdAt: string
}

export async function createOrder(order: CreateOrderRequest): Promise<Order> {
  return request<Order>('/api/public/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  })
}

export async function getOrder(orderId: string): Promise<Order> {
  return request<Order>(`/api/public/orders/${orderId}`)
}

// User Tickets API (requires authentication)
export interface UserTicket {
  id: string
  ticketTypeId: string
  festivalId: string
  code: string
  holderName: string
  holderEmail: string
  status: 'VALID' | 'USED' | 'EXPIRED' | 'CANCELLED' | 'TRANSFERRED'
  checkedInAt?: string
  ticketType?: TicketType
  festival?: Festival
  qrCodeData: string
  createdAt: string
}

export async function getUserTickets(token: string): Promise<UserTicket[]> {
  return request<UserTicket[]>('/api/user/tickets', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function getUserOrders(token: string): Promise<Order[]> {
  return request<Order[]>('/api/user/orders', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

// FAQ API
export interface FAQ {
  id: string
  question: string
  answer: string
  category: string
  order: number
}

export async function getFAQs(festivalId: string): Promise<FAQ[]> {
  return request<FAQ[]>(`/api/public/festivals/${festivalId}/faqs`)
}

// Info API
export interface FestivalInfo {
  id: string
  festivalId: string
  accessInfo: string
  rulesInfo: string
  mapUrl?: string
  contactEmail: string
  contactPhone?: string
  emergencyPhone?: string
}

export async function getFestivalInfo(festivalId: string): Promise<FestivalInfo> {
  return request<FestivalInfo>(`/api/public/festivals/${festivalId}/info`)
}
