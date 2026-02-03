'use client'

import Link from 'next/link'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import {
  Wallet,
  MoreVertical,
  Eye,
  Lock,
  Unlock,
  CreditCard,
  Undo2,
  User,
  Mail,
  Nfc,
} from 'lucide-react'
import { Wallet as WalletType, WalletStatus } from '@/lib/api/wallets'
import { useState, useRef, useEffect } from 'react'

interface WalletCardProps {
  wallet: WalletType
  festivalId: string
  onFreeze?: (walletId: string) => void
  onUnfreeze?: (walletId: string) => void
  onTopUp?: (walletId: string) => void
  onRefund?: (walletId: string) => void
  selected?: boolean
  onSelect?: (walletId: string, selected: boolean) => void
  viewMode?: 'grid' | 'table'
}

const statusConfig: Record<WalletStatus, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: 'Actif', color: 'text-green-700', bgColor: 'bg-green-100' },
  FROZEN: { label: 'Gele', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  CLOSED: { label: 'Ferme', color: 'text-gray-700', bgColor: 'bg-gray-100' },
}

export function WalletCard({
  wallet,
  festivalId,
  onFreeze,
  onUnfreeze,
  onTopUp,
  onRefund,
  selected = false,
  onSelect,
  viewMode = 'grid',
}: WalletCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const config = statusConfig[wallet.status]

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFreeze = () => {
    onFreeze?.(wallet.id)
    setMenuOpen(false)
  }

  const handleUnfreeze = () => {
    onUnfreeze?.(wallet.id)
    setMenuOpen(false)
  }

  const handleTopUp = () => {
    onTopUp?.(wallet.id)
    setMenuOpen(false)
  }

  const handleRefund = () => {
    onRefund?.(wallet.id)
    setMenuOpen(false)
  }

  if (viewMode === 'table') {
    return (
      <tr className="border-b hover:bg-gray-50">
        {onSelect && (
          <td className="px-4 py-3">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(wallet.id, e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </td>
        )}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
              {wallet.user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <Link
                href={`/festivals/${festivalId}/wallets/${wallet.id}`}
                className="font-medium text-gray-900 hover:text-primary"
              >
                {wallet.user.name}
              </Link>
              <p className="text-sm text-gray-500">{wallet.user.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="font-semibold text-gray-900">{formatCurrency(wallet.balance)}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-gray-600">{formatCurrency(wallet.totalTopUps)}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-gray-600">{formatCurrency(wallet.totalSpent)}</span>
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1 text-sm text-gray-500">
            <Nfc className="h-4 w-4" />
            {wallet.nfcTags.filter((t) => t.isActive).length}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              config.bgColor,
              config.color
            )}
          >
            {config.label}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg p-1.5 hover:bg-gray-100"
            >
              <MoreVertical className="h-5 w-5 text-gray-500" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
                <Link
                  href={`/festivals/${festivalId}/wallets/${wallet.id}`}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4" />
                  Voir les details
                </Link>
                {wallet.status === 'ACTIVE' && onTopUp && (
                  <button
                    onClick={handleTopUp}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    Recharger
                  </button>
                )}
                {wallet.status === 'ACTIVE' && wallet.balance > 0 && onRefund && (
                  <button
                    onClick={handleRefund}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Undo2 className="h-4 w-4" />
                    Rembourser
                  </button>
                )}
                <hr className="my-1" />
                {wallet.status === 'ACTIVE' && onFreeze && (
                  <button
                    onClick={handleFreeze}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                  >
                    <Lock className="h-4 w-4" />
                    Geler le portefeuille
                  </button>
                )}
                {wallet.status === 'FROZEN' && onUnfreeze && (
                  <button
                    onClick={handleUnfreeze}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                  >
                    <Unlock className="h-4 w-4" />
                    Degeler le portefeuille
                  </button>
                )}
              </div>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="group relative rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Selection checkbox */}
      {onSelect && (
        <div className="absolute left-4 top-4">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(wallet.id, e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
        </div>
      )}

      {/* Header with user info and menu */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
            {wallet.user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <Link
              href={`/festivals/${festivalId}/wallets/${wallet.id}`}
              className="font-semibold text-gray-900 hover:text-primary"
            >
              {wallet.user.name}
            </Link>
            <p className="text-sm text-gray-500">{wallet.user.email}</p>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100"
          >
            <MoreVertical className="h-5 w-5 text-gray-500" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
              <Link
                href={`/festivals/${festivalId}/wallets/${wallet.id}`}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Eye className="h-4 w-4" />
                Voir les details
              </Link>
              {wallet.status === 'ACTIVE' && onTopUp && (
                <button
                  onClick={handleTopUp}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <CreditCard className="h-4 w-4" />
                  Recharger
                </button>
              )}
              {wallet.status === 'ACTIVE' && wallet.balance > 0 && onRefund && (
                <button
                  onClick={handleRefund}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Undo2 className="h-4 w-4" />
                  Rembourser
                </button>
              )}
              <hr className="my-1" />
              {wallet.status === 'ACTIVE' && onFreeze && (
                <button
                  onClick={handleFreeze}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                >
                  <Lock className="h-4 w-4" />
                  Geler le portefeuille
                </button>
              )}
              {wallet.status === 'FROZEN' && onUnfreeze && (
                <button
                  onClick={handleUnfreeze}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                >
                  <Unlock className="h-4 w-4" />
                  Degeler le portefeuille
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-sm text-gray-500">Solde actuel</p>
        <p className="text-2xl font-bold text-gray-900">{formatCurrency(wallet.balance)}</p>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500">Total recharge</p>
          <p className="font-medium text-green-600">{formatCurrency(wallet.totalTopUps)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total depense</p>
          <p className="font-medium text-gray-900">{formatCurrency(wallet.totalSpent)}</p>
        </div>
      </div>

      {/* Footer with status and NFC tags */}
      <div className="flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              config.bgColor,
              config.color
            )}
          >
            {config.label}
          </span>
          {wallet.nfcTags.filter((t) => t.isActive).length > 0 && (
            <span className="inline-flex items-center gap-1 text-sm text-gray-500">
              <Nfc className="h-4 w-4" />
              {wallet.nfcTags.filter((t) => t.isActive).length} tag(s)
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Skeleton for loading state
export function WalletCardSkeleton({ viewMode = 'grid' }: { viewMode?: 'grid' | 'table' }) {
  if (viewMode === 'table') {
    return (
      <tr className="border-b animate-pulse">
        <td className="px-4 py-3">
          <div className="h-4 w-4 rounded bg-gray-200" />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="h-3 w-48 rounded bg-gray-200" />
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="h-5 w-20 rounded bg-gray-200" />
        </td>
        <td className="px-4 py-3">
          <div className="h-4 w-16 rounded bg-gray-200" />
        </td>
        <td className="px-4 py-3">
          <div className="h-4 w-16 rounded bg-gray-200" />
        </td>
        <td className="px-4 py-3">
          <div className="h-4 w-8 rounded bg-gray-200" />
        </td>
        <td className="px-4 py-3">
          <div className="h-5 w-16 rounded-full bg-gray-200" />
        </td>
        <td className="px-4 py-3">
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
        </td>
      </tr>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm animate-pulse">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="h-3 w-40 rounded bg-gray-200" />
          </div>
        </div>
      </div>
      <div className="mb-4">
        <div className="h-3 w-20 rounded bg-gray-200 mb-2" />
        <div className="h-8 w-28 rounded bg-gray-200" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="h-3 w-20 rounded bg-gray-200" />
          <div className="h-4 w-16 rounded bg-gray-200" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-20 rounded bg-gray-200" />
          <div className="h-4 w-16 rounded bg-gray-200" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t pt-3">
        <div className="h-5 w-16 rounded-full bg-gray-200" />
        <div className="h-4 w-12 rounded bg-gray-200" />
      </div>
    </div>
  )
}
