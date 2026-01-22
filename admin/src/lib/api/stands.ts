import { api } from '../api'

// Types
export interface Stand {
  id: string
  festivalId: string
  name: string
  description?: string
  category: StandCategory
  location?: {
    lat: number
    lng: number
    zone?: string
  }
  settings: StandSettings
  imageUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type StandCategory = 'BAR' | 'FOOD' | 'MERCHANDISE' | 'RECHARGE' | 'INFO' | 'MEDICAL' | 'SECURITY'

export interface StandSettings {
  acceptsOnlyTokens: boolean
  requiresPin: boolean
  allowsNegativeBalance: boolean
  maxTransactionAmount?: number
}

export interface StandStaff {
  id: string
  userId: string
  standId: string
  role: 'MANAGER' | 'OPERATOR'
  user: {
    id: string
    name: string
    email: string
  }
  assignedAt: string
}

export interface StandProduct {
  id: string
  standId: string
  name: string
  description?: string
  price: number
  vatRate: number
  category?: string
  imageUrl?: string
  stock?: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface StandTransaction {
  id: string
  standId: string
  type: 'PAYMENT' | 'REFUND' | 'CANCEL'
  amount: number
  operatorId: string
  operator?: {
    id: string
    name: string
  }
  items?: {
    productId: string
    productName: string
    quantity: number
    price: number
  }[]
  createdAt: string
}

export interface StandStats {
  totalRevenue: number
  transactionCount: number
  averageTransaction: number
  topProducts: {
    productId: string
    productName: string
    quantity: number
    revenue: number
  }[]
  hourlyRevenue: {
    hour: string
    revenue: number
    transactions: number
  }[]
}

// Request types
export interface CreateStandRequest {
  name: string
  description?: string
  category: StandCategory
  location?: {
    lat: number
    lng: number
    zone?: string
  }
  settings: StandSettings
  imageUrl?: string
}

export interface UpdateStandRequest {
  name?: string
  description?: string
  category?: StandCategory
  location?: {
    lat: number
    lng: number
    zone?: string
  }
  settings?: Partial<StandSettings>
  imageUrl?: string
  isActive?: boolean
}

export interface CreateProductRequest {
  name: string
  description?: string
  price: number
  vatRate: number
  category?: string
  imageUrl?: string
  stock?: number
}

export interface UpdateProductRequest {
  name?: string
  description?: string
  price?: number
  vatRate?: number
  category?: string
  imageUrl?: string
  stock?: number
  isActive?: boolean
}

export interface BulkImportProductsRequest {
  products: CreateProductRequest[]
}

export interface AssignStaffRequest {
  userId: string
  role: 'MANAGER' | 'OPERATOR'
}

// Response types
export interface StandListResponse {
  stands: Stand[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

export interface ProductListResponse {
  products: StandProduct[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

export interface TransactionListResponse {
  transactions: StandTransaction[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

// API functions
export const standsApi = {
  // Stand CRUD
  list: (festivalId: string, params?: { category?: StandCategory; isActive?: boolean; page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.category) searchParams.set('category', params.category)
    if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive))
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('perPage', String(params.perPage))
    const query = searchParams.toString()
    return api.get<StandListResponse>(`/api/v1/festivals/${festivalId}/stands${query ? `?${query}` : ''}`)
  },

  get: (festivalId: string, standId: string) =>
    api.get<Stand>(`/api/v1/festivals/${festivalId}/stands/${standId}`),

  create: (festivalId: string, data: CreateStandRequest) =>
    api.post<Stand>(`/api/v1/festivals/${festivalId}/stands`, data),

  update: (festivalId: string, standId: string, data: UpdateStandRequest) =>
    api.patch<Stand>(`/api/v1/festivals/${festivalId}/stands/${standId}`, data),

  delete: (festivalId: string, standId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/stands/${standId}`),

  // Staff management
  listStaff: (festivalId: string, standId: string) =>
    api.get<{ staff: StandStaff[] }>(`/api/v1/festivals/${festivalId}/stands/${standId}/staff`),

  assignStaff: (festivalId: string, standId: string, data: AssignStaffRequest) =>
    api.post<StandStaff>(`/api/v1/festivals/${festivalId}/stands/${standId}/staff`, data),

  removeStaff: (festivalId: string, standId: string, staffId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/stands/${standId}/staff/${staffId}`),

  // Products
  listProducts: (festivalId: string, standId: string, params?: { category?: string; isActive?: boolean; page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.category) searchParams.set('category', params.category)
    if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive))
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('perPage', String(params.perPage))
    const query = searchParams.toString()
    return api.get<ProductListResponse>(`/api/v1/festivals/${festivalId}/stands/${standId}/products${query ? `?${query}` : ''}`)
  },

  getProduct: (festivalId: string, standId: string, productId: string) =>
    api.get<StandProduct>(`/api/v1/festivals/${festivalId}/stands/${standId}/products/${productId}`),

  createProduct: (festivalId: string, standId: string, data: CreateProductRequest) =>
    api.post<StandProduct>(`/api/v1/festivals/${festivalId}/stands/${standId}/products`, data),

  updateProduct: (festivalId: string, standId: string, productId: string, data: UpdateProductRequest) =>
    api.patch<StandProduct>(`/api/v1/festivals/${festivalId}/stands/${standId}/products/${productId}`, data),

  deleteProduct: (festivalId: string, standId: string, productId: string) =>
    api.delete<void>(`/api/v1/festivals/${festivalId}/stands/${standId}/products/${productId}`),

  bulkImportProducts: (festivalId: string, standId: string, data: BulkImportProductsRequest) =>
    api.post<{ imported: number; products: StandProduct[] }>(`/api/v1/festivals/${festivalId}/stands/${standId}/products/bulk`, data),

  // Transactions & Stats
  listTransactions: (festivalId: string, standId: string, params?: { startDate?: string; endDate?: string; page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('perPage', String(params.perPage))
    const query = searchParams.toString()
    return api.get<TransactionListResponse>(`/api/v1/festivals/${festivalId}/stands/${standId}/transactions${query ? `?${query}` : ''}`)
  },

  getStats: (festivalId: string, standId: string, params?: { startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    const query = searchParams.toString()
    return api.get<StandStats>(`/api/v1/festivals/${festivalId}/stands/${standId}/stats${query ? `?${query}` : ''}`)
  },
}
