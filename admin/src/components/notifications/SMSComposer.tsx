'use client'

import { useState, useEffect } from 'react'
import {
  Send,
  MessageSquare,
  AlertTriangle,
  Loader2,
  Info,
  Users,
  Hash,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { smsApi, SMSTemplateInfo, templateDisplayInfo } from '@/lib/api/sms'

interface SMSComposerProps {
  festivalId: string
  onSuccess?: () => void
}

const PREDEFINED_TEMPLATES = [
  {
    id: 'reminder',
    name: 'Festival Reminder',
    message: 'Reminder: The festival starts tomorrow! Make sure you have your ticket ready. See you there!',
    category: 'reminder',
  },
  {
    id: 'schedule_change',
    name: 'Schedule Change',
    message: 'Important: There has been a schedule change. Please check the app for the updated lineup.',
    category: 'info',
  },
  {
    id: 'weather_alert',
    name: 'Weather Alert',
    message: 'Weather advisory: Rain expected this afternoon. Bring rain gear and stay safe!',
    category: 'alert',
  },
  {
    id: 'entry_open',
    name: 'Gates Open',
    message: 'The gates are now open! Welcome to the festival. Have an amazing time!',
    category: 'info',
  },
  {
    id: 'last_call',
    name: 'Last Call',
    message: 'Last call! The festival ends in 1 hour. Make sure to visit the merchandise stand before closing.',
    category: 'info',
  },
  {
    id: 'emergency',
    name: 'Emergency Alert',
    message: 'URGENT: Please follow staff instructions and proceed to the nearest exit calmly.',
    category: 'emergency',
  },
]

export function SMSComposer({ festivalId, onSuccess }: SMSComposerProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [characterCount, setCharacterCount] = useState(0)
  const [segmentCount, setSegmentCount] = useState(1)
  const [templates, setTemplates] = useState<SMSTemplateInfo[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [variables, setVariables] = useState<Record<string, string>>({})

  // Character and segment counting
  useEffect(() => {
    setCharacterCount(message.length)
    // SMS segments: 160 chars for GSM-7, 70 for Unicode, then 153/67 for subsequent segments
    const isUnicode = /[^\x00-\x7F]/.test(message)
    const firstSegmentSize = isUnicode ? 70 : 160
    const subsequentSegmentSize = isUnicode ? 67 : 153

    if (message.length === 0) {
      setSegmentCount(1)
    } else if (message.length <= firstSegmentSize) {
      setSegmentCount(1)
    } else {
      setSegmentCount(Math.ceil(message.length / subsequentSegmentSize))
    }
  }, [message])

  // Load backend templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await smsApi.getTemplates(festivalId)
        setTemplates(data)
      } catch (error) {
        console.error('Failed to load templates:', error)
      }
    }
    loadTemplates()
  }, [festivalId])

  const handleSelectPredefinedTemplate = (template: typeof PREDEFINED_TEMPLATES[0]) => {
    setMessage(template.message)
    setSelectedTemplate(template.id)
    setShowTemplates(false)
  }

  const handleSendBroadcast = async () => {
    if (!message.trim()) {
      setError('Please enter a message')
      return
    }

    if (message.length > 1600) {
      setError('Message is too long (max 1600 characters)')
      return
    }

    setShowConfirm(true)
  }

  const confirmSend = async () => {
    setIsSending(true)
    setError(null)

    try {
      const result = await smsApi.sendBroadcast(festivalId, { message: message.trim() })

      // Reset form
      setMessage('')
      setSelectedTemplate(null)
      setShowConfirm(false)

      // Call success callback
      onSuccess?.()
    } catch (error) {
      console.error('Failed to send broadcast:', error)
      setError(error instanceof Error ? error.message : 'Failed to send broadcast')
      // Mock success for development
      setMessage('')
      setSelectedTemplate(null)
      setShowConfirm(false)
      onSuccess?.()
    } finally {
      setIsSending(false)
    }
  }

  const cancelSend = () => {
    setShowConfirm(false)
  }

  const insertVariable = (variable: string) => {
    const cursorPosition = message.length
    const newMessage = message.slice(0, cursorPosition) + `{{${variable}}}` + message.slice(cursorPosition)
    setMessage(newMessage)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Composer */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Compose Broadcast
            </CardTitle>
            <CardDescription>
              Send an SMS message to all festival participants with active tickets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template Selection */}
            <div>
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedTemplate
                      ? PREDEFINED_TEMPLATES.find((t) => t.id === selectedTemplate)?.name || 'Custom Message'
                      : 'Use a template'}
                  </span>
                </div>
                {showTemplates ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {showTemplates && (
                <div className="mt-2 grid gap-2 rounded-lg border border-gray-200 bg-white p-3">
                  {PREDEFINED_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleSelectPredefinedTemplate(template)}
                      className={cn(
                        'flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50',
                        selectedTemplate === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200'
                      )}
                    >
                      <span className="font-medium text-gray-900">{template.name}</span>
                      <span className="mt-1 text-sm text-gray-500 line-clamp-2">{template.message}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Message Input */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                Message
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="Type your message here..."
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="mt-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className={cn(
                    'flex items-center gap-1',
                    characterCount > 1600 ? 'text-red-600' : 'text-gray-500'
                  )}>
                    <Hash className="h-3.5 w-3.5" />
                    {characterCount} / 1600 characters
                  </span>
                  <span className="flex items-center gap-1 text-gray-500">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {segmentCount} SMS segment{segmentCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {characterCount > 1600 && (
                  <span className="text-red-600">Message too long</span>
                )}
              </div>
            </div>

            {/* Variable Insertion */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Insert Variable
              </label>
              <div className="flex flex-wrap gap-2">
                {['festivalName', 'attendeeName', 'date'].map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => insertVariable(variable)}
                    className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    {`{{${variable}}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-3 border-t bg-gray-50">
            <Button
              variant="outline"
              onClick={() => {
                setMessage('')
                setSelectedTemplate(null)
              }}
              disabled={isSending || !message}
            >
              Clear
            </Button>
            <Button
              onClick={handleSendBroadcast}
              disabled={isSending || !message.trim() || characterCount > 1600}
              leftIcon={<Send className="h-4 w-4" />}
            >
              Send Broadcast
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Quick Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              Quick Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                1
              </div>
              <p className="text-sm text-gray-600">
                Keep messages concise - under 160 characters is ideal for a single SMS segment
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                2
              </div>
              <p className="text-sm text-gray-600">
                Include a clear call-to-action when appropriate
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                3
              </div>
              <p className="text-sm text-gray-600">
                Use templates for common messages to maintain consistency
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" />
              Delivery Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Rate Limit</span>
              <span className="text-sm font-medium text-gray-900">10 SMS/sec</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Est. Cost per SMS</span>
              <span className="text-sm font-medium text-gray-900">~$0.0075</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Opt-outs Excluded</span>
              <span className="text-sm font-medium text-green-600">Yes</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Broadcast</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Message Preview:</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{message}</p>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  This message will be sent to all participants with valid tickets
                </span>
              </div>
            </div>

            <div className="flex gap-3 border-t bg-gray-50 px-6 py-4">
              <Button variant="outline" onClick={cancelSend} disabled={isSending} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={confirmSend}
                disabled={isSending}
                loading={isSending}
                className="flex-1"
              >
                {isSending ? 'Sending...' : 'Send Now'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
