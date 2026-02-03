'use client'

import { formatCurrency } from '@/lib/utils'
import { Package } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import {
  TableRoot,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table'
import type { OrderItem } from '@/lib/api/orders'

interface OrderItemsTableProps {
  items: OrderItem[]
  currency: string
  className?: string
}

export function OrderItemsTable({ items, currency, className }: OrderItemsTableProps) {
  const subtotal = items.reduce((acc, item) => acc + item.total, 0)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-gray-400" />
          Articles ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <TableRoot>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Prix unitaire</TableHead>
              <TableHead className="text-center">Quantite</TableHead>
              <TableHead className="text-right">TVA</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-gray-900">{item.productName}</p>
                    <p className="text-sm text-gray-500">ID: {item.productId}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.unitPrice, currency)}
                </TableCell>
                <TableCell className="text-center">{item.quantity}</TableCell>
                <TableCell className="text-right">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    {item.vatRate}%
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.total, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableRoot>

        {/* Summary footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Sous-total</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(subtotal, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface OrderItemsCompactProps {
  items: OrderItem[]
  currency: string
  className?: string
}

export function OrderItemsCompact({ items, currency, className }: OrderItemsCompactProps) {
  return (
    <div className={className}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
        <Package className="h-4 w-4" />
        Articles ({items.length})
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-sm font-medium text-gray-600">
                {item.quantity}x
              </div>
              <div>
                <p className="font-medium text-gray-900">{item.productName}</p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(item.unitPrice, currency)} / unite
                </p>
              </div>
            </div>
            <span className="font-semibold text-gray-900">
              {formatCurrency(item.total, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
