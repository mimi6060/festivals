'use client'

import * as React from 'react'
import { useForm, UseFormReturn } from 'react-hook-form'
import {
  Save,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Send,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  EmailProvider,
  EMAIL_PROVIDERS,
  TwilioConfig,
  EmailConfig,
  UpdateTwilioInput,
  UpdateEmailInput,
} from '@/lib/api/integrations'

// Generic Config Form Field
interface ConfigFieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function ConfigField({
  label,
  hint,
  error,
  required = false,
  children,
  className,
}: ConfigFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      {!error && hint && <p className="mt-1.5 text-sm text-gray-500">{hint}</p>}
    </div>
  )
}

// Password/Secret Input with toggle visibility
interface SecretInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function SecretInput({ error, className, ...props }: SecretInputProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={cn(
          'w-full rounded-lg border py-2 pl-3 pr-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
          error && 'border-red-500',
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

// Twilio Configuration Form
interface TwilioConfigFormProps {
  config: TwilioConfig | null
  onSave: (data: UpdateTwilioInput) => Promise<void>
  onTest?: (phoneNumber: string) => Promise<{ success: boolean; message: string }>
  isLoading?: boolean
  isSaving?: boolean
}

export function TwilioConfigForm({
  config,
  onSave,
  onTest,
  isLoading = false,
  isSaving = false,
}: TwilioConfigFormProps) {
  const [testPhone, setTestPhone] = React.useState('')
  const [testResult, setTestResult] = React.useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isTesting, setIsTesting] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateTwilioInput>({
    defaultValues: {
      accountSid: config?.accountSid || '',
      authToken: '',
      fromNumber: config?.fromNumber || '',
      messagingServiceSid: config?.messagingServiceSid || '',
    },
  })

  const handleTest = async () => {
    if (!onTest || !testPhone) return
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await onTest(testPhone)
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to send test message',
      })
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <ConfigField
        label="Account SID"
        required
        error={errors.accountSid?.message}
        hint="Found in your Twilio Console"
      >
        <input
          type="text"
          {...register('accountSid', { required: 'Account SID is required' })}
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className={cn(
            'w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            errors.accountSid && 'border-red-500'
          )}
        />
      </ConfigField>

      <ConfigField
        label="Auth Token"
        required
        error={errors.authToken?.message}
        hint="Leave blank to keep existing token"
      >
        <SecretInput
          {...register('authToken')}
          placeholder="Enter your Auth Token"
          error={!!errors.authToken}
        />
      </ConfigField>

      <ConfigField
        label="From Phone Number"
        error={errors.fromNumber?.message}
        hint="Twilio phone number to send from (E.164 format)"
      >
        <input
          type="tel"
          {...register('fromNumber')}
          placeholder="+1234567890"
          className="w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </ConfigField>

      <ConfigField
        label="Messaging Service SID"
        hint="Optional: Use a Messaging Service instead of a phone number"
      >
        <input
          type="text"
          {...register('messagingServiceSid')}
          placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </ConfigField>

      {/* Test SMS */}
      {onTest && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <h4 className="mb-3 font-medium text-gray-900">Test SMS</h4>
          <div className="flex gap-2">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+1234567890"
              className="flex-1 rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !testPhone}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-gray-100 disabled:opacity-50"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Test
            </button>
          </div>
          {testResult && (
            <div
              className={cn(
                'mt-3 flex items-center gap-2 rounded-lg p-3',
                testResult.success
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              )}
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Balance Info */}
      {config?.balance !== undefined && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-900">
              Account Balance: {config.balance.toFixed(2)} {config.currency || 'USD'}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end border-t pt-4">
        <button
          type="submit"
          disabled={isSaving || !isDirty}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Configuration
        </button>
      </div>
    </form>
  )
}

// Email Provider Configuration Form
interface EmailConfigFormProps {
  config: EmailConfig | null
  onSave: (data: UpdateEmailInput) => Promise<void>
  onTest?: (email: string) => Promise<{ success: boolean; message: string }>
  isLoading?: boolean
  isSaving?: boolean
}

export function EmailConfigForm({
  config,
  onSave,
  onTest,
  isLoading = false,
  isSaving = false,
}: EmailConfigFormProps) {
  const [testEmail, setTestEmail] = React.useState('')
  const [testResult, setTestResult] = React.useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isTesting, setIsTesting] = React.useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<UpdateEmailInput>({
    defaultValues: {
      provider: config?.provider || 'smtp',
      fromName: config?.fromName || '',
      fromEmail: config?.fromEmail || '',
      replyToEmail: config?.replyToEmail || '',
      smtpHost: config?.smtpHost || '',
      smtpPort: config?.smtpPort || 587,
      smtpUser: config?.smtpUser || '',
      smtpPassword: '',
      smtpSecure: config?.smtpSecure ?? true,
      apiKey: '',
    },
  })

  const selectedProvider = watch('provider')

  const handleTest = async () => {
    if (!onTest || !testEmail) return
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await onTest(testEmail)
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to send test email',
      })
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <ConfigField label="Email Provider" required>
        <select
          {...register('provider')}
          className="w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {EMAIL_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label} - {p.description}
            </option>
          ))}
        </select>
      </ConfigField>

      <div className="grid gap-4 sm:grid-cols-2">
        <ConfigField
          label="From Name"
          required
          error={errors.fromName?.message}
        >
          <input
            type="text"
            {...register('fromName', { required: 'From name is required' })}
            placeholder="My Festival"
            className={cn(
              'w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              errors.fromName && 'border-red-500'
            )}
          />
        </ConfigField>

        <ConfigField
          label="From Email"
          required
          error={errors.fromEmail?.message}
        >
          <input
            type="email"
            {...register('fromEmail', {
              required: 'From email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
            placeholder="noreply@festival.com"
            className={cn(
              'w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              errors.fromEmail && 'border-red-500'
            )}
          />
        </ConfigField>
      </div>

      <ConfigField label="Reply-To Email" hint="Optional: Different reply address">
        <input
          type="email"
          {...register('replyToEmail')}
          placeholder="support@festival.com"
          className="w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </ConfigField>

      {/* SMTP-specific fields */}
      {selectedProvider === 'smtp' && (
        <div className="space-y-4 rounded-lg border bg-gray-50 p-4">
          <h4 className="font-medium text-gray-900">SMTP Settings</h4>

          <div className="grid gap-4 sm:grid-cols-2">
            <ConfigField label="SMTP Host" required>
              <input
                type="text"
                {...register('smtpHost')}
                placeholder="smtp.example.com"
                className="w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </ConfigField>

            <ConfigField label="SMTP Port" required>
              <input
                type="number"
                {...register('smtpPort', { valueAsNumber: true })}
                placeholder="587"
                className="w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </ConfigField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ConfigField label="SMTP Username">
              <input
                type="text"
                {...register('smtpUser')}
                placeholder="username"
                className="w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </ConfigField>

            <ConfigField label="SMTP Password" hint="Leave blank to keep existing">
              <SecretInput {...register('smtpPassword')} placeholder="Enter password" />
            </ConfigField>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="smtpSecure"
              {...register('smtpSecure')}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="smtpSecure" className="text-sm text-gray-700">
              Use TLS/SSL encryption
            </label>
          </div>
        </div>
      )}

      {/* API Key for other providers */}
      {selectedProvider !== 'smtp' && (
        <ConfigField
          label="API Key"
          required
          hint="Leave blank to keep existing key"
        >
          <SecretInput
            {...register('apiKey')}
            placeholder="Enter your API key"
          />
        </ConfigField>
      )}

      {/* Test Email */}
      {onTest && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <h4 className="mb-3 font-medium text-gray-900">Test Email</h4>
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="flex-1 rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !testEmail}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-gray-100 disabled:opacity-50"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Test
            </button>
          </div>
          {testResult && (
            <div
              className={cn(
                'mt-3 flex items-center gap-2 rounded-lg p-3',
                testResult.success
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              )}
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Verification status */}
      {config?.verified !== undefined && (
        <div
          className={cn(
            'rounded-lg border p-4',
            config.verified
              ? 'border-green-200 bg-green-50'
              : 'border-yellow-200 bg-yellow-50'
          )}
        >
          <div className="flex items-center gap-2">
            {config.verified ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900">Email configuration verified</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-900">
                  Email configuration not verified
                </span>
              </>
            )}
          </div>
          {config.lastTestedAt && (
            <p className="mt-1 text-sm text-gray-600">
              Last tested: {new Date(config.lastTestedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end border-t pt-4">
        <button
          type="submit"
          disabled={isSaving || !isDirty}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Configuration
        </button>
      </div>
    </form>
  )
}
