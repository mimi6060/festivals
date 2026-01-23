'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useDashboardRealtime, ConnectionState } from './useRealtimeData'
import type { StatsData, TransactionData, RevenuePointData } from '@/lib/websocket'

// ============================================================================
// Types
// ============================================================================

export interface LiveStatsData {
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

export interface TransactionFeedItem {
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

export interface RevenueDataPoint {
  timestamp: Date
  revenue: number
  label: string
}

export interface UseLiveStatsOptions {
  festivalId: string
  enabled?: boolean
  /** Update interval for polling fallback (ms) */
  pollInterval?: number
  /** Enable polling fallback when WebSocket disconnects */
  enablePollingFallback?: boolean
  /** Callback when stats update */
  onStatsUpdate?: (stats: LiveStatsData) => void
  /** Callback when new transaction arrives */
  onNewTransaction?: (transaction: TransactionFeedItem) => void
  /** Callback when revenue updates */
  onRevenueUpdate?: (total: number, change: number) => void
}

export interface UseLiveStatsReturn {
  /** Current live stats */
  stats: LiveStatsData
  /** Recent transactions */
  transactions: TransactionFeedItem[]
  /** Revenue data points for charting */
  revenueHistory: RevenueDataPoint[]
  /** Connection state */
  connectionState: ConnectionState
  /** Whether data is live */
  isLive: boolean
  /** Whether currently loading */
  isLoading: boolean
  /** Any error that occurred */
  error: Error | null
  /** Manually refresh stats */
  refresh: () => void
  /** Clear transaction history */
  clearTransactions: () => void
  /** Get transaction summary */
  transactionSummary: {
    totalCount: number
    purchaseCount: number
    topupCount: number
    refundCount: number
    netAmount: number
  }
}

// ============================================================================
// Default values
// ============================================================================

const DEFAULT_STATS: LiveStatsData = {
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

const MAX_TRANSACTION_HISTORY = 100
const NEW_TRANSACTION_DURATION = 5000 // 5 seconds

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for real-time statistics with revenue counter, active users, and transaction feed
 */
export function useLiveStats({
  festivalId,
  enabled = true,
  pollInterval = 30000,
  enablePollingFallback = true,
  onStatsUpdate,
  onNewTransaction,
  onRevenueUpdate,
}: UseLiveStatsOptions): UseLiveStatsReturn {
  const [stats, setStats] = useState<LiveStatsData>(DEFAULT_STATS)
  const [transactions, setTransactions] = useState<TransactionFeedItem[]>([])
  const [revenueHistory, setRevenueHistory] = useState<RevenueDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const prevRevenueRef = useRef<number>(0)
  const newTransactionTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Handle stats update from WebSocket
  const handleStatsUpdate = useCallback((data: StatsData) => {
    const newStats: LiveStatsData = {
      totalRevenue: data.total_revenue,
      revenueChange: data.revenue_change,
      ticketsSold: data.tickets_sold,
      ticketsUsed: data.tickets_used,
      activeWallets: data.active_wallets,
      activeUsers: data.active_users ?? 0,
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

    // Notify revenue update if changed
    if (data.total_revenue !== prevRevenueRef.current) {
      onRevenueUpdate?.(data.total_revenue, data.revenue_change)
      prevRevenueRef.current = data.total_revenue
    }
  }, [onStatsUpdate, onRevenueUpdate])

  // Handle new transaction from WebSocket
  const handleTransaction = useCallback((data: TransactionData) => {
    const newTransaction: TransactionFeedItem = {
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
      const updated = [newTransaction, ...prev].slice(0, MAX_TRANSACTION_HISTORY)
      return updated
    })

    onNewTransaction?.(newTransaction)

    // Clear "new" flag after duration
    const timeout = setTimeout(() => {
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === data.id ? { ...tx, isNew: false } : tx))
      )
      newTransactionTimeoutsRef.current.delete(data.id)
    }, NEW_TRANSACTION_DURATION)

    newTransactionTimeoutsRef.current.set(data.id, timeout)
  }, [onNewTransaction])

  // Handle revenue point from WebSocket
  const handleRevenueUpdate = useCallback((data: RevenuePointData) => {
    const point: RevenueDataPoint = {
      timestamp: new Date(data.timestamp),
      revenue: data.revenue,
      label: data.label,
    }

    setRevenueHistory((prev) => {
      const updated = [...prev, point]
      // Keep last 100 points
      return updated.slice(-100)
    })
  }, [])

  // Use dashboard realtime hook
  const realtime = useDashboardRealtime({
    festivalId,
    enabled,
    onStatsUpdate: handleStatsUpdate,
    onTransaction: handleTransaction,
    onRevenueUpdate: handleRevenueUpdate,
  })

  const { connectionState, isConnected, reconnect } = realtime

  // Polling fallback when disconnected
  useEffect(() => {
    if (!enablePollingFallback || isConnected || !enabled || !festivalId) {
      return
    }

    const fetchStats = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/festivals/${festivalId}/stats`
        )
        if (!response.ok) throw new Error('Failed to fetch stats')
        const data = await response.json()
        handleStatsUpdate(data.data || data)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch stats'))
      }
    }

    // Initial fetch
    fetchStats()

    // Poll periodically
    const interval = setInterval(fetchStats, pollInterval)

    return () => {
      clearInterval(interval)
    }
  }, [enablePollingFallback, isConnected, enabled, festivalId, pollInterval, handleStatsUpdate])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      newTransactionTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
      newTransactionTimeoutsRef.current.clear()
    }
  }, [])

  // Calculate transaction summary
  const transactionSummary = useMemo(() => {
    const summary = {
      totalCount: transactions.length,
      purchaseCount: 0,
      topupCount: 0,
      refundCount: 0,
      netAmount: 0,
    }

    transactions.forEach((tx) => {
      switch (tx.type) {
        case 'purchase':
          summary.purchaseCount++
          summary.netAmount += tx.amount
          break
        case 'topup':
          summary.topupCount++
          summary.netAmount += tx.amount
          break
        case 'refund':
          summary.refundCount++
          summary.netAmount -= tx.amount
          break
      }
    })

    return summary
  }, [transactions])

  const refresh = useCallback(() => {
    if (isConnected) {
      reconnect()
    }
  }, [isConnected, reconnect])

  const clearTransactions = useCallback(() => {
    setTransactions([])
    newTransactionTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
    newTransactionTimeoutsRef.current.clear()
  }, [])

  return {
    stats,
    transactions,
    revenueHistory,
    connectionState,
    isLive: isConnected,
    isLoading,
    error,
    refresh,
    clearTransactions,
    transactionSummary,
  }
}

// ============================================================================
// Specialized hooks
// ============================================================================

export interface UseLiveRevenueOptions {
  festivalId: string
  enabled?: boolean
  /** Animation duration for counter in ms */
  animationDuration?: number
}

export interface UseLiveRevenueReturn {
  /** Current total revenue */
  revenue: number
  /** Animated display value */
  displayRevenue: number
  /** Revenue change percentage */
  revenueChange: number
  /** Whether revenue is currently animating */
  isAnimating: boolean
  /** Connection state */
  connectionState: ConnectionState
  /** Whether data is live */
  isLive: boolean
}

/**
 * Hook specifically for animated revenue counter
 */
export function useLiveRevenue({
  festivalId,
  enabled = true,
  animationDuration = 500,
}: UseLiveRevenueOptions): UseLiveRevenueReturn {
  const [revenue, setRevenue] = useState(0)
  const [displayRevenue, setDisplayRevenue] = useState(0)
  const [revenueChange, setRevenueChange] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const animationRef = useRef<number | null>(null)
  const startValueRef = useRef(0)
  const startTimeRef = useRef(0)

  const handleStatsUpdate = useCallback((data: StatsData) => {
    setRevenue(data.total_revenue)
    setRevenueChange(data.revenue_change)
  }, [])

  const realtime = useDashboardRealtime({
    festivalId,
    enabled,
    onStatsUpdate: handleStatsUpdate,
  })

  // Animate revenue changes
  useEffect(() => {
    if (revenue === displayRevenue) return

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    setIsAnimating(true)
    startValueRef.current = displayRevenue
    startTimeRef.current = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / animationDuration, 1)

      // Easing function (ease-out-quart)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentValue = startValueRef.current + (revenue - startValueRef.current) * easeOutQuart

      setDisplayRevenue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
        animationRef.current = null
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [revenue, displayRevenue, animationDuration])

  return {
    revenue,
    displayRevenue,
    revenueChange,
    isAnimating,
    connectionState: realtime.connectionState,
    isLive: realtime.isConnected,
  }
}

export interface UseLiveActiveUsersOptions {
  festivalId: string
  enabled?: boolean
}

export interface UseLiveActiveUsersReturn {
  /** Current active users count */
  activeUsers: number
  /** Peak users count */
  peakUsers: number
  /** Users by zone */
  usersByZone: Record<string, number>
  /** Connection state */
  connectionState: ConnectionState
  /** Whether data is live */
  isLive: boolean
}

/**
 * Hook for live active users count
 */
export function useLiveActiveUsers({
  festivalId,
  enabled = true,
}: UseLiveActiveUsersOptions): UseLiveActiveUsersReturn {
  const [activeUsers, setActiveUsers] = useState(0)
  const [peakUsers, setPeakUsers] = useState(0)
  const [usersByZone, setUsersByZone] = useState<Record<string, number>>({})

  const handleStatsUpdate = useCallback((data: StatsData) => {
    const users = data.active_users ?? data.active_wallets
    setActiveUsers(users)
    setPeakUsers((prev) => Math.max(prev, users))
  }, [])

  const realtime = useDashboardRealtime({
    festivalId,
    enabled,
    onStatsUpdate: handleStatsUpdate,
  })

  // Subscribe to user activity channel for zone breakdown
  useEffect(() => {
    if (!realtime.isConnected) return

    const unsubscribe = realtime.subscribe('user_activity', (message) => {
      const data = message.data as { users_by_zone?: Record<string, number> }
      if (data.users_by_zone) {
        setUsersByZone(data.users_by_zone)
      }
    })

    return unsubscribe
  }, [realtime.isConnected, realtime.subscribe])

  return {
    activeUsers,
    peakUsers,
    usersByZone,
    connectionState: realtime.connectionState,
    isLive: realtime.isConnected,
  }
}

export interface UseTransactionFeedOptions {
  festivalId: string
  enabled?: boolean
  /** Maximum number of transactions to keep */
  maxItems?: number
  /** Filter by transaction type */
  typeFilter?: ('purchase' | 'topup' | 'refund')[]
}

export interface UseTransactionFeedReturn {
  /** Transaction feed items */
  transactions: TransactionFeedItem[]
  /** New transactions count (in last 5 seconds) */
  newCount: number
  /** Total amount in feed */
  totalAmount: number
  /** Connection state */
  connectionState: ConnectionState
  /** Whether data is live */
  isLive: boolean
  /** Clear all transactions */
  clear: () => void
}

/**
 * Hook for transaction feed with filtering
 */
export function useTransactionFeed({
  festivalId,
  enabled = true,
  maxItems = 50,
  typeFilter,
}: UseTransactionFeedOptions): UseTransactionFeedReturn {
  const [transactions, setTransactions] = useState<TransactionFeedItem[]>([])

  const handleTransaction = useCallback(
    (data: TransactionData) => {
      // Filter by type if specified
      if (typeFilter && !typeFilter.includes(data.type)) {
        return
      }

      const newTransaction: TransactionFeedItem = {
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
        const updated = [newTransaction, ...prev].slice(0, maxItems)
        return updated
      })

      // Clear "new" flag after 5 seconds
      setTimeout(() => {
        setTransactions((prev) =>
          prev.map((tx) => (tx.id === data.id ? { ...tx, isNew: false } : tx))
        )
      }, NEW_TRANSACTION_DURATION)
    },
    [typeFilter, maxItems]
  )

  const realtime = useDashboardRealtime({
    festivalId,
    enabled,
    onTransaction: handleTransaction,
  })

  const newCount = useMemo(() => transactions.filter((tx) => tx.isNew).length, [transactions])

  const totalAmount = useMemo(
    () =>
      transactions.reduce((sum, tx) => {
        return tx.type === 'refund' ? sum - tx.amount : sum + tx.amount
      }, 0),
    [transactions]
  )

  const clear = useCallback(() => {
    setTransactions([])
  }, [])

  return {
    transactions,
    newCount,
    totalAmount,
    connectionState: realtime.connectionState,
    isLive: realtime.isConnected,
    clear,
  }
}
