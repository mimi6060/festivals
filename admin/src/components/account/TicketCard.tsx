'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { QRDownloadButton } from './QRDownloadButton'
import {
  Ticket,
  Calendar,
  MapPin,
  Clock,
  QrCode,
  Apple,
  Smartphone,
  Send,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import type { UserTicket } from '@/lib/api/account'

interface TicketCardProps {
  ticket: UserTicket
  onTransfer?: (ticketId: string) => void
  showActions?: boolean
  compact?: boolean
}

const statusConfig: Record<UserTicket['status'], {
  variant: 'success' | 'warning' | 'error' | 'default' | 'info'
  label: string
  icon: typeof CheckCircle
}> = {
  VALID: { variant: 'success', label: 'Valide', icon: CheckCircle },
  USED: { variant: 'default', label: 'Utilise', icon: CheckCircle },
  CANCELLED: { variant: 'error', label: 'Annule', icon: XCircle },
  EXPIRED: { variant: 'warning', label: 'Expire', icon: AlertCircle },
  TRANSFERRED: { variant: 'info', label: 'Transfere', icon: Send },
}

export function TicketCard({
  ticket,
  onTransfer,
  showActions = true,
  compact = false,
}: TicketCardProps) {
  const [expanded, setExpanded] = useState(false)
  const config = statusConfig[ticket.status]
  const StatusIcon = config.icon

  const isActive = ticket.status === 'VALID'
  const canTransfer = isActive && ticket.transferable && (!ticket.transferDeadline || new Date(ticket.transferDeadline) > new Date())

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow">
        <div className="flex items-center gap-4">
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-lg',
            isActive ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'
          )}>
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{ticket.ticketTypeName}</h3>
            <p className="text-sm text-gray-500">{ticket.festivalName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={config.variant}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
          {isActive && (
            <QRDownloadButton ticketId={ticket.id} size="sm" variant="ghost" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-xl border bg-white overflow-hidden transition-shadow',
      isActive ? 'shadow-sm hover:shadow-md' : 'opacity-75'
    )}>
      {/* Header with festival info */}
      <div className={cn(
        'px-6 py-4',
        isActive ? 'bg-gradient-to-r from-primary/10 to-primary/5' : 'bg-gray-50'
      )}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{ticket.festivalName}</h3>
            <p className="text-sm text-gray-600">{ticket.ticketTypeName}</p>
          </div>
          <Badge variant={config.variant} size="lg">
            <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
            {config.label}
          </Badge>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6">
        {/* Festival details */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <Calendar className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Date</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(ticket.festivalDate)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <MapPin className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Lieu</p>
              <p className="text-sm font-medium text-gray-900">{ticket.festivalLocation}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <Clock className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Valide du</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(ticket.validFrom)} - {formatDate(ticket.validUntil)}
              </p>
            </div>
          </div>
        </div>

        {/* QR Code section */}
        {isActive && (
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-lg bg-gray-50 mb-6">
            <div className="relative h-32 w-32 rounded-lg overflow-hidden bg-white p-2 shadow-sm">
              <Image
                src={ticket.qrCodeUrl || `/api/placeholder/128/128`}
                alt="QR Code du billet"
                fill
                className="object-contain"
              />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm text-gray-600 mb-3">
                Presentez ce QR code a l'entree pour acceder au festival
              </p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                <QRDownloadButton ticketId={ticket.id} />
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Apple className="h-4 w-4" />}
                  onClick={() => window.open(`/api/v1/account/tickets/${ticket.id}/apple-wallet`, '_blank')}
                >
                  Apple Wallet
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Smartphone className="h-4 w-4" />}
                  onClick={() => window.open(`/api/v1/account/tickets/${ticket.id}/google-wallet`, '_blank')}
                >
                  Google Wallet
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Benefits section - collapsible */}
        {ticket.benefits.length > 0 && (
          <div className="border-t pt-4">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <span>Avantages inclus ({ticket.benefits.length})</span>
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {expanded && (
              <ul className="mt-3 space-y-2">
                {ticket.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t mt-6 pt-4">
            <div className="text-sm text-gray-500">
              <span className="font-mono">{ticket.code}</span>
              <span className="mx-2">-</span>
              Achete le {formatDateTime(ticket.purchasedAt)}
            </div>

            {canTransfer && onTransfer && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Send className="h-4 w-4" />}
                onClick={() => onTransfer(ticket.id)}
              >
                Transferer
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Skeleton for loading state
export function TicketCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-white p-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-gray-200" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="h-3 w-24 rounded bg-gray-200" />
          </div>
        </div>
        <div className="h-6 w-16 rounded-full bg-gray-200" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden animate-pulse">
      <div className="px-6 py-4 bg-gray-50">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-gray-200" />
            <div className="h-4 w-24 rounded bg-gray-200" />
          </div>
          <div className="h-6 w-16 rounded-full bg-gray-200" />
        </div>
      </div>
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-200" />
              <div className="space-y-1">
                <div className="h-3 w-12 rounded bg-gray-200" />
                <div className="h-4 w-24 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-40 rounded-lg bg-gray-100" />
      </div>
    </div>
  )
}
