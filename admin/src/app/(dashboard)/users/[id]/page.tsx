'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Shield,
  Ban,
  UserCheck,
  Wallet,
  Ticket,
  Clock,
  CreditCard,
  ShoppingBag,
  LogIn,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MoreVertical,
  Edit,
  User as UserIcon,
  Users,
  UserCog,
  ShieldCheck,
} from 'lucide-react'
import { cn, formatDateTime, formatCurrency, formatNumber } from '@/lib/utils'
import {
  usersApi,
  User,
  UserDetail,
  UserRole,
  UserStatus,
  UserWallet,
  UserTicket,
  UserActivity,
  UserTransaction,
} from '@/lib/api/users'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent, CardBody } from '@/components/ui/Card'
import { CustomTabs, TabPanel } from '@/components/ui/Tabs'
import { UserCard } from '@/components/users/UserCard'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
} from '@/components/ui/Modal'

const roleConfig: Record<UserRole, { label: string; className: string; icon: typeof Shield }> = {
  ADMIN: {
    label: 'Administrateur',
    className: 'bg-purple-100 text-purple-800',
    icon: ShieldCheck,
  },
  ORGANIZER: {
    label: 'Organisateur',
    className: 'bg-blue-100 text-blue-800',
    icon: UserCog,
  },
  MANAGER: {
    label: 'Manager',
    className: 'bg-green-100 text-green-800',
    icon: Users,
  },
  STAFF: {
    label: 'Staff',
    className: 'bg-yellow-100 text-yellow-800',
    icon: UserIcon,
  },
  FESTIVALIER: {
    label: 'Festivalier',
    className: 'bg-gray-100 text-gray-800',
    icon: UserIcon,
  },
}

const statusConfig: Record<UserStatus, { label: string; variant: 'success' | 'error' | 'warning' }> = {
  ACTIVE: { label: 'Actif', variant: 'success' },
  BANNED: { label: 'Banni', variant: 'error' },
  SUSPENDED: { label: 'Suspendu', variant: 'warning' },
}

const activityIcons: Record<string, typeof LogIn> = {
  LOGIN: LogIn,
  TICKET_PURCHASE: Ticket,
  WALLET_RECHARGE: RefreshCw,
  PAYMENT: CreditCard,
  REFUND: RefreshCw,
  TICKET_SCAN: CheckCircle,
  ROLE_CHANGE: Shield,
  BAN: Ban,
  UNBAN: UserCheck,
}

const ticketStatusConfig: Record<string, { label: string; variant: 'success' | 'default' | 'error' }> = {
  VALID: { label: 'Valide', variant: 'success' },
  USED: { label: 'Utilise', variant: 'default' },
  CANCELLED: { label: 'Annule', variant: 'error' },
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = params.id as string
  const initialTab = searchParams.get('tab') || 'overview'

  const [user, setUser] = useState<UserDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [transactions, setTransactions] = useState<UserTransaction[]>([])
  const [activities, setActivities] = useState<UserActivity[]>([])
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadUser()
  }, [userId])

  const loadUser = async () => {
    setIsLoading(true)
    try {
      const data = await usersApi.get(userId)
      setUser(data)
      setSelectedRoles(data.roles)
    } catch (error) {
      console.error('Failed to load user:', error)
      // Mock data for development
      const mockUser: UserDetail = {
        id: userId,
        auth0Id: 'auth0|123',
        email: 'jean.martin@email.com',
        name: 'Jean Martin',
        phone: '+32 123 456 789',
        roles: ['FESTIVALIER'],
        status: 'ACTIVE',
        isActive: true,
        lastLoginAt: '2026-01-22T10:30:00Z',
        createdAt: '2025-06-01T00:00:00Z',
        updatedAt: '2026-01-22T10:30:00Z',
        wallets: [
          {
            id: 'w1',
            festivalId: 'f1',
            festivalName: 'Summer Fest 2026',
            balance: 4500,
            totalRecharges: 10000,
            totalSpent: 5500,
            createdAt: '2026-06-15T10:00:00Z',
            updatedAt: '2026-06-16T18:00:00Z',
          },
          {
            id: 'w2',
            festivalId: 'f2',
            festivalName: 'Winter Beats 2025',
            balance: 0,
            totalRecharges: 5000,
            totalSpent: 5000,
            createdAt: '2025-12-20T10:00:00Z',
            updatedAt: '2025-12-22T22:00:00Z',
          },
        ],
        tickets: [
          {
            id: 't1',
            festivalId: 'f1',
            festivalName: 'Summer Fest 2026',
            type: 'FULL_PASS',
            typeName: 'Pass 3 jours',
            qrCode: 'QR123456',
            status: 'VALID',
            createdAt: '2026-01-10T00:00:00Z',
          },
          {
            id: 't2',
            festivalId: 'f2',
            festivalName: 'Winter Beats 2025',
            type: 'VIP',
            typeName: 'Pass VIP',
            qrCode: 'QR789012',
            status: 'USED',
            usedAt: '2025-12-20T14:30:00Z',
            createdAt: '2025-11-15T00:00:00Z',
          },
        ],
        activityHistory: [
          {
            id: 'a1',
            type: 'LOGIN',
            description: 'Connexion depuis mobile',
            createdAt: '2026-01-22T10:30:00Z',
          },
          {
            id: 'a2',
            type: 'TICKET_PURCHASE',
            description: 'Achat Pass 3 jours - Summer Fest 2026',
            metadata: { amount: 150 },
            createdAt: '2026-01-10T00:00:00Z',
          },
          {
            id: 'a3',
            type: 'WALLET_RECHARGE',
            description: 'Recharge de 100 EUR',
            metadata: { amount: 100 },
            createdAt: '2025-12-20T10:00:00Z',
          },
        ],
        festivalRoles: [],
      }
      setUser(mockUser)
      setSelectedRoles(mockUser.roles)

      // Mock transactions
      setTransactions([
        {
          id: 'tx1',
          walletId: 'w1',
          festivalId: 'f1',
          festivalName: 'Summer Fest 2026',
          type: 'RECHARGE',
          amount: 5000,
          balanceAfter: 5000,
          createdAt: '2026-06-15T10:00:00Z',
        },
        {
          id: 'tx2',
          walletId: 'w1',
          festivalId: 'f1',
          festivalName: 'Summer Fest 2026',
          type: 'PAYMENT',
          amount: -500,
          balanceAfter: 4500,
          standName: 'Bar Central',
          createdAt: '2026-06-15T14:30:00Z',
        },
      ])

      // Mock activities
      setActivities(mockUser.activityHistory)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleToggle = (role: UserRole) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role))
    } else {
      setSelectedRoles([...selectedRoles, role])
    }
  }

  const handleSaveRoles = async () => {
    if (!user || selectedRoles.length === 0) return
    setIsProcessing(true)
    try {
      await usersApi.updateRole(userId, selectedRoles)
      setUser({ ...user, roles: selectedRoles })
      setIsRoleModalOpen(false)
    } catch (error) {
      console.error('Failed to update roles:', error)
      // Update locally for development
      setUser({ ...user, roles: selectedRoles })
      setIsRoleModalOpen(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBan = async () => {
    if (!user) return
    setIsProcessing(true)
    try {
      await usersApi.ban(userId)
      setUser({ ...user, status: 'BANNED', isActive: false })
    } catch (error) {
      console.error('Failed to ban user:', error)
      setUser({ ...user, status: 'BANNED', isActive: false })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUnban = async () => {
    if (!user) return
    setIsProcessing(true)
    try {
      await usersApi.unban(userId)
      setUser({ ...user, status: 'ACTIVE', isActive: true })
    } catch (error) {
      console.error('Failed to unban user:', error)
      setUser({ ...user, status: 'ACTIVE', isActive: true })
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-gray-500">Utilisateur non trouve</p>
        <Link href="/users" className="mt-4 text-primary hover:underline">
          Retour a la liste
        </Link>
      </div>
    )
  }

  const tabs = [
    { value: 'overview', label: 'Apercu' },
    { value: 'wallets', label: 'Portefeuilles' },
    { value: 'tickets', label: 'Billets' },
    { value: 'transactions', label: 'Transactions' },
    { value: 'activity', label: 'Activite' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/users"
            className="mt-1 rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
              <Badge variant={statusConfig[user.status].variant} dot>
                {statusConfig[user.status].label}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {user.email}
              </span>
              {user.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {user.phone}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Inscrit le {formatDateTime(user.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRoleModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            <Shield className="h-4 w-4" />
            Gerer les roles
          </button>
          {user.status === 'BANNED' ? (
            <button
              onClick={handleUnban}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              <UserCheck className="h-4 w-4" />
              Debannir
            </button>
          ) : (
            <button
              onClick={handleBan}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" />
              Bannir
            </button>
          )}
        </div>
      </div>

      {/* Roles Display */}
      <div className="flex flex-wrap gap-2">
        {user.roles.map((role) => {
          const config = roleConfig[role]
          const Icon = config.icon
          return (
            <span
              key={role}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
                config.className
              )}
            >
              <Icon className="h-4 w-4" />
              {config.label}
            </span>
          )
        })}
      </div>

      {/* Tabs */}
      <CustomTabs
        tabs={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
        variant="underline"
      >
        {/* Overview Tab */}
        <TabPanel value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Quick Stats */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Portefeuilles</p>
                        <p className="mt-1 text-2xl font-bold">{user.wallets.length}</p>
                      </div>
                      <div className="rounded-lg bg-blue-100 p-3">
                        <Wallet className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Billets</p>
                        <p className="mt-1 text-2xl font-bold">{user.tickets.length}</p>
                      </div>
                      <div className="rounded-lg bg-green-100 p-3">
                        <Ticket className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Solde total</p>
                        <p className="mt-1 text-2xl font-bold">
                          {formatNumber(user.wallets.reduce((sum, w) => sum + w.balance, 0))}
                        </p>
                      </div>
                      <div className="rounded-lg bg-purple-100 p-3">
                        <CreditCard className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Recent Wallets */}
              {user.wallets.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Portefeuilles recents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {user.wallets.slice(0, 3).map((wallet) => (
                        <div
                          key={wallet.id}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div>
                            <p className="font-medium">{wallet.festivalName}</p>
                            <p className="text-sm text-gray-500">
                              Cree le {formatDateTime(wallet.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600">
                              {formatNumber(wallet.balance)} jetons
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatNumber(wallet.totalSpent)} depenses
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Tickets */}
              {user.tickets.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Billets recents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {user.tickets.slice(0, 3).map((ticket) => (
                        <div
                          key={ticket.id}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div>
                            <p className="font-medium">{ticket.festivalName}</p>
                            <p className="text-sm text-gray-500">{ticket.typeName}</p>
                          </div>
                          <Badge variant={ticketStatusConfig[ticket.status].variant}>
                            {ticketStatusConfig[ticket.status].label}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Activity Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Activite recente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {user.activityHistory.slice(0, 5).map((activity) => {
                      const Icon = activityIcons[activity.type] || Clock
                      return (
                        <div key={activity.id} className="flex gap-3">
                          <div className="rounded-full bg-gray-100 p-2">
                            <Icon className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-900">{activity.description}</p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(activity.createdAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Informations</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm text-gray-500">ID Auth0</dt>
                      <dd className="text-sm font-mono">{user.auth0Id}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Derniere connexion</dt>
                      <dd className="text-sm">
                        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Jamais'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Mise a jour</dt>
                      <dd className="text-sm">{formatDateTime(user.updatedAt)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabPanel>

        {/* Wallets Tab */}
        <TabPanel value="wallets">
          {user.wallets.length === 0 ? (
            <div className="rounded-lg border bg-white p-12 text-center">
              <Wallet className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">Aucun portefeuille</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {user.wallets.map((wallet) => (
                <Card key={wallet.id}>
                  <CardBody>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-medium">{wallet.festivalName}</h3>
                      <Wallet className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500">Solde actuel</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatNumber(wallet.balance)} jetons
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 border-t pt-3">
                        <div>
                          <p className="text-xs text-gray-500">Total recharges</p>
                          <p className="font-medium">{formatNumber(wallet.totalRecharges)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total depenses</p>
                          <p className="font-medium">{formatNumber(wallet.totalSpent)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">
                        Cree le {formatDateTime(wallet.createdAt)}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </TabPanel>

        {/* Tickets Tab */}
        <TabPanel value="tickets">
          {user.tickets.length === 0 ? (
            <div className="rounded-lg border bg-white p-12 text-center">
              <Ticket className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">Aucun billet</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Festival
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Date d&apos;achat
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Utilise le
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {user.tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="px-6 py-4 font-medium">{ticket.festivalName}</td>
                      <td className="px-6 py-4">{ticket.typeName}</td>
                      <td className="px-6 py-4">
                        <Badge variant={ticketStatusConfig[ticket.status].variant}>
                          {ticketStatusConfig[ticket.status].label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDateTime(ticket.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {ticket.usedAt ? formatDateTime(ticket.usedAt) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabPanel>

        {/* Transactions Tab */}
        <TabPanel value="transactions">
          {transactions.length === 0 ? (
            <div className="rounded-lg border bg-white p-12 text-center">
              <CreditCard className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">Aucune transaction</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Festival
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Details
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Montant
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Solde apres
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDateTime(tx.createdAt)}
                      </td>
                      <td className="px-6 py-4">{tx.festivalName}</td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={tx.type === 'RECHARGE' ? 'success' : tx.type === 'PAYMENT' ? 'default' : 'warning'}
                        >
                          {tx.type === 'RECHARGE' && 'Recharge'}
                          {tx.type === 'PAYMENT' && 'Paiement'}
                          {tx.type === 'REFUND' && 'Remboursement'}
                          {tx.type === 'CANCEL' && 'Annulation'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {tx.standName || tx.reference || '-'}
                      </td>
                      <td className={cn(
                        'px-6 py-4 text-right font-medium',
                        tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                      )}>
                        {tx.amount > 0 ? '+' : ''}{formatNumber(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-500">
                        {formatNumber(tx.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabPanel>

        {/* Activity Tab */}
        <TabPanel value="activity">
          {activities.length === 0 ? (
            <div className="rounded-lg border bg-white p-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">Aucune activite</p>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {activities.map((activity, index) => {
                    const Icon = activityIcons[activity.type] || Clock
                    const isLast = index === activities.length - 1
                    return (
                      <div key={activity.id} className="relative flex gap-4">
                        {!isLast && (
                          <div className="absolute left-5 top-10 h-full w-px bg-gray-200" />
                        )}
                        <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          <Icon className="h-5 w-5 text-gray-600" />
                        </div>
                        <div className="flex-1 pb-6">
                          <p className="font-medium text-gray-900">{activity.description}</p>
                          <p className="text-sm text-gray-500">{formatDateTime(activity.createdAt)}</p>
                          {activity.metadata && (
                            <div className="mt-2 rounded bg-gray-50 p-2 text-sm text-gray-600">
                              {JSON.stringify(activity.metadata)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabPanel>
      </CustomTabs>

      {/* Role Management Modal */}
      <Modal open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Gerer les roles</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="mb-4 text-sm text-gray-500">
              Selectionnez les roles pour {user.name}
            </p>
            <div className="space-y-2">
              {(Object.keys(roleConfig) as UserRole[]).map((role) => {
                const config = roleConfig[role]
                const Icon = config.icon
                const isSelected = selectedRoles.includes(role)
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleRoleToggle(role)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      isSelected ? 'bg-primary/10' : 'bg-gray-100'
                    )}>
                      <Icon className={cn('h-4 w-4', isSelected ? 'text-primary' : 'text-gray-500')} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={cn('font-medium', isSelected && 'text-primary')}>
                        {config.label}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setIsRoleModalOpen(false)}
              className="rounded-lg border px-4 py-2 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveRoles}
              disabled={isProcessing || selectedRoles.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isProcessing ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
