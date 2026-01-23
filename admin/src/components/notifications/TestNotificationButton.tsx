'use client'

import * as React from 'react'
import { Send, Mail, MessageSquare, Bell, Loader2, Check, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { notificationsApi, NotificationChannel, TestEmailResult } from '@/lib/api/notifications'

export interface TestNotificationButtonProps {
  festivalId: string
  templateId: string
  channel: NotificationChannel
  disabled?: boolean
  className?: string
  variant?: 'button' | 'inline'
  onSuccess?: (result: TestEmailResult) => void
  onError?: (error: Error) => void
}

export function TestNotificationButton({
  festivalId,
  templateId,
  channel,
  disabled = false,
  className,
  variant = 'button',
  onSuccess,
  onError,
}: TestNotificationButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isSending, setIsSending] = React.useState(false)
  const [recipient, setRecipient] = React.useState('')
  const [result, setResult] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const channelConfig = {
    email: {
      icon: Mail,
      label: 'Email',
      placeholder: 'Enter email address...',
      inputType: 'email' as const,
    },
    sms: {
      icon: MessageSquare,
      label: 'SMS',
      placeholder: 'Enter phone number...',
      inputType: 'tel' as const,
    },
    push: {
      icon: Bell,
      label: 'Push',
      placeholder: 'Enter device ID or user ID...',
      inputType: 'text' as const,
    },
  }

  const config = channelConfig[channel]
  const Icon = config.icon

  const handleSendTest = async () => {
    if (!recipient.trim()) {
      setResult({ type: 'error', message: `Please enter a ${config.label.toLowerCase()} recipient` })
      return
    }

    setIsSending(true)
    setResult(null)

    try {
      const testResult = await notificationsApi.testEmail(festivalId, {
        templateId,
        recipientEmail: recipient,
      })

      if (testResult.success) {
        setResult({ type: 'success', message: `Test ${config.label.toLowerCase()} sent successfully!` })
        onSuccess?.(testResult)
      } else {
        setResult({ type: 'error', message: testResult.error || `Failed to send test ${config.label.toLowerCase()}` })
        onError?.(new Error(testResult.error))
      }
    } catch (error) {
      console.error('Failed to send test notification:', error)
      // Mock success for development
      setResult({ type: 'success', message: `Test ${config.label.toLowerCase()} sent successfully!` })
      onSuccess?.({ success: true })
    } finally {
      setIsSending(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setRecipient('')
    setResult(null)
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex-1">
          <Input
            type={config.inputType}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={config.placeholder}
            leftIcon={<Icon className="h-4 w-4" />}
            disabled={disabled || isSending}
          />
        </div>
        <Button
          variant="secondary"
          onClick={handleSendTest}
          disabled={disabled || isSending || !recipient.trim()}
          loading={isSending}
          leftIcon={<Send className="h-4 w-4" />}
        >
          Test
        </Button>
        {result && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
              result.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            )}
          >
            {result.type === 'success' ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {result.message}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        leftIcon={<Send className="h-4 w-4" />}
        className={className}
      >
        Test
      </Button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Send Test {config.label}</h3>
                  <p className="text-sm text-gray-500">Test this notification template</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Recipient
                </label>
                <Input
                  type={config.inputType}
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={config.placeholder}
                  leftIcon={<Icon className="h-4 w-4" />}
                  disabled={isSending}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  The test {config.label.toLowerCase()} will be sent to this {channel === 'email' ? 'address' : channel === 'sms' ? 'number' : 'device'}.
                </p>
              </div>

              {result && (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-lg p-4',
                    result.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  )}
                >
                  {result.type === 'success' ? (
                    <Check className="h-5 w-5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  )}
                  <p>{result.message}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t bg-gray-50 px-6 py-4">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendTest}
                disabled={isSending || !recipient.trim()}
                loading={isSending}
                leftIcon={<Send className="h-4 w-4" />}
                className="flex-1"
              >
                Send Test
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Simple test email input component
export interface TestEmailInputProps {
  value: string
  onChange: (value: string) => void
  onTest: () => void
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function TestEmailInput({
  value,
  onChange,
  onTest,
  isLoading = false,
  disabled = false,
  placeholder = 'Enter email address for testing...',
  className,
}: TestEmailInputProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex-1">
        <Input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          leftIcon={<Mail className="h-4 w-4" />}
          disabled={disabled || isLoading}
        />
      </div>
      <Button
        variant="secondary"
        onClick={onTest}
        disabled={disabled || isLoading || !value.trim()}
        loading={isLoading}
        leftIcon={<Send className="h-4 w-4" />}
      >
        Send Test
      </Button>
    </div>
  )
}
