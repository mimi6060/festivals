'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  LayoutGrid,
  List,
  AlertCircle,
} from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { RefundRequestCard, RefundRequestRow } from '@/components/refunds/RefundRequestCard'
import {
  refundsApi,
  type RefundRequest,
  type RefundStatus,
  type RefundStats,
} from '@/lib/api/refunds'

type ViewMode = 'grid' | 'list'

// Mock data for development
const mockRefunds: RefundRequest[] = [
  {
    id: '1',
    festivalId: '1',
    userId: 'user-1',
    walletId: 'wallet-1',
    amount: 45.50,
    currency: 'EUR',
    status: 'PENDING',
    method: 'BANK_TRANSFER',
    reason: 'Je ne peux plus assister au festival pour raisons personnelles',
    user: {
      id: 'user-1',
      email: 'jean.dupont@email.com',
      firstName: 'Jean',
      lastName: 'Dupont',
      phone: '+33612345678',
    },
    wallet: {
      id: 'wallet-1',
      balance: 45.50,
      totalSpent: 154.50,
      totalTopUps: 200,
      ticketCode: 'FEST-2026-A1B2C3',
    },
    bankDetails: {
      accountHolder: 'Jean Dupont',
      iban: 'FR76 1234 5678 9012 3456 7890 123',
      bic: 'BNPAFRPP',
      bankName: 'BNP Paribas',
    },
    processedAt: null,
    processedBy: null,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    createdAt: '2026-01-20T14:30:00Z',
    updatedAt: '2026-01-20T14:30:00Z',
  },
  {
    id: '2',
    festivalId: '1',
    userId: 'user-2',
    walletId: 'wallet-2',
    amount: 78.20,
    currency: 'EUR',
    status: 'PENDING',
    method: 'BANK_TRANSFER',
    reason: 'Festival annule a cause de la meteo',
    user: {
      id: 'user-2',
      email: 'marie.martin@email.com',
      firstName: 'Marie',
      lastName: 'Martin',
      phone: '+33698765432',
    },
    wallet: {
      id: 'wallet-2',
      balance: 78.20,
      totalSpent: 21.80,
      totalTopUps: 100,
      ticketCode: 'FEST-2026-D4E5F6',
    },
    bankDetails: {
      accountHolder: 'Marie Martin',
      iban: 'FR76 9876 5432 1098 7654 3210 987',
      bic: 'CEPAFRPP',
      bankName: 'Caisse d\'Epargne',
    },
    processedAt: null,
    processedBy: null,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    createdAt: '2026-01-21T09:15:00Z',
    updatedAt: '2026-01-21T09:15:00Z',
  },
  {
    id: '3',
    festivalId: '1',
    userId: 'user-3',
    walletId: 'wallet-3',
    amount: 32.00,
    currency: 'EUR',
    status: 'APPROVED',
    method: 'BANK_TRANSFER',
    reason: 'Solde restant non utilise',
    user: {
      id: 'user-3',
      email: 'pierre.bernard@email.com',
      firstName: 'Pierre',
      lastName: 'Bernard',
      phone: '+33611223344',
    },
    wallet: {
      id: 'wallet-3',
      balance: 32.00,
      totalSpent: 168.00,
      totalTopUps: 200,
      ticketCode: 'FEST-2026-G7H8I9',
    },
    bankDetails: {
      accountHolder: 'Pierre Bernard',
      iban: 'FR76 1111 2222 3333 4444 5555 666',
      bic: 'SOGEFRPP',
      bankName: 'Societe Generale',
    },
    processedAt: null,
    processedBy: null,
    approvedAt: '2026-01-21T16:45:00Z',
    approvedBy: 'admin@festival.com',
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    createdAt: '2026-01-19T11:20:00Z',
    updatedAt: '2026-01-21T16:45:00Z',
  },
  {
    id: '4',
    festivalId: '1',
    userId: 'user-4',
    walletId: 'wallet-4',
    amount: 15.00,
    currency: 'EUR',
    status: 'REJECTED',
    method: 'ORIGINAL_PAYMENT',
    reason: 'Je veux un remboursement',
    user: {
      id: 'user-4',
      email: 'sophie.leroy@email.com',
      firstName: 'Sophie',
      lastName: 'Leroy',
      phone: null,
    },
    wallet: {
      id: 'wallet-4',
      balance: 15.00,
      totalSpent: 85.00,
      totalTopUps: 100,
      ticketCode: 'FEST-2026-J1K2L3',
    },
    processedAt: null,
    processedBy: null,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: '2026-01-20T10:00:00Z',
    rejectedBy: 'admin@festival.com',
    rejectionReason: 'Demande incomplete - merci de fournir un motif valide',
    createdAt: '2026-01-18T08:00:00Z',
    updatedAt: '2026-01-20T10:00:00Z',
  },
  {
    id: '5',
    festivalId: '1',
    userId: 'user-5',
    walletId: 'wallet-5',
    amount: 125.75,
    currency: 'EUR',
    status: 'COMPLETED',
    method: 'BANK_TRANSFER',
    reason: 'Remboursement suite a annulation de l\'evenement',
    user: {
      id: 'user-5',
      email: 'thomas.moreau@email.com',
      firstName: 'Thomas',
      lastName: 'Moreau',
      phone: '+33655443322',
    },
    wallet: {
      id: 'wallet-5',
      balance: 0,
      totalSpent: 74.25,
      totalTopUps: 200,
      ticketCode: 'FEST-2026-M4N5O6',
    },
    bankDetails: {
      accountHolder: 'Thomas Moreau',
      iban: 'FR76 5555 6666 7777 8888 9999 000',
      bic: 'CRLYFRPP',
      bankName: 'Credit Lyonnais',
    },
    processedAt: '2026-01-19T14:30:00Z',
    processedBy: 'finance@festival.com',
    approvedAt: '2026-01-18T11:00:00Z',
    approvedBy: 'admin@festival.com',
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    createdAt: '2026-01-17T09:00:00Z',
    updatedAt: '2026-01-19T14:30:00Z',
  },
]

const mockStats: RefundStats = {
  pending: 2,
  approved: 1,
  rejected: 1,
  completed: 1,
  totalPendingAmount: 123.70,
  totalCompletedAmount: 125.75,
  avgProcessingTime: 48,
}

export default function RefundsListPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [refunds, setRefunds] = useState<RefundRequest[]>([])
  const [stats, setStats] = useState<RefundStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchActionLoading, setBatchActionLoading] = useState(false)
  const [showBatchRejectModal, setShowBatchRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        // const [refundsResponse, statsResponse] = await Promise.all([
        //   refundsApi.listRefunds(festivalId),
        //   refundsApi.getRefundStats(festivalId),
        // ])
        // setRefunds(refundsResponse.data)
        // setStats(statsResponse)
        // Using mock data for now
        setRefunds(mockRefunds)
        setStats(mockStats)
      } catch (error) {
        console.error('Failed to load refunds:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [festivalId])

  // Filter refunds
  const filteredRefunds = useMemo(() => {
    return refunds.filter((refund) => {
      const matchesSearch =
        searchQuery === '' ||
        refund.user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        refund.user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        refund.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        refund.wallet.ticketCode.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || refund.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [refunds, searchQuery, statusFilter])

  // Get pending refunds for batch actions
  const pendingFilteredRefunds = useMemo(() => {
    return filteredRefunds.filter((r) => r.status === 'PENDING')
  }, [filteredRefunds])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pendingFilteredRefunds.map((r) => r.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return
    setBatchActionLoading(true)
    try {
      // await refundsApi.batchApprove(festivalId, Array.from(selectedIds))
      // Reload data after batch action
      // Using mock: update local state
      setRefunds((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id)
            ? { ...r, status: 'APPROVED' as RefundStatus, approvedAt: new Date().toISOString() }
            : r
        )
      )
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Failed to batch approve:', error)
    } finally {
      setBatchActionLoading(false)
    }
  }

  const handleBatchReject = async () => {
    if (selectedIds.size === 0 || !rejectReason) return
    setBatchActionLoading(true)
    try {
      // await refundsApi.batchReject(festivalId, Array.from(selectedIds), rejectReason)
      // Using mock: update local state
      setRefunds((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id)
            ? {
                ...r,
                status: 'REJECTED' as RefundStatus,
                rejectedAt: new Date().toISOString(),
                rejectionReason: rejectReason,
              }
            : r
        )
      )
      setSelectedIds(new Set())
      setShowBatchRejectModal(false)
      setRejectReason('')
    } catch (error) {
      console.error('Failed to batch reject:', error)
    } finally {
      setBatchActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demandes de remboursement</h1>
          <p className="text-gray-500">Gerez les demandes de remboursement des participants</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Download className="h-4 w-4" />
          Exporter
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <Clock className="h-4 w-4" />
              En attente
            </div>
            <p className="mt-1 text-3xl font-bold">{formatNumber(stats.pending)}</p>
            <p className="text-sm text-gray-500">
              {formatCurrency(stats.totalPendingAmount)}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <CheckCircle className="h-4 w-4" />
              Approuvees
            </div>
            <p className="mt-1 text-3xl font-bold">{formatNumber(stats.approved)}</p>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Banknote className="h-4 w-4" />
              Completees
            </div>
            <p className="mt-1 text-3xl font-bold">{formatNumber(stats.completed)}</p>
            <p className="text-sm text-gray-500">
              {formatCurrency(stats.totalCompletedAmount)}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-2 text-sm text-red-600">
              <XCircle className="h-4 w-4" />
              Rejetees
            </div>
            <p className="mt-1 text-3xl font-bold">{formatNumber(stats.rejected)}</p>
          </div>
        </div>
      )}

      {/* Filters and View Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email ou code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border pl-10 pr-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="APPROVED">Approuve</option>
            <option value="REJECTED">Rejete</option>
            <option value="COMPLETED">Complete</option>
            <option value="FAILED">Echoue</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-white">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-l-lg p-2',
                viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-r-lg p-2',
                viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">
            {selectedIds.size} demande{selectedIds.size > 1 ? 's' : ''} selectionnee{selectedIds.size > 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleBatchApprove}
              disabled={batchActionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              Approuver
            </button>
            <button
              onClick={() => setShowBatchRejectModal(true)}
              disabled={batchActionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Rejeter
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Refunds Display */}
      {filteredRefunds.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border bg-white">
          <AlertCircle className="h-12 w-12 text-gray-300" />
          <p className="mt-2 text-gray-500">Aucune demande de remboursement trouvee</p>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
              }}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Reinitialiser les filtres
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredRefunds.map((refund) => (
            <RefundRequestCard
              key={refund.id}
              refund={refund}
              festivalId={festivalId}
              selected={selectedIds.has(refund.id)}
              onSelect={handleSelect}
              showCheckbox={refund.status === 'PENDING'}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      pendingFilteredRefunds.length > 0 &&
                      pendingFilteredRefunds.every((r) => selectedIds.has(r.id))
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Demandeur</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Montant</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Methode</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRefunds.map((refund) => (
                <RefundRequestRow
                  key={refund.id}
                  refund={refund}
                  festivalId={festivalId}
                  selected={selectedIds.has(refund.id)}
                  onSelect={handleSelect}
                  showCheckbox={refund.status === 'PENDING'}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch Reject Modal */}
      {showBatchRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold">Rejeter les demandes</h2>
            <p className="mt-1 text-sm text-gray-500">
              Veuillez indiquer le motif de rejet pour les {selectedIds.size} demande(s) selectionnee(s).
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motif du rejet..."
              rows={3}
              className="mt-4 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowBatchRejectModal(false)
                  setRejectReason('')
                }}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleBatchReject}
                disabled={!rejectReason || batchActionLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Rejeter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
