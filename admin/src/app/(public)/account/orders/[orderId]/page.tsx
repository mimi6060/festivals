'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { accountApi, UserOrder } from '@/lib/api/account'
import {
  ArrowLeft,
  ShoppingBag,
  CreditCard,
  Wallet,
  Apple,
  Smartphone,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  Download,
  FileText,
  Receipt,
  Ticket,
  Package,
  Coins,
  MapPin,
  Building,
  Hash,
} from 'lucide-react'

const statusConfig: Record<UserOrder['status'], {
  variant: 'success' | 'warning' | 'error' | 'default' | 'info'
  label: string
  icon: typeof CheckCircle
  description: string
}> = {
  PENDING: {
    variant: 'warning',
    label: 'En attente',
    icon: Clock,
    description: 'Votre paiement est en cours de traitement',
  },
  COMPLETED: {
    variant: 'success',
    label: 'Complete',
    icon: CheckCircle,
    description: 'Votre commande a ete traitee avec succes',
  },
  CANCELLED: {
    variant: 'default',
    label: 'Annule',
    icon: XCircle,
    description: 'Cette commande a ete annulee',
  },
  REFUNDED: {
    variant: 'error',
    label: 'Rembourse',
    icon: RotateCcw,
    description: 'Cette commande a ete integralement remboursee',
  },
  PARTIALLY_REFUNDED: {
    variant: 'warning',
    label: 'Partiellement rembourse',
    icon: AlertCircle,
    description: 'Une partie de cette commande a ete remboursee',
  },
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

const itemTypeIcons: Record<string, typeof Ticket> = {
  TICKET: Ticket,
  PRODUCT: Package,
  TOP_UP: Coins,
}

export default function OrderDetailPage() {
  const params = useParams()
  const orderId = params.orderId as string

  const [order, setOrder] = useState<UserOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      loadOrder()
    }
  }, [orderId])

  const loadOrder = async () => {
    try {
      setLoading(true)
      const data = await accountApi.getOrder(orderId)
      setOrder(data)
    } catch (err) {
      console.error('Failed to load order:', err)
      setError('Impossible de charger les details de la commande.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-64 rounded-lg bg-gray-200" />
            <div className="h-48 rounded-lg bg-gray-200" />
          </div>
          <div className="h-96 rounded-lg bg-gray-200" />
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-red-700">{error || 'Commande non trouvee'}</p>
        <Link href="/account/orders">
          <Button variant="outline" className="mt-4">
            Retour aux commandes
          </Button>
        </Link>
      </div>
    )
  }

  const statusInfo = statusConfig[order.status]
  const StatusIcon = statusInfo.icon
  const paymentInfo = paymentMethodConfig[order.paymentMethod]
  const PaymentIcon = paymentInfo.icon

  return (
    <div className="space-y-6">
      {/* Back button and title */}
      <div className="flex items-center gap-4">
        <Link href="/account/orders">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Retour
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Commande #{order.orderNumber}
          </h1>
          <p className="text-gray-600">{order.festivalName}</p>
        </div>
        <Badge variant={statusInfo.variant} size="lg">
          <StatusIcon className="mr-1.5 h-4 w-4" />
          {statusInfo.label}
        </Badge>
      </div>

      {/* Status banner */}
      <div className={`rounded-lg p-4 ${
        order.status === 'COMPLETED' ? 'bg-green-50 border border-green-200' :
        order.status === 'PENDING' ? 'bg-yellow-50 border border-yellow-200' :
        order.status === 'REFUNDED' || order.status === 'PARTIALLY_REFUNDED' ? 'bg-red-50 border border-red-200' :
        'bg-gray-50 border border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-5 w-5 ${
            order.status === 'COMPLETED' ? 'text-green-600' :
            order.status === 'PENDING' ? 'text-yellow-600' :
            order.status === 'REFUNDED' || order.status === 'PARTIALLY_REFUNDED' ? 'text-red-600' :
            'text-gray-600'
          }`} />
          <p className={`font-medium ${
            order.status === 'COMPLETED' ? 'text-green-700' :
            order.status === 'PENDING' ? 'text-yellow-700' :
            order.status === 'REFUNDED' || order.status === 'PARTIALLY_REFUNDED' ? 'text-red-700' :
            'text-gray-700'
          }`}>
            {statusInfo.description}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Articles commandes
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="divide-y">
                {order.items.map((item) => {
                  const ItemIcon = itemTypeIcons[item.type] || Package
                  return (
                    <div key={item.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                          <ItemIcon className="h-6 w-6 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-gray-500">{item.description}</p>
                          )}
                          <p className="text-sm text-gray-500">
                            {item.quantity} x {formatCurrency(item.unitPrice, order.currency)}
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(item.total, order.currency)}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Totals */}
              <div className="mt-4 border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sous-total</span>
                  <span className="text-gray-700">{formatCurrency(order.subtotal, order.currency)}</span>
                </div>
                {order.fees > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Frais de service</span>
                    <span className="text-gray-700">{formatCurrency(order.fees, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">{formatCurrency(order.total, order.currency)}</span>
                </div>
                {order.refundedAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600">Montant rembourse</span>
                    <span className="text-red-600">-{formatCurrency(order.refundedAmount, order.currency)}</span>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Billing address */}
          {order.billingAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Adresse de facturation
                </CardTitle>
              </CardHeader>
              <CardBody>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <Building className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">{order.billingAddress.name}</p>
                      <p className="text-sm text-gray-600">{order.billingAddress.street}</p>
                      <p className="text-sm text-gray-600">
                        {order.billingAddress.postalCode} {order.billingAddress.city}
                      </p>
                      <p className="text-sm text-gray-600">{order.billingAddress.country}</p>
                    </div>
                  </div>
                  {order.billingAddress.vatNumber && (
                    <div className="flex items-start gap-3">
                      <Hash className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Numero de TVA</p>
                        <p className="font-medium text-gray-900">{order.billingAddress.vatNumber}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Paiement
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <PaymentIcon className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{paymentInfo.label}</p>
                  {order.paymentReference && (
                    <p className="text-sm text-gray-500 font-mono">
                      {order.paymentReference}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  Commande le {formatDateTime(order.createdAt)}
                </div>
                {order.completedAt && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <CheckCircle className="h-4 w-4" />
                    Completee le {formatDateTime(order.completedAt)}
                  </div>
                )}
                {order.refundedAt && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <RotateCcw className="h-4 w-4" />
                    Remboursee le {formatDateTime(order.refundedAt)}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                leftIcon={<Receipt className="h-4 w-4" />}
                onClick={() => {
                  const url = accountApi.downloadReceipt(order.id)
                  window.open(url, '_blank')
                }}
              >
                Telecharger le recu
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                leftIcon={<FileText className="h-4 w-4" />}
                onClick={() => {
                  const url = accountApi.downloadInvoice(order.id)
                  window.open(url, '_blank')
                }}
              >
                Telecharger la facture
              </Button>
            </CardBody>
          </Card>

          {/* Help */}
          <Card>
            <CardBody>
              <p className="text-sm text-gray-600 mb-3">
                Un probleme avec cette commande ?
              </p>
              <Button variant="ghost" className="w-full" asChild>
                <Link href="/help/orders">
                  Contacter le support
                </Link>
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
