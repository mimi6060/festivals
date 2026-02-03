'use client'

import * as React from 'react'
import {
  Link as LinkIcon,
  Unlink,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  CreditCard,
  Building,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface StripeConnectProps {
  festivalId: string
  status: StripeStatus | null
  onConnect: () => Promise<void>
  onDisconnect: () => Promise<void>
  onRefresh: () => Promise<void>
  isConnecting?: boolean
}

export function StripeConnect({
  festivalId,
  status,
  onConnect,
  onDisconnect,
  onRefresh,
  isConnecting = false,
}: StripeConnectProps) {
  const [isDisconnecting, setIsDisconnecting] = React.useState(false)

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Stripe account? This will disable payments.')) {
      return
    }

    setIsDisconnecting(true)
    try {
      await onDisconnect()
    } finally {
      setIsDisconnecting(false)
    }
  }

  const getStatusBadge = () => {
    if (!status?.connected) return null

    const statusConfig = {
      enabled: { label: 'Active', className: 'bg-green-100 text-green-800' },
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
      restricted: { label: 'Restricted', className: 'bg-orange-100 text-orange-800' },
      rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
    }

    const config = statusConfig[status.status || 'pending']
    return (
      <span className={cn('rounded-full px-2 py-1 text-xs font-medium', config.className)}>
        {config.label}
      </span>
    )
  }

  if (status?.connected) {
    return (
      <div className="space-y-6">
        {/* Connected Status */}
        <div className="flex items-center gap-4 rounded-lg bg-green-50 p-4">
          <div className="rounded-full bg-green-100 p-2">
            <Check className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-green-900">Stripe Connected</p>
              {getStatusBadge()}
            </div>
            {status.accountName && (
              <p className="text-sm text-green-700">{status.accountName}</p>
            )}
            <p className="text-xs text-green-600">Account ID: {status.accountId}</p>
          </div>
        </div>

        {/* Account Details */}
        <div className="rounded-lg border p-4">
          <h3 className="mb-4 font-medium text-gray-900">Account Details</h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Country</dt>
              <dd className="font-medium text-gray-900">{status.country || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Default Currency</dt>
              <dd className="font-medium text-gray-900">{status.defaultCurrency?.toUpperCase() || 'EUR'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Charges Enabled</dt>
              <dd className="font-medium">
                {status.chargesEnabled ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-red-600">No</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Payouts Enabled</dt>
              <dd className="font-medium">
                {status.payoutsEnabled ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-red-600">No</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Capabilities Warning */}
        {(!status.chargesEnabled || !status.payoutsEnabled) && (
          <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">Account Setup Incomplete</p>
              <p className="mt-1 text-sm text-yellow-700">
                Some features are disabled. Please complete your Stripe account setup.
              </p>
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-yellow-700 hover:underline"
              >
                Go to Stripe Dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4" />
            Open Stripe Dashboard
          </a>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {isDisconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Unlink className="h-4 w-4" />
            )}
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Not Connected Status */}
      <div className="flex items-center gap-4 rounded-lg bg-yellow-50 p-4">
        <div className="rounded-full bg-yellow-100 p-2">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
        </div>
        <div>
          <p className="font-medium text-yellow-900">No Stripe Account Connected</p>
          <p className="text-sm text-yellow-700">
            Connect a Stripe account to receive payments
          </p>
        </div>
      </div>

      {/* Benefits */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-4 font-medium text-gray-900">Why Connect Stripe?</h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <div className="rounded bg-blue-100 p-1">
              <CreditCard className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Accept Payments</p>
              <p className="text-sm text-gray-500">
                Receive payments from ticket sales and wallet top-ups
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="rounded bg-green-100 p-1">
              <Building className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Automatic Payouts</p>
              <p className="text-sm text-gray-500">
                Get funds transferred directly to your bank account
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="rounded bg-purple-100 p-1">
              <Shield className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Secure & Compliant</p>
              <p className="text-sm text-gray-500">
                PCI-compliant payment processing with fraud protection
              </p>
            </div>
          </li>
        </ul>
      </div>

      {/* Connect Button */}
      <button
        onClick={onConnect}
        disabled={isConnecting}
        className="inline-flex items-center gap-2 rounded-lg bg-[#635BFF] px-6 py-3 text-white hover:bg-[#5851E5] disabled:opacity-50"
      >
        {isConnecting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <LinkIcon className="h-5 w-5" />
        )}
        Connect with Stripe
      </button>
    </div>
  )
}
