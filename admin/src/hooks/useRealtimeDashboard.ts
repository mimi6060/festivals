'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  WebSocketClient,
  WebSocketMessage,
  ConnectionState,
  getWebSocketUrl,
  StatsData,
  TransactionData,
  AlertData,
  RevenuePointData,
} from '@/lib/websocket'

// ============================================================================
// Types
// ============================================================================

export interface RealtimeStats {
  totalRevenue: number
  revenueChange: number
  ticketsSold: number
  ticketsUsed: number
  activeWallets: number
  activeUsers: number
  todayTransactions: number
  transactionVolume: number
  averageWalletBalance: number
  entriesLastHour: number
  lastUpdated: Date | null
}

export interface RealtimeTransaction {
  id: string
  type: 'purchase' | 'topup' | 'refund'
  amount: number
  walletId?: string
  standName?: string
  productName?: string
  staffName?: string
  timestamp: Date
  isNew: boolean
}

export interface RealtimeAlert {
  id: string
  type: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  actionUrl?: string
  timestamp: Date
  isRead: boolean
}

export interface RevenueDataPoint {
  timestamp: Date
  revenue: number
  label: string
}

export interface ConnectionInfo {
  state: ConnectionState
  isConnected: boolean
  reconnectAttempts: number
  lastConnected: Date | null
  lastDisconnected: Date | null
}

export interface UseRealtimeDashboardOptions {
  festivalId: string
  enabled?: boolean
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean
  /** Max reconnect attempts */
  maxReconnectAttempts?: number
  /** Reconnect delay in ms */
  reconnectDelay?: number
  /** Buffer updates during reconnection */
  bufferUpdates?: boolean
  /** Max buffered updates */
  maxBufferedUpdates?: number
  /** Callback when stats update */
  onStatsUpdate?: (stats: RealtimeStats) => void
  /** Callback when new transaction arrives */
  onTransaction?: (transaction: RealtimeTransaction) => void
  /** Callback when new alert arrives */
  onAlert?: (alert: RealtimeAlert) => void
  /** Callback when connection state changes */
  onConnectionChange?: (state: ConnectionState) => void
}

export interface UseRealtimeDashboardReturn {
  /** Current real-time stats */
  stats: RealtimeStats
  /** Animated display value for revenue (smoothly transitions) */
  animatedRevenue: number
  /** Whether revenue counter is animating */
  isRevenueAnimating: boolean
  /** Recent transactions */
  transactions: RealtimeTransaction[]
  /** New transactions count (in last 5 seconds) */
  newTransactionsCount: number
  /** Active alerts */
  alerts: RealtimeAlert[]
  /** Unread alerts count */
  unreadAlertsCount: number
  /** Revenue chart data points */
  revenueHistory: RevenueDataPoint[]
  /** Connection info */
  connection: ConnectionInfo
  /** Whether data is live (connected) */
  isLive: boolean
  /** Whether initial data is loading */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Manually reconnect */
  reconnect: () => void
  /** Disconnect */
  disconnect: () => void
  /** Clear transactions */
  clearTransactions: () => void
  /** Mark all alerts as read */
  markAlertsRead: () => void
  /** Clear all alerts */
  clearAlerts: () => void
  /** Refresh stats (triggers immediate fetch) */
  refresh: () => void
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_STATS: RealtimeStats = {
  totalRevenue: 0,
  revenueChange: 0,
  ticketsSold: 0,
  ticketsUsed: 0,
  activeWallets: 0,
  activeUsers: 0,
  todayTransactions: 0,
  transactionVolume: 0,
  averageWalletBalance: 0,
  entriesLastHour: 0,
  lastUpdated: null,
}

const MAX_TRANSACTIONS = 100
const MAX_ALERTS = 50
const MAX_REVENUE_POINTS = 120
const NEW_ITEM_DURATION = 5000 // 5 seconds
const ANIMATION_DURATION = 500 // Animation duration in ms

// ============================================================================
// Hook Implementation
// ============================================================================

export function useRealtimeDashboard({
  festivalId,
  enabled = true,
  autoReconnect = true,
  maxReconnectAttempts = 10,
  reconnectDelay = 2000,
  bufferUpdates = true,
  maxBufferedUpdates = 100,
  onStatsUpdate,
  onTransaction,
  onAlert,
  onConnectionChange,
}: UseRealtimeDashboardOptions): UseRealtimeDashboardReturn {
  // State
  const [stats, setStats] = useState<RealtimeStats>(DEFAULT_STATS)
  const [animatedRevenue, setAnimatedRevenue] = useState(0)
  const [isRevenueAnimating, setIsRevenueAnimating] = useState(false)
  const [transactions, setTransactions] = useState<RealtimeTransaction[]>([])
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([])
  const [revenueHistory, setRevenueHistory] = useState<RevenueDataPoint[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [lastConnected, setLastConnected] = useState<Date | null>(null)
  const [lastDisconnected, setLastDisconnected] = useState<Date | null>(null)

  // Refs
  const clientRef = useRef<WebSocketClient | null>(null)
  const mountedRef = useRef(true)
  const cleanupFnsRef = useRef<(() => void)[]>([])
  const bufferedUpdatesRef = useRef<WebSocketMessage[]>([])
  const animationRef = useRef<number | null>(null)
  const startValueRef = useRef(0)
  const startTimeRef = useRef(0)
  const newItemTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Build WebSocket URL
  const wsUrl = useMemo(() => {
    if (typeof window === 'undefined' || !festivalId) return ''
    return getWebSocketUrl(`/ws/dashboard/${festivalId}`)
  }, [festivalId])

  // Animate revenue changes
  useEffect(() => {
    const targetRevenue = stats.totalRevenue
    if (targetRevenue === animatedRevenue) return

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    setIsRevenueAnimating(true)
    startValueRef.current = animatedRevenue
    startTimeRef.current = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1)

      // Ease-out-quart easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentValue = startValueRef.current + (targetRevenue - startValueRef.current) * easeOutQuart

      setAnimatedRevenue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsRevenueAnimating(false)
        animationRef.current = null
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [stats.totalRevenue, animatedRevenue])

  // Handle stats update
  const handleStatsUpdate = useCallback((data: StatsData) => {
    const newStats: RealtimeStats = {
      totalRevenue: data.total_revenue,
      revenueChange: data.revenue_change,
      ticketsSold: data.tickets_sold,
      ticketsUsed: data.tickets_used,
      activeWallets: data.active_wallets,
      activeUsers: data.active_users ?? data.active_wallets,
      todayTransactions: data.today_transactions,
      transactionVolume: data.transaction_volume,
      averageWalletBalance: data.average_wallet_balance,
      entriesLastHour: data.entries_last_hour,
      lastUpdated: new Date(),
    }

    setStats(newStats)
    setIsLoading(false)
    setError(null)
    onStatsUpdate?.(newStats)
  }, [onStatsUpdate])

  // Handle new transaction
  const handleTransaction = useCallback((data: TransactionData) => {
    const newTx: RealtimeTransaction = {
      id: data.id,
      type: data.type,
      amount: data.amount,
      walletId: data.wallet_id,
      standName: data.stand_name,
      productName: data.product_name,
      staffName: data.staff_name,
      timestamp: new Date(data.timestamp),
      isNew: true,
    }

    setTransactions((prev) => {
      // Check for duplicates
      if (prev.some((tx) => tx.id === newTx.id)) {
        return prev
      }
      const updated = [newTx, ...prev].slice(0, MAX_TRANSACTIONS)
      return updated
    })

    onTransaction?.(newTx)

    // Clear "new" flag after duration
    const timeout = setTimeout(() => {
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === data.id ? { ...tx, isNew: false } : tx))
      )
      newItemTimeoutsRef.current.delete(data.id)
    }, NEW_ITEM_DURATION)

    newItemTimeoutsRef.current.set(data.id, timeout)
  }, [onTransaction])

  // Handle new alert
  const handleAlert = useCallback((data: AlertData) => {
    const newAlert: RealtimeAlert = {
      id: data.id,
      type: data.type as RealtimeAlert['type'],
      title: data.title,
      message: data.message,
      actionUrl: data.action_url,
      timestamp: new Date(data.timestamp),
      isRead: false,
    }

    setAlerts((prev) => {
      // Check for duplicates
      if (prev.some((alert) => alert.id === newAlert.id)) {
        return prev
      }
      const updated = [newAlert, ...prev].slice(0, MAX_ALERTS)
      return updated
    })

    onAlert?.(newAlert)
  }, [onAlert])

  // Handle revenue update
  const handleRevenueUpdate = useCallback((data: RevenuePointData) => {
    const point: RevenueDataPoint = {
      timestamp: new Date(data.timestamp),
      revenue: data.revenue,
      label: data.label,
    }

    setRevenueHistory((prev) => {
      const updated = [...prev, point]
      return updated.slice(-MAX_REVENUE_POINTS)
    })
  }, [])

  // Handle WebSocket message
  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'stats':
        handleStatsUpdate(message.data as StatsData)
        break
      case 'transaction':
        handleTransaction(message.data as TransactionData)
        break
      case 'alert':
        handleAlert(message.data as AlertData)
        break
      case 'revenue_update':
        handleRevenueUpdate(message.data as RevenuePointData)
        break
    }
  }, [handleStatsUpdate, handleTransaction, handleAlert, handleRevenueUpdate])

  // Process buffered updates
  const processBufferedUpdates = useCallback(() => {
    if (bufferedUpdatesRef.current.length === 0) return

    bufferedUpdatesRef.current.forEach((msg) => {
      handleMessage(msg)
    })
    bufferedUpdatesRef.current = []
  }, [handleMessage])

  // Handle connection state change
  const handleConnectionChange = useCallback((state: ConnectionState) => {
    if (!mountedRef.current) return

    setConnectionState(state)
    onConnectionChange?.(state)

    if (state === 'connected') {
      setLastConnected(new Date())
      setReconnectAttempts(0)
      setError(null)
      // Process any buffered updates
      processBufferedUpdates()
    } else if (state === 'disconnected') {
      setLastDisconnected(new Date())
    } else if (state === 'reconnecting') {
      setReconnectAttempts((prev) => prev + 1)
    } else if (state === 'error') {
      setError(new Error('WebSocket connection error'))
    }
  }, [onConnectionChange, processBufferedUpdates])

  // Initialize WebSocket connection
  useEffect(() => {
    if (!wsUrl || !enabled) {
      return
    }

    mountedRef.current = true

    // Get or create client
    const client = WebSocketClient.getInstance(wsUrl, {
      maxReconnectAttempts: autoReconnect ? maxReconnectAttempts : 0,
      baseReconnectDelay: reconnectDelay,
    })
    clientRef.current = client

    // Subscribe to connection changes
    const unsubConnection = client.onConnectionChange(handleConnectionChange)
    cleanupFnsRef.current.push(unsubConnection)

    // Subscribe to all message types
    const unsubStats = client.onMessage('stats', (msg) => {
      if (!mountedRef.current) return
      if (bufferUpdates && connectionState === 'reconnecting') {
        bufferedUpdatesRef.current.push(msg)
        if (bufferedUpdatesRef.current.length > maxBufferedUpdates) {
          bufferedUpdatesRef.current.shift()
        }
      } else {
        handleMessage(msg)
      }
    })
    cleanupFnsRef.current.push(unsubStats)

    const unsubTransaction = client.onMessage('transaction', (msg) => {
      if (!mountedRef.current) return
      handleMessage(msg)
    })
    cleanupFnsRef.current.push(unsubTransaction)

    const unsubAlert = client.onMessage('alert', (msg) => {
      if (!mountedRef.current) return
      handleMessage(msg)
    })
    cleanupFnsRef.current.push(unsubAlert)

    const unsubRevenue = client.onMessage('revenue_update', (msg) => {
      if (!mountedRef.current) return
      handleMessage(msg)
    })
    cleanupFnsRef.current.push(unsubRevenue)

    // Connect
    client.connect()

    return () => {
      mountedRef.current = false
      cleanupFnsRef.current.forEach((fn) => fn())
      cleanupFnsRef.current = []
      // Note: Don't disconnect here to allow connection sharing
    }
  }, [
    wsUrl,
    enabled,
    autoReconnect,
    maxReconnectAttempts,
    reconnectDelay,
    bufferUpdates,
    maxBufferedUpdates,
    handleConnectionChange,
    handleMessage,
    connectionState,
  ])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      newItemTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
      newItemTimeoutsRef.current.clear()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // Computed values
  const isConnected = connectionState === 'connected'
  const newTransactionsCount = useMemo(
    () => transactions.filter((tx) => tx.isNew).length,
    [transactions]
  )
  const unreadAlertsCount = useMemo(
    () => alerts.filter((alert) => !alert.isRead).length,
    [alerts]
  )

  // Connection info object
  const connection: ConnectionInfo = useMemo(() => ({
    state: connectionState,
    isConnected,
    reconnectAttempts,
    lastConnected,
    lastDisconnected,
  }), [connectionState, isConnected, reconnectAttempts, lastConnected, lastDisconnected])

  // Actions
  const reconnect = useCallback(() => {
    const client = clientRef.current
    if (client) {
      setReconnectAttempts(0)
      client.reconnect()
    }
  }, [])

  const disconnect = useCallback(() => {
    const client = clientRef.current
    if (client) {
      client.disconnect()
    }
  }, [])

  const clearTransactions = useCallback(() => {
    setTransactions([])
    newItemTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
    newItemTimeoutsRef.current.clear()
  }, [])

  const markAlertsRead = useCallback(() => {
    setAlerts((prev) => prev.map((alert) => ({ ...alert, isRead: true })))
  }, [])

  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  const refresh = useCallback(() => {
    // Force reconnect to get fresh data
    reconnect()
  }, [reconnect])

  return {
    stats,
    animatedRevenue,
    isRevenueAnimating,
    transactions,
    newTransactionsCount,
    alerts,
    unreadAlertsCount,
    revenueHistory,
    connection,
    isLive: isConnected,
    isLoading,
    error,
    reconnect,
    disconnect,
    clearTransactions,
    markAlertsRead,
    clearAlerts,
    refresh,
  }
}

// ============================================================================
// Additional specialized hooks
// ============================================================================

/**
 * Hook for just the connection status indicator
 */
export function useConnectionStatus(festivalId: string, enabled = true) {
  const { connection, isLive, reconnect } = useRealtimeDashboard({
    festivalId,
    enabled,
  })

  return {
    ...connection,
    isLive,
    reconnect,
  }
}

/**
 * Hook for animated revenue counter only
 */
export function useAnimatedRevenue(festivalId: string, enabled = true) {
  const { stats, animatedRevenue, isRevenueAnimating, isLive } = useRealtimeDashboard({
    festivalId,
    enabled,
  })

  return {
    revenue: stats.totalRevenue,
    displayRevenue: animatedRevenue,
    revenueChange: stats.revenueChange,
    isAnimating: isRevenueAnimating,
    isLive,
  }
}

/**
 * Hook for live transaction feed only
 */
export function useLiveTransactionFeed(
  festivalId: string,
  enabled = true,
  maxItems = 20
) {
  const { transactions, newTransactionsCount, isLive, clearTransactions } = useRealtimeDashboard({
    festivalId,
    enabled,
  })

  const limitedTransactions = useMemo(
    () => transactions.slice(0, maxItems),
    [transactions, maxItems]
  )

  return {
    transactions: limitedTransactions,
    newCount: newTransactionsCount,
    isLive,
    clear: clearTransactions,
  }
}

/**
 * Hook for live alerts only
 */
export function useLiveAlerts(festivalId: string, enabled = true) {
  const { alerts, unreadAlertsCount, isLive, markAlertsRead, clearAlerts } = useRealtimeDashboard({
    festivalId,
    enabled,
  })

  return {
    alerts,
    unreadCount: unreadAlertsCount,
    isLive,
    markAllRead: markAlertsRead,
    clear: clearAlerts,
  }
}
