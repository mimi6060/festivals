'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { inventoryApi, StockAlert } from '@/lib/api/inventory'
import { AlertTriangle, PackageX, AlertCircle, Check, Clock } from 'lucide-react'

interface LowStockAlertProps {
  alert: StockAlert
  showAcknowledge?: boolean
}

export function LowStockAlert({ alert, showAcknowledge = true }: LowStockAlertProps) {
  const queryClient = useQueryClient()

  const acknowledgeMutation = useMutation({
    mutationFn: () => inventoryApi.acknowledgeAlert(alert.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] })
    },
  })

  const getAlertConfig = () => {
    switch (alert.type) {
      case 'OUT_OF_STOCK':
        return {
          icon: PackageX,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-200',
          title: 'Rupture de stock',
        }
      case 'LOW_STOCK':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          borderColor: 'border-yellow-200',
          title: 'Stock bas',
        }
      case 'OVER_STOCK':
        return {
          icon: AlertCircle,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-200',
          title: 'Surstock',
        }
      default:
        return {
          icon: AlertTriangle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-200',
          title: 'Alerte',
        }
    }
  }

  const config = getAlertConfig()
  const Icon = config.icon

  return (
    <div className={cn('rounded-lg border p-4', config.borderColor, config.bgColor)}>
      <div className="flex items-start gap-3">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', config.bgColor)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn('font-medium', config.color)}>{config.title}</p>
            {alert.status === 'ACKNOWLEDGED' && (
              <span className="inline-flex items-center gap-1 rounded bg-white/50 px-1.5 py-0.5 text-xs text-gray-600">
                <Check className="h-3 w-3" />
                Pris en compte
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {alert.productName || 'Produit'}
          </p>
          <p className="text-sm text-gray-600">{alert.standName || 'Stand'}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span>Stock: <span className="font-semibold">{alert.currentQty}</span></span>
            <span>Seuil: <span className="font-semibold">{alert.thresholdQty}</span></span>
          </div>
        </div>
        {showAcknowledge && alert.status === 'ACTIVE' && (
          <button
            onClick={() => acknowledgeMutation.mutate()}
            disabled={acknowledgeMutation.isPending}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {acknowledgeMutation.isPending ? '...' : 'OK'}
          </button>
        )}
      </div>
    </div>
  )
}

interface LowStockAlertCompactProps {
  alert: StockAlert
}

export function LowStockAlertCompact({ alert }: LowStockAlertCompactProps) {
  const isOutOfStock = alert.type === 'OUT_OF_STOCK'

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        isOutOfStock
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-yellow-200 bg-yellow-50 text-yellow-700'
      )}
    >
      {isOutOfStock ? (
        <PackageX className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate">
        <span className="font-medium">{alert.productName}</span>
        {' - '}
        {isOutOfStock ? 'Rupture' : `${alert.currentQty} restant(s)`}
      </span>
    </div>
  )
}

interface LowStockAlertBannerProps {
  alerts: StockAlert[]
  festivalId: string
}

export function LowStockAlertBanner({ alerts, festivalId }: LowStockAlertBannerProps) {
  const outOfStockCount = alerts.filter((a) => a.type === 'OUT_OF_STOCK').length
  const lowStockCount = alerts.filter((a) => a.type === 'LOW_STOCK').length

  if (alerts.length === 0) return null

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-orange-800">Alertes de stock</p>
          <p className="text-sm text-orange-600">
            {outOfStockCount > 0 && (
              <span className="font-semibold">{outOfStockCount} rupture{outOfStockCount > 1 ? 's' : ''}</span>
            )}
            {outOfStockCount > 0 && lowStockCount > 0 && ' et '}
            {lowStockCount > 0 && (
              <span className="font-semibold">{lowStockCount} stock{lowStockCount > 1 ? 's' : ''} bas</span>
            )}
          </p>
        </div>
        <a
          href={`/festivals/${festivalId}/inventory/alerts`}
          className="rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-50"
        >
          Voir les alertes
        </a>
      </div>
    </div>
  )
}
