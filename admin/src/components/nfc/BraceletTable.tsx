'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CreditCard,
  CheckCircle,
  Ban,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Lock,
  Unlock,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { Table, Pagination, type Column } from '@/components/ui/Table'

export interface Bracelet {
  id: string
  uid: string
  status: 'ACTIVE' | 'UNASSIGNED' | 'BLOCKED' | 'LOST' | 'REPLACED'
  walletId: string | null
  walletBalance: number | null
  userId: string | null
  holderName: string | null
  holderEmail: string | null
  ticketType: string | null
  batchId: string | null
  batchName: string | null
  activatedAt: string | null
  blockedAt: string | null
  blockReason: string | null
  lastUsedAt: string | null
  transactionCount: number
  createdAt: string
}

interface BraceletTableProps {
  bracelets: Bracelet[]
  loading?: boolean
  festivalId: string
  currentPage: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
  onBlock?: (braceletId: string, reason: string) => void
  onUnblock?: (braceletId: string) => void
  onDeactivate?: (braceletId: string) => void
  selectedBracelets?: Set<string>
  onSelectBracelet?: (braceletId: string, selected: boolean) => void
  onSelectAll?: (selected: boolean) => void
}

const statusConfig = {
  ACTIVE: {
    label: 'Actif',
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: CheckCircle,
  },
  UNASSIGNED: {
    label: 'Non assigne',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    icon: CreditCard,
  },
  BLOCKED: {
    label: 'Bloque',
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: Ban,
  },
  LOST: {
    label: 'Perdu',
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    icon: AlertTriangle,
  },
  REPLACED: {
    label: 'Remplace',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    icon: RefreshCw,
  },
}

export default function BraceletTable({
  bracelets,
  loading = false,
  festivalId,
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  onBlock,
  onUnblock,
  onDeactivate,
  selectedBracelets = new Set(),
  onSelectBracelet,
  onSelectAll,
}: BraceletTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const handleBlock = (bracelet: Bracelet) => {
    const reason = prompt('Raison du blocage:')
    if (reason && onBlock) {
      onBlock(bracelet.id, reason)
    }
    setOpenMenuId(null)
  }

  const columns: Column<Bracelet>[] = [
    ...(onSelectBracelet
      ? [
          {
            key: 'select',
            header: (
              <input
                type="checkbox"
                checked={selectedBracelets.size === bracelets.length && bracelets.length > 0}
                onChange={(e) => onSelectAll?.(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
            ),
            cell: (bracelet: Bracelet) => (
              <input
                type="checkbox"
                checked={selectedBracelets.has(bracelet.id)}
                onChange={(e) => onSelectBracelet(bracelet.id, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
            ),
            className: 'w-10',
          } as Column<Bracelet>,
        ]
      : []),
    {
      key: 'uid',
      header: 'UID',
      cell: (bracelet) => (
        <div>
          <Link
            href={`/festivals/${festivalId}/nfc/${bracelet.id}`}
            className="font-mono text-sm font-medium text-gray-900 hover:text-primary"
          >
            {bracelet.uid}
          </Link>
          {bracelet.batchName && (
            <p className="text-xs text-gray-500">{bracelet.batchName}</p>
          )}
        </div>
      ),
    },
    {
      key: 'holder',
      header: 'Titulaire',
      cell: (bracelet) =>
        bracelet.holderName ? (
          <div>
            <p className="font-medium text-gray-900">{bracelet.holderName}</p>
            <p className="text-sm text-gray-500">{bracelet.holderEmail}</p>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'ticketType',
      header: 'Type billet',
      cell: (bracelet) =>
        bracelet.ticketType ? (
          <span className="text-sm">{bracelet.ticketType}</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'balance',
      header: 'Solde',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (bracelet) =>
        bracelet.walletBalance !== null ? (
          <span className="font-medium">{formatCurrency(bracelet.walletBalance)}</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'transactions',
      header: 'TX',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (bracelet) => (
        <span className="text-sm text-gray-600">{bracelet.transactionCount}</span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (bracelet) => {
        const status = statusConfig[bracelet.status]
        const Icon = status.icon
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              status.bg,
              status.text
            )}
          >
            <Icon className="h-3 w-3" />
            {status.label}
          </span>
        )
      },
    },
    {
      key: 'lastUsed',
      header: 'Derniere utilisation',
      cell: (bracelet) =>
        bracelet.lastUsedAt ? (
          <span className="text-sm text-gray-500">{formatDate(bracelet.lastUsedAt)}</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      cell: (bracelet) => (
        <div className="relative">
          <button
            onClick={() => setOpenMenuId(openMenuId === bracelet.id ? null : bracelet.id)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {openMenuId === bracelet.id && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpenMenuId(null)}
              />
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
                <Link
                  href={`/festivals/${festivalId}/nfc/${bracelet.id}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setOpenMenuId(null)}
                >
                  <Eye className="h-4 w-4" />
                  Voir details
                </Link>
                {bracelet.status === 'ACTIVE' && onBlock && (
                  <button
                    onClick={() => handleBlock(bracelet)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Lock className="h-4 w-4" />
                    Bloquer
                  </button>
                )}
                {bracelet.status === 'BLOCKED' && onUnblock && (
                  <button
                    onClick={() => {
                      onUnblock(bracelet.id)
                      setOpenMenuId(null)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                  >
                    <Unlock className="h-4 w-4" />
                    Debloquer
                  </button>
                )}
                {bracelet.status === 'ACTIVE' && onDeactivate && (
                  <button
                    onClick={() => {
                      if (confirm('Desactiver ce bracelet ?')) {
                        onDeactivate(bracelet.id)
                      }
                      setOpenMenuId(null)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Desactiver
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <Table
        columns={columns}
        data={bracelets}
        loading={loading}
        emptyMessage="Aucun bracelet trouve"
      />
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={20}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
}
