'use client'

import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import {
  CreditCard,
  Wallet,
  Banknote,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Receipt,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import type { Order, PaymentMethod, OrderStatus } from '@/lib/api/orders'

interface PaymentInfoCardProps {
  order: Order
  className?: string
}

const paymentMethodConfig: Record<
  PaymentMethod,
  { label: string; icon: typeof CreditCard; color: string; bgColor: string }
> = {
  WALLET: {
    label: 'Portefeuille',
    icon: Wallet,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  CARD: {
    label: 'Carte bancaire',
    icon: CreditCard,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  CASH: {
    label: 'Especes',
    icon: Banknote,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  NFC: {
    label: 'NFC / Sans contact',
    icon: CreditCard,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
}

const paymentStatusConfig: Record<
  OrderStatus,
  { label: string; icon: typeof CheckCircle; color: string }
> = {
  PENDING: { label: 'En attente', icon: Clock, color: 'text-yellow-600' },
  COMPLETED: { label: 'Paiement recu', icon: CheckCircle, color: 'text-green-600' },
  CANCELLED: { label: 'Annule', icon: XCircle, color: 'text-gray-500' },
  REFUNDED: { label: 'Rembourse', icon: AlertTriangle, color: 'text-red-600' },
  PARTIALLY_REFUNDED: {
    label: 'Partiellement rembourse',
    icon: AlertTriangle,
    color: 'text-orange-600',
  },
}

export function PaymentInfoCard({ order, className }: PaymentInfoCardProps) {
  const method = paymentMethodConfig[order.paymentMethod]
  const PaymentIcon = method.icon
  const status = paymentStatusConfig[order.status]
  const StatusIcon = status.icon

  const netAmount = order.total - order.refundedAmount

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-gray-400" />
          Paiement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment method */}
        <div className="flex items-center gap-4">
          <div className={cn('rounded-lg p-3', method.bgColor)}>
            <PaymentIcon className={cn('h-6 w-6', method.color)} />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">{method.label}</p>
            <div className="flex items-center gap-2 text-sm">
              <StatusIcon className={cn('h-4 w-4', status.color)} />
              <span className={status.color}>{status.label}</span>
            </div>
          </div>
        </div>

        {/* Payment reference */}
        {order.paymentReference && (
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Reference de paiement</p>
            <p className="font-mono text-sm text-gray-900">{order.paymentReference}</p>
          </div>
        )}

        {/* Amount breakdown */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Montant paye</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(order.total, order.currency)}
            </span>
          </div>

          {order.refundedAmount > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-red-600">Rembourse</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(order.refundedAmount, order.currency)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium text-gray-900">Montant net</span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(netAmount, order.currency)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Refund info */}
        {order.refundedAt && (
          <div className="rounded-lg bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-medium text-red-800">Remboursement effectue</p>
                <p className="text-sm text-red-700">
                  Le {formatDateTime(order.refundedAt)}
                </p>
                {order.refundReason && (
                  <p className="mt-1 text-sm text-red-600">
                    Motif: {order.refundReason}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Wallet ID for wallet payments */}
        {order.paymentMethod === 'WALLET' && order.walletId && (
          <div className="rounded-lg bg-purple-50 p-3">
            <p className="text-xs text-purple-600">Portefeuille utilise</p>
            <p className="font-mono text-sm text-purple-900">{order.walletId}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
