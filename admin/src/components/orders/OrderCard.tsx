'use client'

import Link from 'next/link'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import {
  User,
  Store,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  ChevronRight,
  Wallet,
  Banknote,
} from 'lucide-react'
import type { Order, OrderStatus, PaymentMethod } from '@/lib/api/orders'

interface OrderCardProps {
  order: Order
  festivalId: string
  selected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  showCheckbox?: boolean
}

const statusConfig: Record<OrderStatus, { bg: string; text: string; label: string; icon: typeof CheckCircle }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En attente', icon: Clock },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Complete', icon: CheckCircle },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Annule', icon: XCircle },
  REFUNDED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rembourse', icon: RotateCcw },
  PARTIALLY_REFUNDED: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Partiellement rembourse', icon: AlertCircle },
}

const paymentMethodLabels: Record<PaymentMethod, { label: string; icon: typeof CreditCard }> = {
  WALLET: { label: 'Portefeuille', icon: Wallet },
  CARD: { label: 'Carte bancaire', icon: CreditCard },
  CASH: { label: 'Especes', icon: Banknote },
  NFC: { label: 'NFC', icon: CreditCard },
}

export function OrderCard({
  order,
  festivalId,
  selected = false,
  onSelect,
  showCheckbox = false,
}: OrderCardProps) {
  const statusStyle = statusConfig[order.status]
  const StatusIcon = statusStyle.icon
  const paymentInfo = paymentMethodLabels[order.paymentMethod]
  const PaymentIcon = paymentInfo.icon

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
              onChange={(e) => onSelect?.(order.id, e.target.checked)}
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
                  href={`/festivals/${festivalId}/orders/${order.id}`}
                  className="font-medium text-gray-900 hover:text-primary"
                >
                  {order.customerName}
                </Link>
                <p className="text-sm text-gray-500">{order.customerEmail}</p>
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
                href={`/festivals/${festivalId}/orders/${order.id}`}
                className="rounded p-1 hover:bg-gray-100"
              >
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </Link>
            </div>
          </div>

          {/* Content */}
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            {/* Order ID */}
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Commande</p>
                <p className="font-mono text-sm font-medium text-gray-900">
                  #{order.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>

            {/* Stand */}
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Stand</p>
                <p className="text-sm font-medium text-gray-900">{order.standName}</p>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center gap-2">
              <PaymentIcon className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(order.total, order.currency)}
                </p>
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDateTime(order.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Items summary */}
          <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
            <span>{order.items.length} article{order.items.length > 1 ? 's' : ''}</span>
            <span>Paiement : {paymentInfo.label}</span>
            {order.refundedAmount > 0 && (
              <span className="text-red-600">
                Rembourse : {formatCurrency(order.refundedAmount, order.currency)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact row variant for tables
export function OrderRow({
  order,
  festivalId,
  selected = false,
  onSelect,
  showCheckbox = false,
}: OrderCardProps) {
  const statusStyle = statusConfig[order.status]
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
            onChange={(e) => onSelect?.(order.id, e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
        </td>
      )}
      <td className="px-4 py-3">
        <Link
          href={`/festivals/${festivalId}/orders/${order.id}`}
          className="font-mono text-sm font-medium text-gray-900 hover:text-primary"
        >
          #{order.id.slice(0, 8).toUpperCase()}
        </Link>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-gray-900">{order.customerName}</p>
          <p className="text-sm text-gray-500">{order.customerEmail}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {order.standName}
      </td>
      <td className="px-4 py-3 font-medium">
        {formatCurrency(order.total, order.currency)}
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
      <td className="px-4 py-3 text-sm text-gray-500">
        {formatDateTime(order.createdAt)}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/festivals/${festivalId}/orders/${order.id}`}
          className="text-primary hover:underline text-sm"
        >
          Details
        </Link>
      </td>
    </tr>
  )
}
