'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletCard, WalletCardSkeleton } from '@/components/account/WalletCard'
import {
  accountApi,
  UserWallet,
  WalletTransaction,
  RequestRefundInput,
} from '@/lib/api/account'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Nfc,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react'

const transactionTypeConfig: Record<WalletTransaction['type'], {
  label: string
  icon: typeof ArrowUpRight
  color: string
}> = {
  TOP_UP: { label: 'Rechargement', icon: ArrowUpRight, color: 'text-green-600' },
  TOP_UP_BONUS: { label: 'Bonus', icon: ArrowUpRight, color: 'text-green-600' },
  PAYMENT: { label: 'Paiement', icon: ArrowDownRight, color: 'text-red-600' },
  REFUND: { label: 'Remboursement', icon: ArrowUpRight, color: 'text-green-600' },
  TRANSFER_IN: { label: 'Transfert recu', icon: ArrowUpRight, color: 'text-green-600' },
  TRANSFER_OUT: { label: 'Transfert envoye', icon: ArrowDownRight, color: 'text-red-600' },
  INITIAL_BALANCE: { label: 'Solde initial', icon: ArrowUpRight, color: 'text-green-600' },
}

export default function WalletPage() {
  const searchParams = useSearchParams()
  const selectedWalletId = searchParams.get('id')

  const [wallets, setWallets] = useState<UserWallet[]>([])
  const [selectedWallet, setSelectedWallet] = useState<UserWallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Refund modal state
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [submittingRefund, setSubmittingRefund] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)

  useEffect(() => {
    loadWallets()
  }, [])

  useEffect(() => {
    if (selectedWalletId && wallets.length > 0) {
      const wallet = wallets.find((w) => w.id === selectedWalletId)
      if (wallet) {
        setSelectedWallet(wallet)
        loadTransactions(wallet.id)
      }
    } else if (wallets.length > 0 && !selectedWallet) {
      // Auto-select first wallet
      setSelectedWallet(wallets[0])
      loadTransactions(wallets[0].id)
    }
  }, [selectedWalletId, wallets])

  const loadWallets = async () => {
    try {
      setLoading(true)
      const data = await accountApi.getMyWallet()
      setWallets(data)
    } catch (err) {
      console.error('Failed to load wallets:', err)
      setError('Impossible de charger vos portefeuilles.')
    } finally {
      setLoading(false)
    }
  }

  const loadTransactions = async (walletId: string, pageNum = 1) => {
    try {
      setLoadingTransactions(true)
      const response = await accountApi.getWalletTransactions(walletId, {
        page: pageNum,
        limit: 20,
      })
      setTransactions(response.data)
      setTotalPages(response.pagination.totalPages)
      setPage(pageNum)
    } catch (err) {
      console.error('Failed to load transactions:', err)
    } finally {
      setLoadingTransactions(false)
    }
  }

  const handleSelectWallet = (wallet: UserWallet) => {
    setSelectedWallet(wallet)
    loadTransactions(wallet.id)
    // Update URL without navigation
    window.history.replaceState(null, '', `/account/wallet?id=${wallet.id}`)
  }

  const handleRequestRefund = (walletId: string) => {
    const wallet = wallets.find((w) => w.id === walletId)
    if (wallet) {
      setRefundAmount(wallet.balance.toString())
      setRefundModalOpen(true)
      setRefundError(null)
    }
  }

  const handleSubmitRefund = async () => {
    if (!selectedWallet || !refundAmount || !bankAccount || !bankName || !accountHolder) return

    setSubmittingRefund(true)
    setRefundError(null)

    try {
      const data: RequestRefundInput = {
        walletId: selectedWallet.id,
        amount: parseFloat(refundAmount),
        bankAccount,
        bankName,
        accountHolderName: accountHolder,
      }
      await accountApi.requestRefund(data)
      setRefundModalOpen(false)
      loadWallets()
    } catch (err: any) {
      console.error('Failed to request refund:', err)
      setRefundError(err.message || 'La demande de remboursement a echoue.')
    } finally {
      setSubmittingRefund(false)
    }
  }

  const handleUnlinkWallet = async (walletId: string) => {
    if (!confirm('Etes-vous sur de vouloir delier ce portefeuille de votre bracelet NFC ?')) return

    try {
      await accountApi.unlinkWallet(walletId)
      loadWallets()
    } catch (err) {
      console.error('Failed to unlink wallet:', err)
    }
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-red-700">{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            setError(null)
            loadWallets()
          }}
        >
          Reessayer
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon portefeuille</h1>
        <p className="text-gray-600 mt-1">
          Gerez votre solde, consultez vos transactions et demandez un remboursement
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid gap-6 lg:grid-cols-3">
          <WalletCardSkeleton />
          <div className="lg:col-span-2">
            <div className="h-96 rounded-lg bg-gray-200 animate-pulse" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && wallets.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <Wallet className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun portefeuille
            </h3>
            <p className="text-gray-500 mb-4">
              Vous n'avez pas encore de portefeuille festival
            </p>
            <p className="text-sm text-gray-400">
              Un portefeuille sera automatiquement cree lors de votre prochain achat de billet
            </p>
          </CardBody>
        </Card>
      )}

      {/* Main content */}
      {!loading && wallets.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Wallet selector / details */}
          <div className="space-y-4">
            {wallets.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Selectionnez un portefeuille</p>
                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => handleSelectWallet(wallet)}
                    className={cn(
                      'w-full text-left rounded-lg border p-4 transition-all',
                      selectedWallet?.id === wallet.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{wallet.festivalName}</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(wallet.balance, wallet.currency)}
                        </p>
                      </div>
                      {wallet.nfcLinked && (
                        <Nfc className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedWallet && (
              <WalletCard
                wallet={selectedWallet}
                onRequestRefund={handleRequestRefund}
                onUnlink={handleUnlinkWallet}
                showActions={wallets.length === 1}
              />
            )}
          </div>

          {/* Transactions */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Historique des transactions
                </CardTitle>
              </CardHeader>
              <CardBody>
                {loadingTransactions ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center justify-between py-3 border-b">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-200" />
                          <div className="space-y-1">
                            <div className="h-4 w-24 rounded bg-gray-200" />
                            <div className="h-3 w-32 rounded bg-gray-200" />
                          </div>
                        </div>
                        <div className="h-5 w-16 rounded bg-gray-200" />
                      </div>
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Aucune transaction</p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y">
                      {transactions.map((tx) => {
                        const config = transactionTypeConfig[tx.type]
                        const TxIcon = config.icon
                        const isCredit = tx.amount > 0
                        return (
                          <div key={tx.id} className="flex items-center justify-between py-4 first:pt-0">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-full',
                                isCredit ? 'bg-green-100' : 'bg-red-100'
                              )}>
                                <TxIcon className={cn('h-5 w-5', config.color)} />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{config.label}</p>
                                <p className="text-sm text-gray-500">
                                  {tx.description || tx.standName || formatDateTime(tx.createdAt)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                'font-semibold',
                                isCredit ? 'text-green-600' : 'text-red-600'
                              )}>
                                {isCredit ? '+' : ''}{formatCurrency(tx.amount, selectedWallet?.currency)}
                              </p>
                              <p className="text-xs text-gray-400">
                                Solde: {formatCurrency(tx.balanceAfter, selectedWallet?.currency)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t mt-4 pt-4">
                        <p className="text-sm text-gray-500">Page {page} sur {totalPages}</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedWallet && loadTransactions(selectedWallet.id, page - 1)}
                            disabled={page === 1}
                            leftIcon={<ChevronLeft className="h-4 w-4" />}
                          >
                            Precedent
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedWallet && loadTransactions(selectedWallet.id, page + 1)}
                            disabled={page === totalPages}
                            rightIcon={<ChevronRight className="h-4 w-4" />}
                          >
                            Suivant
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardBody>
            </Card>

            {/* Actions for multiple wallets */}
            {wallets.length > 1 && selectedWallet && selectedWallet.status === 'ACTIVE' && (
              <div className="flex gap-3 mt-4">
                {selectedWallet.balance > 0 && (
                  <Button
                    variant="outline"
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                    onClick={() => handleRequestRefund(selectedWallet.id)}
                  >
                    Demander un remboursement
                  </Button>
                )}
                {selectedWallet.nfcLinked && (
                  <Button
                    variant="ghost"
                    leftIcon={<Unlink className="h-4 w-4" />}
                    onClick={() => handleUnlinkWallet(selectedWallet.id)}
                  >
                    Delier NFC
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refund modal */}
      {refundModalOpen && selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Demander un remboursement</h3>
              <button
                onClick={() => setRefundModalOpen(false)}
                className="rounded-lg p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Solde disponible</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(selectedWallet.balance, selectedWallet.currency)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant a rembourser
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    max={selectedWallet.balance}
                    min={0}
                    step="0.01"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-12 focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">EUR</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IBAN
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="FR76 1234 5678 9012 3456 7890 123"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de la banque
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Nom de votre banque"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titulaire du compte
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Prenom Nom"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {refundError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {refundError}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <p className="font-medium mb-1">Information</p>
                <p>Le remboursement sera traite sous 5 a 10 jours ouvrables apres approbation.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRefundModalOpen(false)}
                disabled={submittingRefund}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleSubmitRefund}
                loading={submittingRefund}
                disabled={!refundAmount || !bankAccount || !bankName || !accountHolder || parseFloat(refundAmount) <= 0 || parseFloat(refundAmount) > selectedWallet.balance}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Demander
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
