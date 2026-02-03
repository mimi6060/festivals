import { api } from '../api'

// SMS Types
export type SMSTemplate =
  | 'TICKET_REMINDER'
  | 'SOS_CONFIRMATION'
  | 'TOPUP_CONFIRMATION'
  | 'BROADCAST'
  | 'WELCOME'
  | 'LINEUP_CHANGE'
  | 'EMERGENCY'
  | 'PAYMENT_CONFIRM'

export type SMSLogStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'OPTED_OUT'

export interface SMSLog {
  id: string
  festivalId?: string
  userId?: string
  toPhone: string
  template: SMSTemplate
  message: string
  status: SMSLogStatus
  messageSid?: string
  error?: string
  broadcastId?: string
  sentAt?: string
  createdAt: string
}

export interface SMSBroadcast {
  id: string
  festivalId: string
  template: SMSTemplate
  message: string
  totalCount: number
  sentCount: number
  failedCount: number
  optedOutCount: number
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  startedAt?: string
  completedAt?: string
  createdBy?: string
  createdAt: string
}

export interface SMSStats {
  totalSent: number
  totalFailed: number
  totalOptedOut: number
  totalBroadcasts: number
  byTemplate: Record<string, number>
}

export interface SMSBalance {
  currency: string
  balance: number
}

export interface SMSTemplateInfo {
  id: SMSTemplate
  name: string
  description: string
  content: string
  variables: string[]
}

export interface SendBroadcastInput {
  message: string
}

export interface BroadcastResult {
  broadcastId: string
  totalCount: number
  sentCount: number
  failedCount: number
  optedOutCount: number
  status: string
}

export interface SendSingleSMSInput {
  to: string
  template: SMSTemplate
  message?: string
  variables?: Record<string, string>
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    perPage: number
  }
}

// SMS API Functions
export const smsApi = {
  // Get SMS balance
  getBalance: async (): Promise<SMSBalance> => {
    return api.get<SMSBalance>('/api/v1/sms/balance')
  },

  // Get SMS logs for a festival
  getLogs: async (
    festivalId: string,
    page = 1,
    perPage = 20
  ): Promise<PaginatedResponse<SMSLog>> => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/v1/festivals/${festivalId}/sms/logs?page=${page}&per_page=${perPage}`,
      { credentials: 'include' }
    )
    if (!response.ok) throw new Error('Failed to fetch SMS logs')
    return response.json()
  },

  // Get broadcasts for a festival
  getBroadcasts: async (
    festivalId: string,
    page = 1,
    perPage = 20
  ): Promise<PaginatedResponse<SMSBroadcast>> => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/v1/festivals/${festivalId}/sms/broadcasts?page=${page}&per_page=${perPage}`,
      { credentials: 'include' }
    )
    if (!response.ok) throw new Error('Failed to fetch broadcasts')
    return response.json()
  },

  // Get a single broadcast
  getBroadcast: async (festivalId: string, broadcastId: string): Promise<SMSBroadcast> => {
    return api.get<SMSBroadcast>(`/api/v1/festivals/${festivalId}/sms/broadcasts/${broadcastId}`)
  },

  // Get SMS stats for a festival
  getStats: async (festivalId: string): Promise<SMSStats> => {
    return api.get<SMSStats>(`/api/v1/festivals/${festivalId}/sms/stats`)
  },

  // Get available templates
  getTemplates: async (festivalId: string): Promise<SMSTemplateInfo[]> => {
    return api.get<SMSTemplateInfo[]>(`/api/v1/festivals/${festivalId}/sms/templates`)
  },

  // Send a broadcast SMS
  sendBroadcast: async (festivalId: string, data: SendBroadcastInput): Promise<BroadcastResult> => {
    return api.post<BroadcastResult>(`/api/v1/festivals/${festivalId}/sms/broadcast`, data)
  },

  // Send a single SMS (for testing)
  sendSingleSMS: async (data: SendSingleSMSInput): Promise<{ success: boolean; message: string }> => {
    return api.post<{ success: boolean; message: string }>('/api/v1/sms/send', data)
  },

  // Opt out a phone number
  optOut: async (phone: string, reason?: string): Promise<{ success: boolean; message: string }> => {
    return api.post<{ success: boolean; message: string }>('/api/v1/sms/opt-out', { phone, reason })
  },

  // Opt in a phone number
  optIn: async (phone: string): Promise<{ success: boolean; message: string }> => {
    return api.post<{ success: boolean; message: string }>('/api/v1/sms/opt-in', { phone })
  },

  // Check if a phone is opted out
  checkOptOut: async (phone: string): Promise<{ phone: string; optedOut: boolean }> => {
    return api.get<{ phone: string; optedOut: boolean }>(`/api/v1/sms/opt-out/check?phone=${encodeURIComponent(phone)}`)
  },
}

// Template display info
export const templateDisplayInfo: Record<SMSTemplate, { name: string; icon: string; color: string }> = {
  TICKET_REMINDER: { name: 'Ticket Reminder', icon: 'Ticket', color: 'blue' },
  SOS_CONFIRMATION: { name: 'SOS Confirmation', icon: 'AlertTriangle', color: 'red' },
  TOPUP_CONFIRMATION: { name: 'Top-Up Confirmation', icon: 'Wallet', color: 'green' },
  BROADCAST: { name: 'Broadcast', icon: 'Megaphone', color: 'purple' },
  WELCOME: { name: 'Welcome', icon: 'PartyPopper', color: 'yellow' },
  LINEUP_CHANGE: { name: 'Lineup Change', icon: 'Music', color: 'pink' },
  EMERGENCY: { name: 'Emergency', icon: 'Siren', color: 'red' },
  PAYMENT_CONFIRM: { name: 'Payment Confirm', icon: 'CreditCard', color: 'green' },
}

// Status display info
export const statusDisplayInfo: Record<SMSLogStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'yellow' },
  SENT: { label: 'Sent', color: 'blue' },
  DELIVERED: { label: 'Delivered', color: 'green' },
  FAILED: { label: 'Failed', color: 'red' },
  OPTED_OUT: { label: 'Opted Out', color: 'gray' },
}
