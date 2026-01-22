'use client'

import { useMemo } from 'react'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import {
  ShoppingCart,
  CreditCard,
  ArrowDownLeft,
  User,
  Store,
  Clock,
} from 'lucide-react'
import type { Transaction } from '@/hooks/useWebSocket'

interface LiveTransactionsProps {
  transactions: Transaction[]
  loading?: boolean
  maxItems?: number
  className?: string
  title?: string
}

function TransactionIcon({ type }: { type: Transaction['type'] }) {
  switch (type) {
    case 'purchase':
      return <ShoppingCart className="h-4 w-4" />
    case 'topup':
      return <CreditCard className="h-4 w-4" />
    case 'refund':
      return <ArrowDownLeft className="h-4 w-4" />
    default:
      return <CreditCard className="h-4 w-4" />
  }
}

function TransactionBadge({ type }: { type: Transaction['type'] }) {
  const config = {
    purchase: {
      label: 'Achat',
      className: 'bg-blue-100 text-blue-700',
    },
    topup: {
      label: 'Recharge',
      className: 'bg-green-100 text-green-700',
    },
    refund: {
      label: 'Remboursement',
      className: 'bg-orange-100 text-orange-700',
    },
  }

  const { label, className } = config[type] || config.purchase

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
    >
      <TransactionIcon type={type} />
      {label}
    </span>
  )
}

function TransactionItem({
  transaction,
  isNew,
}: {
  transaction: Transaction
  isNew: boolean
}) {
  const formattedTime = useMemo(() => {
    const date = new Date(transaction.timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'A l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    return formatDateTime(transaction.timestamp)
  }, [transaction.timestamp])

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg p-3 transition-all',
        isNew && 'animate-slide-in bg-primary/5',
        'hover:bg-gray-50'
      )}
    >
      {/* Amount */}
      <div
        className={cn(
          'flex h-10 w-16 items-center justify-center rounded-md text-sm font-bold',
          transaction.type === 'refund'
            ? 'bg-orange-100 text-orange-700'
            : 'bg-green-100 text-green-700'
        )}
      >
        {transaction.type === 'refund' ? '-' : '+'}
        {formatCurrency(Math.abs(transaction.amount))}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <TransactionBadge type={transaction.type} />
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formattedTime}
          </span>
        </div>

        {/* Product/Stand Info */}
        {transaction.product_name && (
          <p className="mt-1 truncate text-sm font-medium text-gray-900">
            {transaction.product_name}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {transaction.stand_name && (
            <span className="flex items-center gap-1">
              <Store className="h-3 w-3" />
              {transaction.stand_name}
            </span>
          )}
          {transaction.staff_name && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {transaction.staff_name}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3">
          <div className="h-10 w-16 animate-pulse rounded-md bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function LiveTransactions({
  transactions,
  loading = false,
  maxItems = 10,
  className,
  title = 'Transactions en direct',
}: LiveTransactionsProps) {
  const displayedTransactions = useMemo(() => {
    return transactions.slice(0, maxItems)
  }, [transactions, maxItems])

  const totalAmount = useMemo(() => {
    return displayedTransactions.reduce((sum, tx) => {
      if (tx.type === 'refund') return sum - tx.amount
      return sum + tx.amount
    }, 0)
  }, [displayedTransactions])

  return (
    <div className={cn('rounded-lg border bg-card shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <CreditCard className="h-5 w-5 text-primary" />
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {transactions.length > 0
              ? `${transactions.length} transaction${transactions.length > 1 ? 's' : ''} recente${transactions.length > 1 ? 's' : ''}`
              : 'En attente de transactions...'}
          </p>
        </div>
        {displayedTransactions.length > 0 && (
          <div className="text-right">
            <p className="text-lg font-bold text-green-600">
              {totalAmount >= 0 ? '+' : ''}
              {formatCurrency(totalAmount)}
            </p>
            <p className="text-xs text-muted-foreground">Total affiche</p>
          </div>
        )}
      </div>

      {/* Transactions List */}
      <div className="max-h-[500px] overflow-y-auto">
        {loading ? (
          <LoadingSkeleton count={5} />
        ) : displayedTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune transaction pour le moment
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les nouvelles transactions apparaitront ici en temps reel
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {displayedTransactions.map((transaction, index) => (
              <TransactionItem
                key={transaction.id}
                transaction={transaction}
                isNew={index === 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {transactions.length > maxItems && (
        <div className="border-t px-4 py-2 text-center text-sm text-muted-foreground">
          +{transactions.length - maxItems} autres transactions
        </div>
      )}
    </div>
  )
}
