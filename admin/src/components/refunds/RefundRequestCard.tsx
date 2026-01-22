'use client'

import Link from 'next/link'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import {
  User,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Banknote,
  ChevronRight,
} from 'lucide-react'
import type { RefundRequest, RefundStatus } from '@/lib/api/refunds'

interface RefundRequestCardProps {
  refund: RefundRequest
  festivalId: string
  selected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  showCheckbox?: boolean
}

const statusConfig: Record<RefundStatus, { bg: string; text: string; label: string; icon: typeof CheckCircle }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En attente', icon: Clock },
  APPROVED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Approuve', icon: CheckCircle },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejete', icon: XCircle },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Complete', icon: CheckCircle },
  FAILED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Echoue', icon: AlertCircle },
}

const methodLabels: Record<string, string> = {
  BANK_TRANSFER: 'Virement bancaire',
  ORIGINAL_PAYMENT: 'Moyen de paiement original',
  WALLET_CREDIT: 'Credit portefeuille',
}

export function RefundRequestCard({
  refund,
  festivalId,
  selected = false,
  onSelect,
  showCheckbox = false,
}: RefundRequestCardProps) {
  const statusStyle = statusConfig[refund.status]
  const StatusIcon = statusStyle.icon

  return (
    <div className={cn(
      'rounded-lg border bg-white p-4 transition-shadow hover:shadow-md',
      selected && 'ring-2 ring-primary'
    )}>
      <div className="flex items-start gap-4">
        {showCheckbox && (
          <div className="flex items-center pt-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect?.(refund.id, e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <User className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <Link
                  href={`/festivals/${festivalId}/refunds/${refund.id}`}
                  className="font-medium text-gray-900 hover:text-primary"
                >
                  {refund.user.firstName} {refund.user.lastName}
                </Link>
                <p className="text-sm text-gray-500">{refund.user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  statusStyle.bg,
                  statusStyle.text
                )}
              >
                <StatusIcon className="h-3 w-3" />
                {statusStyle.label}
              </span>
              <Link
                href={`/festivals/${festivalId}/refunds/${refund.id}`}
                className="rounded p-1 hover:bg-gray-100"
              >
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </Link>
            </div>
          </div>

          {/* Content */}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {/* Amount */}
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Montant</p>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(refund.amount, refund.currency)}
                </p>
              </div>
            </div>

            {/* Method */}
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Methode</p>
                <p className="text-sm font-medium text-gray-900">
                  {methodLabels[refund.method] || refund.method}
                </p>
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Demande le</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDateTime(refund.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Reason */}
          {refund.reason && (
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Motif :</span> {refund.reason}
              </p>
            </div>
          )}

          {/* Wallet info */}
          <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
            <span>Ticket : <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{refund.wallet.ticketCode}</code></span>
            <span>Solde : {formatCurrency(refund.wallet.balance)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact row variant for tables
export function RefundRequestRow({
  refund,
  festivalId,
  selected = false,
  onSelect,
  showCheckbox = false,
}: RefundRequestCardProps) {
  const statusStyle = statusConfig[refund.status]
  const StatusIcon = statusStyle.icon

  return (
    <tr className={cn(
      'border-b hover:bg-gray-50',
      selected && 'bg-primary/5'
    )}>
      {showCheckbox && (
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(refund.id, e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
        </td>
      )}
      <td className="px-4 py-3">
        <Link
          href={`/festivals/${festivalId}/refunds/${refund.id}`}
          className="font-medium text-gray-900 hover:text-primary"
        >
          {refund.user.firstName} {refund.user.lastName}
        </Link>
        <p className="text-sm text-gray-500">{refund.user.email}</p>
      </td>
      <td className="px-4 py-3 font-medium">
        {formatCurrency(refund.amount, refund.currency)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {methodLabels[refund.method] || refund.method}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {formatDateTime(refund.createdAt)}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
            statusStyle.bg,
            statusStyle.text
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {statusStyle.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/festivals/${festivalId}/refunds/${refund.id}`}
          className="text-primary hover:underline text-sm"
        >
          Details
        </Link>
      </td>
    </tr>
  )
}
