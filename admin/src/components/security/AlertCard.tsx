'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  User,
  CheckCircle,
  XCircle,
  UserPlus,
  MoreVertical,
} from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import {
  SecurityAlert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  getAlertTypeLabel,
  getSeverityLabel,
  getStatusLabel,
} from '@/lib/api/security'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface AlertCardProps {
  alert: SecurityAlert
  onAcknowledge?: (alertId: string) => void
  onResolve?: (alertId: string) => void
  onCancel?: (alertId: string) => void
  onAssign?: (alertId: string) => void
  onViewDetails?: (alertId: string) => void
  isLoading?: boolean
  compact?: boolean
}

const typeIcons: Record<AlertType, React.ElementType> = {
  SOS: AlertTriangle,
  MEDICAL: AlertTriangle,
  FIRE: AlertTriangle,
  THEFT: AlertTriangle,
  VIOLENCE: AlertTriangle,
  LOST_CHILD: User,
  SUSPICIOUS: AlertTriangle,
  CROWD_CONTROL: AlertTriangle,
  OTHER: AlertTriangle,
}

const severityStyles: Record<AlertSeverity, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
  MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  CRITICAL: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
}

const statusStyles: Record<AlertStatus, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-red-100', text: 'text-red-700' },
  ACKNOWLEDGED: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700' },
  RESOLVED: { bg: 'bg-green-100', text: 'text-green-700' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-500' },
}

export function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  onCancel,
  onAssign,
  onViewDetails,
  isLoading = false,
  compact = false,
}: AlertCardProps) {
  const [showActions, setShowActions] = useState(false)

  const Icon = typeIcons[alert.type] || AlertTriangle
  const severity = severityStyles[alert.severity]
  const status = statusStyles[alert.status]

  const isPending = alert.status === 'PENDING'
  const isActive = ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(alert.status)

  const timeSinceCreation = () => {
    const created = new Date(alert.createdAt)
    const now = new Date()
    const diffMs = now.getTime() - created.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'A l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Il y a ${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    return `Il y a ${diffDays}j`
  }

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors',
          severity.border,
          isPending && 'animate-pulse'
        )}
        onClick={() => onViewDetails?.(alert.id)}
      >
        <div className={cn('rounded-full p-2', severity.bg)}>
          <Icon className={cn('h-4 w-4', severity.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">{alert.title}</span>
            <Badge className={cn(status.bg, status.text, 'text-xs')}>
              {getStatusLabel(alert.status)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-3 w-3" />
            <span>{timeSinceCreation()}</span>
            {alert.location.zone && (
              <>
                <MapPin className="h-3 w-3 ml-2" />
                <span>{alert.location.zone}</span>
              </>
            )}
          </div>
        </div>
        <Badge className={cn(severity.bg, severity.text)}>
          {getSeverityLabel(alert.severity)}
        </Badge>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-white shadow-sm overflow-hidden',
        severity.border,
        isPending && alert.severity === 'CRITICAL' && 'ring-2 ring-red-500 ring-offset-2'
      )}
    >
      {/* Header */}
      <div className={cn('px-4 py-3 border-b', severity.bg, severity.border)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-full p-2 bg-white/50')}>
              <Icon className={cn('h-5 w-5', severity.text)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn('font-semibold', severity.text)}>
                  {getAlertTypeLabel(alert.type)}
                </span>
                <Badge className={cn(severity.bg, severity.text, 'border', severity.border)}>
                  {getSeverityLabel(alert.severity)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm opacity-75">
                <Clock className="h-3 w-3" />
                <span>{timeSinceCreation()}</span>
              </div>
            </div>
          </div>
          <Badge className={cn(status.bg, status.text)}>
            {getStatusLabel(alert.status)}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900">{alert.title}</h3>
          {alert.description && (
            <p className="text-gray-600 mt-1">{alert.description}</p>
          )}
        </div>

        {/* Location */}
        {(alert.location.latitude || alert.location.zone) && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
            <div>
              {alert.location.zone && (
                <span className="font-medium text-gray-700">{alert.location.zone}</span>
              )}
              {alert.location.latitude && (
                <span className="text-gray-500 block">
                  {alert.location.latitude.toFixed(6)}, {alert.location.longitude.toFixed(6)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Contact */}
        {alert.contactPhone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-gray-400" />
            <a href={`tel:${alert.contactPhone}`} className="text-primary hover:underline">
              {alert.contactPhone}
            </a>
          </div>
        )}

        {/* Assignment */}
        {alert.assignedTo && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">Assigne a: {alert.assignedTo}</span>
          </div>
        )}

        {/* Resolution */}
        {alert.resolution && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-green-700 font-medium mb-1">
              <CheckCircle className="h-4 w-4" />
              Resolution
            </div>
            <p className="text-green-600">{alert.resolution}</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="text-xs text-gray-400 space-y-1">
          <div>Cree le {formatDateTime(alert.createdAt)}</div>
          {alert.acknowledgedAt && (
            <div>Pris en compte le {formatDateTime(alert.acknowledgedAt)}</div>
          )}
          {alert.resolvedAt && (
            <div>Resolu le {formatDateTime(alert.resolvedAt)}</div>
          )}
        </div>
      </div>

      {/* Actions */}
      {isActive && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-2">
          {isPending && onAcknowledge && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAcknowledge(alert.id)}
              disabled={isLoading}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Prendre en compte
            </Button>
          )}
          {onAssign && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAssign(alert.id)}
              disabled={isLoading}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Assigner
            </Button>
          )}
          {onResolve && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onResolve(alert.id)}
              disabled={isLoading}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Resoudre
            </Button>
          )}
          {onCancel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCancel(alert.id)}
              disabled={isLoading}
              className="text-gray-500 hover:text-gray-700"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Annuler
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default AlertCard
