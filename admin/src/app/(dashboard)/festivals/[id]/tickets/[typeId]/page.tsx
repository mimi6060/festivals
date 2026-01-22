'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Edit,
  Trash2,
  MoreVertical,
  Search,
  Download,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { cn, formatCurrency, formatNumber, formatDateTime, formatDate } from '@/lib/utils'
import { ticketsApi, type TicketType, type Ticket } from '@/lib/api/tickets'

// Mock data for development
const mockTicketType: TicketType = {
  id: '1',
  festivalId: '1',
  name: 'Pass 3 Jours',
  description: 'Acces complet aux 3 jours du festival avec tous les avantages VIP inclus. Profitez d une experience complete avec acces a toutes les scenes et zones du festival.',
  price: 189,
  quantity: 5000,
  sold: 4523,
  checkedIn: 2847,
  status: 'ON_SALE',
  validFrom: '2026-06-15T00:00:00Z',
  validUntil: '2026-06-17T23:59:59Z',
  benefits: ['Acces 3 jours', 'Zone VIP', 'Boisson offerte', 'Parking gratuit'],
  settings: {
    allowReentry: true,
    initialTopUpAmount: 20,
    transferable: true,
    transferDeadline: '2026-06-14T23:59:59Z',
    maxTransfers: 2,
    requiresId: false,
  },
  createdAt: '2025-12-01T10:00:00Z',
  updatedAt: '2026-01-15T14:30:00Z',
}

const mockTickets: Ticket[] = [
  {
    id: '1',
    ticketTypeId: '1',
    ticketTypeName: 'Pass 3 Jours',
    code: 'FEST-2026-A1B2C3',
    status: 'USED',
    holderName: 'Jean Dupont',
    holderEmail: 'jean.dupont@email.com',
    purchasedAt: '2025-12-15T14:30:00Z',
    checkedInAt: '2026-06-15T10:30:00Z',
    checkedInBy: 'staff@festival.com',
    transferredFrom: null,
    walletId: 'wallet-123',
  },
  {
    id: '2',
    ticketTypeId: '1',
    ticketTypeName: 'Pass 3 Jours',
    code: 'FEST-2026-D4E5F6',
    status: 'VALID',
    holderName: 'Marie Martin',
    holderEmail: 'marie.martin@email.com',
    purchasedAt: '2025-12-20T09:15:00Z',
    checkedInAt: null,
    checkedInBy: null,
    transferredFrom: null,
    walletId: 'wallet-456',
  },
  {
    id: '3',
    ticketTypeId: '1',
    ticketTypeName: 'Pass 3 Jours',
    code: 'FEST-2026-G7H8I9',
    status: 'CANCELLED',
    holderName: 'Pierre Bernard',
    holderEmail: 'pierre.bernard@email.com',
    purchasedAt: '2025-12-22T16:45:00Z',
    checkedInAt: null,
    checkedInBy: null,
    transferredFrom: null,
    walletId: null,
  },
  {
    id: '4',
    ticketTypeId: '1',
    ticketTypeName: 'Pass 3 Jours',
    code: 'FEST-2026-J1K2L3',
    status: 'USED',
    holderName: 'Sophie Leroy',
    holderEmail: 'sophie.leroy@email.com',
    purchasedAt: '2026-01-05T11:20:00Z',
    checkedInAt: '2026-06-15T12:45:00Z',
    checkedInBy: 'staff@festival.com',
    transferredFrom: 'original-buyer@email.com',
    walletId: 'wallet-789',
  },
  {
    id: '5',
    ticketTypeId: '1',
    ticketTypeName: 'Pass 3 Jours',
    code: 'FEST-2026-M4N5O6',
    status: 'VALID',
    holderName: 'Thomas Moreau',
    holderEmail: 'thomas.moreau@email.com',
    purchasedAt: '2026-01-10T08:00:00Z',
    checkedInAt: null,
    checkedInBy: null,
    transferredFrom: null,
    walletId: 'wallet-012',
  },
]

const statusColors: Record<Ticket['status'], { bg: string; text: string; label: string; icon: typeof CheckCircle }> = {
  VALID: { bg: 'bg-green-100', text: 'text-green-700', label: 'Valide', icon: CheckCircle },
  USED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Utilise', icon: Users },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Annule', icon: XCircle },
  EXPIRED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Expire', icon: Clock },
}

const ticketTypeStatusColors: Record<TicketType['status'], { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Brouillon' },
  ON_SALE: { bg: 'bg-green-100', text: 'text-green-700', label: 'En vente' },
  SOLD_OUT: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Complet' },
  CLOSED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Ferme' },
}

export default function TicketTypeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const typeId = params.typeId as string

  const [ticketType, setTicketType] = useState<TicketType | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'tickets'>('details')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Editable fields
  const [editedName, setEditedName] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedStatus, setEditedStatus] = useState<TicketType['status']>('DRAFT')

  useEffect(() => {
    async function loadData() {
      try {
        // const data = await ticketsApi.getTicketType(festivalId, typeId)
        // setTicketType(data)
        // Using mock data for now
        setTicketType(mockTicketType)
        setEditedName(mockTicketType.name)
        setEditedDescription(mockTicketType.description)
        setEditedStatus(mockTicketType.status)
      } catch (error) {
        console.error('Failed to load ticket type:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [festivalId, typeId])

  useEffect(() => {
    if (activeTab === 'tickets') {
      loadTickets()
    }
  }, [activeTab, festivalId, typeId])

  const loadTickets = async () => {
    setTicketsLoading(true)
    try {
      // const response = await ticketsApi.listTickets(festivalId, { ticketTypeId: typeId })
      // setTickets(response.data)
      // Using mock data for now
      setTickets(mockTickets)
    } catch (error) {
      console.error('Failed to load tickets:', error)
    } finally {
      setTicketsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!ticketType) return
    try {
      // await ticketsApi.updateTicketType(festivalId, typeId, {
      //   name: editedName,
      //   description: editedDescription,
      //   status: editedStatus,
      // })
      setTicketType({
        ...ticketType,
        name: editedName,
        description: editedDescription,
        status: editedStatus,
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update ticket type:', error)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Etes-vous sur de vouloir supprimer ce type de billet ?')) return
    try {
      await ticketsApi.deleteTicketType(festivalId, typeId)
      router.push(`/festivals/${festivalId}/tickets`)
    } catch (error) {
      console.error('Failed to delete ticket type:', error)
    }
  }

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      searchQuery === '' ||
      ticket.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.holderName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.holderEmail?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!ticketType) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <AlertCircle className="h-12 w-12 text-gray-400" />
        <p className="mt-2 text-gray-500">Type de billet introuvable</p>
        <Link
          href={`/festivals/${festivalId}/tickets`}
          className="mt-4 text-primary hover:underline"
        >
          Retour a la liste
        </Link>
      </div>
    )
  }

  const statusStyle = ticketTypeStatusColors[ticketType.status]
  const soldPercentage = ticketType.quantity
    ? Math.round((ticketType.sold / ticketType.quantity) * 100)
    : null
  const checkedInPercentage = ticketType.sold > 0
    ? Math.round((ticketType.checkedIn / ticketType.sold) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/tickets`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{ticketType.name}</h1>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  statusStyle.bg,
                  statusStyle.text
                )}
              >
                {statusStyle.label}
              </span>
            </div>
            <p className="text-gray-500">{formatCurrency(ticketType.price)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Edit className="h-4 w-4" />
            Modifier
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg border bg-white p-2 hover:bg-gray-50"
            >
              <MoreVertical className="h-5 w-5 text-gray-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
                <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <Download className="h-4 w-4" />
                  Exporter les billets
                </button>
                {ticketType.sold === 0 && (
                  <button
                    onClick={handleDelete}
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="h-4 w-4" />
            Vendus
          </div>
          <p className="mt-1 text-3xl font-bold">
            {formatNumber(ticketType.sold)}
            {ticketType.quantity && (
              <span className="text-lg font-normal text-gray-400">
                {' '}/ {formatNumber(ticketType.quantity)}
              </span>
            )}
          </p>
          {ticketType.quantity && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(soldPercentage || 0, 100)}%` }}
              />
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            Check-ins
          </div>
          <p className="mt-1 text-3xl font-bold">
            {formatNumber(ticketType.checkedIn)}
            <span className="text-lg font-normal text-gray-400">
              {' '}({checkedInPercentage}%)
            </span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: `${checkedInPercentage}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Revenus</p>
          <p className="mt-1 text-3xl font-bold">
            {formatCurrency(ticketType.sold * ticketType.price)}
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Top-up initial</p>
          <p className="mt-1 text-3xl font-bold">
            {formatCurrency(ticketType.settings.initialTopUpAmount)}
          </p>
          <p className="text-sm text-gray-400">
            Total: {formatCurrency(ticketType.sold * ticketType.settings.initialTopUpAmount)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('details')}
            className={cn(
              'border-b-2 pb-3 text-sm font-medium transition-colors',
              activeTab === 'details'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            )}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={cn(
              'border-b-2 pb-3 text-sm font-medium transition-colors',
              activeTab === 'tickets'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            )}
          >
            Billets vendus ({formatNumber(ticketType.sold)})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Info */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Informations</h2>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Statut</label>
                  <select
                    value={editedStatus}
                    onChange={(e) => setEditedStatus(e.target.value as TicketType['status'])}
                    className="w-full rounded-lg border px-3 py-2"
                  >
                    <option value="DRAFT">Brouillon</option>
                    <option value="ON_SALE">En vente</option>
                    <option value="SOLD_OUT">Complet</option>
                    <option value="CLOSED">Ferme</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
                  >
                    Enregistrer
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-500">Description</dt>
                  <dd className="mt-1">{ticketType.description || 'Aucune description'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Prix</dt>
                  <dd className="mt-1 font-medium">{formatCurrency(ticketType.price)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Quantite</dt>
                  <dd className="mt-1">
                    {ticketType.quantity ? formatNumber(ticketType.quantity) : 'Illimite'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Periode de validite</dt>
                  <dd className="mt-1">
                    {formatDate(ticketType.validFrom)} - {formatDate(ticketType.validUntil)}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* Benefits */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Avantages</h2>
            {ticketType.benefits.length > 0 ? (
              <ul className="space-y-2">
                {ticketType.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {benefit}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">Aucun avantage defini</p>
            )}
          </div>

          {/* Settings */}
          <div className="rounded-lg border bg-white p-6 lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Parametres</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Re-entree</p>
                <p className="mt-1 font-medium">
                  {ticketType.settings.allowReentry ? 'Autorisee' : 'Non autorisee'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Top-up initial</p>
                <p className="mt-1 font-medium">
                  {formatCurrency(ticketType.settings.initialTopUpAmount)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Transfert</p>
                <p className="mt-1 font-medium">
                  {ticketType.settings.transferable
                    ? `Oui (max ${ticketType.settings.maxTransfers})`
                    : 'Non'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Piece d identite</p>
                <p className="mt-1 font-medium">
                  {ticketType.settings.requiresId ? 'Requise' : 'Non requise'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tickets Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par code, nom ou email..."
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
                <option value="VALID">Valide</option>
                <option value="USED">Utilise</option>
                <option value="CANCELLED">Annule</option>
                <option value="EXPIRED">Expire</option>
              </select>
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              <Download className="h-4 w-4" />
              Exporter
            </button>
          </div>

          {/* Tickets Table */}
          {ticketsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-lg border bg-white">
              <p className="text-gray-500">Aucun billet trouve</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-white">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Titulaire</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Achat</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Check-in</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => {
                    const ticketStatus = statusColors[ticket.status]
                    const StatusIcon = ticketStatus.icon
                    return (
                      <tr key={ticket.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <code className="rounded bg-gray-100 px-2 py-0.5 text-sm font-mono">
                            {ticket.code}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {ticket.holderName || 'Non attribue'}
                            </p>
                            <p className="text-sm text-gray-500">{ticket.holderEmail}</p>
                            {ticket.transferredFrom && (
                              <p className="text-xs text-gray-400">
                                Transfere de: {ticket.transferredFrom}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDateTime(ticket.purchasedAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {ticket.checkedInAt ? formatDateTime(ticket.checkedInAt) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                              ticketStatus.bg,
                              ticketStatus.text
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {ticketStatus.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
