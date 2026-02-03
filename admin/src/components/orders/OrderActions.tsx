'use client'

import * as React from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  RotateCcw,
  Printer,
  Download,
  MoreHorizontal,
  Copy,
  Mail,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from '@/components/ui/Modal'
import type { Order, OrderStatus } from '@/lib/api/orders'

interface OrderActionsProps {
  order: Order
  onRefund: () => void
  onPrint: () => void
  onCancel?: () => void
  className?: string
  refundLoading?: boolean
  printLoading?: boolean
  cancelLoading?: boolean
}

export function OrderActions({
  order,
  onRefund,
  onPrint,
  onCancel,
  className,
  refundLoading = false,
  printLoading = false,
  cancelLoading = false,
}: OrderActionsProps) {
  const canRefund =
    order.status === 'COMPLETED' || order.status === 'PARTIALLY_REFUNDED'
  const canCancel = order.status === 'PENDING'
  const refundableAmount = order.total - order.refundedAmount

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Print receipt */}
      <Button
        variant="outline"
        leftIcon={<Printer className="h-4 w-4" />}
        onClick={onPrint}
        loading={printLoading}
      >
        Imprimer le recu
      </Button>

      {/* Refund button */}
      {canRefund && refundableAmount > 0 && (
        <Button
          variant="danger"
          leftIcon={<RotateCcw className="h-4 w-4" />}
          onClick={onRefund}
          loading={refundLoading}
        >
          Rembourser
        </Button>
      )}

      {/* Cancel button */}
      {canCancel && onCancel && (
        <Button
          variant="outline"
          leftIcon={<XCircle className="h-4 w-4" />}
          onClick={onCancel}
          loading={cancelLoading}
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          Annuler la commande
        </Button>
      )}
    </div>
  )
}

interface ConfirmRefundDialogProps {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
}

export function ConfirmRefundDialog({
  order,
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: ConfirmRefundDialogProps) {
  const refundableAmount = order.total - order.refundedAmount

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-red-600" />
            Confirmer le remboursement
          </ModalTitle>
          <ModalDescription>
            Cette action va ouvrir le dialogue de remboursement.
          </ModalDescription>
        </ModalHeader>

        <ModalBody>
          <div className="space-y-4">
            <div className="rounded-lg bg-yellow-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Attention</p>
                  <p>
                    Le remboursement sera traite immediatement et cette action est
                    irreversible.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Commande</span>
                <span className="font-mono font-medium">
                  #{order.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-gray-600">Client</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2">
                <span className="text-gray-600">Montant remboursable</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(refundableAmount, order.currency)}
                </span>
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={loading}
            leftIcon={<RotateCcw className="h-4 w-4" />}
          >
            Continuer vers le remboursement
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

interface CancelOrderDialogProps {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  loading?: boolean
}

export function CancelOrderDialog({
  order,
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: CancelOrderDialogProps) {
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('Veuillez indiquer un motif d\'annulation')
      return
    }
    onConfirm(reason)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('')
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Annuler la commande
          </ModalTitle>
          <ModalDescription>
            Commande #{order.id.slice(0, 8).toUpperCase()} - {order.customerName}
          </ModalDescription>
        </ModalHeader>

        <ModalBody>
          <div className="space-y-4">
            <div className="rounded-lg bg-yellow-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Attention</p>
                  <p>
                    Cette action annulera definitivement la commande. Si un paiement
                    a ete effectue, un remboursement sera necessaire.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Motif d'annulation <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  setError(null)
                }}
                placeholder="Indiquez la raison de l'annulation..."
                rows={3}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                  error && 'border-red-500'
                )}
              />
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Retour
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={loading}
            leftIcon={<XCircle className="h-4 w-4" />}
          >
            Confirmer l'annulation
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

interface PrintReceiptButtonProps {
  order: Order
  className?: string
}

export function PrintReceiptButton({ order, className }: PrintReceiptButtonProps) {
  const handlePrint = () => {
    // Create a printable receipt
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

  return (
    <Button
      variant="outline"
      size="sm"
      leftIcon={<Printer className="h-4 w-4" />}
      onClick={handlePrint}
      className={className}
    >
      Imprimer
    </Button>
  )
}
