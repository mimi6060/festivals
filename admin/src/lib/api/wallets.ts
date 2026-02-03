import { api } from '../api'

// Types
export interface Wallet {
  id: string
  festivalId: string
  userId: string
  user: WalletUser
  balance: number
  totalTopUps: number
  totalSpent: number
  status: WalletStatus
  nfcTags: NfcTag[]
  createdAt: string
  updatedAt: string
}

export type WalletStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED'

export interface WalletUser {
  id: string
  email: string
  name: string
  phone?: string
  avatarUrl?: string
}

export interface NfcTag {
  id: string
  walletId: string
  uid: string
  label?: string
  isActive: boolean
  linkedAt: string
}

export interface WalletTransaction {
  id: string
  walletId: string
  type: WalletTransactionType
  amount: number
  balanceAfter: number
  description?: string
  reference?: string
  standId?: string
  standName?: string
  operatorId?: string
  operatorName?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export type WalletTransactionType =
  | 'TOP_UP'
  | 'TOP_UP_BONUS'
  | 'PAYMENT'
  | 'REFUND'
  | 'MANUAL_CREDIT'
  | 'MANUAL_DEBIT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'INITIAL_BALANCE'

export interface WalletStats {
  totalWallets: number
  activeWallets: number
  frozenWallets: number
  totalBalance: number
  totalTopUps: number
  totalSpent: number
  averageBalance: number
}

// Request types
export interface WalletListParams {
  status?: WalletStatus
  search?: string
  minBalance?: number
  maxBalance?: number
  page?: number
  perPage?: number
}

export interface TopUpRequest {
  amount: number
  description?: string
  reference?: string
}

export interface RefundRequest {
  amount: number
  reason: string
  reference?: string
}

export interface ManualAdjustmentRequest {
  type: 'CREDIT' | 'DEBIT'
  amount: number
  reason: string
  reference?: string
}

export interface FreezeWalletRequest {
  reason: string
}

export interface BulkActionRequest {
  walletIds: string[]
  action: 'FREEZE' | 'UNFREEZE'
  reason?: string
}

export interface LinkNfcTagRequest {
  uid: string
  label?: string
}

// Response types
export interface WalletListResponse {
  wallets: Wallet[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

export interface TransactionListResponse {
  transactions: WalletTransaction[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

// API functions
export const walletsApi = {
  // Wallet CRUD & list
  list: (festivalId: string, params?: WalletListParams) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.minBalance !== undefined) searchParams.set('minBalance', String(params.minBalance))
    if (params?.maxBalance !== undefined) searchParams.set('maxBalance', String(params.maxBalance))
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('perPage', String(params.perPage))
    const query = searchParams.toString()
    return api.get<WalletListResponse>(`/api/v1/festivals/${festivalId}/wallets${query ? `?${query}` : ''}`)
  },

  get: (festivalId: string, walletId: string) =>
    api.get<Wallet>(`/api/v1/festivals/${festivalId}/wallets/${walletId}`),

  getStats: (festivalId: string) =>
    api.get<WalletStats>(`/api/v1/festivals/${festivalId}/wallets/stats`),

  // Status management
  freeze: (festivalId: string, walletId: string, data: FreezeWalletRequest) =>
    api.post<Wallet>(`/api/v1/festivals/${festivalId}/wallets/${walletId}/freeze`, data),

  unfreeze: (festivalId: string, walletId: string) =>
    api.post<Wallet>(`/api/v1/festivals/${festivalId}/wallets/${walletId}/unfreeze`),

  // Balance operations
  topUp: (festivalId: string, walletId: string, data: TopUpRequest) =>
    api.post<WalletTransaction>(`/api/v1/festivals/${festivalId}/wallets/${walletId}/top-up`, data),

  refund: (festivalId: string, walletId: string, data: RefundRequest) =>
    api.post<WalletTransaction>(`/api/v1/festivals/${festivalId}/wallets/${walletId}/refund`, data),

  manualAdjustment: (festivalId: string, walletId: string, data: ManualAdjustmentRequest) =>
    api.post<WalletTransaction>(`/api/v1/festivals/${festivalId}/wallets/${walletId}/adjust`, data),

  // Transaction history
  listTransactions: (
    festivalId: string,
    walletId: string,
    params?: { type?: WalletTransactionType; startDate?: string; endDate?: string; page?: number; perPage?: number }
  ) => {
    const searchParams = new URLSearchParams()
    if (params?.type) searchParams.set('type', params.type)
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('perPage', String(params.perPage))
    const query = searchParams.toString()
    return api.get<TransactionListResponse>(
      `/api/v1/festivals/${festivalId}/wallets/${walletId}/transactions${query ? `?${query}` : ''}`
    )
  },

  // NFC Tags
  listNfcTags: (festivalId: string, walletId: string) =>
    api.get<{ tags: NfcTag[] }>(`/api/v1/festivals/${festivalId}/wallets/${walletId}/nfc-tags`),

  linkNfcTag: (festivalId: string, walletId: string, data: LinkNfcTagRequest) =>
    api.post<NfcTag>(`/api/v1/festivals/${festivalId}/wallets/${walletId}/nfc-tags`, data),

  unlinkNfcTag: (festivalId: string, walletId: string, tagId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/wallets/${walletId}/nfc-tags/${tagId}`),

  // Bulk actions
  bulkAction: (festivalId: string, data: BulkActionRequest) =>
    api.post<{ processed: number; failed: number }>(`/api/v1/festivals/${festivalId}/wallets/bulk`, data),

  // Export
  exportWallets: (festivalId: string, params?: { status?: WalletStatus; format?: 'csv' | 'xlsx' }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.format) searchParams.set('format', params.format)
    const query = searchParams.toString()
    return `/api/v1/festivals/${festivalId}/wallets/export${query ? `?${query}` : ''}`
  },
}
