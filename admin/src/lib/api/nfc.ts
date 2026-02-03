import { api } from '../api'

// Types
export type NFCTagStatus = 'UNASSIGNED' | 'ACTIVE' | 'BLOCKED' | 'LOST'

export interface NFCTag {
  id: string
  festivalId: string
  uid: string
  status: NFCTagStatus
  walletId: string | null
  walletBalance: number | null
  holderName: string | null
  holderEmail: string | null
  ticketId: string | null
  ticketTypeName: string | null
  activatedAt: string | null
  activatedBy: string | null
  blockedAt: string | null
  blockedBy: string | null
  blockedReason: string | null
  lastUsedAt: string | null
  transactionCount: number
  createdAt: string
  updatedAt: string
}

export interface NFCTagStats {
  total: number
  unassigned: number
  active: number
  blocked: number
  lost: number
  totalTransactions: number
  totalVolume: number
}

export interface NFCTransaction {
  id: string
  tagId: string
  walletId: string
  type: 'TOPUP' | 'PAYMENT' | 'REFUND' | 'TRANSFER_IN' | 'TRANSFER_OUT'
  amount: number
  balanceBefore: number
  balanceAfter: number
  standId: string | null
  standName: string | null
  description: string | null
  createdAt: string
}

export interface NFCTagListParams {
  status?: NFCTagStatus
  search?: string
  page?: number
  limit?: number
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

export interface ActivateTagInput {
  walletId: string
  ticketId?: string
}

export interface BlockTagInput {
  reason: string
}

export interface TransferTagInput {
  newWalletId: string
  transferBalance: boolean
}

export interface ImportTagsInput {
  uids: string[]
}

export interface ImportResult {
  imported: number
  duplicates: number
  errors: string[]
}

// API functions
export const nfcApi = {
  // List NFC tags with filtering
  listTags: (festivalId: string, params?: NFCTagListParams) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return api.get<PaginatedResponse<NFCTag>>(
      `/api/v1/festivals/${festivalId}/nfc-tags${query ? `?${query}` : ''}`
    )
  },

  // Get a single NFC tag
  getTag: (festivalId: string, tagId: string) =>
    api.get<NFCTag>(`/api/v1/festivals/${festivalId}/nfc-tags/${tagId}`),

  // Get NFC tag stats
  getStats: (festivalId: string) =>
    api.get<NFCTagStats>(`/api/v1/festivals/${festivalId}/nfc-tags/stats`),

  // Activate a tag (assign to wallet)
  activateTag: (festivalId: string, tagId: string, data: ActivateTagInput) =>
    api.post<NFCTag>(`/api/v1/festivals/${festivalId}/nfc-tags/${tagId}/activate`, data),

  // Deactivate a tag (unassign from wallet)
  deactivateTag: (festivalId: string, tagId: string) =>
    api.post<NFCTag>(`/api/v1/festivals/${festivalId}/nfc-tags/${tagId}/deactivate`),

  // Block a tag
  blockTag: (festivalId: string, tagId: string, data: BlockTagInput) =>
    api.post<NFCTag>(`/api/v1/festivals/${festivalId}/nfc-tags/${tagId}/block`, data),

  // Unblock a tag
  unblockTag: (festivalId: string, tagId: string) =>
    api.post<NFCTag>(`/api/v1/festivals/${festivalId}/nfc-tags/${tagId}/unblock`),

  // Mark tag as lost
  markAsLost: (festivalId: string, tagId: string) =>
    api.post<NFCTag>(`/api/v1/festivals/${festivalId}/nfc-tags/${tagId}/lost`),

  // Transfer tag to new wallet
  transferTag: (festivalId: string, tagId: string, data: TransferTagInput) =>
    api.post<NFCTag>(`/api/v1/festivals/${festivalId}/nfc-tags/${tagId}/transfer`, data),

  // Get transaction history for a tag
  getTransactions: (festivalId: string, tagId: string, params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return api.get<PaginatedResponse<NFCTransaction>>(
      `/api/v1/festivals/${festivalId}/nfc-tags/${tagId}/transactions${query ? `?${query}` : ''}`
    )
  },

  // Batch operations
  batchActivate: (festivalId: string, tagIds: string[], walletIds: string[]) =>
    api.post<{ success: number; failed: number }>(`/api/v1/festivals/${festivalId}/nfc-tags/batch/activate`, {
      tags: tagIds.map((tagId, index) => ({ tagId, walletId: walletIds[index] })),
    }),

  batchDeactivate: (festivalId: string, tagIds: string[]) =>
    api.post<{ success: number; failed: number }>(`/api/v1/festivals/${festivalId}/nfc-tags/batch/deactivate`, {
      tagIds,
    }),

  batchBlock: (festivalId: string, tagIds: string[], reason: string) =>
    api.post<{ success: number; failed: number }>(`/api/v1/festivals/${festivalId}/nfc-tags/batch/block`, {
      tagIds,
      reason,
    }),

  // Import tags from CSV
  importTags: (festivalId: string, data: ImportTagsInput) =>
    api.post<ImportResult>(`/api/v1/festivals/${festivalId}/nfc-tags/import`, data),
}
