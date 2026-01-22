'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { InventoryItem } from '@/lib/api/inventory'
import {
  Package,
  AlertTriangle,
  PackageX,
  Edit,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react'

interface StockTableProps {
  items: InventoryItem[]
  isLoading: boolean
  onAdjustStock: (item: InventoryItem) => void
  festivalId: string
}

type SortField = 'productName' | 'quantity' | 'standName' | 'minThreshold'
type SortDirection = 'asc' | 'desc'

export function StockTable({ items, isLoading, onAdjustStock, festivalId }: StockTableProps) {
  const [sortField, setSortField] = useState<SortField>('productName')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedItems = [...items].sort((a, b) => {
    let aVal: string | number = ''
    let bVal: string | number = ''

    switch (sortField) {
      case 'productName':
        aVal = a.productName || ''
        bVal = b.productName || ''
        break
      case 'quantity':
        aVal = a.quantity
        bVal = b.quantity
        break
      case 'standName':
        aVal = a.standName || ''
        bVal = b.standName || ''
        break
      case 'minThreshold':
        aVal = a.minThreshold
        bVal = b.minThreshold
        break
    }

    if (typeof aVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal)
    }

    return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal
  })

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-medium text-gray-500 hover:text-gray-700"
    >
      {children}
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="h-4 w-4 opacity-50" />
      )}
    </button>
  )

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Produit</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Stand</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Quantite</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Seuil</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="px-4 py-3">
                  <div className="h-4 w-32 rounded bg-gray-200" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-24 rounded bg-gray-200" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-16 rounded bg-gray-200" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-12 rounded bg-gray-200" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-6 w-20 rounded bg-gray-200" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-8 w-8 rounded bg-gray-200" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Package className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="mb-2 text-lg font-medium text-gray-900">Aucun produit en stock</h3>
        <p className="text-gray-500">
          Commencez par ajouter des produits a l'inventaire
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm">
                <SortHeader field="productName">Produit</SortHeader>
              </th>
              <th className="px-4 py-3 text-left text-sm">
                <SortHeader field="standName">Stand</SortHeader>
              </th>
              <th className="px-4 py-3 text-left text-sm">
                <SortHeader field="quantity">Quantite</SortHeader>
              </th>
              <th className="px-4 py-3 text-left text-sm">
                <SortHeader field="minThreshold">Seuil</SortHeader>
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedItems.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                      <Package className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.productName || 'Produit'}</p>
                      {item.productSku && (
                        <p className="text-xs text-gray-500">SKU: {item.productSku}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {item.standName || 'Stand'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-lg font-semibold',
                        item.isOutOfStock
                          ? 'text-red-600'
                          : item.isLowStock
                          ? 'text-yellow-600'
                          : 'text-gray-900'
                      )}
                    >
                      {item.quantity}
                    </span>
                    {item.maxCapacity && (
                      <span className="text-xs text-gray-400">/ {item.maxCapacity}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.minThreshold}</td>
                <td className="px-4 py-3">
                  {item.isOutOfStock ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      <PackageX className="h-3 w-3" />
                      Rupture
                    </span>
                  ) : item.isLowStock ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                      <AlertTriangle className="h-3 w-3" />
                      Stock bas
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      OK
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                      className="rounded-lg p-1 hover:bg-gray-100"
                    >
                      <MoreVertical className="h-5 w-5 text-gray-500" />
                    </button>

                    {openMenuId === item.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
                          <button
                            onClick={() => {
                              onAdjustStock(item)
                              setOpenMenuId(null)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit className="h-4 w-4" />
                            Ajuster le stock
                          </button>
                          <Link
                            href={`/festivals/${festivalId}/stands/${item.standId}/products`}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <Package className="h-4 w-4" />
                            Voir le produit
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StockTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Produit</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Stand</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Quantite</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Seuil</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: 10 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              <td className="px-4 py-3">
                <div className="h-4 w-32 rounded bg-gray-200" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-24 rounded bg-gray-200" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-16 rounded bg-gray-200" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-12 rounded bg-gray-200" />
              </td>
              <td className="px-4 py-3">
                <div className="h-6 w-20 rounded bg-gray-200" />
              </td>
              <td className="px-4 py-3">
                <div className="h-8 w-8 rounded bg-gray-200" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
