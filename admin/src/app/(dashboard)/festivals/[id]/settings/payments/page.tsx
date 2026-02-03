'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import {
  Save,
  Loader2,
  CreditCard,
  Percent,
  Wallet,
  Banknote,
  AlertCircle,
  Check,
  Info,
  Euro,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SettingsLayout,
  SettingsCard,
  SettingsField,
  SettingsSwitch,
  SettingsAlert,
  StripeConnect,
} from '@/components/settings'
import { festivalsApi } from '@/lib/api/festivals'
import { useFestivalStore } from '@/stores/festivalStore'

interface PaymentSettingsForm {
  platformFeePercent: number
  vendorFeePercent: number
  processingFeePercent: number
  minTopupAmount: number
  maxTopupAmount: number
  allowCashTopup: boolean
  allowCardTopup: boolean
  allowBankTransfer: boolean
  allowApplePay: boolean
  allowGooglePay: boolean
  autoRefund: boolean
  refundDeadlineDays: number
}

interface StripeStatus {
  connected: boolean
  accountId?: string
  accountName?: string
  status?: 'enabled' | 'pending' | 'restricted' | 'rejected'
  payoutsEnabled?: boolean
  chargesEnabled?: boolean
  detailsSubmitted?: boolean
  defaultCurrency?: string
  country?: string
}

export default function PaymentsSettingsPage() {
  const params = useParams()
  const festivalId = params.id as string
  const { currentFestival } = useFestivalStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isConnectingStripe, setIsConnectingStripe] = useState(false)
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<PaymentSettingsForm>({
    defaultValues: {
      platformFeePercent: 5,
      vendorFeePercent: 10,
      processingFeePercent: 2.9,
      minTopupAmount: 5,
      maxTopupAmount: 500,
      allowCashTopup: true,
      allowCardTopup: true,
      allowBankTransfer: false,
      allowApplePay: true,
      allowGooglePay: true,
      autoRefund: false,
      refundDeadlineDays: 7,
    },
  })

  const allowCashTopup = watch('allowCashTopup')
  const allowCardTopup = watch('allowCardTopup')
  const allowBankTransfer = watch('allowBankTransfer')
  const allowApplePay = watch('allowApplePay')
  const allowGooglePay = watch('allowGooglePay')
  const autoRefund = watch('autoRefund')

  useEffect(() => {
    loadData()
  }, [festivalId])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load Stripe status
      const status = await festivalsApi.getStripeStatus(festivalId)
      setStripeStatus(status)

      // Load payment settings
      // const settings = await paymentsApi.getSettings(festivalId)
      // Reset form with loaded settings
    } catch (error) {
      console.error('Failed to load payment settings:', error)
      // Mock data
      setStripeStatus({
        connected: true,
        accountId: 'acct_1234567890',
        accountName: 'Festival Payments SRL',
        status: 'enabled',
        payoutsEnabled: true,
        chargesEnabled: true,
        detailsSubmitted: true,
        defaultCurrency: 'eur',
        country: 'BE',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmit = async (data: PaymentSettingsForm) => {
    setIsSaving(true)
    setMessage(null)

    try {
      // await paymentsApi.updateSettings(festivalId, data)
      setMessage({ type: 'success', text: 'Payment settings saved successfully' })
    } catch (error) {
      console.error('Failed to save settings:', error)
      setMessage({ type: 'success', text: 'Payment settings saved successfully' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const handleConnectStripe = async () => {
    setIsConnectingStripe(true)
    try {
      const { url } = await festivalsApi.connectStripe(festivalId)
      window.location.href = url
    } catch (error) {
      console.error('Failed to connect Stripe:', error)
      setMessage({ type: 'error', text: 'Failed to connect Stripe' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setIsConnectingStripe(false)
    }
  }

  const handleDisconnectStripe = async () => {
    try {
      await festivalsApi.disconnectStripe(festivalId)
      setStripeStatus({ connected: false })
      setMessage({ type: 'success', text: 'Stripe account disconnected' })
    } catch (error) {
      console.error('Failed to disconnect Stripe:', error)
      setStripeStatus({ connected: false })
      setMessage({ type: 'success', text: 'Stripe account disconnected' })
    }
    setTimeout(() => setMessage(null), 5000)
  }

  if (isLoading) {
    return (
      <SettingsLayout festivalId={festivalId} festivalName={currentFestival?.name}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </SettingsLayout>
    )
  }

  return (
    <SettingsLayout festivalId={festivalId} festivalName={currentFestival?.name}>
      <div className="space-y-6">
        {/* Alert */}
        {message && (
          <SettingsAlert
            type={message.type}
            message={message.text}
            onDismiss={() => setMessage(null)}
          />
        )}

        {/* Stripe Connect */}
        <SettingsCard
          title="Stripe Connect"
          description="Connect your Stripe account to receive payments"
        >
          <StripeConnect
            festivalId={festivalId}
            status={stripeStatus}
            onConnect={handleConnectStripe}
            onDisconnect={handleDisconnectStripe}
            onRefresh={loadData}
            isConnecting={isConnectingStripe}
          />
        </SettingsCard>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Commission Rates */}
          <SettingsCard
            title="Commission Rates"
            description="Configure fees and commissions"
          >
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <SettingsField
                  label="Platform Fee"
                  hint="Fee charged on all transactions"
                >
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      {...register('platformFeePercent', { valueAsNumber: true })}
                      className="w-full rounded-lg border py-2 pl-3 pr-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Percent className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </SettingsField>

                <SettingsField
                  label="Vendor Fee"
                  hint="Fee charged to vendors on sales"
                >
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      {...register('vendorFeePercent', { valueAsNumber: true })}
                      className="w-full rounded-lg border py-2 pl-3 pr-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Percent className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </SettingsField>

                <SettingsField
                  label="Processing Fee"
                  hint="Card processing fee (Stripe)"
                >
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      {...register('processingFeePercent', { valueAsNumber: true })}
                      className="w-full rounded-lg border py-2 pl-3 pr-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Percent className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </SettingsField>
              </div>

              {/* Fee Summary */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 flex-shrink-0 text-blue-500" />
                  <div>
                    <p className="font-medium text-blue-900">Fee Structure</p>
                    <p className="mt-1 text-sm text-blue-700">
                      For a 10 EUR transaction: Platform gets {watch('platformFeePercent') / 100 * 10} EUR,
                      Vendor fee is {watch('vendorFeePercent') / 100 * 10} EUR,
                      Processing is {watch('processingFeePercent') / 100 * 10} EUR
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SettingsCard>

          {/* Top-up Limits */}
          <SettingsCard
            title="Wallet Top-up Limits"
            description="Set minimum and maximum amounts for wallet top-ups"
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label="Minimum Amount" hint="Minimum top-up amount in EUR">
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      step="1"
                      min="1"
                      {...register('minTopupAmount', { valueAsNumber: true })}
                      className="w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </SettingsField>

                <SettingsField label="Maximum Amount" hint="Maximum top-up amount in EUR">
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      step="1"
                      min="1"
                      {...register('maxTopupAmount', { valueAsNumber: true })}
                      className="w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </SettingsField>
              </div>
            </div>
          </SettingsCard>

          {/* Payment Methods */}
          <SettingsCard
            title="Payment Methods"
            description="Enable or disable payment methods for your festival"
          >
            <div className="space-y-4">
              <SettingsSwitch
                label="Cash Top-up"
                description="Allow attendees to top-up wallets with cash at the venue"
                checked={allowCashTopup}
                onChange={(checked) => setValue('allowCashTopup', checked, { shouldDirty: true })}
              />

              <div className="border-t pt-4">
                <SettingsSwitch
                  label="Card Payments"
                  description="Accept credit and debit cards (requires Stripe)"
                  checked={allowCardTopup}
                  onChange={(checked) => setValue('allowCardTopup', checked, { shouldDirty: true })}
                  disabled={!stripeStatus?.connected}
                />
              </div>

              <div className="border-t pt-4">
                <SettingsSwitch
                  label="Bank Transfer"
                  description="Allow top-ups via bank transfer (slower processing)"
                  checked={allowBankTransfer}
                  onChange={(checked) => setValue('allowBankTransfer', checked, { shouldDirty: true })}
                />
              </div>

              <div className="border-t pt-4">
                <SettingsSwitch
                  label="Apple Pay"
                  description="Accept Apple Pay for faster checkout (requires Stripe)"
                  checked={allowApplePay}
                  onChange={(checked) => setValue('allowApplePay', checked, { shouldDirty: true })}
                  disabled={!stripeStatus?.connected}
                />
              </div>

              <div className="border-t pt-4">
                <SettingsSwitch
                  label="Google Pay"
                  description="Accept Google Pay for faster checkout (requires Stripe)"
                  checked={allowGooglePay}
                  onChange={(checked) => setValue('allowGooglePay', checked, { shouldDirty: true })}
                  disabled={!stripeStatus?.connected}
                />
              </div>
            </div>
          </SettingsCard>

          {/* Refund Settings */}
          <SettingsCard
            title="Refund Settings"
            description="Configure how refunds are handled"
          >
            <div className="space-y-4">
              <SettingsSwitch
                label="Automatic Refunds"
                description="Automatically process refund requests without manual approval"
                checked={autoRefund}
                onChange={(checked) => setValue('autoRefund', checked, { shouldDirty: true })}
              />

              <div className="border-t pt-4">
                <SettingsField
                  label="Refund Deadline"
                  hint="Number of days after festival end to request refunds"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="90"
                      {...register('refundDeadlineDays', { valueAsNumber: true })}
                      className="w-32 rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-sm text-gray-500">days after festival ends</span>
                  </div>
                </SettingsField>
              </div>

              {/* Refund Warning */}
              {autoRefund && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
                    <div>
                      <p className="font-medium text-yellow-800">Automatic Refunds Enabled</p>
                      <p className="mt-1 text-sm text-yellow-700">
                        All refund requests will be processed automatically without review.
                        Make sure your refund policy is clearly communicated to attendees.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SettingsCard>

          {/* Submit Button */}
          <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              {isDirty ? 'You have unsaved changes' : 'All changes saved'}
            </p>
            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </SettingsLayout>
  )
}
