/**
 * WebSocket Client Singleton
 * Manages a single WebSocket connection with auto-reconnect and message handling
 */

// Message types for WebSocket communication
export type WebSocketMessageType =
  | 'stats'
  | 'transaction'
  | 'alert'
  | 'entry'
  | 'revenue_update'
  | 'user_activity'
  | 'inventory_update'
  | 'security_alert'
  | 'ping'
  | 'pong'
  | 'subscribe'
  | 'unsubscribe'
  | 'error'

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType
  festival_id?: string
  channel?: string
  timestamp: string
  data: T
}

export interface StatsData {
  total_revenue: number
  revenue_change: number
  tickets_sold: number
  tickets_used: number
  active_wallets: number
  active_users: number
  today_transactions: number
  transaction_volume: number
  average_wallet_balance: number
  entries_last_hour: number
  timestamp: string
}

export interface TransactionData {
  id: string
  type: 'purchase' | 'topup' | 'refund'
  amount: number
  wallet_id?: string
  stand_name?: string
  product_name?: string
  staff_name?: string
  timestamp: string
}

export interface AlertData {
  id: string
  type: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  action_url?: string
  timestamp: string
}

export interface UserActivityData {
  active_users: number
  peak_users: number
  users_by_zone: Record<string, number>
  timestamp: string
}

export interface EntryData {
  id: string
  ticket_type: string
  gate_name: string
  visitor_name?: string
  timestamp: string
}

export interface RevenuePointData {
  timestamp: string
  revenue: number
  label: string
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

export type MessageHandler<T = unknown> = (message: WebSocketMessage<T>) => void
export type ConnectionHandler = (state: ConnectionState) => void

interface WebSocketClientConfig {
  maxReconnectAttempts: number
  baseReconnectDelay: number
  maxReconnectDelay: number
  pingInterval: number
  pongTimeout: number
}

const DEFAULT_CONFIG: WebSocketClientConfig = {
  maxReconnectAttempts: 10,
  baseReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  pingInterval: 30000,
  pongTimeout: 5000,
}

class WebSocketClient {
  private static instances: Map<string, WebSocketClient> = new Map()

  private ws: WebSocket | null = null
  private url: string
  private config: WebSocketClientConfig
  private state: ConnectionState = 'disconnected'
  private reconnectAttempts = 0
  private reconnectTimeout: NodeJS.Timeout | null = null
  private pingInterval: NodeJS.Timeout | null = null
  private pongTimeout: NodeJS.Timeout | null = null
  private messageHandlers: Map<WebSocketMessageType | '*', Set<MessageHandler>> = new Map()
  private connectionHandlers: Set<ConnectionHandler> = new Set()
  private subscribedChannels: Set<string> = new Set()
  private pendingMessages: string[] = []
  private lastPongTime: number = 0

  private constructor(url: string, config: Partial<WebSocketClientConfig> = {}) {
    this.url = url
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Get or create a WebSocket client instance for the given URL
   */
  static getInstance(url: string, config?: Partial<WebSocketClientConfig>): WebSocketClient {
    const existing = WebSocketClient.instances.get(url)
    if (existing) {
      return existing
    }

    const instance = new WebSocketClient(url, config)
    WebSocketClient.instances.set(url, instance)
    return instance
  }

  /**
   * Remove a client instance
   */
  static removeInstance(url: string): void {
    const instance = WebSocketClient.instances.get(url)
    if (instance) {
      instance.disconnect()
      WebSocketClient.instances.delete(url)
    }
  }

  /**
   * Get all active instances
   */
  static getActiveInstances(): Map<string, WebSocketClient> {
    return new Map(WebSocketClient.instances)
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      return
    }

    this.clearTimeouts()
    this.setState('connecting')

    try {
      this.ws = new WebSocket(this.url)
      this.setupEventListeners()
    } catch (error) {
      console.error('[WebSocket] Connection error:', error)
      this.setState('error')
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.clearTimeouts()
    this.reconnectAttempts = 0

    if (this.ws) {
      this.ws.onclose = null // Prevent reconnect attempt
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.setState('disconnected')
    this.subscribedChannels.clear()
    this.pendingMessages = []
  }

  /**
   * Force reconnect
   */
  reconnect(): void {
    this.reconnectAttempts = 0
    this.disconnect()
    this.connect()
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Subscribe to a message type
   */
  onMessage<T = unknown>(type: WebSocketMessageType | '*', handler: MessageHandler<T>): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)!.add(handler as MessageHandler)

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type)
      if (handlers) {
        handlers.delete(handler as MessageHandler)
        if (handlers.size === 0) {
          this.messageHandlers.delete(type)
        }
      }
    }
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler)
    // Immediately notify of current state
    handler(this.state)

    return () => {
      this.connectionHandlers.delete(handler)
    }
  }

  /**
   * Send a message
   */
  send<T>(type: WebSocketMessageType, data: T, channel?: string): boolean {
    const message: WebSocketMessage<T> = {
      type,
      timestamp: new Date().toISOString(),
      data,
      ...(channel && { channel }),
    }

    const messageStr = JSON.stringify(message)

    if (this.isConnected()) {
      try {
        this.ws!.send(messageStr)
        return true
      } catch (error) {
        console.error('[WebSocket] Send error:', error)
        this.pendingMessages.push(messageStr)
        return false
      }
    } else {
      // Queue message for when connection is restored
      this.pendingMessages.push(messageStr)
      return false
    }
  }

  /**
   * Subscribe to a channel
   */
  subscribeChannel(channel: string): void {
    if (this.subscribedChannels.has(channel)) {
      return
    }

    this.subscribedChannels.add(channel)
    this.send('subscribe', { channel })
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribeChannel(channel: string): void {
    if (!this.subscribedChannels.has(channel)) {
      return
    }

    this.subscribedChannels.delete(channel)
    this.send('unsubscribe', { channel })
  }

  /**
   * Get subscribed channels
   */
  getSubscribedChannels(): string[] {
    return Array.from(this.subscribedChannels)
  }

  private setupEventListeners(): void {
    if (!this.ws) return

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected')
      this.setState('connected')
      this.reconnectAttempts = 0
      this.lastPongTime = Date.now()

      // Resubscribe to channels
      this.subscribedChannels.forEach((channel) => {
        this.send('subscribe', { channel })
      })

      // Send pending messages
      this.flushPendingMessages()

      // Start ping interval
      this.startPingInterval()
    }

    this.ws.onclose = (event) => {
      console.log('[WebSocket] Closed:', event.code, event.reason)
      this.clearTimeouts()

      if (event.code !== 1000) {
        // Abnormal close, attempt reconnect
        this.scheduleReconnect()
      } else {
        this.setState('disconnected')
      }
    }

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error)
      this.setState('error')
    }

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data)
    }
  }

  private handleMessage(data: string): void {
    try {
      // Handle multiple messages separated by newlines
      const messages = data.split('\n').filter(Boolean)

      for (const msgStr of messages) {
        const message = JSON.parse(msgStr) as WebSocketMessage

        // Handle pong
        if (message.type === 'pong') {
          this.lastPongTime = Date.now()
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout)
            this.pongTimeout = null
          }
          continue
        }

        // Handle ping - respond with pong
        if (message.type === 'ping') {
          this.send('pong', { timestamp: new Date().toISOString() })
          continue
        }

        // Notify type-specific handlers
        const handlers = this.messageHandlers.get(message.type)
        if (handlers) {
          handlers.forEach((handler) => handler(message))
        }

        // Notify wildcard handlers
        const wildcardHandlers = this.messageHandlers.get('*')
        if (wildcardHandlers) {
          wildcardHandlers.forEach((handler) => handler(message))
        }
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error)
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return

    this.state = state
    this.connectionHandlers.forEach((handler) => handler(state))
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log('[WebSocket] Max reconnect attempts reached')
      this.setState('disconnected')
      return
    }

    this.setState('reconnecting')
    this.reconnectAttempts++

    // Exponential backoff with jitter
    const baseDelay = this.config.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    const jitter = Math.random() * 1000
    const delay = Math.min(baseDelay + jitter, this.config.maxReconnectDelay)

    console.log(`[WebSocket] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`)

    this.reconnectTimeout = setTimeout(() => {
      this.connect()
    }, delay)
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (!this.isConnected()) return

      // Check if we received a pong recently
      const timeSinceLastPong = Date.now() - this.lastPongTime
      if (timeSinceLastPong > this.config.pingInterval * 2) {
        console.log('[WebSocket] Connection seems dead, reconnecting')
        this.reconnect()
        return
      }

      // Send ping
      this.send('ping', { timestamp: new Date().toISOString() })

      // Set pong timeout
      this.pongTimeout = setTimeout(() => {
        console.log('[WebSocket] Pong timeout, reconnecting')
        this.reconnect()
      }, this.config.pongTimeout)
    }, this.config.pingInterval)
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0 && this.isConnected()) {
      const message = this.pendingMessages.shift()
      if (message) {
        try {
          this.ws!.send(message)
        } catch (error) {
          console.error('[WebSocket] Failed to send pending message:', error)
          this.pendingMessages.unshift(message)
          break
        }
      }
    }
  }

  private clearTimeouts(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout)
      this.pongTimeout = null
    }
  }
}

/**
 * Get the WebSocket URL for a given path
 */
export function getWebSocketUrl(path: string): string {
  if (typeof window === 'undefined') return ''

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = process.env.NEXT_PUBLIC_API_HOST || window.location.host
  return `${protocol}//${host}${path}`
}

/**
 * Create a dashboard WebSocket client
 */
export function createDashboardClient(festivalId: string): WebSocketClient {
  const url = getWebSocketUrl(`/ws/dashboard/${festivalId}`)
  return WebSocketClient.getInstance(url)
}

/**
 * Create an alerts WebSocket client
 */
export function createAlertsClient(festivalId: string): WebSocketClient {
  const url = getWebSocketUrl(`/ws/alerts/${festivalId}`)
  return WebSocketClient.getInstance(url)
}

/**
 * Create a general admin WebSocket client
 */
export function createAdminClient(): WebSocketClient {
  const url = getWebSocketUrl('/ws/admin')
  return WebSocketClient.getInstance(url)
}

export { WebSocketClient }
