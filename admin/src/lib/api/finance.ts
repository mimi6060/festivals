import { api } from '@/lib/api'

// Types for finance API
export interface RevenueStats {
  totalRevenue: number
  totalFees: number // Platform fees (1%)
  netRevenue: number
  totalTransactions: number
  averageTransactionValue: number
  revenueByDay: DailyRevenue[]
  revenueByWeek: WeeklyRevenue[]
  revenueByMonth: MonthlyRevenue[]
  topStands: StandRevenue[]
  topProducts: ProductRevenue[]
}

export interface DailyRevenue {
  date: string
  revenue: number
  transactions: number
  fees: number
  refunds: number
}

export interface WeeklyRevenue {
  weekStart: string
  weekEnd: string
  revenue: number
  transactions: number
  fees: number
  refunds: number
}

export interface MonthlyRevenue {
  month: string
  year: number
  revenue: number
  transactions: number
  fees: number
  refunds: number
}

export interface StandRevenue {
  standId: string
  standName: string
  revenue: number
  transactions: number
  percentage: number
}

export interface ProductRevenue {
  productId: string
  productName: string
  standName: string
  quantity: number
  revenue: number
}

export interface Transaction {
  id: string
  festivalId: string
  walletId: string
  userId?: string
  userName?: string
  type: 'RECHARGE' | 'PAYMENT' | 'REFUND' | 'CANCEL'
  amount: number
  balanceAfter: number
  standId?: string
  standName?: string
  operatorId?: string
  operatorName?: string
  reference?: string
  productDetails?: TransactionProduct[]
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED'
  idempotencyKey: string
  offlineCreated: boolean
  syncedAt?: string
  createdAt: string
}

export interface TransactionProduct {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface TransactionFilters {
  startDate?: string
  endDate?: string
  type?: 'RECHARGE' | 'PAYMENT' | 'REFUND' | 'CANCEL'
  status?: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED'
  standId?: string
  minAmount?: number
  maxAmount?: number
  search?: string
  page?: number
  perPage?: number
  sortBy?: 'createdAt' | 'amount'
  sortOrder?: 'asc' | 'desc'
}

export interface TransactionsResponse {
  transactions: Transaction[]
  meta: {
    total: number
    page: number
    perPage: number
    totalPages: number
  }
}

export interface Payout {
  id: string
  festivalId: string
  amount: number
  fees: number
  netAmount: number
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  stripePayoutId?: string
  stripeBankAccountId?: string
  failureReason?: string
  expectedArrivalDate?: string
  completedAt?: string
  createdAt: string
}

export interface PayoutFilters {
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  startDate?: string
  endDate?: string
  page?: number
  perPage?: number
}

export interface PayoutsResponse {
  payouts: Payout[]
  meta: {
    total: number
    page: number
    perPage: number
    totalPages: number
  }
}

export interface StripeAccountStatus {
  accountId: string
  status: 'PENDING' | 'ACTIVE' | 'RESTRICTED' | 'DISABLED'
  payoutsEnabled: boolean
  chargesEnabled: boolean
  detailsSubmitted: boolean
  requiresAction: boolean
  requirements?: string[]
  dashboardUrl?: string
  defaultCurrency: string
  availableBalance: number
  pendingBalance: number
  bankAccounts: BankAccount[]
}

export interface BankAccount {
  id: string
  bankName: string
  last4: string
  currency: string
  isDefault: boolean
}

export interface PayoutSummary {
  pendingAmount: number
  nextPayoutDate?: string
  totalPaidOut: number
  totalFeesPaid: number
  lastPayoutDate?: string
  lastPayoutAmount?: number
}

export interface ExportOptions {
  format: 'csv' | 'xlsx'
  startDate?: string
  endDate?: string
  type?: 'RECHARGE' | 'PAYMENT' | 'REFUND' | 'CANCEL'
  standId?: string
  includeProducts?: boolean
}

// API functions
export const financeApi = {
  // Revenue stats
  getRevenueStats: (festivalId: string, period: 'day' | 'week' | 'month' | 'all' = 'all') =>
    api.get<RevenueStats>(`/api/admin/festivals/${festivalId}/finance/revenue?period=${period}`),

  getDailyRevenue: (festivalId: string, days = 30) =>
    api.get<DailyRevenue[]>(`/api/admin/festivals/${festivalId}/finance/revenue/daily?days=${days}`),

  getWeeklyRevenue: (festivalId: string, weeks = 12) =>
    api.get<WeeklyRevenue[]>(`/api/admin/festivals/${festivalId}/finance/revenue/weekly?weeks=${weeks}`),

  getMonthlyRevenue: (festivalId: string, months = 12) =>
    api.get<MonthlyRevenue[]>(`/api/admin/festivals/${festivalId}/finance/revenue/monthly?months=${months}`),

  // Transactions
  getTransactions: (festivalId: string, filters?: TransactionFilters) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.set(key, String(value))
        }
      })
    }
    return api.get<TransactionsResponse>(
      `/api/admin/festivals/${festivalId}/finance/transactions?${params}`
    )
  },

  getTransaction: (festivalId: string, transactionId: string) =>
    api.get<Transaction>(`/api/admin/festivals/${festivalId}/finance/transactions/${transactionId}`),

  refundTransaction: (festivalId: string, transactionId: string, reason?: string) =>
    api.post<Transaction>(
      `/api/admin/festivals/${festivalId}/finance/transactions/${transactionId}/refund`,
      { reason }
    ),

  // Export
  exportTransactions: (festivalId: string, options: ExportOptions) => {
    const params = new URLSearchParams()
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value))
      }
    })
    return api.get<{ downloadUrl: string }>(
      `/api/admin/festivals/${festivalId}/finance/transactions/export?${params}`
    )
  },

  // Payouts
  getPayouts: (festivalId: string, filters?: PayoutFilters) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.set(key, String(value))
        }
      })
    }
    return api.get<PayoutsResponse>(`/api/admin/festivals/${festivalId}/finance/payouts?${params}`)
  },

  getPayout: (festivalId: string, payoutId: string) =>
    api.get<Payout>(`/api/admin/festivals/${festivalId}/finance/payouts/${payoutId}`),

  getPayoutSummary: (festivalId: string) =>
    api.get<PayoutSummary>(`/api/admin/festivals/${festivalId}/finance/payouts/summary`),

  triggerPayout: (festivalId: string, amount?: number) =>
    api.post<Payout>(`/api/admin/festivals/${festivalId}/finance/payouts/trigger`, { amount }),

  // Stripe Account
  getStripeAccountStatus: (festivalId: string) =>
    api.get<StripeAccountStatus>(`/api/admin/festivals/${festivalId}/finance/stripe/status`),

  createStripeAccountLink: (festivalId: string) =>
    api.post<{ url: string }>(`/api/admin/festivals/${festivalId}/finance/stripe/account-link`),

  refreshStripeAccount: (festivalId: string) =>
    api.post<StripeAccountStatus>(`/api/admin/festivals/${festivalId}/finance/stripe/refresh`),
}

// Query keys for React Query
export const financeQueryKeys = {
  all: ['finance'] as const,
  revenue: (festivalId: string) => [...financeQueryKeys.all, 'revenue', festivalId] as const,
  revenueStats: (festivalId: string, period: string) =>
    [...financeQueryKeys.revenue(festivalId), 'stats', period] as const,
  dailyRevenue: (festivalId: string, days: number) =>
    [...financeQueryKeys.revenue(festivalId), 'daily', days] as const,
  weeklyRevenue: (festivalId: string, weeks: number) =>
    [...financeQueryKeys.revenue(festivalId), 'weekly', weeks] as const,
  monthlyRevenue: (festivalId: string, months: number) =>
    [...financeQueryKeys.revenue(festivalId), 'monthly', months] as const,
  transactions: (festivalId: string, filters?: TransactionFilters) =>
    [...financeQueryKeys.all, 'transactions', festivalId, filters] as const,
  transaction: (festivalId: string, id: string) =>
    [...financeQueryKeys.all, 'transaction', festivalId, id] as const,
  payouts: (festivalId: string, filters?: PayoutFilters) =>
    [...financeQueryKeys.all, 'payouts', festivalId, filters] as const,
  payout: (festivalId: string, id: string) =>
    [...financeQueryKeys.all, 'payout', festivalId, id] as const,
  payoutSummary: (festivalId: string) =>
    [...financeQueryKeys.all, 'payoutSummary', festivalId] as const,
  stripeStatus: (festivalId: string) =>
    [...financeQueryKeys.all, 'stripeStatus', festivalId] as const,
}

// Utility functions
export const PLATFORM_FEE_RATE = 0.01 // 1%

export function calculatePlatformFee(amount: number): number {
  return Math.round(amount * PLATFORM_FEE_RATE * 100) / 100
}

export function calculateNetAmount(grossAmount: number): number {
  return grossAmount - calculatePlatformFee(grossAmount)
}

export function getTransactionTypeLabel(type: Transaction['type']): string {
  const labels: Record<Transaction['type'], string> = {
    RECHARGE: 'Recharge',
    PAYMENT: 'Paiement',
    REFUND: 'Remboursement',
    CANCEL: 'Annulation',
  }
  return labels[type] || type
}

export function getTransactionStatusLabel(status: Transaction['status']): string {
  const labels: Record<Transaction['status'], string> = {
    COMPLETED: 'Termine',
    PENDING: 'En attente',
    FAILED: 'Echoue',
    REFUNDED: 'Rembourse',
  }
  return labels[status] || status
}

export function getPayoutStatusLabel(status: Payout['status']): string {
  const labels: Record<Payout['status'], string> = {
    PENDING: 'En attente',
    PROCESSING: 'En cours',
    COMPLETED: 'Termine',
    FAILED: 'Echoue',
  }
  return labels[status] || status
}
