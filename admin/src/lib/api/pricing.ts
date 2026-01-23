import { api } from '../api'

// Types
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT'

export interface PricingRule {
  id: string
  standId: string
  productId?: string
  name: string
  description: string
  discountType: DiscountType
  discountValue: number
  startTime: string // HH:MM format
  endTime: string   // HH:MM format
  daysOfWeek: number[] // 0=Sunday, 1=Monday, ..., 6=Saturday
  priority: number
  active: boolean
  isCurrentlyActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CalculatedPrice {
  productId: string
  productName: string
  originalPrice: number
  discountedPrice: number
  discount: number
  appliedRule?: PricingRule
}

export interface CurrentPricesResponse {
  standId: string
  prices: CalculatedPrice[]
  activeRules: PricingRule[]
  calculatedAt: string
}

// Request types
export interface CreatePricingRuleRequest {
  productId?: string
  name: string
  description?: string
  discountType: DiscountType
  discountValue: number
  startTime: string
  endTime: string
  daysOfWeek: number[]
  priority?: number
}

export interface UpdatePricingRuleRequest {
  name?: string
  description?: string
  discountType?: DiscountType
  discountValue?: number
  startTime?: string
  endTime?: string
  daysOfWeek?: number[]
  priority?: number
  active?: boolean
}

// Response types
export interface PricingRuleListResponse {
  data: PricingRule[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

// Day names helper
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Format helpers
export function formatDiscount(rule: PricingRule): string {
  if (rule.discountType === 'PERCENTAGE') {
    return `${rule.discountValue}% off`
  }
  return `${(rule.discountValue / 100).toFixed(2)} off`
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`
}

export function formatDaysOfWeek(days: number[]): string {
  if (days.length === 7) {
    return 'Every day'
  }
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) {
    return 'Weekdays'
  }
  if (days.length === 2 && days.includes(0) && days.includes(6)) {
    return 'Weekends'
  }
  return days.map((d) => DAY_NAMES_SHORT[d]).join(', ')
}

// API functions
export const pricingApi = {
  // List pricing rules for a stand
  list: (festivalId: string, standId: string, params?: { page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('per_page', String(params.perPage))
    const query = searchParams.toString()
    return api.get<PricingRule[]>(
      `/api/v1/festivals/${festivalId}/stands/${standId}/pricing-rules${query ? `?${query}` : ''}`
    )
  },

  // Get a single pricing rule
  get: (ruleId: string) => api.get<PricingRule>(`/api/v1/pricing-rules/${ruleId}`),

  // Create a new pricing rule
  create: (festivalId: string, standId: string, data: CreatePricingRuleRequest) =>
    api.post<PricingRule>(`/api/v1/festivals/${festivalId}/stands/${standId}/pricing-rules`, data),

  // Update a pricing rule
  update: (ruleId: string, data: UpdatePricingRuleRequest) =>
    api.patch<PricingRule>(`/api/v1/pricing-rules/${ruleId}`, data),

  // Delete a pricing rule
  delete: (ruleId: string) => api.delete<void>(`/api/v1/pricing-rules/${ruleId}`),

  // Get current prices with discounts applied
  getCurrentPrices: (festivalId: string, standId: string) =>
    api.get<CurrentPricesResponse>(`/api/v1/festivals/${festivalId}/stands/${standId}/current-prices`),

  // Toggle rule active state
  toggleActive: (ruleId: string, active: boolean) =>
    api.patch<PricingRule>(`/api/v1/pricing-rules/${ruleId}`, { active }),
}
