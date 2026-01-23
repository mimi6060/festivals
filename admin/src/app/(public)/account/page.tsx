'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { TicketCard, TicketCardSkeleton } from '@/components/account/TicketCard'
import { OrderCard, OrderCardSkeleton } from '@/components/account/OrderCard'
import { WalletMiniCard, WalletCardSkeleton } from '@/components/account/WalletCard'
import { accountApi, AccountSummary, UserTicket, UserOrder, UserWallet } from '@/lib/api/account'
import {
  User,
  Ticket,
  ShoppingBag,
  Wallet,
  Calendar,
  ChevronRight,
  TrendingUp,
  Heart,
} from 'lucide-react'

export default function AccountOverviewPage() {
  const [summary, setSummary] = useState<AccountSummary | null>(null)
  const [tickets, setTickets] = useState<UserTicket[]>([])
  const [orders, setOrders] = useState<UserOrder[]>([])
  const [wallets, setWallets] = useState<UserWallet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [summaryData, ticketsData, ordersData, walletsData] = await Promise.all([
          accountApi.getAccountSummary(),
          accountApi.getMyTickets({ limit: 3, status: 'VALID' }),
          accountApi.getMyOrders({ limit: 3 }),
          accountApi.getMyWallet(),
        ])
        setSummary(summaryData)
        setTickets(ticketsData.data)
        setOrders(ordersData.data)
        setWallets(walletsData)
      } catch (err) {
        console.error('Failed to load account data:', err)
        setError('Impossible de charger vos donnees. Veuillez reessayer.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-red-700">{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Reessayer
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-16 w-16 rounded-full bg-gray-200 animate-pulse" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white text-2xl font-bold">
              {summary?.user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            {loading ? (
              <>
                <div className="h-7 w-48 rounded bg-gray-200 animate-pulse mb-2" />
                <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" />
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">
                  Bonjour, {summary?.user.name.split(' ')[0]}
                </h1>
                <p className="text-gray-600">{summary?.user.email}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Ticket className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Billets actifs</p>
                {loading ? (
                  <div className="h-7 w-12 rounded bg-gray-200 animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{summary?.ticketCount || 0}</p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Festivals a venir</p>
                {loading ? (
                  <div className="h-7 w-12 rounded bg-gray-200 animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{summary?.upcomingFestivals || 0}</p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Link href="/account/favorites">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardBody>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                  <Heart className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Artistes favoris</p>
                  {loading ? (
                    <div className="h-7 w-12 rounded bg-gray-200 animate-pulse mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">{summary?.favoriteCount || 0}</p>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        </Link>

        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Solde total</p>
                {loading ? (
                  <div className="h-7 w-20 rounded bg-gray-200 animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(summary?.totalWalletBalance || 0)}
                  </p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total depense</p>
                {loading ? (
                  <div className="h-7 w-24 rounded bg-gray-200 animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(summary?.totalSpent || 0)}
                  </p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tickets section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Mes billets actifs</h2>
          <Link href="/account/tickets">
            <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="h-4 w-4" />}>
              Voir tous
            </Button>
          </Link>
        </div>
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <TicketCardSkeleton key={i} compact />
            ))}
          </div>
        ) : tickets.length > 0 ? (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} compact showActions={false} />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-8">
              <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Vous n'avez pas encore de billets</p>
              <Link href="/festivals">
                <Button variant="primary" className="mt-4">
                  Decouvrir les festivals
                </Button>
              </Link>
            </CardBody>
          </Card>
        )}
      </section>

      {/* Wallets section */}
      {(loading || wallets.length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Mes portefeuilles</h2>
            <Link href="/account/wallet">
              <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="h-4 w-4" />}>
                Gerer
              </Button>
            </Link>
          </div>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <WalletCardSkeleton key={i} compact />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {wallets.slice(0, 4).map((wallet) => (
                <WalletMiniCard key={wallet.id} wallet={wallet} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Orders section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Commandes recentes</h2>
          <Link href="/account/orders">
            <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="h-4 w-4" />}>
              Historique complet
            </Button>
          </Link>
        </div>
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <OrderCardSkeleton key={i} />
            ))}
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-8">
              <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune commande pour le moment</p>
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  )
}
