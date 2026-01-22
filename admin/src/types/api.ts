// Festival types
export interface Festival {
  id: string
  name: string
  slug: string
  description?: string
  startDate: string
  endDate: string
  location: string
  timezone: string
  currencyName: string
  exchangeRate: number
  stripeAccountId?: string
  settings: Record<string, unknown>
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  createdAt: string
  updatedAt: string
}

// User types
export interface User {
  id: string
  auth0Id: string
  email: string
  name: string
  phone?: string
  roles: string[]
  parentId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Wallet types
export interface Wallet {
  id: string
  userId: string
  balance: number
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  walletId: string
  type: 'RECHARGE' | 'PAYMENT' | 'REFUND' | 'CANCEL'
  amount: number
  balanceAfter: number
  reference?: string
  standId?: string
  operatorId?: string
  idempotencyKey: string
  offlineCreated: boolean
  syncedAt?: string
  createdAt: string
}

// Ticket types
export interface Ticket {
  id: string
  userId?: string
  type: string
  qrCode: string
  status: 'VALID' | 'USED' | 'CANCELLED'
  options: Record<string, unknown>
  invitedBy?: string
  usedAt?: string
  usedBy?: string
  createdAt: string
}

// Stand types
export interface Stand {
  id: string
  name: string
  type: 'BAR' | 'FOOD' | 'MERCH' | 'RECHARGE'
  location?: { lat: number; lng: number; zone?: string }
  isActive: boolean
  createdAt: string
}

// Product types
export interface Product {
  id: string
  standId: string
  name: string
  price: number
  vatRate: number
  category?: string
  stock?: number
  isActive: boolean
  createdAt: string
}

// Lineup types
export interface Stage {
  id: string
  name: string
  capacity?: number
  location?: { lat: number; lng: number }
  createdAt: string
}

export interface Artist {
  id: string
  userId?: string
  name: string
  type?: 'DJ' | 'BAND' | 'SOLO'
  rider: Record<string, unknown>
  guestQuota: number
  createdAt: string
}

export interface Slot {
  id: string
  stageId: string
  artistId: string
  startTime: string
  endTime: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  createdAt: string
}

// Incident types
export interface Incident {
  id: string
  reporterId: string
  reporterType: 'STAFF' | 'FESTIVALIER'
  type: 'FIGHT' | 'THEFT' | 'MEDICAL' | 'SOS' | 'OTHER'
  location: { lat: number; lng: number }
  description?: string
  status: 'OPEN' | 'ASSIGNED' | 'RESOLVED'
  assignedTo?: string
  resolvedAt?: string
  resolutionNotes?: string
  isAbuse: boolean
  createdAt: string
}

// API Response types
export interface ApiResponse<T> {
  data: T
  meta?: {
    total: number
    page: number
    perPage: number
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}
