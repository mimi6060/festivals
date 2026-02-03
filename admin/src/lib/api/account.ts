import { api } from '../api'

// Types
export interface UserTicket {
  id: string
  code: string
  ticketTypeId: string
  ticketTypeName: string
  festivalId: string
  festivalName: string
  festivalDate: string
  festivalLocation: string
  status: 'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED' | 'TRANSFERRED'
  holderName: string
  holderEmail: string
  purchasedAt: string
  checkedInAt: string | null
  validFrom: string
  validUntil: string
  benefits: string[]
  transferable: boolean
  transferDeadline: string | null
  qrCodeUrl: string
  walletId: string | null
}

export interface UserOrder {
  id: string
  orderNumber: string
  festivalId: string
  festivalName: string
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
  items: UserOrderItem[]
  subtotal: number
  fees: number
  total: number
  currency: string
  paymentMethod: 'CARD' | 'WALLET' | 'APPLE_PAY' | 'GOOGLE_PAY'
  paymentReference: string | null
  createdAt: string
  completedAt: string | null
  refundedAmount: number
  refundedAt: string | null
  billingAddress: BillingAddress | null
  receiptUrl: string | null
  invoiceUrl: string | null
}

export interface UserOrderItem {
  id: string
  type: 'TICKET' | 'PRODUCT' | 'TOP_UP'
  name: string
  description: string | null
  quantity: number
  unitPrice: number
  total: number
  ticketId?: string
}

export interface BillingAddress {
  name: string
  street: string
  city: string
  postalCode: string
  country: string
  vatNumber?: string
}

export interface UserWallet {
  id: string
  festivalId: string
  festivalName: string
  balance: number
  currency: string
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED'
  totalTopUps: number
  totalSpent: number
  nfcLinked: boolean
  nfcTagId: string | null
  createdAt: string
  updatedAt: string
}

export interface WalletTransaction {
  id: string
  walletId: string
  type: 'TOP_UP' | 'TOP_UP_BONUS' | 'PAYMENT' | 'REFUND' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'INITIAL_BALANCE'
  amount: number
  balanceAfter: number
  description: string
  standName?: string
  reference?: string
  createdAt: string
}

export interface RefundRequest {
  id: string
  walletId: string
  amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  bankAccount: string
  requestedAt: string
  processedAt: string | null
  rejectionReason: string | null
}

export interface TransferTicketInput {
  ticketId: string
  recipientEmail: string
  recipientName: string
}

export interface RequestRefundInput {
  walletId: string
  amount: number
  bankAccount: string
  bankName: string
  accountHolderName: string
}

export interface LinkWalletInput {
  festivalId: string
  nfcTagUid?: string
}

// Response types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AccountSummary {
  user: {
    id: string
    name: string
    email: string
    phone?: string
    avatarUrl?: string
  }
  ticketCount: number
  upcomingFestivals: number
  totalOrders: number
  totalSpent: number
  activeWallets: number
  totalWalletBalance: number
}

// API functions
export const accountApi = {
  // Account Summary
  getAccountSummary: () =>
    api.get<AccountSummary>('/api/v1/account/summary'),

  // Tickets
  getMyTickets: (params?: { status?: string; festivalId?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.festivalId) searchParams.set('festivalId', params.festivalId)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    const query = searchParams.toString()
    return api.get<PaginatedResponse<UserTicket>>(`/api/v1/account/tickets${query ? `?${query}` : ''}`)
  },

  getTicket: (ticketId: string) =>
    api.get<UserTicket>(`/api/v1/account/tickets/${ticketId}`),

  downloadTicketQR: (ticketId: string) =>
    `/api/v1/account/tickets/${ticketId}/qr`,

  downloadTicketPDF: (ticketId: string) =>
    `/api/v1/account/tickets/${ticketId}/pdf`,

  getAppleWalletPass: (ticketId: string) =>
    `/api/v1/account/tickets/${ticketId}/apple-wallet`,

  getGoogleWalletPass: (ticketId: string) =>
    `/api/v1/account/tickets/${ticketId}/google-wallet`,

  transferTicket: (data: TransferTicketInput) =>
    api.post<UserTicket>('/api/v1/account/tickets/transfer', data),

  cancelTransfer: (ticketId: string) =>
    api.post<UserTicket>(`/api/v1/account/tickets/${ticketId}/cancel-transfer`),

  // Orders
  getMyOrders: (params?: { status?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    const query = searchParams.toString()
    return api.get<PaginatedResponse<UserOrder>>(`/api/v1/account/orders${query ? `?${query}` : ''}`)
  },

  getOrder: (orderId: string) =>
    api.get<UserOrder>(`/api/v1/account/orders/${orderId}`),

  downloadReceipt: (orderId: string) =>
    `/api/v1/account/orders/${orderId}/receipt`,

  downloadInvoice: (orderId: string) =>
    `/api/v1/account/orders/${orderId}/invoice`,

  // Wallet
  getMyWallet: (festivalId?: string) => {
    const searchParams = new URLSearchParams()
    if (festivalId) searchParams.set('festivalId', festivalId)
    const query = searchParams.toString()
    return api.get<UserWallet[]>(`/api/v1/account/wallets${query ? `?${query}` : ''}`)
  },

  getWalletDetails: (walletId: string) =>
    api.get<UserWallet>(`/api/v1/account/wallets/${walletId}`),

  getWalletTransactions: (
    walletId: string,
    params?: { type?: string; page?: number; limit?: number }
  ) => {
    const searchParams = new URLSearchParams()
    if (params?.type) searchParams.set('type', params.type)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    const query = searchParams.toString()
    return api.get<PaginatedResponse<WalletTransaction>>(
      `/api/v1/account/wallets/${walletId}/transactions${query ? `?${query}` : ''}`
    )
  },

  requestRefund: (data: RequestRefundInput) =>
    api.post<RefundRequest>('/api/v1/account/wallets/refund-request', data),

  getRefundRequests: () =>
    api.get<RefundRequest[]>('/api/v1/account/wallets/refund-requests'),

  linkWallet: (data: LinkWalletInput) =>
    api.post<UserWallet>('/api/v1/account/wallets/link', data),

  unlinkWallet: (walletId: string) =>
    api.post<void>(`/api/v1/account/wallets/${walletId}/unlink`),
}
