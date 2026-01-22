import { api } from '@/lib/api'
import type { Activity } from '@/components/dashboard/ActivityFeed'
import type { RevenueDataPoint } from '@/components/dashboard/RevenueChart'

// Types for stats responses
export interface OverviewStats {
  totalRevenue: number
  revenueChange: number
  ticketsSold: number
  ticketsChange: number
  activeWallets: number
  walletsChange: number
  todayTransactions: number
  transactionsChange: number
}

export interface FestivalStats {
  festivalId: string
  totalRevenue: number
  revenueChange: number
  ticketsSold: number
  ticketsUsed: number
  activeWallets: number
  averageWalletBalance: number
  todayTransactions: number
  transactionVolume: number
  topSellingProducts: TopProduct[]
  staffActivity: StaffActivityItem[]
  alerts: Alert[]
}

export interface TopProduct {
  id: string
  name: string
  quantity: number
  revenue: number
  standName: string
}

export interface StaffActivityItem {
  id: string
  name: string
  role: string
  checkinTime: string
  transactionCount: number
  totalSales: number
}

export interface Alert {
  id: string
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
  timestamp: string
  actionUrl?: string
}

export interface Festival {
  id: string
  name: string
  slug: string
  startDate: string
  endDate: string
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
}

// API functions
export const statsApi = {
  // Get overview stats for all festivals the user has access to
  getOverviewStats: () => api.get<OverviewStats>('/api/admin/stats/overview'),

  // Get detailed stats for a specific festival
  getFestivalStats: (festivalId: string) =>
    api.get<FestivalStats>(`/api/admin/festivals/${festivalId}/stats`),

  // Get revenue data for chart
  getRevenueData: (festivalId: string, days = 7) =>
    api.get<RevenueDataPoint[]>(
      `/api/admin/festivals/${festivalId}/stats/revenue?days=${days}`
    ),

  // Get all revenue data across festivals
  getAllRevenueData: (days = 7) =>
    api.get<RevenueDataPoint[]>(`/api/admin/stats/revenue?days=${days}`),

  // Get recent activities
  getRecentActivities: (festivalId?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (festivalId) params.set('festivalId', festivalId)
    return api.get<Activity[]>(`/api/admin/activities?${params}`)
  },

  // Get list of festivals user has access to
  getFestivals: () => api.get<Festival[]>('/api/admin/festivals'),

  // Get top selling products for a festival
  getTopProducts: (festivalId: string, limit = 10) =>
    api.get<TopProduct[]>(
      `/api/admin/festivals/${festivalId}/stats/top-products?limit=${limit}`
    ),

  // Get staff activity for a festival
  getStaffActivity: (festivalId: string) =>
    api.get<StaffActivityItem[]>(
      `/api/admin/festivals/${festivalId}/stats/staff-activity`
    ),

  // Get alerts for a festival
  getAlerts: (festivalId: string) =>
    api.get<Alert[]>(`/api/admin/festivals/${festivalId}/alerts`),

  // Real-time stats subscription endpoint (for WebSocket or SSE)
  getRealtimeStatsUrl: (festivalId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/admin/festivals/${festivalId}/stats/realtime`,
}

// React Query hooks helpers
export const statsQueryKeys = {
  all: ['stats'] as const,
  overview: () => [...statsQueryKeys.all, 'overview'] as const,
  festival: (id: string) => [...statsQueryKeys.all, 'festival', id] as const,
  revenue: (festivalId: string, days: number) =>
    [...statsQueryKeys.all, 'revenue', festivalId, days] as const,
  allRevenue: (days: number) => [...statsQueryKeys.all, 'revenue', 'all', days] as const,
  activities: (festivalId?: string) =>
    [...statsQueryKeys.all, 'activities', festivalId] as const,
  festivals: () => [...statsQueryKeys.all, 'festivals'] as const,
  topProducts: (festivalId: string) =>
    [...statsQueryKeys.all, 'topProducts', festivalId] as const,
  staffActivity: (festivalId: string) =>
    [...statsQueryKeys.all, 'staffActivity', festivalId] as const,
  alerts: (festivalId: string) =>
    [...statsQueryKeys.all, 'alerts', festivalId] as const,
}
