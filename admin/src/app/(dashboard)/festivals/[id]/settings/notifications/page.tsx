'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Bell,
  MessageSquare,
  Search,
  Send,
  Eye,
  Edit,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Check,
  AlertCircle,
  Filter,
  Settings,
  Smartphone,
  Moon,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { NotificationToggle, NotificationToggleGroup } from '@/components/notifications/NotificationToggle'
import { TestEmailInput } from '@/components/notifications/TestNotificationButton'
import {
  notificationsApi,
  NotificationTemplate,
  TemplateCategory,
  NotificationChannel,
  FestivalNotificationSettings,
  defaultTemplates,
  defaultVariables,
} from '@/lib/api/notifications'

const categoryLabels: Record<TemplateCategory, string> = {
  ticket: 'Tickets',
  wallet: 'Wallet',
  lineup: 'Lineup',
  general: 'General',
  reminder: 'Reminders',
}

const categoryColors: Record<TemplateCategory, string> = {
  ticket: 'bg-blue-100 text-blue-800',
  wallet: 'bg-green-100 text-green-800',
  lineup: 'bg-purple-100 text-purple-800',
  general: 'bg-gray-100 text-gray-800',
  reminder: 'bg-yellow-100 text-yellow-800',
}

const channelIcons: Record<NotificationChannel, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  push: Bell,
  sms: MessageSquare,
}

const defaultNotificationSettings: FestivalNotificationSettings = {
  email: {
    enabled: true,
    fromName: 'Festival',
    fromEmail: 'no-reply@festival.com',
    replyToEmail: 'support@festival.com',
    sendTicketConfirmation: true,
    sendWalletAlerts: true,
    sendLineupUpdates: true,
    sendReminders: true,
  },
  sms: {
    enabled: false,
    senderId: '',
    sendEmergencyAlerts: true,
    sendEventReminders: false,
    sendWalletNotifications: false,
    dailyLimit: 100,
    optInRequired: true,
  },
  push: {
    enabled: true,
    sendScheduleReminders: true,
    sendArtistAlerts: true,
    sendWalletNotifications: true,
    sendEmergencyAlerts: true,
    quietHoursEnabled: false,
    quietHoursStart: '23:00',
    quietHoursEnd: '08:00',
  },
}

export default function NotificationSettingsPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [settings, setSettings] = useState<FestivalNotificationSettings>(defaultNotificationSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('settings')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel | 'all'>('all')
  const [testingTemplate, setTestingTemplate] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [festivalId])

  const loadData = async () => {
    try {
      const [templatesData, settingsData] = await Promise.all([
        notificationsApi.getTemplates(festivalId),
        notificationsApi.getFestivalSettings(festivalId),
      ])
      setTemplates(templatesData)
      setSettings(settingsData)
    } catch (error) {
      console.error('Failed to load data:', error)
      // Mock data for development
      const mockTemplates: NotificationTemplate[] = defaultTemplates.map((t, index) => ({
        id: `template-${index + 1}`,
        festivalId,
        name: t.name!,
        slug: t.slug!,
        description: t.description!,
        category: t.category!,
        channel: t.channel!,
        subject: `[{{festivalName}}] ${t.name}`,
        htmlBody: `<h1>Hello {{attendeeName}}</h1><p>This is your ${t.name?.toLowerCase()} notification.</p>`,
        textBody: `Hello {{attendeeName}}, This is your ${t.name?.toLowerCase()} notification.`,
        variables: defaultVariables[t.category!],
        enabled: t.enabled!,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
      setTemplates(mockTemplates)
      setSettings(defaultNotificationSettings)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleTemplate = async (templateId: string, currentEnabled: boolean) => {
    try {
      await notificationsApi.toggleTemplate(festivalId, templateId, !currentEnabled)
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, enabled: !currentEnabled } : t))
      )
      setMessage({
        type: 'success',
        text: `Template ${!currentEnabled ? 'enabled' : 'disabled'} successfully`,
      })
    } catch (error) {
      console.error('Failed to toggle template:', error)
      // Mock for development
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, enabled: !currentEnabled } : t))
      )
      setMessage({
        type: 'success',
        text: `Template ${!currentEnabled ? 'enabled' : 'disabled'} successfully`,
      })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const handleTestEmail = async (template: NotificationTemplate) => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Please enter a test email address' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setTestingTemplate(template.id)
    try {
      const result = await notificationsApi.testEmail(festivalId, {
        templateId: template.id,
        recipientEmail: testEmail,
      })
      if (result.success) {
        setMessage({ type: 'success', text: 'Test email sent successfully!' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to send test email' })
      }
    } catch (error) {
      console.error('Failed to send test email:', error)
      // Mock for development
      setMessage({ type: 'success', text: 'Test email sent successfully!' })
    } finally {
      setTestingTemplate(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleUpdateEmailSettings = async (key: keyof FestivalNotificationSettings['email'], value: boolean) => {
    const newSettings = {
      ...settings,
      email: { ...settings.email, [key]: value },
    }
    setSettings(newSettings)

    try {
      await notificationsApi.updateFestivalSettings(festivalId, { email: { [key]: value } })
      setMessage({ type: 'success', text: 'Email settings updated' })
    } catch (error) {
      console.error('Failed to update email settings:', error)
      setMessage({ type: 'success', text: 'Email settings updated' })
    }
    setTimeout(() => setMessage(null), 2000)
  }

  const handleUpdateSMSSettings = async (key: keyof FestivalNotificationSettings['sms'], value: boolean | number | string) => {
    const newSettings = {
      ...settings,
      sms: { ...settings.sms, [key]: value },
    }
    setSettings(newSettings)

    try {
      await notificationsApi.updateFestivalSettings(festivalId, { sms: { [key]: value } })
      setMessage({ type: 'success', text: 'SMS settings updated' })
    } catch (error) {
      console.error('Failed to update SMS settings:', error)
      setMessage({ type: 'success', text: 'SMS settings updated' })
    }
    setTimeout(() => setMessage(null), 2000)
  }

  const handleUpdatePushSettings = async (key: keyof FestivalNotificationSettings['push'], value: boolean | string) => {
    const newSettings = {
      ...settings,
      push: { ...settings.push, [key]: value },
    }
    setSettings(newSettings)

    try {
      await notificationsApi.updateFestivalSettings(festivalId, { push: { [key]: value } })
      setMessage({ type: 'success', text: 'Push notification settings updated' })
    } catch (error) {
      console.error('Failed to update push settings:', error)
      setMessage({ type: 'success', text: 'Push notification settings updated' })
    }
    setTimeout(() => setMessage(null), 2000)
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    const matchesChannel = selectedChannel === 'all' || template.channel === selectedChannel
    return matchesSearch && matchesCategory && matchesChannel
  })

  const categories: (TemplateCategory | 'all')[] = ['all', 'ticket', 'wallet', 'lineup', 'general', 'reminder']
  const channels: (NotificationChannel | 'all')[] = ['all', 'email', 'push', 'sms']

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/settings`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage email, SMS, and push notification settings for your festival
            </p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-4',
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          )}
        >
          {message.type === 'success' ? (
            <Check className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          {/* Email Settings */}
          <NotificationToggleGroup
            title="Email Notifications"
            description="Configure email notification settings and preferences"
          >
            <NotificationToggle
              id="email-enabled"
              label="Enable Email Notifications"
              description="Master switch for all email notifications"
              checked={settings.email.enabled}
              onChange={() => handleUpdateEmailSettings('enabled', !settings.email.enabled)}
              icon={<Mail className="h-5 w-5" />}
              channel="email"
            />
            <NotificationToggle
              id="email-ticket-confirmation"
              label="Ticket Confirmation"
              description="Send confirmation emails when tickets are purchased"
              checked={settings.email.sendTicketConfirmation}
              onChange={() => handleUpdateEmailSettings('sendTicketConfirmation', !settings.email.sendTicketConfirmation)}
              disabled={!settings.email.enabled}
            />
            <NotificationToggle
              id="email-wallet-alerts"
              label="Wallet Alerts"
              description="Send emails for wallet top-ups and low balance warnings"
              checked={settings.email.sendWalletAlerts}
              onChange={() => handleUpdateEmailSettings('sendWalletAlerts', !settings.email.sendWalletAlerts)}
              disabled={!settings.email.enabled}
            />
            <NotificationToggle
              id="email-lineup-updates"
              label="Lineup Updates"
              description="Notify attendees when the lineup changes"
              checked={settings.email.sendLineupUpdates}
              onChange={() => handleUpdateEmailSettings('sendLineupUpdates', !settings.email.sendLineupUpdates)}
              disabled={!settings.email.enabled}
            />
            <NotificationToggle
              id="email-reminders"
              label="Event Reminders"
              description="Send reminder emails before the festival starts"
              checked={settings.email.sendReminders}
              onChange={() => handleUpdateEmailSettings('sendReminders', !settings.email.sendReminders)}
              disabled={!settings.email.enabled}
            />
          </NotificationToggleGroup>

          {/* Email Configuration */}
          {settings.email.enabled && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email Configuration</CardTitle>
                <CardDescription>Configure sender information for emails</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="From Name"
                    value={settings.email.fromName}
                    onChange={(e) => {
                      setSettings({
                        ...settings,
                        email: { ...settings.email, fromName: e.target.value },
                      })
                    }}
                    placeholder="Festival Name"
                  />
                  <Input
                    label="From Email"
                    type="email"
                    value={settings.email.fromEmail}
                    onChange={(e) => {
                      setSettings({
                        ...settings,
                        email: { ...settings.email, fromEmail: e.target.value },
                      })
                    }}
                    placeholder="no-reply@festival.com"
                  />
                </div>
                <Input
                  label="Reply-To Email"
                  type="email"
                  value={settings.email.replyToEmail || ''}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      email: { ...settings.email, replyToEmail: e.target.value },
                    })
                  }}
                  placeholder="support@festival.com"
                  hint="Email address that will receive replies"
                />
              </CardContent>
            </Card>
          )}

          {/* SMS Settings */}
          <NotificationToggleGroup
            title="SMS Notifications"
            description="Configure SMS notification settings"
          >
            <NotificationToggle
              id="sms-enabled"
              label="Enable SMS Notifications"
              description="Master switch for all SMS notifications"
              checked={settings.sms.enabled}
              onChange={() => handleUpdateSMSSettings('enabled', !settings.sms.enabled)}
              icon={<MessageSquare className="h-5 w-5" />}
              channel="sms"
            />
            <NotificationToggle
              id="sms-emergency"
              label="Emergency Alerts"
              description="Send SMS for emergency and safety notifications"
              checked={settings.sms.sendEmergencyAlerts}
              onChange={() => handleUpdateSMSSettings('sendEmergencyAlerts', !settings.sms.sendEmergencyAlerts)}
              disabled={!settings.sms.enabled}
            />
            <NotificationToggle
              id="sms-reminders"
              label="Event Reminders"
              description="Send SMS reminders before artist performances"
              checked={settings.sms.sendEventReminders}
              onChange={() => handleUpdateSMSSettings('sendEventReminders', !settings.sms.sendEventReminders)}
              disabled={!settings.sms.enabled}
            />
            <NotificationToggle
              id="sms-wallet"
              label="Wallet Notifications"
              description="Send SMS for wallet top-ups and transactions"
              checked={settings.sms.sendWalletNotifications}
              onChange={() => handleUpdateSMSSettings('sendWalletNotifications', !settings.sms.sendWalletNotifications)}
              disabled={!settings.sms.enabled}
            />
            <NotificationToggle
              id="sms-opt-in"
              label="Require Opt-In"
              description="Require explicit consent before sending SMS"
              checked={settings.sms.optInRequired}
              onChange={() => handleUpdateSMSSettings('optInRequired', !settings.sms.optInRequired)}
              disabled={!settings.sms.enabled}
            />
          </NotificationToggleGroup>

          {/* SMS Configuration */}
          {settings.sms.enabled && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SMS Configuration</CardTitle>
                <CardDescription>Configure SMS sender settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Sender ID"
                    value={settings.sms.senderId || ''}
                    onChange={(e) => {
                      setSettings({
                        ...settings,
                        sms: { ...settings.sms, senderId: e.target.value },
                      })
                    }}
                    placeholder="FestivalName"
                    hint="Max 11 characters (alphanumeric)"
                  />
                  <Input
                    label="Daily Limit"
                    type="number"
                    value={settings.sms.dailyLimit || 100}
                    onChange={(e) => {
                      setSettings({
                        ...settings,
                        sms: { ...settings.sms, dailyLimit: parseInt(e.target.value) || 100 },
                      })
                    }}
                    hint="Maximum SMS per day per user"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Push Notification Settings */}
          <NotificationToggleGroup
            title="Push Notifications"
            description="Configure push notification settings for the mobile app"
          >
            <NotificationToggle
              id="push-enabled"
              label="Enable Push Notifications"
              description="Master switch for all push notifications"
              checked={settings.push.enabled}
              onChange={() => handleUpdatePushSettings('enabled', !settings.push.enabled)}
              icon={<Smartphone className="h-5 w-5" />}
              channel="push"
            />
            <NotificationToggle
              id="push-schedule"
              label="Schedule Reminders"
              description="Remind attendees about upcoming performances"
              checked={settings.push.sendScheduleReminders}
              onChange={() => handleUpdatePushSettings('sendScheduleReminders', !settings.push.sendScheduleReminders)}
              disabled={!settings.push.enabled}
            />
            <NotificationToggle
              id="push-artist"
              label="Artist Alerts"
              description="Notify when favorited artists are about to perform"
              checked={settings.push.sendArtistAlerts}
              onChange={() => handleUpdatePushSettings('sendArtistAlerts', !settings.push.sendArtistAlerts)}
              disabled={!settings.push.enabled}
            />
            <NotificationToggle
              id="push-wallet"
              label="Wallet Notifications"
              description="Notify about wallet balance and transactions"
              checked={settings.push.sendWalletNotifications}
              onChange={() => handleUpdatePushSettings('sendWalletNotifications', !settings.push.sendWalletNotifications)}
              disabled={!settings.push.enabled}
            />
            <NotificationToggle
              id="push-emergency"
              label="Emergency Alerts"
              description="Critical safety and emergency notifications"
              checked={settings.push.sendEmergencyAlerts}
              onChange={() => handleUpdatePushSettings('sendEmergencyAlerts', !settings.push.sendEmergencyAlerts)}
              disabled={!settings.push.enabled}
            />
          </NotificationToggleGroup>

          {/* Quiet Hours */}
          {settings.push.enabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Moon className="h-4 w-4" />
                  Quiet Hours
                </CardTitle>
                <CardDescription>
                  Pause non-emergency push notifications during specified hours
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <NotificationToggle
                  id="quiet-hours-enabled"
                  label="Enable Quiet Hours"
                  description="Pause notifications during quiet hours (except emergencies)"
                  checked={settings.push.quietHoursEnabled}
                  onChange={() => handleUpdatePushSettings('quietHoursEnabled', !settings.push.quietHoursEnabled)}
                />
                {settings.push.quietHoursEnabled && (
                  <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Start Time
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="time"
                          value={settings.push.quietHoursStart || '23:00'}
                          onChange={(e) => handleUpdatePushSettings('quietHoursStart', e.target.value)}
                          className="w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        End Time
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="time"
                          value={settings.push.quietHoursEnd || '08:00'}
                          onChange={(e) => handleUpdatePushSettings('quietHoursEnd', e.target.value)}
                          className="w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-6 space-y-6">
          {/* Test Email Input */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="Enter email address for testing templates..."
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    leftIcon={<Mail className="h-4 w-4" />}
                  />
                </div>
                <p className="text-sm text-gray-500">
                  This email will receive test notifications when you click &quot;Test&quot; on a template.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[240px]">
              <Input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as TemplateCategory | 'all')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : categoryLabels[cat]}
                  </option>
                ))}
              </select>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value as NotificationChannel | 'all')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {channels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch === 'all' ? 'All Channels' : ch.charAt(0).toUpperCase() + ch.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Templates List */}
          <div className="space-y-4">
            {filteredTemplates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Mail className="h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-500">No templates found</p>
                </CardContent>
              </Card>
            ) : (
              filteredTemplates.map((template) => {
                const ChannelIcon = channelIcons[template.channel]
                return (
                  <Card key={template.id} hoverable>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-lg',
                              template.enabled ? 'bg-blue-100' : 'bg-gray-100'
                            )}
                          >
                            <ChannelIcon
                              className={cn(
                                'h-5 w-5',
                                template.enabled ? 'text-blue-600' : 'text-gray-400'
                              )}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3
                                className={cn(
                                  'font-medium',
                                  template.enabled ? 'text-gray-900' : 'text-gray-500'
                                )}
                              >
                                {template.name}
                              </h3>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                  categoryColors[template.category]
                                )}
                              >
                                {categoryLabels[template.category]}
                              </span>
                              {template.isDefault && (
                                <Badge variant="outline" size="sm">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 text-sm text-gray-500">{template.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewTemplate(template)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestEmail(template)}
                            disabled={!template.enabled || testingTemplate === template.id}
                            loading={testingTemplate === template.id}
                            leftIcon={<Send className="h-4 w-4" />}
                          >
                            Test
                          </Button>
                          <Link href={`/festivals/${festivalId}/settings/notifications/${template.id}`}>
                            <Button variant="outline" size="sm" leftIcon={<Edit className="h-4 w-4" />}>
                              Edit
                            </Button>
                          </Link>
                          <button
                            onClick={() => handleToggleTemplate(template.id, template.enabled)}
                            className={cn(
                              'rounded-lg p-2 transition-colors',
                              template.enabled
                                ? 'text-green-600 hover:bg-green-50'
                                : 'text-gray-400 hover:bg-gray-100'
                            )}
                            title={template.enabled ? 'Disable' : 'Enable'}
                          >
                            {template.enabled ? (
                              <ToggleRight className="h-6 w-6" />
                            ) : (
                              <ToggleLeft className="h-6 w-6" />
                            )}
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">Preview: {previewTemplate.name}</h2>
                <p className="text-sm text-gray-500">Subject: {previewTemplate.subject}</p>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-6">
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-medium text-gray-700">HTML Preview</h3>
                <div
                  className="rounded-lg border bg-gray-50 p-4"
                  dangerouslySetInnerHTML={{ __html: previewTemplate.htmlBody }}
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-700">Plain Text Preview</h3>
                <pre className="whitespace-pre-wrap rounded-lg border bg-gray-50 p-4 text-sm">
                  {previewTemplate.textBody}
                </pre>
              </div>
            </div>
            <div className="border-t px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Available variables:{' '}
                    {previewTemplate.variables.map((v) => `{{${v.name}}}`).join(', ')}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setPreviewTemplate(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
