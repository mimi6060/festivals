'use client'

import * as React from 'react'
import { formatCurrency } from '@/lib/utils'
import { RotateCcw, AlertTriangle, Wallet, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from '@/components/ui/Modal'
import type { Order, OrderItem } from '@/lib/api/orders'

interface RefundDialogProps {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefund: (data: RefundData) => Promise<void>
  loading?: boolean
}

export interface RefundData {
  type: 'full' | 'partial'
  amount: number
  reason: string
  refundToWallet: boolean
  items?: Array<{ itemId: string; quantity: number }>
}

export function RefundDialog({
  order,
  open,
  onOpenChange,
  onRefund,
  loading = false,
}: RefundDialogProps) {
  const [refundType, setRefundType] = React.useState<'full' | 'partial'>('full')
  const [reason, setReason] = React.useState('')
  const [refundToWallet, setRefundToWallet] = React.useState(true)
  const [customAmount, setCustomAmount] = React.useState('')
  const [selectedItems, setSelectedItems] = React.useState<Map<string, number>>(new Map())
  const [error, setError] = React.useState<string | null>(null)

  // Calculate refund amount based on selected items
  const calculatePartialRefund = React.useCallback(() => {
    let total = 0
    selectedItems.forEach((quantity, itemId) => {
      const item = order.items.find((i) => i.id === itemId)
      if (item) {
        total += item.unitPrice * quantity
      }
    })
    return total
  }, [selectedItems, order.items])

  const refundAmount = refundType === 'full'
    ? order.total - order.refundedAmount
    : calculatePartialRefund()

  const maxRefundable = order.total - order.refundedAmount

  const handleItemQuantityChange = (itemId: string, quantity: number) => {
    const newSelected = new Map(selectedItems)
    if (quantity <= 0) {
      newSelected.delete(itemId)
    } else {
      newSelected.set(itemId, quantity)
    }
    setSelectedItems(newSelected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!reason.trim()) {
      setError('Veuillez indiquer un motif de remboursement')
      return
    }

    if (refundType === 'partial' && selectedItems.size === 0) {
      setError('Veuillez selectionner au moins un article a rembourser')
      return
    }

    if (refundAmount <= 0) {
      setError('Le montant du remboursement doit etre superieur a 0')
      return
    }

    if (refundAmount > maxRefundable) {
      setError(`Le montant maximum remboursable est de ${formatCurrency(maxRefundable, order.currency)}`)
      return
    }

    const items = refundType === 'partial'
      ? Array.from(selectedItems.entries()).map(([itemId, quantity]) => ({
          itemId,
          quantity,
        }))
      : undefined

    await onRefund({
      type: refundType,
      amount: refundAmount,
      reason,
      refundToWallet,
      items,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form state when closing
      setRefundType('full')
      setReason('')
      setRefundToWallet(true)
      setCustomAmount('')
      setSelectedItems(new Map())
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent size="lg">
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" />
              Remboursement de commande
            </ModalTitle>
            <ModalDescription>
              Commande #{order.id.slice(0, 8).toUpperCase()} - {order.customerName}
            </ModalDescription>
          </ModalHeader>

          <ModalBody className="space-y-6">
            {/* Warning banner */}
            <div className="flex items-start gap-3 rounded-lg bg-yellow-50 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Attention</p>
                <p>Cette action est irreversible. Le remboursement sera traite immediatement.</p>
              </div>
            </div>

            {/* Refund type selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Type de remboursement
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRefundType('full')}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    refundType === 'full'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900">Remboursement total</p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(maxRefundable, order.currency)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setRefundType('partial')}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    refundType === 'partial'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900">Remboursement partiel</p>
                  <p className="text-sm text-gray-500">Selectionner les articles</p>
                </button>
              </div>
            </div>

            {/* Item selection for partial refund */}
            {refundType === 'partial' && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Articles a rembourser
                </label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-2">
                  {order.items.map((item) => (
                    <ItemRefundRow
                      key={item.id}
                      item={item}
                      currency={order.currency}
                      selectedQuantity={selectedItems.get(item.id) || 0}
                      onQuantityChange={(qty) => handleItemQuantityChange(item.id, qty)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Refund destination */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Destination du remboursement
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRefundToWallet(true)}
                  disabled={!order.walletId}
                  className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                    refundToWallet
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${!order.walletId ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <Wallet className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Portefeuille</p>
                    <p className="text-sm text-gray-500">Credit instantane</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRefundToWallet(false)}
                  className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                    !refundToWallet
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <CreditCard className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Moyen original</p>
                    <p className="text-sm text-gray-500">3-5 jours ouvrables</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Reason */}
            <Input
              label="Motif du remboursement"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Indiquez la raison du remboursement..."
              error={error || undefined}
            />

            {/* Summary */}
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Montant a rembourser</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(refundAmount, order.currency)}
                </span>
              </div>
              {order.refundedAmount > 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  Deja rembourse : {formatCurrency(order.refundedAmount, order.currency)}
                </p>
              )}
            </div>
          </ModalBody>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={loading}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Confirmer le remboursement
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

interface ItemRefundRowProps {
  item: OrderItem
  currency: string
  selectedQuantity: number
  onQuantityChange: (quantity: number) => void
}

function ItemRefundRow({
  item,
  currency,
  selectedQuantity,
  onQuantityChange,
}: ItemRefundRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md bg-white p-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{item.productName}</p>
        <p className="text-sm text-gray-500">
          {formatCurrency(item.unitPrice, currency)} x {item.quantity}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onQuantityChange(Math.max(0, selectedQuantity - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 hover:bg-gray-50"
        >
          -
        </button>
        <span className="w-8 text-center font-medium">{selectedQuantity}</span>
        <button
          type="button"
          onClick={() => onQuantityChange(Math.min(item.quantity, selectedQuantity + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 hover:bg-gray-50"
        >
          +
        </button>
      </div>
    </div>
  )
}
