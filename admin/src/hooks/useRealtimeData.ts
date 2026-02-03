'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  WebSocketClient,
  WebSocketMessage,
  WebSocketMessageType,
  ConnectionState,
  MessageHandler,
  getWebSocketUrl,
  StatsData,
  TransactionData,
  AlertData,
  EntryData,
  RevenuePointData,
  UserActivityData,
} from '@/lib/websocket'

// Re-export types for convenience
export type { ConnectionState, WebSocketMessage, WebSocketMessageType }

export interface UseRealtimeDataOptions {
  /** WebSocket URL path (e.g., '/ws/dashboard/123') */
  url: string
  /** Whether the connection should be active */
  enabled?: boolean
  /** Channels to subscribe to */
  channels?: string[]
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean
  /** Max reconnect attempts */
  maxReconnectAttempts?: number
  /** Base reconnect delay in ms */
  baseReconnectDelay?: number
  /** Callback when connection state changes */
  onConnectionChange?: (state: ConnectionState) => void
  /** Callback when a message is received */
  onMessage?: (message: WebSocketMessage) => void
  /** Callback on error */
  onError?: (error: Event | Error) => void
}

export interface UseRealtimeDataReturn {
  /** Current connection state */
  connectionState: ConnectionState
  /** Whether currently connected */
  isConnected: boolean
  /** Last received message */
  lastMessage: WebSocketMessage | null
  /** Send a message */
  send: <T>(type: WebSocketMessageType, data: T) => boolean
  /** Subscribe to a message type */
  subscribe: <T>(type: WebSocketMessageType | '*', handler: MessageHandler<T>) => () => void
  /** Manually reconnect */
  reconnect: () => void
  /** Manually disconnect */
  disconnect: () => void
  /** Subscribe to a channel */
  subscribeChannel: (channel: string) => void
  /** Unsubscribe from a channel */
  unsubscribeChannel: (channel: string) => void
}

/**
 * Hook for managing WebSocket connections with auto-reconnect and event subscription
 */
export function useRealtimeData({
  url,
  enabled = true,
  channels = [],
  autoReconnect = true,
  maxReconnectAttempts = 10,
  baseReconnectDelay = 1000,
  onConnectionChange,
  onMessage,
  onError,
}: UseRealtimeDataOptions): UseRealtimeDataReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  const clientRef = useRef<WebSocketClient | null>(null)
  const cleanupFnsRef = useRef<(() => void)[]>([])
  const mountedRef = useRef(true)

  // Build full URL
  const fullUrl = useMemo(() => {
    if (!url) return ''
    return url.startsWith('ws://') || url.startsWith('wss://') ? url : getWebSocketUrl(url)
  }, [url])

  // Initialize client
  useEffect(() => {
    if (!fullUrl || !enabled) {
      return
    }

    mountedRef.current = true

    // Get or create client instance
    const client = WebSocketClient.getInstance(fullUrl, {
      maxReconnectAttempts: autoReconnect ? maxReconnectAttempts : 0,
      baseReconnectDelay,
    })
    clientRef.current = client

    // Subscribe to connection state changes
    const unsubConnection = client.onConnectionChange((state) => {
      if (!mountedRef.current) return
      setConnectionState(state)
      onConnectionChange?.(state)
    })
    cleanupFnsRef.current.push(unsubConnection)

    // Subscribe to all messages for lastMessage tracking
    const unsubMessages = client.onMessage('*', (message) => {
      if (!mountedRef.current) return
      setLastMessage(message)
      onMessage?.(message)
    })
    cleanupFnsRef.current.push(unsubMessages)

    // Connect
    client.connect()

    // Subscribe to initial channels
    channels.forEach((channel) => {
      client.subscribeChannel(channel)
    })

    return () => {
      mountedRef.current = false
      cleanupFnsRef.current.forEach((fn) => fn())
      cleanupFnsRef.current = []

      // Note: We don't disconnect here to allow connection sharing
      // The client will be cleaned up when all subscribers leave
    }
  }, [fullUrl, enabled, autoReconnect, maxReconnectAttempts, baseReconnectDelay, onConnectionChange, onMessage])

  // Handle channel changes
  useEffect(() => {
    const client = clientRef.current
    if (!client) return

    channels.forEach((channel) => {
      client.subscribeChannel(channel)
    })
  }, [channels])

  const isConnected = connectionState === 'connected'

  const send = useCallback(<T,>(type: WebSocketMessageType, data: T): boolean => {
    const client = clientRef.current
    if (!client) return false
    return client.send(type, data)
  }, [])

  const subscribe = useCallback(<T,>(
    type: WebSocketMessageType | '*',
    handler: MessageHandler<T>
  ): (() => void) => {
    const client = clientRef.current
    if (!client) return () => {}
    const unsubscribe = client.onMessage(type, handler as MessageHandler)
    cleanupFnsRef.current.push(unsubscribe)
    return unsubscribe
  }, [])

  const reconnect = useCallback(() => {
    const client = clientRef.current
    if (!client) return
    client.reconnect()
  }, [])

  const disconnect = useCallback(() => {
    const client = clientRef.current
    if (!client) return
    client.disconnect()
  }, [])

  const subscribeChannel = useCallback((channel: string) => {
    const client = clientRef.current
    if (!client) return
    client.subscribeChannel(channel)
  }, [])

  const unsubscribeChannel = useCallback((channel: string) => {
    const client = clientRef.current
    if (!client) return
    client.unsubscribeChannel(channel)
  }, [])

  return {
    connectionState,
    isConnected,
    lastMessage,
    send,
    subscribe,
    reconnect,
    disconnect,
    subscribeChannel,
    unsubscribeChannel,
  }
}

// ============================================================================
// Specialized hooks for common use cases
// ============================================================================

export interface UseDashboardRealtimeOptions {
  festivalId: string
  enabled?: boolean
  onStatsUpdate?: (stats: StatsData) => void
  onTransaction?: (transaction: TransactionData) => void
  onAlert?: (alert: AlertData) => void
  onEntry?: (entry: EntryData) => void
  onRevenueUpdate?: (point: RevenuePointData) => void
}

export interface UseDashboardRealtimeReturn extends UseRealtimeDataReturn {
  stats: StatsData | null
  transactions: TransactionData[]
  alerts: AlertData[]
  entries: EntryData[]
  revenuePoints: RevenuePointData[]
}

const MAX_TRANSACTIONS = 50
const MAX_ALERTS = 20
const MAX_ENTRIES = 100
const MAX_REVENUE_POINTS = 100

/**
 * Hook for dashboard real-time data with automatic message handling
 */
export function useDashboardRealtime({
  festivalId,
  enabled = true,
  onStatsUpdate,
  onTransaction,
  onAlert,
  onEntry,
  onRevenueUpdate,
}: UseDashboardRealtimeOptions): UseDashboardRealtimeReturn {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [transactions, setTransactions] = useState<TransactionData[]>([])
  const [alerts, setAlerts] = useState<AlertData[]>([])
  const [entries, setEntries] = useState<EntryData[]>([])
  const [revenuePoints, setRevenuePoints] = useState<RevenuePointData[]>([])

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'stats':
        const statsData = message.data as StatsData
        setStats(statsData)
        onStatsUpdate?.(statsData)
        break

      case 'transaction':
        const txData = message.data as TransactionData
        setTransactions((prev) => [txData, ...prev].slice(0, MAX_TRANSACTIONS))
        onTransaction?.(txData)
        break

      case 'alert':
        const alertData = message.data as AlertData
        setAlerts((prev) => [alertData, ...prev].slice(0, MAX_ALERTS))
        onAlert?.(alertData)
        break

      case 'entry':
        const entryData = message.data as EntryData
        setEntries((prev) => [entryData, ...prev].slice(0, MAX_ENTRIES))
        onEntry?.(entryData)
        break

      case 'revenue_update':
        const revenueData = message.data as RevenuePointData
        setRevenuePoints((prev) => [...prev, revenueData].slice(-MAX_REVENUE_POINTS))
        onRevenueUpdate?.(revenueData)
        break
    }
  }, [onStatsUpdate, onTransaction, onAlert, onEntry, onRevenueUpdate])

  const realtime = useRealtimeData({
    url: `/ws/dashboard/${festivalId}`,
    enabled: enabled && !!festivalId,
    onMessage: handleMessage,
  })

  return {
    ...realtime,
    stats,
    transactions,
    alerts,
    entries,
    revenuePoints,
  }
}

export interface UseAlertsRealtimeOptions {
  festivalId: string
  enabled?: boolean
  onAlert?: (alert: AlertData) => void
}

export interface UseAlertsRealtimeReturn extends UseRealtimeDataReturn {
  alerts: AlertData[]
  unreadCount: number
  markAllRead: () => void
  clearAlerts: () => void
}

/**
 * Hook for real-time alerts
 */
export function useAlertsRealtime({
  festivalId,
  enabled = true,
  onAlert,
}: UseAlertsRealtimeOptions): UseAlertsRealtimeReturn {
  const [alerts, setAlerts] = useState<AlertData[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'alert' || message.type === 'security_alert') {
      const alertData = message.data as AlertData
      setAlerts((prev) => [alertData, ...prev].slice(0, MAX_ALERTS))
      onAlert?.(alertData)
    }
  }, [onAlert])

  const realtime = useRealtimeData({
    url: `/ws/alerts/${festivalId}`,
    enabled: enabled && !!festivalId,
    onMessage: handleMessage,
  })

  const unreadCount = useMemo(() => {
    return alerts.filter((alert) => !readIds.has(alert.id)).length
  }, [alerts, readIds])

  const markAllRead = useCallback(() => {
    setReadIds(new Set(alerts.map((a) => a.id)))
  }, [alerts])

  const clearAlerts = useCallback(() => {
    setAlerts([])
    setReadIds(new Set())
  }, [])

  return {
    ...realtime,
    alerts,
    unreadCount,
    markAllRead,
    clearAlerts,
  }
}

export interface UseUserActivityOptions {
  festivalId: string
  enabled?: boolean
  onActivityUpdate?: (activity: UserActivityData) => void
}

export interface UseUserActivityReturn extends UseRealtimeDataReturn {
  activity: UserActivityData | null
  activeUsers: number
  peakUsers: number
}

/**
 * Hook for real-time user activity tracking
 */
export function useUserActivity({
  festivalId,
  enabled = true,
  onActivityUpdate,
}: UseUserActivityOptions): UseUserActivityReturn {
  const [activity, setActivity] = useState<UserActivityData | null>(null)

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'user_activity' || message.type === 'stats') {
      const data = message.data as UserActivityData | StatsData

      if ('active_users' in data) {
        const activityData: UserActivityData = {
          active_users: data.active_users,
          peak_users: (data as UserActivityData).peak_users ?? data.active_users,
          users_by_zone: (data as UserActivityData).users_by_zone ?? {},
          timestamp: data.timestamp,
        }
        setActivity(activityData)
        onActivityUpdate?.(activityData)
      }
    }
  }, [onActivityUpdate])

  const realtime = useRealtimeData({
    url: `/ws/dashboard/${festivalId}`,
    enabled: enabled && !!festivalId,
    onMessage: handleMessage,
    channels: ['user_activity'],
  })

  return {
    ...realtime,
    activity,
    activeUsers: activity?.active_users ?? 0,
    peakUsers: activity?.peak_users ?? 0,
  }
}
