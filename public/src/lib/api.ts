const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

// Default timeout of 30 seconds
const DEFAULT_TIMEOUT = 30000

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

// User-friendly error messages mapping
const ERROR_MESSAGES: Record<string, string> = {
  'network_error': 'Impossible de se connecter au serveur. Verifiez votre connexion internet.',
  'timeout': 'La requete a pris trop de temps. Veuillez reessayer.',
  'unauthorized': 'Vous devez vous connecter pour effectuer cette action.',
  'forbidden': 'Vous n\'avez pas les droits pour effectuer cette action.',
  'not_found': 'La ressource demandee n\'existe pas.',
  'validation_error': 'Les donnees envoyees sont invalides.',
  'server_error': 'Une erreur serveur est survenue. Veuillez reessayer plus tard.',
  'default': 'Une erreur est survenue. Veuillez reessayer.',
}

export class ApiError extends Error {
  public readonly statusCode?: number
  public readonly originalError?: string

  constructor(message: string, statusCode?: number, originalError?: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.originalError = originalError
  }
}

function getErrorMessage(statusCode: number, serverMessage?: string): string {
  // In development, show more details
  if (process.env.NODE_ENV === 'development' && serverMessage) {
    return serverMessage
  }

  // In production, map to user-friendly messages
  if (statusCode === 401) return ERROR_MESSAGES.unauthorized
  if (statusCode === 403) return ERROR_MESSAGES.forbidden
  if (statusCode === 404) return ERROR_MESSAGES.not_found
  if (statusCode === 400 || statusCode === 422) return ERROR_MESSAGES.validation_error
  if (statusCode >= 500) return ERROR_MESSAGES.server_error

  return ERROR_MESSAGES.default
}

interface RequestOptions extends Omit<RequestInit, 'signal'> {
  timeout?: number
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: undefined }))
      const userMessage = getErrorMessage(response.status, errorBody.message)
      throw new ApiError(userMessage, response.status, errorBody.message)
    }

    return response.json()
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof ApiError) {
      throw error
    }

    if (error instanceof Error) {
      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        throw new ApiError(ERROR_MESSAGES.timeout, undefined, 'Request timeout')
      }

      // Handle network errors
      if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
        throw new ApiError(ERROR_MESSAGES.network_error, undefined, error.message)
      }
    }

    // Fallback for unknown errors
    throw new ApiError(ERROR_MESSAGES.default, undefined, String(error))
  }
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
