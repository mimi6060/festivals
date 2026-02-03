import { api } from '../api'

// Types
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'FAILED'
export type RefundMethod = 'BANK_TRANSFER' | 'ORIGINAL_PAYMENT' | 'WALLET_CREDIT'

export interface RefundRequest {
  id: string
  festivalId: string
  userId: string
  walletId: string
  amount: number
  currency: string
  status: RefundStatus
  method: RefundMethod
  reason: string
  user: RefundUser
  wallet: RefundWallet
  bankDetails?: BankDetails
  processedAt: string | null
  processedBy: string | null
  approvedAt: string | null
  approvedBy: string | null
  rejectedAt: string | null
  rejectedBy: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

export interface RefundUser {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
}

export interface RefundWallet {
  id: string
  balance: number
  totalSpent: number
  totalTopUps: number
  ticketCode: string
}

export interface BankDetails {
  accountHolder: string
  iban: string
  bic: string
  bankName: string
}

export interface RefundHistoryEntry {
  id: string
  refundId: string
  action: 'CREATED' | 'APPROVED' | 'REJECTED' | 'PROCESSED' | 'FAILED'
  performedBy: string
  performedByEmail: string
  note: string | null
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface RefundStats {
  pending: number
  approved: number
  rejected: number
  completed: number
  totalPendingAmount: number
  totalCompletedAmount: number
  avgProcessingTime: number // in hours
}

export interface RefundListParams {
  status?: RefundStatus
  search?: string
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'amount' | 'status'
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

export interface ApproveRefundInput {
  note?: string
}

export interface RejectRefundInput {
  reason: string
}

export interface ProcessRefundInput {
  transactionReference?: string
  note?: string
}

export interface BatchActionResult {
  success: string[]
  failed: Array<{ id: string; error: string }>
}

// API functions
export const refundsApi = {
  // List refund requests
  listRefunds: (festivalId: string, params?: RefundListParams) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder)

    const query = searchParams.toString()
    return api.get<PaginatedResponse<RefundRequest>>(
      `/api/v1/festivals/${festivalId}/refunds${query ? `?${query}` : ''}`
    )
  },

  // Get single refund request
  getRefund: (festivalId: string, refundId: string) =>
    api.get<RefundRequest>(`/api/v1/festivals/${festivalId}/refunds/${refundId}`),

  // Get refund history
  getRefundHistory: (festivalId: string, refundId: string) =>
    api.get<RefundHistoryEntry[]>(`/api/v1/festivals/${festivalId}/refunds/${refundId}/history`),

  // Get refund stats
  getRefundStats: (festivalId: string) =>
    api.get<RefundStats>(`/api/v1/festivals/${festivalId}/refunds/stats`),

  // Approve refund request
  approveRefund: (festivalId: string, refundId: string, data?: ApproveRefundInput) =>
    api.post<RefundRequest>(`/api/v1/festivals/${festivalId}/refunds/${refundId}/approve`, data),

  // Reject refund request
  rejectRefund: (festivalId: string, refundId: string, data: RejectRefundInput) =>
    api.post<RefundRequest>(`/api/v1/festivals/${festivalId}/refunds/${refundId}/reject`, data),

  // Process refund payment
  processRefund: (festivalId: string, refundId: string, data?: ProcessRefundInput) =>
    api.post<RefundRequest>(`/api/v1/festivals/${festivalId}/refunds/${refundId}/process`, data),

  // Batch approve refunds
  batchApprove: (festivalId: string, refundIds: string[], note?: string) =>
    api.post<BatchActionResult>(`/api/v1/festivals/${festivalId}/refunds/batch-approve`, {
      refundIds,
      note,
    }),

  // Batch reject refunds
  batchReject: (festivalId: string, refundIds: string[], reason: string) =>
    api.post<BatchActionResult>(`/api/v1/festivals/${festivalId}/refunds/batch-reject`, {
      refundIds,
      reason,
    }),

  // Export refunds
  exportRefunds: (festivalId: string, params?: RefundListParams) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    searchParams.set('format', 'csv')

    const query = searchParams.toString()
    return api.get<Blob>(`/api/v1/festivals/${festivalId}/refunds/export?${query}`)
  },
}
