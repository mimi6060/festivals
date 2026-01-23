'use client'

import Link from 'next/link'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  ShoppingBag,
  CreditCard,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  ChevronRight,
  Download,
  FileText,
  Apple,
  Smartphone,
} from 'lucide-react'
import type { UserOrder } from '@/lib/api/account'

interface OrderCardProps {
  order: UserOrder
  showDetails?: boolean
}

const statusConfig: Record<UserOrder['status'], {
  variant: 'success' | 'warning' | 'error' | 'default' | 'info'
  label: string
  icon: typeof CheckCircle
}> = {
  PENDING: { variant: 'warning', label: 'En attente', icon: Clock },
  COMPLETED: { variant: 'success', label: 'Complete', icon: CheckCircle },
  CANCELLED: { variant: 'default', label: 'Annule', icon: XCircle },
  REFUNDED: { variant: 'error', label: 'Rembourse', icon: RotateCcw },
  PARTIALLY_REFUNDED: { variant: 'warning', label: 'Partiellement rembourse', icon: AlertCircle },
}

const paymentMethodConfig: Record<UserOrder['paymentMethod'], {
  label: string
  icon: typeof CreditCard
}> = {
  CARD: { label: 'Carte bancaire', icon: CreditCard },
  WALLET: { label: 'Portefeuille', icon: Wallet },
  APPLE_PAY: { label: 'Apple Pay', icon: Apple },
  GOOGLE_PAY: { label: 'Google Pay', icon: Smartphone },
}

export function OrderCard({ order, showDetails = true }: OrderCardProps) {
  const config = statusConfig[order.status]
  const StatusIcon = config.icon
  const paymentConfig = paymentMethodConfig[order.paymentMethod]
  const PaymentIcon = paymentConfig.icon

  const ticketItems = order.items.filter(item => item.type === 'TICKET')
  const otherItems = order.items.filter(item => item.type !== 'TICKET')

  return (
    <div className="rounded-lg border bg-white overflow-hidden hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <Link
              href={`/account/orders/${order.id}`}
              className="font-semibold text-gray-900 hover:text-primary"
            >
              Commande #{order.orderNumber}
            </Link>
            <p className="text-sm text-gray-500">
              {order.festivalName} - {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>
        <Badge variant={config.variant}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {config.label}
        </Badge>
      </div>

      {/* Items summary */}
      <div className="px-6 py-4">
        <div className="space-y-3">
          {order.items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{item.quantity}x</span>
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
                {item.type === 'TICKET' && (
                  <Badge variant="info" size="sm">Billet</Badge>
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">
                {formatCurrency(item.total, order.currency)}
              </span>
            </div>
          ))}
          {order.items.length > 3 && (
            <p className="text-sm text-gray-500">
              +{order.items.length - 3} autre{order.items.length - 3 > 1 ? 's' : ''} article{order.items.length - 3 > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Totals */}
        <div className="mt-4 border-t pt-4 space-y-2">
          {order.fees > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Frais de service</span>
              <span className="text-gray-700">{formatCurrency(order.fees, order.currency)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="font-medium text-gray-900">Total</span>
            <span className="font-semibold text-gray-900">{formatCurrency(order.total, order.currency)}</span>
          </div>
          {order.refundedAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-red-600">Rembourse</span>
              <span className="text-red-600">-{formatCurrency(order.refundedAmount, order.currency)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer with actions */}
      {showDetails && (
        <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <PaymentIcon className="h-4 w-4" />
            {paymentConfig.label}
          </div>
          <div className="flex items-center gap-2">
            {order.receiptUrl && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={() => window.open(order.receiptUrl!, '_blank')}
              >
                Recu
              </Button>
            )}
            {order.invoiceUrl && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<FileText className="h-4 w-4" />}
                onClick={() => window.open(order.invoiceUrl!, '_blank')}
              >
                Facture
              </Button>
            )}
            <Link href={`/account/orders/${order.id}`}>
              <Button
                variant="outline"
                size="sm"
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Details
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact variant for table/list views
export function OrderRow({ order }: { order: UserOrder }) {
  const config = statusConfig[order.status]
  const StatusIcon = config.icon

  return (
    <tr className="border-b hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <Link
          href={`/account/orders/${order.id}`}
          className="font-mono text-sm font-medium text-gray-900 hover:text-primary"
        >
          #{order.orderNumber}
        </Link>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-700">{order.festivalName}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-500">{order.items.length} article{order.items.length > 1 ? 's' : ''}</span>
      </td>
      <td className="px-4 py-3 font-medium">
        {formatCurrency(order.total, order.currency)}
      </td>
      <td className="px-4 py-3">
        <Badge variant={config.variant} size="sm">
          <StatusIcon className="mr-1 h-3 w-3" />
          {config.label}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {formatDateTime(order.createdAt)}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/account/orders/${order.id}`}
          className="text-primary hover:underline text-sm"
        >
          Voir
        </Link>
      </td>
    </tr>
  )
}

// Skeleton for loading state
export function OrderCardSkeleton() {
  return (
    <div className="rounded-lg border bg-white overflow-hidden animate-pulse">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="h-3 w-48 rounded bg-gray-200" />
          </div>
        </div>
        <div className="h-6 w-20 rounded-full bg-gray-200" />
      </div>
      <div className="px-6 py-4">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-4 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="mt-4 border-t pt-4">
          <div className="flex justify-between">
            <div className="h-4 w-12 rounded bg-gray-200" />
            <div className="h-5 w-20 rounded bg-gray-200" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-3">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-8 w-24 rounded bg-gray-200" />
      </div>
    </div>
  )
}
