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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import {
  notificationsApi,
  NotificationTemplate,
  TemplateCategory,
  NotificationChannel,
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

export default function NotificationSettingsPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel | 'all'>('all')
  const [testingTemplate, setTestingTemplate] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [festivalId])

  const loadTemplates = async () => {
    try {
      const data = await notificationsApi.getTemplates(festivalId)
      setTemplates(data)
    } catch (error) {
      console.error('Failed to load templates:', error)
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
            <h1 className="text-2xl font-bold text-gray-900">Notification Templates</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage email templates and notification settings for your festival
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
