'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { inventoryApi, InventoryItem, MovementType } from '@/lib/api/inventory'
import {
  X,
  Plus,
  Minus,
  RefreshCw,
  Truck,
  AlertTriangle,
  RotateCcw,
  Package,
} from 'lucide-react'

interface StockAdjustFormProps {
  item: InventoryItem
  onClose: () => void
  onSuccess: () => void
}

const adjustmentTypes: { value: MovementType; label: string; icon: typeof Plus; description: string }[] = [
  { value: 'IN', label: 'Entree', icon: Plus, description: 'Reception de stock' },
  { value: 'OUT', label: 'Sortie', icon: Minus, description: 'Sortie de stock' },
  { value: 'ADJUSTMENT', label: 'Ajustement', icon: RefreshCw, description: 'Correction de stock' },
  { value: 'LOSS', label: 'Perte', icon: AlertTriangle, description: 'Stock perdu/casse' },
  { value: 'RETURN', label: 'Retour', icon: RotateCcw, description: 'Retour client' },
]

export function StockAdjustForm({ item, onClose, onSuccess }: StockAdjustFormProps) {
  const [type, setType] = useState<MovementType>('IN')
  const [quantity, setQuantity] = useState<number>(1)
  const [reason, setReason] = useState('')

  const adjustMutation = useMutation({
    mutationFn: (data: { productId: string; standId: string; delta: number; type: MovementType; reason?: string }) =>
      inventoryApi.adjustStock(data),
    onSuccess: () => {
      onSuccess()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (quantity <= 0) return

    // For OUT and LOSS, delta should be negative
    const delta = type === 'OUT' || type === 'LOSS' ? -quantity : quantity

    adjustMutation.mutate({
      productId: item.productId,
      standId: item.standId,
      delta,
      type,
      reason: reason || undefined,
    })
  }

  const previewQuantity = (() => {
    const delta = type === 'OUT' || type === 'LOSS' ? -quantity : quantity
    return Math.max(0, item.quantity + delta)
  })()

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold text-gray-900">Ajuster le stock</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Product info */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
              <Package className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{item.productName || 'Produit'}</p>
              <p className="text-sm text-gray-500">
                Stock actuel: <span className="font-semibold">{item.quantity}</span>
              </p>
            </div>
          </div>

          {/* Adjustment type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type d'ajustement
            </label>
            <div className="grid grid-cols-2 gap-2">
              {adjustmentTypes.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 text-left transition-colors',
                      type === option.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <div>
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs opacity-70">{option.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantite
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-gray-50"
              >
                <Minus className="h-5 w-5" />
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 rounded-lg border px-3 py-2 text-center text-lg font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-gray-50"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Stock apres ajustement:</span>
              <span
                className={cn(
                  'text-lg font-semibold',
                  previewQuantity === 0
                    ? 'text-red-600'
                    : previewQuantity <= item.minThreshold
                    ? 'text-yellow-600'
                    : 'text-green-600'
                )}
              >
                {previewQuantity}
              </span>
            </div>
            {type === 'OUT' || type === 'LOSS' ? (
              quantity > item.quantity && (
                <p className="mt-2 text-sm text-red-600">
                  Attention: la quantite demandee depasse le stock disponible
                </p>
              )
            ) : null}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Raison (optionnel)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Raison de l'ajustement..."
              className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Error */}
          {adjustMutation.isError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {(adjustMutation.error as Error)?.message || 'Une erreur est survenue'}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={
                adjustMutation.isPending ||
                quantity <= 0 ||
                ((type === 'OUT' || type === 'LOSS') && quantity > item.quantity)
              }
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {adjustMutation.isPending ? 'Ajustement...' : 'Confirmer l\'ajustement'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
