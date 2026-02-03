'use client'

import Link from 'next/link'
import { CreditCard, Ban, CheckCircle, AlertTriangle, User, Mail, Wallet } from 'lucide-react'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import type { NFCTag, NFCTagStatus } from '@/lib/api/nfc'

const statusConfig: Record<NFCTagStatus, { label: string; bg: string; text: string; icon: typeof CheckCircle }> = {
  UNASSIGNED: { label: 'Non assigne', bg: 'bg-gray-100', text: 'text-gray-700', icon: CreditCard },
  ACTIVE: { label: 'Actif', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  BLOCKED: { label: 'Bloque', bg: 'bg-red-100', text: 'text-red-700', icon: Ban },
  LOST: { label: 'Perdu', bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle },
}

interface NFCTagCardProps {
  tag: NFCTag
  festivalId: string
  selected?: boolean
  onSelect?: (selected: boolean) => void
}

export function NFCTagCard({ tag, festivalId, selected, onSelect }: NFCTagCardProps) {
  const status = statusConfig[tag.status]
  const StatusIcon = status.icon

  return (
    <Link
      href={`/festivals/${festivalId}/nfc/${tag.id}`}
      className={cn(
        'block rounded-lg border bg-white p-6 transition-all hover:border-gray-300 hover:shadow-sm',
        selected && 'ring-2 ring-primary border-primary'
      )}
      onClick={(e) => {
        if (onSelect && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault()
        }
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {onSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation()
                onSelect(e.target.checked)
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-gray-300"
            />
          )}
          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <p className="font-mono text-sm font-medium text-gray-900">{tag.uid}</p>
            {tag.ticketTypeName && (
              <p className="text-xs text-gray-500">{tag.ticketTypeName}</p>
            )}
          </div>
        </div>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', status.bg, status.text)}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>

      {tag.holderName && (
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4 text-gray-400" />
            {tag.holderName}
          </div>
          {tag.holderEmail && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Mail className="h-4 w-4 text-gray-400" />
              {tag.holderEmail}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-gray-400" />
          <span className={cn(
            'text-lg font-semibold',
            tag.walletBalance !== null && tag.walletBalance > 0 ? 'text-green-600' : 'text-gray-400'
          )}>
            {tag.walletBalance !== null ? formatCurrency(tag.walletBalance) : '-'}
          </span>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>{tag.transactionCount} transactions</p>
          {tag.lastUsedAt && (
            <p>Dernier: {formatDateTime(tag.lastUsedAt)}</p>
          )}
        </div>
      </div>
    </Link>
  )
}

interface NFCTagRowProps {
  tag: NFCTag
  festivalId: string
  selected?: boolean
  onSelect?: (selected: boolean) => void
}

export function NFCTagRow({ tag, festivalId, selected, onSelect }: NFCTagRowProps) {
  const status = statusConfig[tag.status]
  const StatusIcon = status.icon

  return (
    <tr className={cn('border-b hover:bg-gray-50', selected && 'bg-blue-50')}>
      <td className="px-4 py-3">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
        )}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/festivals/${festivalId}/nfc/${tag.id}`}
          className="font-mono text-sm font-medium text-gray-900 hover:text-primary"
        >
          {tag.uid}
        </Link>
      </td>
      <td className="px-4 py-3">
        {tag.holderName ? (
          <div>
            <p className="text-sm font-medium text-gray-900">{tag.holderName}</p>
            <p className="text-xs text-gray-500">{tag.holderEmail}</p>
          </div>
        ) : (
          <span className="text-sm text-gray-400">Non assigne</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span className={cn(
          'font-medium',
          tag.walletBalance !== null && tag.walletBalance > 0 ? 'text-green-600' : 'text-gray-400'
        )}>
          {tag.walletBalance !== null ? formatCurrency(tag.walletBalance) : '-'}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm text-gray-600">{tag.transactionCount}</span>
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', status.bg, status.text)}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </td>
    </tr>
  )
}
