'use client'

import Link from 'next/link'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Nfc,
  RefreshCw,
  Unlink,
  ChevronRight,
  Snowflake,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import type { UserWallet } from '@/lib/api/account'

interface WalletCardProps {
  wallet: UserWallet
  onRequestRefund?: (walletId: string) => void
  onUnlink?: (walletId: string) => void
  showActions?: boolean
  compact?: boolean
}

const statusConfig: Record<UserWallet['status'], {
  variant: 'success' | 'warning' | 'error' | 'default'
  label: string
  icon: typeof CheckCircle
}> = {
  ACTIVE: { variant: 'success', label: 'Actif', icon: CheckCircle },
  FROZEN: { variant: 'warning', label: 'Gele', icon: Snowflake },
  CLOSED: { variant: 'default', label: 'Ferme', icon: XCircle },
}

export function WalletCard({
  wallet,
  onRequestRefund,
  onUnlink,
  showActions = true,
  compact = false,
}: WalletCardProps) {
  const config = statusConfig[wallet.status]
  const StatusIcon = config.icon
  const isActive = wallet.status === 'ACTIVE'

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow">
        <div className="flex items-center gap-4">
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-lg',
            isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
          )}>
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{wallet.festivalName}</h3>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(wallet.balance, wallet.currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={config.variant}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
          {wallet.nfcLinked && (
            <span className="flex items-center text-sm text-gray-500">
              <Nfc className="h-4 w-4 mr-1" />
              Lie
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-xl border bg-white overflow-hidden transition-shadow',
      isActive ? 'shadow-sm hover:shadow-md' : 'opacity-75'
    )}>
      {/* Header */}
      <div className={cn(
        'px-6 py-4',
        isActive ? 'bg-gradient-to-r from-green-50 to-emerald-50' : 'bg-gray-50'
      )}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl',
              isActive ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
            )}>
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{wallet.festivalName}</h3>
              <Badge variant={config.variant} size="sm">
                <StatusIcon className="mr-1 h-3 w-3" />
                {config.label}
              </Badge>
            </div>
          </div>
          {wallet.nfcLinked && (
            <div className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              <Nfc className="h-4 w-4" />
              NFC lie
            </div>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="p-6">
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 mb-1">Solde actuel</p>
          <p className="text-4xl font-bold text-gray-900">{formatCurrency(wallet.balance, wallet.currency)}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
              <span className="text-xs text-gray-500">Total recharge</span>
            </div>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(wallet.totalTopUps, wallet.currency)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              <span className="text-xs text-gray-500">Total depense</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(wallet.totalSpent, wallet.currency)}
            </p>
          </div>
        </div>

        {/* Frozen notice */}
        {wallet.status === 'FROZEN' && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 mb-6">
            <div className="flex items-start gap-3">
              <Snowflake className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Portefeuille gele</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Votre portefeuille est temporairement gele. Contactez le support pour plus d'informations.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {showActions && isActive && (
          <div className="flex flex-wrap gap-3">
            <Link href={`/account/wallet?id=${wallet.id}`} className="flex-1">
              <Button variant="primary" className="w-full" rightIcon={<ChevronRight className="h-4 w-4" />}>
                Voir les transactions
              </Button>
            </Link>
            {wallet.balance > 0 && onRequestRefund && (
              <Button
                variant="outline"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={() => onRequestRefund(wallet.id)}
              >
                Demander un remboursement
              </Button>
            )}
            {wallet.nfcLinked && onUnlink && (
              <Button
                variant="ghost"
                leftIcon={<Unlink className="h-4 w-4" />}
                onClick={() => onUnlink(wallet.id)}
              >
                Delier NFC
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Mini card for dashboard overview
export function WalletMiniCard({ wallet }: { wallet: UserWallet }) {
  const isActive = wallet.status === 'ACTIVE'

  return (
    <Link
      href={`/account/wallet?id=${wallet.id}`}
      className={cn(
        'flex items-center gap-4 rounded-lg border bg-white p-4 hover:shadow-sm transition-all',
        !isActive && 'opacity-60'
      )}
    >
      <div className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg',
        isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
      )}>
        <Wallet className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 truncate">{wallet.festivalName}</p>
        <p className="font-semibold text-gray-900">{formatCurrency(wallet.balance, wallet.currency)}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-gray-400" />
    </Link>
  )
}

// Skeleton for loading state
export function WalletCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-white p-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-gray-200" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="h-5 w-20 rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-6 w-16 rounded-full bg-gray-200" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden animate-pulse">
      <div className="px-6 py-4 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gray-200" />
          <div className="space-y-2">
            <div className="h-5 w-32 rounded bg-gray-200" />
            <div className="h-4 w-16 rounded-full bg-gray-200" />
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="text-center mb-6">
          <div className="h-3 w-20 rounded bg-gray-200 mx-auto mb-2" />
          <div className="h-10 w-32 rounded bg-gray-200 mx-auto" />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg bg-gray-100 p-4">
            <div className="h-3 w-20 rounded bg-gray-200 mb-2" />
            <div className="h-6 w-24 rounded bg-gray-200" />
          </div>
          <div className="rounded-lg bg-gray-100 p-4">
            <div className="h-3 w-20 rounded bg-gray-200 mb-2" />
            <div className="h-6 w-24 rounded bg-gray-200" />
          </div>
        </div>
        <div className="h-10 w-full rounded bg-gray-200" />
      </div>
    </div>
  )
}
