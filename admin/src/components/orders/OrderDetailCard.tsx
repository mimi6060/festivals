'use client'

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
  Wallet,
  Banknote,
  Hash,
  Calendar,
  UserCircle,
  Mail,
  Phone,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import type { Order, OrderStatus, PaymentMethod } from '@/lib/api/orders'

interface OrderDetailCardProps {
  order: Order
  className?: string
}

const statusConfig: Record<
  OrderStatus,
  { bg: string; text: string; label: string; icon: typeof CheckCircle }
> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En attente', icon: Clock },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completee', icon: CheckCircle },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Annulee', icon: XCircle },
  REFUNDED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Remboursee', icon: RotateCcw },
  PARTIALLY_REFUNDED: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    label: 'Partiellement remboursee',
    icon: AlertCircle,
  },
}

const paymentMethodConfig: Record<
  PaymentMethod,
  { label: string; icon: typeof CreditCard }
> = {
  WALLET: { label: 'Portefeuille', icon: Wallet },
  CARD: { label: 'Carte bancaire', icon: CreditCard },
  CASH: { label: 'Especes', icon: Banknote },
  NFC: { label: 'NFC', icon: CreditCard },
}

export function OrderDetailCard({ order, className }: OrderDetailCardProps) {
  const statusStyle = statusConfig[order.status]
  const StatusIcon = statusStyle.icon
  const paymentMethod = paymentMethodConfig[order.paymentMethod]
  const PaymentIcon = paymentMethod.icon

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-gray-400" />
            Commande #{order.id.slice(0, 8).toUpperCase()}
          </CardTitle>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
              statusStyle.bg,
              statusStyle.text
            )}
          >
            <StatusIcon className="h-4 w-4" />
            {statusStyle.label}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          {/* Stand */}
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-gray-100 p-2">
              <Store className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <dt className="text-sm text-gray-500">Stand</dt>
              <dd className="font-medium text-gray-900">{order.standName}</dd>
            </div>
          </div>

          {/* Payment method */}
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-gray-100 p-2">
              <PaymentIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <dt className="text-sm text-gray-500">Paiement</dt>
              <dd className="font-medium text-gray-900">{paymentMethod.label}</dd>
              {order.paymentReference && (
                <dd className="text-sm text-gray-500">
                  Ref: {order.paymentReference}
                </dd>
              )}
            </div>
          </div>

          {/* Date created */}
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-gray-100 p-2">
              <Calendar className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <dt className="text-sm text-gray-500">Date de creation</dt>
              <dd className="font-medium text-gray-900">
                {formatDateTime(order.createdAt)}
              </dd>
            </div>
          </div>

          {/* Operator */}
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-gray-100 p-2">
              <UserCircle className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <dt className="text-sm text-gray-500">Operateur</dt>
              <dd className="font-medium text-gray-900">{order.operatorName}</dd>
            </div>
          </div>

          {/* Totals */}
          <div className="col-span-full rounded-lg bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Sous-total</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(order.subtotal, order.currency)}
              </span>
            </div>
            {order.discount > 0 && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-gray-600">Remise</span>
                <span className="font-medium text-green-600">
                  -{formatCurrency(order.discount, order.currency)}
                </span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <span className="text-lg font-semibold text-gray-900">Total</span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(order.total, order.currency)}
              </span>
            </div>
            {order.refundedAmount > 0 && (
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="text-red-600">Montant rembourse</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(order.refundedAmount, order.currency)}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="col-span-full">
              <dt className="mb-1 text-sm text-gray-500">Notes</dt>
              <dd className="rounded-lg bg-gray-50 p-3 text-gray-700">
                {order.notes}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  )
}

interface CustomerInfoCardProps {
  order: Order
  className?: string
}

export function CustomerInfoCard({ order, className }: CustomerInfoCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-gray-400" />
          Informations client
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {order.customerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{order.customerName}</p>
              <p className="text-sm text-gray-500">Client</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-600">
              <Mail className="h-4 w-4 text-gray-400" />
              <a
                href={`mailto:${order.customerEmail}`}
                className="hover:text-primary hover:underline"
              >
                {order.customerEmail}
              </a>
            </div>

            {order.walletId && (
              <div className="flex items-center gap-3 text-gray-600">
                <Wallet className="h-4 w-4 text-gray-400" />
                <span className="font-mono text-sm">{order.walletId}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
