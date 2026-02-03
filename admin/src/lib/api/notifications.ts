import { api } from '../api'

// Notification Template Types
export type NotificationChannel = 'email' | 'push' | 'sms'
export type TemplateCategory = 'ticket' | 'wallet' | 'lineup' | 'general' | 'reminder'

export interface TemplateVariable {
  name: string
  description: string
  example: string
}

export interface NotificationTemplate {
  id: string
  festivalId?: string // null for global/default templates
  name: string
  slug: string
  description: string
  category: TemplateCategory
  channel: NotificationChannel
  subject: string
  htmlBody: string
  textBody: string
  variables: TemplateVariable[]
  enabled: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTemplateInput {
  name: string
  slug: string
  description?: string
  category: TemplateCategory
  channel: NotificationChannel
  subject: string
  htmlBody: string
  textBody: string
  variables?: TemplateVariable[]
  enabled?: boolean
}

export interface UpdateTemplateInput {
  name?: string
  description?: string
  subject?: string
  htmlBody?: string
  textBody?: string
  variables?: TemplateVariable[]
  enabled?: boolean
}

export interface TestEmailInput {
  templateId: string
  recipientEmail: string
  sampleData?: Record<string, string>
}

export interface TestEmailResult {
  success: boolean
  messageId?: string
  previewUrl?: string
  error?: string
}

export interface TemplateListParams {
  category?: TemplateCategory
  channel?: NotificationChannel
  enabled?: boolean
  search?: string
}

export interface PlatformEmailSettings {
  fromName: string
  fromEmail: string
  replyToEmail: string
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPassword?: string
  provider: 'smtp' | 'sendgrid' | 'ses' | 'resend'
  apiKey?: string
  footerText: string
  unsubscribeUrl?: string
}

export interface GlobalSettings {
  emailSettings: PlatformEmailSettings
  defaultTemplates: NotificationTemplate[]
  notificationDefaults: {
    enableTicketConfirmation: boolean
    enableWalletAlerts: boolean
    enableLineupUpdates: boolean
    enableReminders: boolean
  }
}

// Festival-specific notification settings
export interface FestivalNotificationSettings {
  // Email settings
  email: {
    enabled: boolean
    fromName: string
    fromEmail: string
    replyToEmail?: string
    sendTicketConfirmation: boolean
    sendWalletAlerts: boolean
    sendLineupUpdates: boolean
    sendReminders: boolean
  }
  // SMS settings
  sms: {
    enabled: boolean
    senderId?: string
    sendEmergencyAlerts: boolean
    sendEventReminders: boolean
    sendWalletNotifications: boolean
    dailyLimit?: number
    optInRequired: boolean
  }
  // Push notification settings
  push: {
    enabled: boolean
    sendScheduleReminders: boolean
    sendArtistAlerts: boolean
    sendWalletNotifications: boolean
    sendEmergencyAlerts: boolean
    quietHoursEnabled: boolean
    quietHoursStart?: string // HH:mm format
    quietHoursEnd?: string // HH:mm format
  }
}

export interface UpdateNotificationSettingsInput {
  email?: Partial<FestivalNotificationSettings['email']>
  sms?: Partial<FestivalNotificationSettings['sms']>
  push?: Partial<FestivalNotificationSettings['push']>
}

export interface TestPushInput {
  deviceToken?: string
  userId?: string
  title: string
  body: string
  data?: Record<string, string>
}

export interface TestPushResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface TestSMSInput {
  phoneNumber: string
  message: string
}

export interface TestSMSResult {
  success: boolean
  messageSid?: string
  error?: string
}

// Default template variables by category
export const defaultVariables: Record<TemplateCategory, TemplateVariable[]> = {
  ticket: [
    { name: 'ticketId', description: 'Unique ticket identifier', example: 'TKT-2026-001234' },
    { name: 'ticketType', description: 'Type of ticket purchased', example: 'VIP Weekend Pass' },
    { name: 'attendeeName', description: 'Name of the ticket holder', example: 'John Doe' },
    { name: 'attendeeEmail', description: 'Email of the ticket holder', example: 'john@example.com' },
    { name: 'festivalName', description: 'Name of the festival', example: 'Summer Fest 2026' },
    { name: 'festivalDate', description: 'Festival dates', example: 'June 15-17, 2026' },
    { name: 'festivalLocation', description: 'Festival venue', example: 'Brussels, Belgium' },
    { name: 'qrCodeUrl', description: 'URL to QR code image', example: 'https://...' },
    { name: 'purchaseDate', description: 'Date of purchase', example: 'January 15, 2026' },
    { name: 'totalAmount', description: 'Total amount paid', example: '150.00 EUR' },
  ],
  wallet: [
    { name: 'attendeeName', description: 'Name of the wallet owner', example: 'John Doe' },
    { name: 'walletBalance', description: 'Current wallet balance', example: '50.00' },
    { name: 'currencyName', description: 'Festival currency name', example: 'Griffons' },
    { name: 'topUpAmount', description: 'Amount added to wallet', example: '25.00' },
    { name: 'transactionId', description: 'Transaction reference', example: 'TXN-2026-005678' },
    { name: 'festivalName', description: 'Name of the festival', example: 'Summer Fest 2026' },
  ],
  lineup: [
    { name: 'artistName', description: 'Name of the artist', example: 'The Headliners' },
    { name: 'stageName', description: 'Stage name', example: 'Main Stage' },
    { name: 'performanceDate', description: 'Date of performance', example: 'June 16, 2026' },
    { name: 'performanceTime', description: 'Time of performance', example: '21:00' },
    { name: 'festivalName', description: 'Name of the festival', example: 'Summer Fest 2026' },
    { name: 'attendeeName', description: 'Name of the attendee', example: 'John Doe' },
  ],
  general: [
    { name: 'attendeeName', description: 'Name of the recipient', example: 'John Doe' },
    { name: 'attendeeEmail', description: 'Email of the recipient', example: 'john@example.com' },
    { name: 'festivalName', description: 'Name of the festival', example: 'Summer Fest 2026' },
    { name: 'festivalDate', description: 'Festival dates', example: 'June 15-17, 2026' },
    { name: 'festivalLocation', description: 'Festival venue', example: 'Brussels, Belgium' },
    { name: 'supportEmail', description: 'Support email address', example: 'support@festival.com' },
  ],
  reminder: [
    { name: 'attendeeName', description: 'Name of the attendee', example: 'John Doe' },
    { name: 'festivalName', description: 'Name of the festival', example: 'Summer Fest 2026' },
    { name: 'daysUntil', description: 'Days until festival', example: '7' },
    { name: 'festivalDate', description: 'Festival start date', example: 'June 15, 2026' },
    { name: 'festivalLocation', description: 'Festival venue', example: 'Brussels, Belgium' },
    { name: 'ticketType', description: 'Type of ticket', example: 'VIP Weekend Pass' },
  ],
}

// Default templates
export const defaultTemplates: Partial<NotificationTemplate>[] = [
  {
    slug: 'ticket-confirmation',
    name: 'Ticket Confirmation',
    description: 'Sent when a ticket purchase is completed',
    category: 'ticket',
    channel: 'email',
    enabled: true,
  },
  {
    slug: 'ticket-reminder',
    name: 'Ticket Reminder',
    description: 'Sent before the festival starts',
    category: 'reminder',
    channel: 'email',
    enabled: true,
  },
  {
    slug: 'wallet-topup',
    name: 'Wallet Top-Up Confirmation',
    description: 'Sent when wallet is topped up',
    category: 'wallet',
    channel: 'email',
    enabled: true,
  },
  {
    slug: 'wallet-low-balance',
    name: 'Low Wallet Balance Alert',
    description: 'Sent when wallet balance is low',
    category: 'wallet',
    channel: 'email',
    enabled: false,
  },
  {
    slug: 'lineup-update',
    name: 'Lineup Update',
    description: 'Sent when lineup changes occur',
    category: 'lineup',
    channel: 'email',
    enabled: true,
  },
  {
    slug: 'artist-reminder',
    name: 'Artist Performance Reminder',
    description: 'Sent before a favorited artist performs',
    category: 'lineup',
    channel: 'push',
    enabled: true,
  },
  {
    slug: 'welcome',
    name: 'Welcome Email',
    description: 'Sent when user registers for the festival',
    category: 'general',
    channel: 'email',
    enabled: true,
  },
  {
    slug: 'password-reset',
    name: 'Password Reset',
    description: 'Sent when user requests password reset',
    category: 'general',
    channel: 'email',
    enabled: true,
  },
]

// API Functions
export const notificationsApi = {
  // Get all templates for a festival (includes defaults if not overridden)
  getTemplates: async (
    festivalId: string,
    params?: TemplateListParams
  ): Promise<NotificationTemplate[]> => {
    const searchParams = new URLSearchParams()
    if (params?.category) searchParams.set('category', params.category)
    if (params?.channel) searchParams.set('channel', params.channel)
    if (params?.enabled !== undefined) searchParams.set('enabled', String(params.enabled))
    if (params?.search) searchParams.set('search', params.search)

    const query = searchParams.toString()
    return api.get<NotificationTemplate[]>(
      `/api/v1/festivals/${festivalId}/notifications/templates${query ? `?${query}` : ''}`
    )
  },

  // Get a single template
  getTemplate: async (festivalId: string, templateId: string): Promise<NotificationTemplate> => {
    return api.get<NotificationTemplate>(
      `/api/v1/festivals/${festivalId}/notifications/templates/${templateId}`
    )
  },

  // Create a new template (override default or custom)
  createTemplate: async (
    festivalId: string,
    data: CreateTemplateInput
  ): Promise<NotificationTemplate> => {
    return api.post<NotificationTemplate>(
      `/api/v1/festivals/${festivalId}/notifications/templates`,
      data
    )
  },

  // Update a template
  updateTemplate: async (
    festivalId: string,
    templateId: string,
    data: UpdateTemplateInput
  ): Promise<NotificationTemplate> => {
    return api.patch<NotificationTemplate>(
      `/api/v1/festivals/${festivalId}/notifications/templates/${templateId}`,
      data
    )
  },

  // Delete a custom template (revert to default if exists)
  deleteTemplate: async (festivalId: string, templateId: string): Promise<void> => {
    return api.delete<void>(
      `/api/v1/festivals/${festivalId}/notifications/templates/${templateId}`
    )
  },

  // Toggle template enabled/disabled
  toggleTemplate: async (
    festivalId: string,
    templateId: string,
    enabled: boolean
  ): Promise<NotificationTemplate> => {
    return api.patch<NotificationTemplate>(
      `/api/v1/festivals/${festivalId}/notifications/templates/${templateId}`,
      { enabled }
    )
  },

  // Send a test email
  testEmail: async (festivalId: string, data: TestEmailInput): Promise<TestEmailResult> => {
    return api.post<TestEmailResult>(
      `/api/v1/festivals/${festivalId}/notifications/test`,
      data
    )
  },

  // Preview rendered template with sample data
  previewTemplate: async (
    festivalId: string,
    templateId: string,
    sampleData?: Record<string, string>
  ): Promise<{ html: string; text: string; subject: string }> => {
    return api.post<{ html: string; text: string; subject: string }>(
      `/api/v1/festivals/${festivalId}/notifications/templates/${templateId}/preview`,
      { sampleData }
    )
  },

  // Global/Platform settings
  getGlobalSettings: async (): Promise<GlobalSettings> => {
    return api.get<GlobalSettings>('/api/v1/admin/settings/notifications')
  },

  updateGlobalSettings: async (
    settings: Partial<GlobalSettings>
  ): Promise<GlobalSettings> => {
    return api.patch<GlobalSettings>('/api/v1/admin/settings/notifications', settings)
  },

  updateEmailSettings: async (
    settings: Partial<PlatformEmailSettings>
  ): Promise<PlatformEmailSettings> => {
    return api.patch<PlatformEmailSettings>('/api/v1/admin/settings/email', settings)
  },

  // Get default templates (platform-wide)
  getDefaultTemplates: async (): Promise<NotificationTemplate[]> => {
    return api.get<NotificationTemplate[]>('/api/v1/admin/notifications/templates')
  },

  // Update a default template
  updateDefaultTemplate: async (
    templateId: string,
    data: UpdateTemplateInput
  ): Promise<NotificationTemplate> => {
    return api.patch<NotificationTemplate>(
      `/api/v1/admin/notifications/templates/${templateId}`,
      data
    )
  },

  // Test platform email settings
  testEmailSettings: async (
    recipientEmail: string
  ): Promise<TestEmailResult> => {
    return api.post<TestEmailResult>('/api/v1/admin/settings/email/test', { recipientEmail })
  },

  // Festival-specific notification settings
  getFestivalSettings: async (
    festivalId: string
  ): Promise<FestivalNotificationSettings> => {
    return api.get<FestivalNotificationSettings>(
      `/api/v1/festivals/${festivalId}/notifications/settings`
    )
  },

  updateFestivalSettings: async (
    festivalId: string,
    settings: UpdateNotificationSettingsInput
  ): Promise<FestivalNotificationSettings> => {
    return api.patch<FestivalNotificationSettings>(
      `/api/v1/festivals/${festivalId}/notifications/settings`,
      settings
    )
  },

  // Test push notification
  testPush: async (
    festivalId: string,
    data: TestPushInput
  ): Promise<TestPushResult> => {
    return api.post<TestPushResult>(
      `/api/v1/festivals/${festivalId}/notifications/test-push`,
      data
    )
  },

  // Test SMS
  testSMS: async (
    festivalId: string,
    data: TestSMSInput
  ): Promise<TestSMSResult> => {
    return api.post<TestSMSResult>(
      `/api/v1/festivals/${festivalId}/notifications/test-sms`,
      data
    )
  },
}
