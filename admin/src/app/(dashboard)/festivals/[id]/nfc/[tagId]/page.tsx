'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CreditCard,
  Ban,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  User,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  MoreVertical,
  ShieldOff,
  Shield,
  ArrowRightLeft,
} from 'lucide-react'
import { cn, formatCurrency, formatNumber, formatDateTime, formatDate } from '@/lib/utils'
import {
  nfcApi,
  type NFCTag,
  type NFCTagStatus,
  type NFCTransaction,
} from '@/lib/api/nfc'

// Mock data for development
const mockTag: NFCTag = {
  id: '1',
  festivalId: '1',
  uid: '04:A2:B3:C4:D5:E6:F7',
  status: 'ACTIVE',
  walletId: 'wallet-123',
  walletBalance: 45.50,
  holderName: 'Jean Dupont',
  holderEmail: 'jean.dupont@email.com',
  ticketId: 'ticket-1',
  ticketTypeName: 'Pass 3 Jours',
  activatedAt: '2026-06-15T10:30:00Z',
  activatedBy: 'staff@festival.com',
  blockedAt: null,
  blockedBy: null,
  blockedReason: null,
  lastUsedAt: '2026-06-15T14:22:00Z',
  transactionCount: 12,
  createdAt: '2026-01-10T08:00:00Z',
  updatedAt: '2026-06-15T14:22:00Z',
}

const mockTransactions: NFCTransaction[] = [
  {
    id: '1',
    tagId: '1',
    walletId: 'wallet-123',
    type: 'TOPUP',
    amount: 50.00,
    balanceBefore: 20.00,
    balanceAfter: 70.00,
    standId: null,
    standName: null,
    description: 'Rechargement par CB',
    createdAt: '2026-06-15T10:35:00Z',
  },
  {
    id: '2',
    tagId: '1',
    walletId: 'wallet-123',
    type: 'PAYMENT',
    amount: -8.50,
    balanceBefore: 70.00,
    balanceAfter: 61.50,
    standId: 'stand-1',
    standName: 'Bar Central',
    description: '2x Biere',
    createdAt: '2026-06-15T11:15:00Z',
  },
  {
    id: '3',
    tagId: '1',
    walletId: 'wallet-123',
    type: 'PAYMENT',
    amount: -12.00,
    balanceBefore: 61.50,
    balanceAfter: 49.50,
    standId: 'stand-2',
    standName: 'Food Truck Pizza',
    description: 'Pizza Margherita',
    createdAt: '2026-06-15T12:30:00Z',
  },
  {
    id: '4',
    tagId: '1',
    walletId: 'wallet-123',
    type: 'PAYMENT',
    amount: -4.00,
    balanceBefore: 49.50,
    balanceAfter: 45.50,
    standId: 'stand-1',
    standName: 'Bar Central',
    description: 'Eau',
    createdAt: '2026-06-15T14:22:00Z',
  },
]

const statusConfig: Record<NFCTagStatus, { label: string; bg: string; text: string; icon: typeof CheckCircle }> = {
  UNASSIGNED: { label: 'Non assigne', bg: 'bg-gray-100', text: 'text-gray-700', icon: CreditCard },
  ACTIVE: { label: 'Actif', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  BLOCKED: { label: 'Bloque', bg: 'bg-red-100', text: 'text-red-700', icon: Ban },
  LOST: { label: 'Perdu', bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle },
}

const transactionTypeConfig: Record<NFCTransaction['type'], { label: string; icon: typeof ArrowUpRight; color: string }> = {
  TOPUP: { label: 'Rechargement', icon: ArrowUpRight, color: 'text-green-600' },
  PAYMENT: { label: 'Paiement', icon: ArrowDownRight, color: 'text-red-600' },
  REFUND: { label: 'Remboursement', icon: RefreshCw, color: 'text-blue-600' },
  TRANSFER_IN: { label: 'Transfert recu', icon: ArrowUpRight, color: 'text-green-600' },
  TRANSFER_OUT: { label: 'Transfert envoye', icon: ArrowDownRight, color: 'text-orange-600' },
}

export default function NFCTagDetailPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const tagId = params.tagId as string

  const [tag, setTag] = useState<NFCTag | null>(null)
  const [transactions, setTransactions] = useState<NFCTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferWalletId, setTransferWalletId] = useState('')
  const [transferBalance, setTransferBalance] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        // const tagData = await nfcApi.getTag(festivalId, tagId)
        // setTag(tagData)
        // Using mock data for now
        setTag(mockTag)
      } catch (error) {
        console.error('Failed to load NFC tag:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [festivalId, tagId])

  useEffect(() => {
    if (tag) {
      loadTransactions()
    }
  }, [tag])

  const loadTransactions = async () => {
    setTransactionsLoading(true)
    try {
      // const response = await nfcApi.getTransactions(festivalId, tagId)
      // setTransactions(response.data)
      // Using mock data for now
      setTransactions(mockTransactions)
    } catch (error) {
      console.error('Failed to load transactions:', error)
    } finally {
      setTransactionsLoading(false)
    }
  }

  const handleBlock = async () => {
    if (!tag) return
    const reason = prompt('Raison du blocage:')
    if (!reason) return

    setActionLoading(true)
    try {
      await nfcApi.blockTag(festivalId, tagId, { reason })
      setTag({ ...tag, status: 'BLOCKED', blockedReason: reason, blockedAt: new Date().toISOString() })
    } catch (error) {
      console.error('Failed to block tag:', error)
    } finally {
      setActionLoading(false)
      setMenuOpen(false)
    }
  }

  const handleUnblock = async () => {
    if (!tag) return
    if (!confirm('Debloquer ce tag NFC ?')) return

    setActionLoading(true)
    try {
      await nfcApi.unblockTag(festivalId, tagId)
      setTag({ ...tag, status: 'ACTIVE', blockedReason: null, blockedAt: null })
    } catch (error) {
      console.error('Failed to unblock tag:', error)
    } finally {
      setActionLoading(false)
      setMenuOpen(false)
    }
  }

  const handleMarkAsLost = async () => {
    if (!tag) return
    if (!confirm('Marquer ce tag comme perdu ? Le solde sera preserve.')) return

    setActionLoading(true)
    try {
      await nfcApi.markAsLost(festivalId, tagId)
      setTag({ ...tag, status: 'LOST', blockedReason: 'Marque comme perdu' })
    } catch (error) {
      console.error('Failed to mark as lost:', error)
    } finally {
      setActionLoading(false)
      setMenuOpen(false)
    }
  }

  const handleTransfer = async () => {
    if (!tag || !transferWalletId) return

    setActionLoading(true)
    try {
      await nfcApi.transferTag(festivalId, tagId, {
        newWalletId: transferWalletId,
        transferBalance,
      })
      // Refresh tag data
      setTag({ ...tag, walletId: transferWalletId })
      setShowTransferModal(false)
      setTransferWalletId('')
    } catch (error) {
      console.error('Failed to transfer tag:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!tag) return
    if (!confirm('Desactiver ce tag NFC ? Le portefeuille sera dissocie.')) return

    setActionLoading(true)
    try {
      await nfcApi.deactivateTag(festivalId, tagId)
      setTag({ ...tag, status: 'UNASSIGNED', walletId: null, walletBalance: null })
    } catch (error) {
      console.error('Failed to deactivate tag:', error)
    } finally {
      setActionLoading(false)
      setMenuOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!tag) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <AlertCircle className="h-12 w-12 text-gray-400" />
        <p className="mt-2 text-gray-500">Tag NFC introuvable</p>
        <Link
          href={`/festivals/${festivalId}/nfc`}
          className="mt-4 text-primary hover:underline"
        >
          Retour a la liste
        </Link>
      </div>
    )
  }

  const statusStyle = statusConfig[tag.status]
  const StatusIcon = statusStyle.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/nfc`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{tag.uid}</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  statusStyle.bg,
                  statusStyle.text
                )}
              >
                <StatusIcon className="h-3 w-3" />
                {statusStyle.label}
              </span>
            </div>
            <p className="text-gray-500">Tag NFC</p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg border bg-white p-2 hover:bg-gray-50"
          >
            <MoreVertical className="h-5 w-5 text-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border bg-white py-1 shadow-lg">
              {tag.status === 'ACTIVE' && (
                <>
                  <button
                    onClick={() => {
                      setShowTransferModal(true)
                      setMenuOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Transferer vers un autre wallet
                  </button>
                  <button
                    onClick={handleBlock}
                    disabled={actionLoading}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Shield className="h-4 w-4" />
                    Bloquer
                  </button>
                  <button
                    onClick={handleMarkAsLost}
                    disabled={actionLoading}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Marquer comme perdu
                  </button>
                  <button
                    onClick={handleDeactivate}
                    disabled={actionLoading}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    Desactiver
                  </button>
                </>
              )}
              {tag.status === 'BLOCKED' && (
                <button
                  onClick={handleUnblock}
                  disabled={actionLoading}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50 disabled:opacity-50"
                >
                  <ShieldOff className="h-4 w-4" />
                  Debloquer
                </button>
              )}
              {tag.status === 'LOST' && (
                <button
                  onClick={() => {
                    setShowTransferModal(true)
                    setMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Transferer le solde vers un nouveau tag
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Blocked Alert */}
      {tag.status === 'BLOCKED' && tag.blockedReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <Ban className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Tag bloque</p>
              <p className="mt-1 text-sm text-red-700">Raison: {tag.blockedReason}</p>
              {tag.blockedAt && tag.blockedBy && (
                <p className="mt-1 text-sm text-red-600">
                  Bloque le {formatDateTime(tag.blockedAt)} par {tag.blockedBy}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lost Alert */}
      {tag.status === 'LOST' && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-800">Tag marque comme perdu</p>
              <p className="mt-1 text-sm text-orange-700">
                Le solde de {formatCurrency(tag.walletBalance || 0)} est preserve et peut etre transfere vers un nouveau tag.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Wallet Info */}
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Wallet className="h-5 w-5" />
            Portefeuille
          </div>
          {tag.walletId ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Solde actuel</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(tag.walletBalance || 0)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">ID Wallet</p>
                  <p className="font-mono text-sm">{tag.walletId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Transactions</p>
                  <p className="font-medium">{formatNumber(tag.transactionCount)}</p>
                </div>
              </div>
              {tag.lastUsedAt && (
                <div>
                  <p className="text-sm text-gray-500">Derniere utilisation</p>
                  <p className="text-sm">{formatDateTime(tag.lastUsedAt)}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center py-8 text-gray-400">
              <Wallet className="h-12 w-12" />
              <p className="mt-2">Aucun portefeuille associe</p>
            </div>
          )}
        </div>

        {/* Holder Info */}
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <User className="h-5 w-5" />
            Titulaire
          </div>
          {tag.holderName ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Nom</p>
                <p className="font-medium">{tag.holderName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-sm">{tag.holderEmail}</p>
              </div>
              {tag.ticketTypeName && (
                <div>
                  <p className="text-sm text-gray-500">Type de billet</p>
                  <p className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary">
                    {tag.ticketTypeName}
                  </p>
                </div>
              )}
              {tag.activatedAt && (
                <div>
                  <p className="text-sm text-gray-500">Active le</p>
                  <p className="text-sm">
                    {formatDateTime(tag.activatedAt)}
                    {tag.activatedBy && <span className="text-gray-400"> par {tag.activatedBy}</span>}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center py-8 text-gray-400">
              <User className="h-12 w-12" />
              <p className="mt-2">Aucun titulaire</p>
            </div>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-lg border bg-white">
        <div className="border-b p-6">
          <h2 className="text-lg font-semibold">Historique des transactions</h2>
        </div>
        {transactionsLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-gray-400">
            <Wallet className="h-12 w-12" />
            <p className="mt-2">Aucune transaction</p>
          </div>
        ) : (
          <div className="divide-y">
            {transactions.map((tx) => {
              const typeConfig = transactionTypeConfig[tx.type]
              const TypeIcon = typeConfig.icon
              return (
                <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className={cn('rounded-full p-2', tx.amount >= 0 ? 'bg-green-100' : 'bg-red-100')}>
                      <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{typeConfig.label}</p>
                      {tx.standName && (
                        <p className="text-sm text-gray-500">{tx.standName}</p>
                      )}
                      {tx.description && (
                        <p className="text-sm text-gray-400">{tx.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn('font-semibold', tx.amount >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-sm text-gray-400">
                      Solde: {formatCurrency(tx.balanceAfter)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(tx.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="text-lg font-semibold">Transferer vers un nouveau wallet</h3>
            <p className="mt-2 text-sm text-gray-500">
              Entrez l ID du nouveau wallet vers lequel transferer ce tag.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  ID du nouveau wallet
                </label>
                <input
                  type="text"
                  value={transferWalletId}
                  onChange={(e) => setTransferWalletId(e.target.value)}
                  placeholder="wallet-xxx"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={transferBalance}
                  onChange={(e) => setTransferBalance(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  Transferer le solde ({formatCurrency(tag.walletBalance || 0)})
                </span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowTransferModal(false)
                  setTransferWalletId('')
                }}
                className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleTransfer}
                disabled={!transferWalletId || actionLoading}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {actionLoading ? 'Transfert...' : 'Transferer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
