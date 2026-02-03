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

// ==================== Advanced Analytics Types ====================

export interface AnalyticsEvent {
  id: string
  festivalId: string
  userId?: string
  sessionId: string
  type: string
  category: string
  action: string
  label?: string
  value?: number
  data?: Record<string, unknown>
  deviceType?: string
  platform?: string
  timestamp: string
}

export interface FunnelStep {
  name: string
  eventType: string
  count: number
  percentage: number
}

export interface Funnel {
  id: string
  festivalId: string
  name: string
  description?: string
  steps: FunnelStep[]
  totalStarted: number
  totalCompleted: number
  conversionRate: number
  averageTime: number
  dropOffStep: number
  period: string
  createdAt: string
}

export interface CohortMetric {
  period: number
  value: number
  count: number
  retentionRate: number
}

export interface Cohort {
  id: string
  festivalId: string
  name: string
  groupBy: string
  metric: string
  period: string
  cohortDate: string
  cohortSize: number
  metrics: CohortMetric[]
  totalRevenue: number
  averageRevenue: number
  retentionCurve: number[]
  lifetimeValue: number
  createdAt: string
}

export interface CohortSummary {
  totalUsers: number
  averageRetention: number
  averageLifetimeValue: number
  bestCohort: string
  worstCohort: string
  trendDirection: 'improving' | 'declining' | 'stable'
}

export interface CohortAnalysis {
  festivalId: string
  name: string
  description?: string
  groupBy: string
  metric: string
  period: string
  cohorts: Cohort[]
  summary: CohortSummary
  generatedAt: string
}

export interface HeatmapPoint {
  x: number
  y: number
  value: number
  count: number
  label?: string
  locationId?: string
}

export interface Heatmap {
  id: string
  festivalId: string
  type: 'LOCATION' | 'TIME' | 'SPENDING' | 'TRAFFIC' | 'ENGAGEMENT'
  name: string
  description?: string
  points: HeatmapPoint[]
  minValue: number
  maxValue: number
  unit: string
  gridWidth?: number
  gridHeight?: number
  timeStart?: string
  timeEnd?: string
  generatedAt: string
}

export interface UserJourneyStep {
  timestamp: string
  eventType: string
  category: string
  action: string
  label?: string
  value?: number
  location?: string
  locationId?: string
  duration?: number
}

export interface UserJourney {
  userId: string
  festivalId: string
  sessionCount: number
  firstSeen: string
  lastSeen: string
  totalEvents: number
  totalSpent: number
  totalSpentDisplay: string
  steps: UserJourneyStep[]
  topLocations: string[]
  keyMoments: UserJourneyStep[]
  engagementScore: number
  customerType: 'new' | 'returning' | 'vip'
}

export interface PredictionFactor {
  name: string
  impact: number
  description: string
  category: string
}

export interface HistoricalPoint {
  date: string
  value: number
  label?: string
}

export interface Prediction {
  id: string
  festivalId: string
  type: 'REVENUE' | 'ATTENDANCE' | 'DEMAND' | 'CROWD_DENSITY' | 'WAIT_TIME'
  name: string
  description?: string
  predictedValue: number
  unit: string
  confidence: number
  confidenceLevel: 'low' | 'medium' | 'high'
  lowerBound: number
  upperBound: number
  predictedAt: string
  validUntil: string
  targetDate: string
  factors: PredictionFactor[]
  historical: HistoricalPoint[]
  trend: 'up' | 'down' | 'stable'
  percentChange: number
}

export interface Recommendation {
  id: string
  title: string
  description: string
  category: 'staffing' | 'inventory' | 'pricing' | 'operations'
  priority: 'low' | 'medium' | 'high' | 'critical'
  impact: string
  actionItems: string[]
  deadline?: string
  metrics?: Record<string, unknown>
}

export interface Predictions {
  festivalId: string
  revenue?: Prediction
  attendance?: Prediction
  peakHours: Prediction[]
  standDemand: Prediction[]
  recommendations: Recommendation[]
  generatedAt: string
}

export interface AnalyticsSummary {
  festivalId: string
  totalEvents: number
  uniqueUsers: number
  uniqueSessions: number
  averageSessionDuration: number
  bounceRate: number
  conversionRate: number
  engagementRate: number
  topEvents: Array<{ type: string; count: number; percentage: number }>
  topDevices: Array<{ device: string; count: number; percentage: number }>
  topPlatforms: Array<{ platform: string; count: number; percentage: number }>
  period: string
  generatedAt: string
}

export interface RealTimeMetrics {
  festivalId: string
  activeUsers: number
  eventsPerMinute: number
  transactionsNow: number
  revenueLastHour: number
  topStandNow: string
  queueAlerts: string[]
  timestamp: string
}

export interface AnalyticsExport {
  id: string
  festivalId: string
  format: 'CSV' | 'JSON' | 'EXCEL' | 'PDF'
  fileName: string
  fileUrl: string
  fileSize: number
  dataTypes: string[]
  startDate: string
  endDate: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  createdAt: string
  expiresAt: string
}

// API functions for advanced analytics
export const analyticsApi = {
  // Summary & real-time
  getSummary: (festivalId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    return api.get<AnalyticsSummary>(`/api/festivals/${festivalId}/analytics/summary?${params}`)
  },

  getRealTimeMetrics: (festivalId: string) =>
    api.get<RealTimeMetrics>(`/api/festivals/${festivalId}/analytics/realtime`),

  // Funnels
  getAllFunnels: (festivalId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    return api.get<Funnel[]>(`/api/festivals/${festivalId}/analytics/funnels?${params}`)
  },

  getFunnel: (festivalId: string, name: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    return api.get<Funnel>(`/api/festivals/${festivalId}/analytics/funnels/${name}?${params}`)
  },

  createFunnel: (festivalId: string, data: { name: string; description?: string; steps: string[] }) =>
    api.post<{ id: string }>(`/api/festivals/${festivalId}/analytics/funnels`, data),

  // Cohorts
  getCohortAnalysis: (
    festivalId: string,
    type?: string,
    period?: string,
    startDate?: string,
    endDate?: string
  ) => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (period) params.set('period', period)
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    return api.get<CohortAnalysis>(`/api/festivals/${festivalId}/analytics/cohorts?${params}`)
  },

  // Heatmaps
  getHeatmap: (
    festivalId: string,
    type: 'LOCATION' | 'TIME' | 'SPENDING' | 'TRAFFIC' | 'ENGAGEMENT',
    startDate?: string,
    endDate?: string
  ) => {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    return api.get<Heatmap>(`/api/festivals/${festivalId}/analytics/heatmaps/${type}?${params}`)
  },

  // User journey
  getUserJourney: (festivalId: string, userId: string) =>
    api.get<UserJourney>(`/api/festivals/${festivalId}/analytics/users/${userId}/journey`),

  // Predictions
  getPredictions: (festivalId: string) =>
    api.get<Predictions>(`/api/festivals/${festivalId}/analytics/predictions`),

  // Key metrics
  getConversionRate: (festivalId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    return api.get<{ conversionRate: number; unit: string; period: { start: string; end: string } }>(
      `/api/festivals/${festivalId}/analytics/metrics/conversion?${params}`
    )
  },

  getAverageSpend: (festivalId: string) =>
    api.get<{ averageSpend: number; averageSpendDisplay: string; unit: string }>(
      `/api/festivals/${festivalId}/analytics/metrics/avg-spend`
    ),

  getPeakTimes: (festivalId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    return api.get<Heatmap>(`/api/festivals/${festivalId}/analytics/metrics/peak-times?${params}`)
  },

  getRetentionRate: (festivalId: string) =>
    api.get<{ retentionRate: number; unit: string }>(
      `/api/festivals/${festivalId}/analytics/metrics/retention`
    ),

  // Export
  createExport: (
    festivalId: string,
    data: {
      format: 'CSV' | 'JSON' | 'EXCEL' | 'PDF'
      dataTypes: string[]
      startDate: string
      endDate: string
    }
  ) => api.post<AnalyticsExport>(`/api/festivals/${festivalId}/analytics/export`, data),

  getExports: (festivalId: string) =>
    api.get<AnalyticsExport[]>(`/api/festivals/${festivalId}/analytics/exports`),

  getExport: (festivalId: string, exportId: string) =>
    api.get<AnalyticsExport>(`/api/festivals/${festivalId}/analytics/exports/${exportId}`),

  // Event tracking
  trackEvent: (
    festivalId: string,
    data: {
      type: string
      category: string
      action: string
      label?: string
      value?: number
      sessionId: string
      data?: Record<string, unknown>
    }
  ) => api.post<AnalyticsEvent>(`/api/festivals/${festivalId}/analytics/events`, data),
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

export const analyticsQueryKeys = {
  all: ['analytics'] as const,
  summary: (festivalId: string) => [...analyticsQueryKeys.all, 'summary', festivalId] as const,
  realtime: (festivalId: string) => [...analyticsQueryKeys.all, 'realtime', festivalId] as const,
  funnels: (festivalId: string) => [...analyticsQueryKeys.all, 'funnels', festivalId] as const,
  funnel: (festivalId: string, name: string) => [...analyticsQueryKeys.all, 'funnel', festivalId, name] as const,
  cohorts: (festivalId: string, type?: string) => [...analyticsQueryKeys.all, 'cohorts', festivalId, type] as const,
  heatmap: (festivalId: string, type: string) => [...analyticsQueryKeys.all, 'heatmap', festivalId, type] as const,
  userJourney: (festivalId: string, userId: string) => [...analyticsQueryKeys.all, 'journey', festivalId, userId] as const,
  predictions: (festivalId: string) => [...analyticsQueryKeys.all, 'predictions', festivalId] as const,
  conversion: (festivalId: string) => [...analyticsQueryKeys.all, 'conversion', festivalId] as const,
  avgSpend: (festivalId: string) => [...analyticsQueryKeys.all, 'avgSpend', festivalId] as const,
  peakTimes: (festivalId: string) => [...analyticsQueryKeys.all, 'peakTimes', festivalId] as const,
  retention: (festivalId: string) => [...analyticsQueryKeys.all, 'retention', festivalId] as const,
  exports: (festivalId: string) => [...analyticsQueryKeys.all, 'exports', festivalId] as const,
}
