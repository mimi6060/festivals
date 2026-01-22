'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  Wallet,
  CreditCard,
  Building,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Banknote,
  Phone,
  Mail,
  Ticket,
} from 'lucide-react'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import {
  refundsApi,
  type RefundRequest,
  type RefundHistoryEntry,
  type RefundStatus,
} from '@/lib/api/refunds'

// Mock data for development
const mockRefund: RefundRequest = {
  id: '1',
  festivalId: '1',
  userId: 'user-1',
  walletId: 'wallet-1',
  amount: 45.50,
  currency: 'EUR',
  status: 'PENDING',
  method: 'BANK_TRANSFER',
  reason: 'Je ne peux plus assister au festival pour raisons personnelles. J\'ai eu un empechement de derniere minute et je souhaiterais recuperer le solde restant sur mon portefeuille.',
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
}

const mockHistory: RefundHistoryEntry[] = [
  {
    id: '1',
    refundId: '1',
    action: 'CREATED',
    performedBy: 'user-1',
    performedByEmail: 'jean.dupont@email.com',
    note: null,
    createdAt: '2026-01-20T14:30:00Z',
  },
]

const statusConfig: Record<RefundStatus, { bg: string; text: string; label: string; icon: typeof CheckCircle }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En attente', icon: Clock },
  APPROVED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Approuve', icon: CheckCircle },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejete', icon: XCircle },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Complete', icon: CheckCircle },
  FAILED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Echoue', icon: AlertCircle },
}

const actionLabels: Record<string, { label: string; color: string }> = {
  CREATED: { label: 'Demande creee', color: 'text-gray-600' },
  APPROVED: { label: 'Demande approuvee', color: 'text-blue-600' },
  REJECTED: { label: 'Demande rejetee', color: 'text-red-600' },
  PROCESSED: { label: 'Paiement effectue', color: 'text-green-600' },
  FAILED: { label: 'Paiement echoue', color: 'text-red-600' },
}

const methodLabels: Record<string, string> = {
  BANK_TRANSFER: 'Virement bancaire',
  ORIGINAL_PAYMENT: 'Moyen de paiement original',
  WALLET_CREDIT: 'Credit portefeuille',
}

export default function RefundDetailPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const refundId = params.refundId as string

  const [refund, setRefund] = useState<RefundRequest | null>(null)
  const [history, setHistory] = useState<RefundHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Modal states
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processNote, setProcessNote] = useState('')
  const [transactionRef, setTransactionRef] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        // const [refundData, historyData] = await Promise.all([
        //   refundsApi.getRefund(festivalId, refundId),
        //   refundsApi.getRefundHistory(festivalId, refundId),
        // ])
        // setRefund(refundData)
        // setHistory(historyData)
        // Using mock data for now
        setRefund(mockRefund)
        setHistory(mockHistory)
      } catch (error) {
        console.error('Failed to load refund:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [festivalId, refundId])

  const handleApprove = async () => {
    if (!refund) return
    setActionLoading(true)
    try {
      // await refundsApi.approveRefund(festivalId, refundId)
      // Reload data
      // Using mock: update local state
      setRefund({ ...refund, status: 'APPROVED', approvedAt: new Date().toISOString() })
      setHistory([
        ...history,
        {
          id: String(history.length + 1),
          refundId,
          action: 'APPROVED',
          performedBy: 'admin',
          performedByEmail: 'admin@festival.com',
          note: null,
          createdAt: new Date().toISOString(),
        },
      ])
    } catch (error) {
      console.error('Failed to approve refund:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!refund || !rejectReason) return
    setActionLoading(true)
    try {
      // await refundsApi.rejectRefund(festivalId, refundId, { reason: rejectReason })
      // Using mock: update local state
      setRefund({
        ...refund,
        status: 'REJECTED',
        rejectedAt: new Date().toISOString(),
        rejectionReason: rejectReason,
      })
      setHistory([
        ...history,
        {
          id: String(history.length + 1),
          refundId,
          action: 'REJECTED',
          performedBy: 'admin',
          performedByEmail: 'admin@festival.com',
          note: rejectReason,
          createdAt: new Date().toISOString(),
        },
      ])
      setShowRejectModal(false)
      setRejectReason('')
    } catch (error) {
      console.error('Failed to reject refund:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleProcess = async () => {
    if (!refund) return
    setActionLoading(true)
    try {
      // await refundsApi.processRefund(festivalId, refundId, {
      //   transactionReference: transactionRef,
      //   note: processNote,
      // })
      // Using mock: update local state
      setRefund({
        ...refund,
        status: 'COMPLETED',
        processedAt: new Date().toISOString(),
      })
      setHistory([
        ...history,
        {
          id: String(history.length + 1),
          refundId,
          action: 'PROCESSED',
          performedBy: 'admin',
          performedByEmail: 'admin@festival.com',
          note: processNote || null,
          metadata: transactionRef ? { transactionReference: transactionRef } : undefined,
          createdAt: new Date().toISOString(),
        },
      ])
      setShowProcessModal(false)
      setProcessNote('')
      setTransactionRef('')
    } catch (error) {
      console.error('Failed to process refund:', error)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!refund) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <AlertCircle className="h-12 w-12 text-gray-400" />
        <p className="mt-2 text-gray-500">Demande de remboursement introuvable</p>
        <Link
          href={`/festivals/${festivalId}/refunds`}
          className="mt-4 text-primary hover:underline"
        >
          Retour a la liste
        </Link>
      </div>
    )
  }

  const statusStyle = statusConfig[refund.status]
  const StatusIcon = statusStyle.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/refunds`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Demande de remboursement
              </h1>
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
            <p className="text-gray-500">
              {refund.user.firstName} {refund.user.lastName} - {formatCurrency(refund.amount, refund.currency)}
            </p>
          </div>
        </div>

        {/* Action buttons based on status */}
        <div className="flex items-center gap-2">
          {refund.status === 'PENDING' && (
            <>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Rejeter
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Approuver
              </button>
            </>
          )}
          {refund.status === 'APPROVED' && (
            <button
              onClick={() => setShowProcessModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Traiter le paiement
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Refund Details */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Banknote className="h-5 w-5 text-gray-400" />
              Details du remboursement
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-gray-500">Montant</dt>
                <dd className="mt-1 text-xl font-bold text-gray-900">
                  {formatCurrency(refund.amount, refund.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Methode</dt>
                <dd className="mt-1 font-medium text-gray-900">
                  {methodLabels[refund.method] || refund.method}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-gray-500">Motif</dt>
                <dd className="mt-1 text-gray-900">{refund.reason}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Date de demande</dt>
                <dd className="mt-1 text-gray-900">{formatDateTime(refund.createdAt)}</dd>
              </div>
              {refund.approvedAt && (
                <div>
                  <dt className="text-sm text-gray-500">Approuve le</dt>
                  <dd className="mt-1 text-gray-900">{formatDateTime(refund.approvedAt)}</dd>
                </div>
              )}
              {refund.processedAt && (
                <div>
                  <dt className="text-sm text-gray-500">Traite le</dt>
                  <dd className="mt-1 text-gray-900">{formatDateTime(refund.processedAt)}</dd>
                </div>
              )}
              {refund.rejectedAt && (
                <>
                  <div>
                    <dt className="text-sm text-gray-500">Rejete le</dt>
                    <dd className="mt-1 text-gray-900">{formatDateTime(refund.rejectedAt)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-gray-500">Motif de rejet</dt>
                    <dd className="mt-1 text-red-600">{refund.rejectionReason}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {/* Bank Details */}
          {refund.bankDetails && (
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Building className="h-5 w-5 text-gray-400" />
                Coordonnees bancaires
              </h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-gray-500">Titulaire du compte</dt>
                  <dd className="mt-1 font-medium text-gray-900">
                    {refund.bankDetails.accountHolder}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Banque</dt>
                  <dd className="mt-1 text-gray-900">{refund.bankDetails.bankName}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-gray-500">IBAN</dt>
                  <dd className="mt-1">
                    <code className="rounded bg-gray-100 px-2 py-1 font-mono text-sm">
                      {refund.bankDetails.iban}
                    </code>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">BIC</dt>
                  <dd className="mt-1">
                    <code className="rounded bg-gray-100 px-2 py-1 font-mono text-sm">
                      {refund.bankDetails.bic}
                    </code>
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* History Log */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-gray-400" />
              Historique
            </h2>
            <div className="space-y-4">
              {history.map((entry, index) => {
                const actionConfig = actionLabels[entry.action] || {
                  label: entry.action,
                  color: 'text-gray-600',
                }
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'relative pl-6',
                      index !== history.length - 1 && 'pb-4'
                    )}
                  >
                    {/* Timeline line */}
                    {index !== history.length - 1 && (
                      <div className="absolute left-[9px] top-5 h-full w-0.5 bg-gray-200" />
                    )}
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-gray-200 bg-white" />

                    <div>
                      <p className={cn('font-medium', actionConfig.color)}>
                        {actionConfig.label}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDateTime(entry.createdAt)} par {entry.performedByEmail}
                      </p>
                      {entry.note && (
                        <p className="mt-1 text-sm text-gray-600">{entry.note}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User Info */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <User className="h-5 w-5 text-gray-400" />
              Informations utilisateur
            </h2>
            <div className="space-y-4">
              <div>
                <p className="font-medium text-gray-900">
                  {refund.user.firstName} {refund.user.lastName}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-4 w-4 text-gray-400" />
                <a
                  href={`mailto:${refund.user.email}`}
                  className="hover:text-primary hover:underline"
                >
                  {refund.user.email}
                </a>
              </div>
              {refund.user.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <a
                    href={`tel:${refund.user.phone}`}
                    className="hover:text-primary hover:underline"
                  >
                    {refund.user.phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Wallet Info */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Wallet className="h-5 w-5 text-gray-400" />
              Portefeuille
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-gray-400" />
                <code className="rounded bg-gray-100 px-2 py-0.5 text-sm">
                  {refund.wallet.ticketCode}
                </code>
              </div>
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
                <div>
                  <p className="text-xs text-gray-500">Solde actuel</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(refund.wallet.balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total recharge</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(refund.wallet.totalTopUps)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Total depense</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(refund.wallet.totalSpent)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold">Rejeter la demande</h2>
            <p className="mt-1 text-sm text-gray-500">
              Veuillez indiquer le motif de rejet. Cette information sera visible par l'utilisateur.
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
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason || actionLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Rejeter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Process Payment Modal */}
      {showProcessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold">Traiter le paiement</h2>
            <p className="mt-1 text-sm text-gray-500">
              Confirmez que le virement de {formatCurrency(refund.amount, refund.currency)} a ete effectue.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Reference de transaction (optionnel)
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="Ex: VIR-2026-01-001"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Note (optionnel)
                </label>
                <textarea
                  value={processNote}
                  onChange={(e) => setProcessNote(e.target.value)}
                  placeholder="Note interne..."
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowProcessModal(false)
                  setProcessNote('')
                  setTransactionRef('')
                }}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleProcess}
                disabled={actionLoading}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                Confirmer le paiement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
