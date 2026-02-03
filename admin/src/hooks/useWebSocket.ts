'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export type MessageType =
  | 'stats'
  | 'transaction'
  | 'alert'
  | 'entry'
  | 'revenue_update'
  | 'ping'
  | 'pong'

export interface WebSocketMessage<T = unknown> {
  type: MessageType
  festival_id?: string
  timestamp: string
  data: T
}

export interface StatsUpdate {
  total_revenue: number
  revenue_change: number
  tickets_sold: number
  tickets_used: number
  active_wallets: number
  active_users?: number
  today_transactions: number
  transaction_volume: number
  average_wallet_balance: number
  entries_last_hour: number
  timestamp: string
}

export interface Transaction {
  id: string
  type: 'purchase' | 'topup' | 'refund'
  amount: number
  wallet_id?: string
  stand_name?: string
  product_name?: string
  staff_name?: string
  timestamp: string
}

export interface Alert {
  id: string
  type: 'info' | 'warning' | 'error'
  title: string
  message: string
  action_url?: string
  timestamp: string
}

export interface Entry {
  id: string
  ticket_type: string
  gate_name: string
  visitor_name?: string
  timestamp: string
}

export interface RevenuePoint {
  timestamp: string
  revenue: number
  label: string
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface UseWebSocketOptions {
  url: string
  enabled?: boolean
  reconnectAttempts?: number
  reconnectInterval?: number
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

export interface UseWebSocketReturn {
  status: ConnectionStatus
  lastMessage: WebSocketMessage | null
  stats: StatsUpdate | null
  transactions: Transaction[]
  alerts: Alert[]
  entries: Entry[]
  revenuePoints: RevenuePoint[]
  send: (data: unknown) => void
  reconnect: () => void
}

const MAX_TRANSACTIONS = 50
const MAX_ALERTS = 20
const MAX_ENTRIES = 100
const MAX_REVENUE_POINTS = 100

export function useWebSocket({
  url,
  enabled = true,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [stats, setStats] = useState<StatsUpdate | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [revenuePoints, setRevenuePoints] = useState<RevenuePoint[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return

    clearReconnectTimeout()

    try {
      setStatus('connecting')
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close()
          return
        }
        setStatus('connected')
        reconnectCountRef.current = 0
        onConnect?.()
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setStatus('disconnected')
        onDisconnect?.()

        // Attempt reconnect
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++
          const delay = reconnectInterval * Math.min(reconnectCountRef.current, 5)
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect()
            }
          }, delay)
        }
      }

      ws.onerror = (error) => {
        if (!mountedRef.current) return
        setStatus('error')
        onError?.(error)
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return

        try {
          // Handle multiple messages separated by newlines
          const messages = event.data.split('\n').filter(Boolean)

          for (const msgStr of messages) {
            const message = JSON.parse(msgStr) as WebSocketMessage
            setLastMessage(message)
            onMessage?.(message)

            // Handle message by type
            switch (message.type) {
              case 'stats':
                setStats(message.data as StatsUpdate)
                break

              case 'transaction':
                setTransactions((prev) => {
                  const tx = message.data as Transaction
                  const updated = [tx, ...prev]
                  return updated.slice(0, MAX_TRANSACTIONS)
                })
                break

              case 'alert':
                setAlerts((prev) => {
                  const alert = message.data as Alert
                  const updated = [alert, ...prev]
                  return updated.slice(0, MAX_ALERTS)
                })
                break

              case 'entry':
                setEntries((prev) => {
                  const entry = message.data as Entry
                  const updated = [entry, ...prev]
                  return updated.slice(0, MAX_ENTRIES)
                })
                break

              case 'revenue_update':
                setRevenuePoints((prev) => {
                  const point = message.data as RevenuePoint
                  const updated = [...prev, point]
                  return updated.slice(-MAX_REVENUE_POINTS)
                })
                break

              case 'ping':
                // Respond with pong
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }))
                break

              default:
                // Unknown message type
                break
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }
    } catch (error) {
      console.error('WebSocket connection error:', error)
      setStatus('error')
    }
  }, [
    url,
    enabled,
    reconnectAttempts,
    reconnectInterval,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    clearReconnectTimeout,
  ])

  const disconnect = useCallback(() => {
    clearReconnectTimeout()
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [clearReconnectTimeout])

  const reconnect = useCallback(() => {
    reconnectCountRef.current = 0
    disconnect()
    connect()
  }, [disconnect, connect])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true

    if (enabled) {
      connect()
    }

    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return {
    status,
    lastMessage,
    stats,
    transactions,
    alerts,
    entries,
    revenuePoints,
    send,
    reconnect,
  }
}

// Helper hook for dashboard WebSocket
export function useDashboardWebSocket(festivalId: string, enabled = true) {
  const wsUrl =
    typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${process.env.NEXT_PUBLIC_API_HOST || window.location.host}/ws/dashboard/${festivalId}`
      : ''

  return useWebSocket({
    url: wsUrl,
    enabled: enabled && !!festivalId,
    reconnectAttempts: 10,
    reconnectInterval: 2000,
  })
}

// Helper hook for alerts WebSocket
export function useAlertsWebSocket(festivalId: string, enabled = true) {
  const wsUrl =
    typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${process.env.NEXT_PUBLIC_API_HOST || window.location.host}/ws/alerts/${festivalId}`
      : ''

  return useWebSocket({
    url: wsUrl,
    enabled: enabled && !!festivalId,
    reconnectAttempts: 10,
    reconnectInterval: 2000,
  })
}
