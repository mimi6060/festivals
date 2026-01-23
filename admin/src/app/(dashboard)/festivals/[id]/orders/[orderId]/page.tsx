'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  RotateCcw,
  Printer,
} from 'lucide-react'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import {
  ordersApi,
  type Order,
  type OrderHistoryEntry,
} from '@/lib/api/orders'
import { Button } from '@/components/ui/Button'
import { OrderDetailCard, CustomerInfoCard } from '@/components/orders/OrderDetailCard'
import { OrderItemsTable } from '@/components/orders/OrderItemsTable'
import { PaymentInfoCard } from '@/components/orders/PaymentInfoCard'
import { OrderTimeline } from '@/components/orders/OrderTimeline'
import {
  OrderActions,
  CancelOrderDialog,
} from '@/components/orders/OrderActions'
import { RefundDialog, type RefundData } from '@/components/orders/RefundDialog'

// Mock data for development
const mockOrder: Order = {
  id: 'ord-12345678-abcd-efgh-ijkl-mnopqrstuvwx',
  festivalId: '1',
  standId: 'stand-1',
  standName: 'Bar Central',
  customerId: 'user-1',
  customerName: 'Jean Dupont',
  customerEmail: 'jean.dupont@email.com',
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      productName: 'Biere Blonde 50cl',
      quantity: 2,
      unitPrice: 5.00,
      total: 10.00,
      vatRate: 20,
    },
    {
      id: 'item-2',
      productId: 'prod-2',
      productName: 'Cocktail Mojito',
      quantity: 1,
      unitPrice: 8.50,
      total: 8.50,
      vatRate: 20,
    },
    {
      id: 'item-3',
      productId: 'prod-3',
      productName: 'Chips',
      quantity: 1,
      unitPrice: 3.00,
      total: 3.00,
      vatRate: 5.5,
    },
  ],
  subtotal: 21.50,
  total: 21.50,
  discount: 0,
  currency: 'EUR',
  status: 'COMPLETED',
  paymentMethod: 'WALLET',
  paymentReference: 'PAY-2026-01-20-00123',
  walletId: 'wallet-12345',
  operatorId: 'op-1',
  operatorName: 'Marie Martin',
  refundedAmount: 0,
  refundedAt: null,
  refundedBy: null,
  refundReason: null,
  notes: null,
  createdAt: '2026-01-20T15:30:00Z',
  updatedAt: '2026-01-20T15:30:00Z',
}

const mockHistory: OrderHistoryEntry[] = [
  {
    id: '1',
    orderId: mockOrder.id,
    action: 'CREATED',
    performedBy: 'op-1',
    performedByName: 'Marie Martin',
    note: null,
    createdAt: '2026-01-20T15:30:00Z',
  },
  {
    id: '2',
    orderId: mockOrder.id,
    action: 'COMPLETED',
    performedBy: 'op-1',
    performedByName: 'Marie Martin',
    note: 'Paiement valide par portefeuille',
    metadata: {
      paymentMethod: 'WALLET',
      walletId: 'wallet-12345',
    },
    createdAt: '2026-01-20T15:30:05Z',
  },
]

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const orderId = params.orderId as string

  // State
  const [order, setOrder] = React.useState<Order | null>(null)
  const [history, setHistory] = React.useState<OrderHistoryEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)

  // Dialog states
  const [showRefundDialog, setShowRefundDialog] = React.useState(false)
  const [showCancelDialog, setShowCancelDialog] = React.useState(false)

  // Load order data
  React.useEffect(() => {
    async function loadData() {
      try {
        // Uncomment for real API calls:
        // const [orderData, historyData] = await Promise.all([
        //   ordersApi.getOrder(festivalId, orderId),
        //   ordersApi.getOrderHistory(festivalId, orderId),
        // ])
        // setOrder(orderData)
        // setHistory(historyData)

        // Using mock data for development
        setOrder(mockOrder)
        setHistory(mockHistory)
      } catch (error) {
        console.error('Failed to load order:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [festivalId, orderId])

  // Handle refund
  const handleRefund = async (data: RefundData) => {
    if (!order) return
    setActionLoading(true)
    try {
      if (data.type === 'full') {
        await ordersApi.refundOrder(festivalId, orderId, {
          amount: data.amount,
          reason: data.reason,
          refundToWallet: data.refundToWallet,
        })
      } else {
        await ordersApi.partialRefundOrder(festivalId, orderId, {
          items: data.items || [],
          reason: data.reason,
          refundToWallet: data.refundToWallet,
        })
      }

      // Reload order data
      const [updatedOrder, updatedHistory] = await Promise.all([
        ordersApi.getOrder(festivalId, orderId),
        ordersApi.getOrderHistory(festivalId, orderId),
      ])
      setOrder(updatedOrder)
      setHistory(updatedHistory)
      setShowRefundDialog(false)
    } catch (error) {
      console.error('Failed to process refund:', error)
      // In production, show error toast
    } finally {
      setActionLoading(false)
    }
  }

  // Handle cancel
  const handleCancel = async (reason: string) => {
    if (!order) return
    setActionLoading(true)
    try {
      await ordersApi.cancelOrder(festivalId, orderId, reason)

      // Reload order data
      const [updatedOrder, updatedHistory] = await Promise.all([
        ordersApi.getOrder(festivalId, orderId),
        ordersApi.getOrderHistory(festivalId, orderId),
      ])
      setOrder(updatedOrder)
      setHistory(updatedHistory)
      setShowCancelDialog(false)
    } catch (error) {
      console.error('Failed to cancel order:', error)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle print receipt
  const handlePrint = () => {
    if (!order) return

    const receiptWindow = window.open('', '_blank', 'width=400,height=600')
    if (!receiptWindow) return

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recu - Commande #${order.id.slice(0, 8).toUpperCase()}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              padding: 20px;
              max-width: 300px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .divider {
              border-top: 1px dashed #ccc;
              margin: 10px 0;
            }
            .item {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
            }
            .total {
              font-weight: bold;
              font-size: 14px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 10px;
              color: #666;
            }
            @media print {
              body { margin: 0; padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0;">RECU</h2>
            <p>Commande #${order.id.slice(0, 8).toUpperCase()}</p>
            <p>${new Date(order.createdAt).toLocaleString('fr-FR')}</p>
          </div>

          <div class="divider"></div>

          <p><strong>Client:</strong> ${order.customerName}</p>
          <p><strong>Stand:</strong> ${order.standName}</p>
          <p><strong>Operateur:</strong> ${order.operatorName}</p>

          <div class="divider"></div>

          <h3>Articles</h3>
          ${order.items
            .map(
              (item) => `
            <div class="item">
              <span>${item.quantity}x ${item.productName}</span>
              <span>${formatCurrency(item.total, order.currency)}</span>
            </div>
          `
            )
            .join('')}

          <div class="divider"></div>

          <div class="item">
            <span>Sous-total</span>
            <span>${formatCurrency(order.subtotal, order.currency)}</span>
          </div>
          ${
            order.discount > 0
              ? `
            <div class="item">
              <span>Remise</span>
              <span>-${formatCurrency(order.discount, order.currency)}</span>
            </div>
          `
              : ''
          }
          <div class="item total">
            <span>TOTAL</span>
            <span>${formatCurrency(order.total, order.currency)}</span>
          </div>

          <div class="divider"></div>

          <p><strong>Paiement:</strong> ${order.paymentMethod}</p>
          ${order.paymentReference ? `<p><strong>Ref:</strong> ${order.paymentReference}</p>` : ''}

          <div class="footer">
            <p>Merci de votre visite!</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `

    receiptWindow.document.write(receiptHTML)
    receiptWindow.document.close()
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Not found state
  if (!order) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <AlertCircle className="h-12 w-12 text-gray-400" />
        <p className="mt-2 text-gray-500">Commande introuvable</p>
        <Link
          href={`/festivals/${festivalId}/orders`}
          className="mt-4 text-primary hover:underline"
        >
          Retour a la liste
        </Link>
      </div>
    )
  }

  const canRefund =
    (order.status === 'COMPLETED' || order.status === 'PARTIALLY_REFUNDED') &&
    order.total - order.refundedAmount > 0
  const canCancel = order.status === 'PENDING'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link
            href={`/festivals/${festivalId}/orders`}
            className="mt-1 rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Commande #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <p className="mt-1 text-gray-500">
              {order.customerName} - {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>

        <OrderActions
          order={order}
          onRefund={() => setShowRefundDialog(true)}
          onPrint={handlePrint}
          onCancel={canCancel ? () => setShowCancelDialog(true) : undefined}
          refundLoading={actionLoading}
        />
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Order details and items */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order info card */}
          <OrderDetailCard order={order} />

          {/* Items table */}
          <OrderItemsTable items={order.items} currency={order.currency} />

          {/* Timeline */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Historique
            </h2>
            <OrderTimeline history={history} />
          </div>
        </div>

        {/* Right column - Customer and payment info */}
        <div className="space-y-6">
          {/* Customer info */}
          <CustomerInfoCard order={order} />

          {/* Payment info */}
          <PaymentInfoCard order={order} />

          {/* Quick actions */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Actions rapides
            </h2>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                leftIcon={<Printer className="h-4 w-4" />}
                onClick={handlePrint}
              >
                Imprimer le recu
              </Button>

              {canRefund && (
                <Button
                  variant="outline"
                  className="w-full justify-start border-red-200 text-red-600 hover:bg-red-50"
                  leftIcon={<RotateCcw className="h-4 w-4" />}
                  onClick={() => setShowRefundDialog(true)}
                >
                  Rembourser ({formatCurrency(order.total - order.refundedAmount, order.currency)})
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Refund dialog */}
      {order && (
        <RefundDialog
          order={order}
          open={showRefundDialog}
          onOpenChange={setShowRefundDialog}
          onRefund={handleRefund}
          loading={actionLoading}
        />
      )}

      {/* Cancel dialog */}
      {order && (
        <CancelOrderDialog
          order={order}
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          onConfirm={handleCancel}
          loading={actionLoading}
        />
      )}
    </div>
  )
}
