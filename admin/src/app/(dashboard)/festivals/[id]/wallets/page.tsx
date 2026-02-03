'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { WalletCard, WalletCardSkeleton } from '@/components/wallets/WalletCard'
import {
  walletsApi,
  type Wallet,
  type WalletStatus,
  type WalletStats,
} from '@/lib/api/wallets'
import {
  Search,
  Download,
  LayoutGrid,
  List,
  Wallet as WalletIcon,
  TrendingUp,
  Lock,
  Unlock,
  CreditCard,
  Undo2,
  X,
  Loader2,
  AlertCircle,
  Users,
  PiggyBank,
} from 'lucide-react'

type ViewMode = 'grid' | 'list'

// Mock data for development
const mockWallets: Wallet[] = [
  {
    id: '1',
    festivalId: '1',
    userId: 'u1',
    user: { id: 'u1', email: 'jean.dupont@email.com', name: 'Jean Dupont', phone: '+33612345678' },
    balance: 45.50,
    totalTopUps: 100,
    totalSpent: 54.50,
    status: 'ACTIVE',
    nfcTags: [{ id: 't1', walletId: '1', uid: 'NFC001', label: 'Bracelet principal', isActive: true, linkedAt: '2026-01-15T10:00:00Z' }],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-20T14:30:00Z',
  },
  {
    id: '2',
    festivalId: '1',
    userId: 'u2',
    user: { id: 'u2', email: 'marie.martin@email.com', name: 'Marie Martin' },
    balance: 0,
    totalTopUps: 50,
    totalSpent: 50,
    status: 'ACTIVE',
    nfcTags: [{ id: 't2', walletId: '2', uid: 'NFC002', isActive: true, linkedAt: '2026-01-16T11:00:00Z' }],
    createdAt: '2026-01-16T11:00:00Z',
    updatedAt: '2026-01-21T09:15:00Z',
  },
  {
    id: '3',
    festivalId: '1',
    userId: 'u3',
    user: { id: 'u3', email: 'pierre.bernard@email.com', name: 'Pierre Bernard', phone: '+33698765432' },
    balance: 120.00,
    totalTopUps: 150,
    totalSpent: 30,
    status: 'FROZEN',
    nfcTags: [
      { id: 't3', walletId: '3', uid: 'NFC003', label: 'Bracelet 1', isActive: true, linkedAt: '2026-01-14T08:00:00Z' },
      { id: 't4', walletId: '3', uid: 'NFC004', label: 'Bracelet 2', isActive: false, linkedAt: '2026-01-14T08:00:00Z' },
    ],
    createdAt: '2026-01-14T08:00:00Z',
    updatedAt: '2026-01-19T16:45:00Z',
  },
  {
    id: '4',
    festivalId: '1',
    userId: 'u4',
    user: { id: 'u4', email: 'sophie.laurent@email.com', name: 'Sophie Laurent' },
    balance: 78.25,
    totalTopUps: 200,
    totalSpent: 121.75,
    status: 'ACTIVE',
    nfcTags: [{ id: 't5', walletId: '4', uid: 'NFC005', isActive: true, linkedAt: '2026-01-17T12:00:00Z' }],
    createdAt: '2026-01-17T12:00:00Z',
    updatedAt: '2026-01-22T10:20:00Z',
  },
  {
    id: '5',
    festivalId: '1',
    userId: 'u5',
    user: { id: 'u5', email: 'lucas.moreau@email.com', name: 'Lucas Moreau' },
    balance: 15.00,
    totalTopUps: 75,
    totalSpent: 60,
    status: 'ACTIVE',
    nfcTags: [],
    createdAt: '2026-01-18T14:30:00Z',
    updatedAt: '2026-01-20T18:00:00Z',
  },
]

const mockStats: WalletStats = {
  totalWallets: 4523,
  activeWallets: 4100,
  frozenWallets: 23,
  totalBalance: 125680.50,
  totalTopUps: 285420.00,
  totalSpent: 159739.50,
  averageBalance: 27.78,
}

export default function WalletsListPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const festivalId = params.id as string

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedWallets, setSelectedWallets] = useState<string[]>([])

  // Modal states
  const [showFreezeModal, setShowFreezeModal] = useState(false)
  const [showUnfreezeModal, setShowUnfreezeModal] = useState(false)
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [targetWalletId, setTargetWalletId] = useState<string | null>(null)
  const [freezeReason, setFreezeReason] = useState('')
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpDescription, setTopUpDescription] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')

  // Mock data loading (replace with real API calls)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [stats, setStats] = useState<WalletStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        // const [walletsData, statsData] = await Promise.all([
        //   walletsApi.list(festivalId),
        //   walletsApi.getStats(festivalId),
        // ])
        // setWallets(walletsData.wallets)
        // setStats(statsData)
        // Using mock data for now
        setWallets(mockWallets)
        setStats(mockStats)
      } catch (error) {
        console.error('Failed to load wallets:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [festivalId])

  // Mutations
  const freezeMutation = useMutation({
    mutationFn: (data: { walletId: string; reason: string }) =>
      walletsApi.freeze(festivalId, data.walletId, { reason: data.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets', festivalId] })
      setShowFreezeModal(false)
      setFreezeReason('')
      setTargetWalletId(null)
      // Update local state for demo
      if (targetWalletId) {
        setWallets((prev) =>
          prev.map((w) => (w.id === targetWalletId ? { ...w, status: 'FROZEN' as WalletStatus } : w))
        )
      }
    },
  })

  const unfreezeMutation = useMutation({
    mutationFn: (walletId: string) => walletsApi.unfreeze(festivalId, walletId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets', festivalId] })
      setShowUnfreezeModal(false)
      setTargetWalletId(null)
      // Update local state for demo
      if (targetWalletId) {
        setWallets((prev) =>
          prev.map((w) => (w.id === targetWalletId ? { ...w, status: 'ACTIVE' as WalletStatus } : w))
        )
      }
    },
  })

  const topUpMutation = useMutation({
    mutationFn: (data: { walletId: string; amount: number; description?: string }) =>
      walletsApi.topUp(festivalId, data.walletId, { amount: data.amount, description: data.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets', festivalId] })
      setShowTopUpModal(false)
      setTopUpAmount('')
      setTopUpDescription('')
      setTargetWalletId(null)
    },
  })

  const refundMutation = useMutation({
    mutationFn: (data: { walletId: string; amount: number; reason: string }) =>
      walletsApi.refund(festivalId, data.walletId, { amount: data.amount, reason: data.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets', festivalId] })
      setShowRefundModal(false)
      setRefundAmount('')
      setRefundReason('')
      setTargetWalletId(null)
    },
  })

  const bulkActionMutation = useMutation({
    mutationFn: (data: { action: 'FREEZE' | 'UNFREEZE'; reason?: string }) =>
      walletsApi.bulkAction(festivalId, { walletIds: selectedWallets, action: data.action, reason: data.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets', festivalId] })
      setSelectedWallets([])
    },
  })

  // Filter wallets
  const filteredWallets = wallets.filter((wallet) => {
    const matchesSearch =
      searchQuery === '' ||
      wallet.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wallet.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || wallet.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Selection handlers
  const handleSelectWallet = (walletId: string, selected: boolean) => {
    setSelectedWallets((prev) =>
      selected ? [...prev, walletId] : prev.filter((id) => id !== walletId)
    )
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedWallets(selected ? filteredWallets.map((w) => w.id) : [])
  }

  // Action handlers
  const openFreezeModal = (walletId: string) => {
    setTargetWalletId(walletId)
    setShowFreezeModal(true)
  }

  const openUnfreezeModal = (walletId: string) => {
    setTargetWalletId(walletId)
    setShowUnfreezeModal(true)
  }

  const openTopUpModal = (walletId: string) => {
    setTargetWalletId(walletId)
    setShowTopUpModal(true)
  }

  const openRefundModal = (walletId: string) => {
    setTargetWalletId(walletId)
    setShowRefundModal(true)
  }

  const handleFreeze = () => {
    if (targetWalletId && freezeReason) {
      freezeMutation.mutate({ walletId: targetWalletId, reason: freezeReason })
    }
  }

  const handleUnfreeze = () => {
    if (targetWalletId) {
      unfreezeMutation.mutate(targetWalletId)
    }
  }

  const handleTopUp = () => {
    if (targetWalletId && topUpAmount) {
      topUpMutation.mutate({
        walletId: targetWalletId,
        amount: parseFloat(topUpAmount),
        description: topUpDescription || undefined,
      })
    }
  }

  const handleRefund = () => {
    if (targetWalletId && refundAmount && refundReason) {
      refundMutation.mutate({
        walletId: targetWalletId,
        amount: parseFloat(refundAmount),
        reason: refundReason,
      })
    }
  }

  const handleBulkFreeze = () => {
    if (selectedWallets.length > 0) {
      bulkActionMutation.mutate({ action: 'FREEZE', reason: 'Action groupee admin' })
    }
  }

  const handleBulkUnfreeze = () => {
    if (selectedWallets.length > 0) {
      bulkActionMutation.mutate({ action: 'UNFREEZE' })
    }
  }

  const handleExport = () => {
    const exportUrl = walletsApi.exportWallets(festivalId, {
      status: statusFilter !== 'all' ? (statusFilter as WalletStatus) : undefined,
      format: 'csv',
    })
    window.open(exportUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const targetWallet = targetWalletId ? wallets.find((w) => w.id === targetWalletId) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des portefeuilles</h1>
          <p className="text-gray-500">Gerez les portefeuilles cashless des festivaliers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Exporter
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total portefeuilles</p>
                <p className="text-2xl font-bold">{formatNumber(stats.totalWallets)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <PiggyBank className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Solde total</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalBalance)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Portefeuilles actifs</p>
                <p className="text-2xl font-bold">{formatNumber(stats.activeWallets)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <WalletIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Solde moyen</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.averageBalance)}</p>
              </div>
            </div>
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
              placeholder="Rechercher par nom ou email..."
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
            <option value="ACTIVE">Actif</option>
            <option value="FROZEN">Gele</option>
            <option value="CLOSED">Ferme</option>
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

      {/* Bulk Actions */}
      {selectedWallets.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <span className="font-medium text-blue-700">
            {selectedWallets.length} portefeuille(s) selectionne(s)
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkFreeze}
              disabled={bulkActionMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              Geler
            </button>
            <button
              onClick={handleBulkUnfreeze}
              disabled={bulkActionMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Unlock className="h-4 w-4" />
              Degeler
            </button>
            <button
              onClick={() => setSelectedWallets([])}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Wallets Display */}
      {filteredWallets.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border bg-white">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">Aucun portefeuille trouve</p>
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredWallets.map((wallet) => (
            <WalletCard
              key={wallet.id}
              wallet={wallet}
              festivalId={festivalId}
              selected={selectedWallets.includes(wallet.id)}
              onSelect={handleSelectWallet}
              onFreeze={openFreezeModal}
              onUnfreeze={openUnfreezeModal}
              onTopUp={openTopUpModal}
              onRefund={openRefundModal}
              viewMode="grid"
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
                    checked={selectedWallets.length === filteredWallets.length && filteredWallets.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Utilisateur</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Solde</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Recharges</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Depenses</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tags NFC</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWallets.map((wallet) => (
                <WalletCard
                  key={wallet.id}
                  wallet={wallet}
                  festivalId={festivalId}
                  selected={selectedWallets.includes(wallet.id)}
                  onSelect={handleSelectWallet}
                  onFreeze={openFreezeModal}
                  onUnfreeze={openUnfreezeModal}
                  onTopUp={openTopUpModal}
                  onRefund={openRefundModal}
                  viewMode="table"
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Freeze Modal */}
      {showFreezeModal && targetWallet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowFreezeModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Geler le portefeuille</h3>
              <button
                onClick={() => setShowFreezeModal(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-700">
                Vous allez geler le portefeuille de <strong>{targetWallet.user.name}</strong>.
                Le solde actuel est de <strong>{formatCurrency(targetWallet.balance)}</strong>.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Raison du gel *
                </label>
                <textarea
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Indiquez la raison du gel..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowFreezeModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleFreeze}
                  disabled={!freezeReason || freezeMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {freezeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Lock className="h-4 w-4" />
                  Geler
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Unfreeze Modal */}
      {showUnfreezeModal && targetWallet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowUnfreezeModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Degeler le portefeuille</h3>
              <button
                onClick={() => setShowUnfreezeModal(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-green-50 p-4">
              <p className="text-sm text-green-700">
                Vous allez degeler le portefeuille de <strong>{targetWallet.user.name}</strong>.
                Le solde actuel est de <strong>{formatCurrency(targetWallet.balance)}</strong>.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowUnfreezeModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleUnfreeze}
                disabled={unfreezeMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {unfreezeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Unlock className="h-4 w-4" />
                Degeler
              </button>
            </div>
          </div>
        </>
      )}

      {/* Top-up Modal */}
      {showTopUpModal && targetWallet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowTopUpModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recharger le portefeuille</h3>
              <button
                onClick={() => setShowTopUpModal(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-700">
                Portefeuille de <strong>{targetWallet.user.name}</strong>
              </p>
              <p className="text-sm text-gray-500">
                Solde actuel: <strong>{formatCurrency(targetWallet.balance)}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Montant a crediter *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="w-full rounded-lg border pl-8 pr-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="0.00"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">EUR</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description (optionnel)
                </label>
                <input
                  type="text"
                  value={topUpDescription}
                  onChange={(e) => setTopUpDescription(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Ex: Credit commercial, geste commercial..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowTopUpModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleTopUp}
                  disabled={!topUpAmount || parseFloat(topUpAmount) <= 0 || topUpMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {topUpMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <CreditCard className="h-4 w-4" />
                  Recharger
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Refund Modal */}
      {showRefundModal && targetWallet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowRefundModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Rembourser le portefeuille</h3>
              <button
                onClick={() => setShowRefundModal(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-amber-50 p-4">
              <p className="text-sm text-amber-700">
                Portefeuille de <strong>{targetWallet.user.name}</strong>
              </p>
              <p className="text-sm text-amber-600">
                Solde actuel: <strong>{formatCurrency(targetWallet.balance)}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Montant a rembourser *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={targetWallet.balance}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full rounded-lg border pl-8 pr-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="0.00"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">EUR</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">Maximum: {formatCurrency(targetWallet.balance)}</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Raison du remboursement *
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Indiquez la raison du remboursement..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowRefundModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRefund}
                  disabled={
                    !refundAmount ||
                    parseFloat(refundAmount) <= 0 ||
                    parseFloat(refundAmount) > targetWallet.balance ||
                    !refundReason ||
                    refundMutation.isPending
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {refundMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Undo2 className="h-4 w-4" />
                  Rembourser
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
