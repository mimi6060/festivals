'use client'

import Link from 'next/link'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { Ticket, MoreVertical, Edit, Trash2, TrendingUp, Users } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { TicketType } from '@/lib/api/tickets'

interface TicketTypeCardProps {
  ticketType: TicketType
  festivalId: string
  onDelete?: (id: string) => void
}

const statusColors: Record<TicketType['status'], { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Brouillon' },
  ON_SALE: { bg: 'bg-green-100', text: 'text-green-700', label: 'En vente' },
  SOLD_OUT: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Complet' },
  CLOSED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Fermé' },
}

export function TicketTypeCard({ ticketType, festivalId, onDelete }: TicketTypeCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const statusStyle = statusColors[ticketType.status]
  const soldPercentage = ticketType.quantity
    ? Math.round((ticketType.sold / ticketType.quantity) * 100)
    : null
  const checkedInPercentage = ticketType.sold > 0
    ? Math.round((ticketType.checkedIn / ticketType.sold) * 100)
    : 0

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="rounded-lg border bg-white p-6 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Ticket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <Link
              href={`/festivals/${festivalId}/tickets/${ticketType.id}`}
              className="font-semibold text-gray-900 hover:text-primary"
            >
              {ticketType.name}
            </Link>
            <p className="text-sm text-gray-500">{formatCurrency(ticketType.price)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              statusStyle.bg,
              statusStyle.text
            )}
          >
            {statusStyle.label}
          </span>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded p-1 hover:bg-gray-100"
            >
              <MoreVertical className="h-5 w-5 text-gray-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
                <Link
                  href={`/festivals/${festivalId}/tickets/${ticketType.id}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4" />
                  Modifier
                </Link>
                {onDelete && ticketType.sold === 0 && (
                  <button
                    onClick={() => {
                      onDelete(ticketType.id)
                      setMenuOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {ticketType.description && (
        <p className="mt-3 text-sm text-gray-600 line-clamp-2">{ticketType.description}</p>
      )}

      <div className="mt-4 space-y-3">
        {/* Sales Progress */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-gray-600">
              <TrendingUp className="h-4 w-4" />
              Ventes
            </span>
            <span className="font-medium">
              {formatNumber(ticketType.sold)}
              {ticketType.quantity ? ` / ${formatNumber(ticketType.quantity)}` : ' (illimité)'}
            </span>
          </div>
          {ticketType.quantity && (
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  soldPercentage && soldPercentage >= 90
                    ? 'bg-orange-500'
                    : soldPercentage && soldPercentage >= 100
                    ? 'bg-red-500'
                    : 'bg-primary'
                )}
                style={{ width: `${Math.min(soldPercentage || 0, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Check-in Progress */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-gray-600">
              <Users className="h-4 w-4" />
              Check-ins
            </span>
            <span className="font-medium">
              {formatNumber(ticketType.checkedIn)} / {formatNumber(ticketType.sold)} ({checkedInPercentage}%)
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${checkedInPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Benefits Preview */}
      {ticketType.benefits.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {ticketType.benefits.slice(0, 3).map((benefit, index) => (
            <span
              key={index}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {benefit}
            </span>
          ))}
          {ticketType.benefits.length > 3 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              +{ticketType.benefits.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Revenue */}
      <div className="mt-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Revenus</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(ticketType.sold * ticketType.price)}
          </span>
        </div>
      </div>
    </div>
  )
}

// Compact variant for lists
export function TicketTypeRow({ ticketType, festivalId }: Omit<TicketTypeCardProps, 'onDelete'>) {
  const statusStyle = statusColors[ticketType.status]
  const soldPercentage = ticketType.quantity
    ? Math.round((ticketType.sold / ticketType.quantity) * 100)
    : null

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-3">
        <Link
          href={`/festivals/${festivalId}/tickets/${ticketType.id}`}
          className="font-medium text-gray-900 hover:text-primary"
        >
          {ticketType.name}
        </Link>
      </td>
      <td className="px-4 py-3 text-right">
        {formatCurrency(ticketType.price)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-24">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(soldPercentage || 0, 100)}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-gray-600">
            {formatNumber(ticketType.sold)}
            {ticketType.quantity ? ` / ${formatNumber(ticketType.quantity)}` : ''}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        {formatNumber(ticketType.checkedIn)}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
            statusStyle.bg,
            statusStyle.text
          )}
        >
          {statusStyle.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-medium">
        {formatCurrency(ticketType.sold * ticketType.price)}
      </td>
    </tr>
  )
}
