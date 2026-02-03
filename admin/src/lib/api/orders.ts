import { api } from '../api'

// Types
export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
export type PaymentMethod = 'WALLET' | 'CARD' | 'CASH' | 'NFC'

export interface Order {
  id: string
  festivalId: string
  standId: string
  standName: string
  customerId: string
  customerName: string
  customerEmail: string
  items: OrderItem[]
  subtotal: number
  total: number
  discount: number
  currency: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentReference: string | null
  walletId: string | null
  operatorId: string
  operatorName: string
  refundedAmount: number
  refundedAt: string | null
  refundedBy: string | null
  refundReason: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
  vatRate: number
}

export interface OrderHistoryEntry {
  id: string
  orderId: string
  action: 'CREATED' | 'UPDATED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PARTIAL_REFUND'
  performedBy: string
  performedByName: string
  note: string | null
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface OrderStats {
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  completedOrders: number
  cancelledOrders: number
  refundedOrders: number
  pendingOrders: number
}

export interface OrderListParams {
  status?: OrderStatus
  standId?: string
  search?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'total' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface RefundOrderInput {
  amount: number
  reason: string
  refundToWallet?: boolean
}

export interface PartialRefundInput {
  items: Array<{
    itemId: string
    quantity: number
  }>
  reason: string
  refundToWallet?: boolean
}

// API functions
export const ordersApi = {
  // List orders
  listOrders: (festivalId: string, params?: OrderListParams) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.standId) searchParams.set('standId', params.standId)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder)

    const query = searchParams.toString()
    return api.get<PaginatedResponse<Order>>(
      `/api/v1/festivals/${festivalId}/orders${query ? `?${query}` : ''}`
    )
  },

  // Get single order
  getOrder: (festivalId: string, orderId: string) =>
    api.get<Order>(`/api/v1/festivals/${festivalId}/orders/${orderId}`),

  // Get order history
  getOrderHistory: (festivalId: string, orderId: string) =>
    api.get<OrderHistoryEntry[]>(`/api/v1/festivals/${festivalId}/orders/${orderId}/history`),

  // Get order stats
  getOrderStats: (festivalId: string, params?: { startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    const query = searchParams.toString()
    return api.get<OrderStats>(`/api/v1/festivals/${festivalId}/orders/stats${query ? `?${query}` : ''}`)
  },

  // Cancel order
  cancelOrder: (festivalId: string, orderId: string, reason: string) =>
    api.post<Order>(`/api/v1/festivals/${festivalId}/orders/${orderId}/cancel`, { reason }),

  // Full refund
  refundOrder: (festivalId: string, orderId: string, data: RefundOrderInput) =>
    api.post<Order>(`/api/v1/festivals/${festivalId}/orders/${orderId}/refund`, data),

  // Partial refund
  partialRefundOrder: (festivalId: string, orderId: string, data: PartialRefundInput) =>
    api.post<Order>(`/api/v1/festivals/${festivalId}/orders/${orderId}/partial-refund`, data),

  // Export orders to CSV
  exportOrders: (festivalId: string, params?: OrderListParams) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.standId) searchParams.set('standId', params.standId)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    searchParams.set('format', 'csv')

    const query = searchParams.toString()
    return api.get<Blob>(`/api/v1/festivals/${festivalId}/orders/export?${query}`)
  },
}
