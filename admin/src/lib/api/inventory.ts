import { api } from '../api'

// Types
export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'LOSS' | 'RETURN'
export type AlertType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVER_STOCK'
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
export type CountStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface InventoryItem {
  id: string
  productId: string
  productName?: string
  productSku?: string
  standId: string
  standName?: string
  festivalId: string
  quantity: number
  minThreshold: number
  maxCapacity?: number
  isLowStock: boolean
  isOutOfStock: boolean
  lastRestockAt?: string
  lastCountAt?: string
  createdAt: string
  updatedAt: string
}

export interface StockMovement {
  id: string
  inventoryItemId: string
  productId: string
  productName?: string
  standId: string
  standName?: string
  type: MovementType
  quantity: number
  previousQty: number
  newQty: number
  reason?: string
  reference?: string
  performedBy: string
  performedByName: string
  createdAt: string
}

export interface StockAlert {
  id: string
  inventoryItemId: string
  productId: string
  productName?: string
  standId: string
  standName?: string
  type: AlertType
  status: AlertStatus
  currentQty: number
  thresholdQty: number
  message: string
  acknowledgedBy?: string
  acknowledgedAt?: string
  resolvedAt?: string
  createdAt: string
}

export interface InventoryCount {
  id: string
  standId: string
  standName?: string
  festivalId: string
  status: CountStatus
  startedAt?: string
  completedAt?: string
  notes?: string
  itemCount: number
  countedCount: number
  varianceCount: number
  createdAt: string
}

export interface InventoryCountItem {
  id: string
  countId: string
  inventoryItemId: string
  productId: string
  productName?: string
  productSku?: string
  expectedQty: number
  countedQty?: number
  variance?: number
  notes?: string
  countedAt?: string
  createdAt: string
}

export interface StockSummary {
  totalItems: number
  totalQuantity: number
  lowStockCount: number
  outOfStockCount: number
  activeAlerts: number
}

// Request types
export interface CreateInventoryItemRequest {
  productId: string
  standId: string
  festivalId: string
  quantity: number
  minThreshold: number
  maxCapacity?: number
}

export interface UpdateInventoryItemRequest {
  minThreshold?: number
  maxCapacity?: number
}

export interface AdjustStockRequest {
  productId: string
  standId: string
  delta: number
  type: MovementType
  reason?: string
  reference?: string
}

export interface RecordSaleRequest {
  productId: string
  standId: string
  quantity: number
  orderId?: string
}

export interface CreateCountRequest {
  standId: string
  festivalId: string
  notes?: string
}

export interface CountItemRequest {
  inventoryItemId: string
  countedQty: number
  notes?: string
}

export interface ReconcileCountRequest {
  items: CountItemRequest[]
}

// Response types
export interface InventoryItemListResponse {
  data: InventoryItem[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

export interface StockMovementListResponse {
  data: StockMovement[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

export interface StockAlertListResponse {
  data: StockAlert[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

export interface InventoryCountListResponse {
  data: InventoryCount[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

// API functions
export const inventoryApi = {
  // Inventory Items
  listItems: (festivalId: string, params?: { page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams()
    searchParams.set('festivalId', festivalId)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('per_page', String(params.perPage))
    return api.get<InventoryItemListResponse>(`/api/v1/inventory/items?${searchParams.toString()}`)
  },

  listStandItems: (standId: string, params?: { page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('per_page', String(params.perPage))
    const query = searchParams.toString()
    return api.get<InventoryItemListResponse>(`/api/v1/stands/${standId}/inventory${query ? `?${query}` : ''}`)
  },

  getItem: (itemId: string) =>
    api.get<{ data: InventoryItem }>(`/api/v1/inventory/items/${itemId}`),

  createItem: (data: CreateInventoryItemRequest) =>
    api.post<{ data: InventoryItem }>('/api/v1/inventory/items', data),

  updateItem: (itemId: string, data: UpdateInventoryItemRequest) =>
    api.patch<{ data: InventoryItem }>(`/api/v1/inventory/items/${itemId}`, data),

  deleteItem: (itemId: string) =>
    api.delete<void>(`/api/v1/inventory/items/${itemId}`),

  // Stock Operations
  getStock: (productId: string, standId: string) =>
    api.get<{ productId: string; standId: string; quantity: number }>(`/api/v1/inventory/stock/${productId}/${standId}`),

  adjustStock: (data: AdjustStockRequest) =>
    api.post<{ data: InventoryItem }>('/api/v1/inventory/adjust', data),

  recordSale: (data: RecordSaleRequest) =>
    api.post<{ success: boolean }>('/api/v1/inventory/sale', data),

  // Movements
  listMovements: (festivalId: string, params?: { page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams()
    searchParams.set('festivalId', festivalId)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('per_page', String(params.perPage))
    return api.get<StockMovementListResponse>(`/api/v1/inventory/movements?${searchParams.toString()}`)
  },

  listStandMovements: (standId: string, params?: { page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('per_page', String(params.perPage))
    const query = searchParams.toString()
    return api.get<StockMovementListResponse>(`/api/v1/stands/${standId}/inventory/movements${query ? `?${query}` : ''}`)
  },

  // Alerts
  listAlerts: (festivalId: string, params?: { status?: AlertStatus; page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams()
    searchParams.set('festivalId', festivalId)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('per_page', String(params.perPage))
    return api.get<StockAlertListResponse>(`/api/v1/inventory/alerts?${searchParams.toString()}`)
  },

  listStandAlerts: (standId: string, params?: { status?: AlertStatus }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    const query = searchParams.toString()
    return api.get<{ data: StockAlert[] }>(`/api/v1/stands/${standId}/inventory/alerts${query ? `?${query}` : ''}`)
  },

  acknowledgeAlert: (alertId: string) =>
    api.post<{ data: StockAlert }>(`/api/v1/inventory/alerts/${alertId}/acknowledge`),

  // Inventory Counts
  listCounts: (festivalId: string, params?: { page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams()
    searchParams.set('festivalId', festivalId)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('per_page', String(params.perPage))
    return api.get<InventoryCountListResponse>(`/api/v1/inventory/counts?${searchParams.toString()}`)
  },

  getCount: (countId: string) =>
    api.get<{ data: InventoryCount }>(`/api/v1/inventory/counts/${countId}`),

  getCountItems: (countId: string) =>
    api.get<{ data: InventoryCountItem[] }>(`/api/v1/inventory/counts/${countId}/items`),

  createCount: (data: CreateCountRequest) =>
    api.post<{ data: InventoryCount }>('/api/v1/inventory/counts', data),

  recordCountItem: (countId: string, data: { itemId: string; countedQty: number; notes?: string }) =>
    api.post<{ data: InventoryCountItem }>(`/api/v1/inventory/counts/${countId}/record`, data),

  reconcileCount: (countId: string, data: ReconcileCountRequest) =>
    api.post<{ data: InventoryCount }>(`/api/v1/inventory/counts/${countId}/reconcile`, data),

  cancelCount: (countId: string) =>
    api.post<{ data: InventoryCount }>(`/api/v1/inventory/counts/${countId}/cancel`),

  // Summary
  getSummary: (festivalId: string) => {
    const searchParams = new URLSearchParams()
    searchParams.set('festivalId', festivalId)
    return api.get<{ data: StockSummary }>(`/api/v1/inventory/summary?${searchParams.toString()}`)
  },

  getStandSummary: (standId: string) =>
    api.get<{ data: StockSummary }>(`/api/v1/stands/${standId}/inventory/summary`),
}
