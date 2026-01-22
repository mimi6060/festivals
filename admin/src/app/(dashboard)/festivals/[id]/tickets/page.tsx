'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, LayoutGrid, List, Search, Download, QrCode } from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { TicketTypeCard, TicketTypeRow } from '@/components/tickets/TicketTypeCard'
import { ticketsApi, type TicketType } from '@/lib/api/tickets'

type ViewMode = 'grid' | 'list'

// Mock data for development
const mockTicketTypes: TicketType[] = [
  {
    id: '1',
    festivalId: '1',
    name: 'Pass 3 Jours',
    description: 'Acces complet aux 3 jours du festival avec tous les avantages VIP inclus',
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
  },
  {
    id: '2',
    festivalId: '1',
    name: 'Pass Journee - Vendredi',
    description: 'Acces au festival le vendredi 15 juin',
    price: 75,
    quantity: 2000,
    sold: 1876,
    checkedIn: 1234,
    status: 'ON_SALE',
    validFrom: '2026-06-15T00:00:00Z',
    validUntil: '2026-06-15T23:59:59Z',
    benefits: ['Acces vendredi'],
    settings: {
      allowReentry: true,
      initialTopUpAmount: 10,
      transferable: true,
      transferDeadline: '2026-06-14T23:59:59Z',
      maxTransfers: 1,
      requiresId: false,
    },
    createdAt: '2025-12-01T10:00:00Z',
    updatedAt: '2026-01-10T09:15:00Z',
  },
  {
    id: '3',
    festivalId: '1',
    name: 'Pass Journee - Samedi',
    description: 'Acces au festival le samedi 16 juin',
    price: 85,
    quantity: 2500,
    sold: 2500,
    checkedIn: 1892,
    status: 'SOLD_OUT',
    validFrom: '2026-06-16T00:00:00Z',
    validUntil: '2026-06-16T23:59:59Z',
    benefits: ['Acces samedi'],
    settings: {
      allowReentry: true,
      initialTopUpAmount: 10,
      transferable: true,
      transferDeadline: '2026-06-15T23:59:59Z',
      maxTransfers: 1,
      requiresId: false,
    },
    createdAt: '2025-12-01T10:00:00Z',
    updatedAt: '2026-01-20T16:45:00Z',
  },
  {
    id: '4',
    festivalId: '1',
    name: 'Pass VIP Premium',
    description: 'Experience VIP ultime avec acces backstage, meet & greet et services exclusifs',
    price: 450,
    quantity: 200,
    sold: 156,
    checkedIn: 89,
    status: 'ON_SALE',
    validFrom: '2026-06-15T00:00:00Z',
    validUntil: '2026-06-17T23:59:59Z',
    benefits: ['Acces 3 jours', 'Zone VIP Premium', 'Backstage', 'Meet & Greet', 'Open bar', 'Parking VIP'],
    settings: {
      allowReentry: true,
      initialTopUpAmount: 100,
      transferable: false,
      transferDeadline: null,
      maxTransfers: 0,
      requiresId: true,
    },
    createdAt: '2025-12-01T10:00:00Z',
    updatedAt: '2026-01-18T11:20:00Z',
  },
  {
    id: '5',
    festivalId: '1',
    name: 'Pass Camping',
    description: 'Supplement camping pour les detenteurs de pass 3 jours',
    price: 45,
    quantity: null,
    sold: 1234,
    checkedIn: 1100,
    status: 'ON_SALE',
    validFrom: '2026-06-14T14:00:00Z',
    validUntil: '2026-06-18T12:00:00Z',
    benefits: ['Emplacement camping', 'Acces douches', 'Consigne'],
    settings: {
      allowReentry: true,
      initialTopUpAmount: 0,
      transferable: false,
      transferDeadline: null,
      maxTransfers: 0,
      requiresId: false,
    },
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2026-01-22T08:00:00Z',
  },
]

export default function TicketsListPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    async function loadTicketTypes() {
      try {
        // const data = await ticketsApi.listTicketTypes(festivalId)
        // setTicketTypes(data)
        // Using mock data for now
        setTicketTypes(mockTicketTypes)
      } catch (error) {
        console.error('Failed to load ticket types:', error)
      } finally {
        setLoading(false)
      }
    }
    loadTicketTypes()
  }, [festivalId])

  const handleDelete = async (id: string) => {
    if (!confirm('Etes-vous sur de vouloir supprimer ce type de billet ?')) return
    try {
      await ticketsApi.deleteTicketType(festivalId, id)
      setTicketTypes((prev) => prev.filter((t) => t.id !== id))
    } catch (error) {
      console.error('Failed to delete ticket type:', error)
    }
  }

  // Filter ticket types
  const filteredTicketTypes = ticketTypes.filter((tt) => {
    const matchesSearch =
      searchQuery === '' ||
      tt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tt.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || tt.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Calculate totals
  const totals = ticketTypes.reduce(
    (acc, tt) => ({
      sold: acc.sold + tt.sold,
      checkedIn: acc.checkedIn + tt.checkedIn,
      revenue: acc.revenue + tt.sold * tt.price,
    }),
    { sold: 0, checkedIn: 0, revenue: 0 }
  )

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
          <h1 className="text-2xl font-bold text-gray-900">Gestion des billets</h1>
          <p className="text-gray-500">Gerez les types de billets et suivez les ventes</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/festivals/${festivalId}/tickets/scan`}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <QrCode className="h-4 w-4" />
            Scanner
          </Link>
          <Link
            href={`/festivals/${festivalId}/tickets/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nouveau type de billet
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Types de billets</p>
          <p className="text-3xl font-bold">{ticketTypes.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Billets vendus</p>
          <p className="text-3xl font-bold">{formatNumber(totals.sold)}</p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Check-ins</p>
          <p className="text-3xl font-bold">{formatNumber(totals.checkedIn)}</p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Revenus totaux</p>
          <p className="text-3xl font-bold">{formatCurrency(totals.revenue)}</p>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un type de billet..."
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
            <option value="DRAFT">Brouillon</option>
            <option value="ON_SALE">En vente</option>
            <option value="SOLD_OUT">Complet</option>
            <option value="CLOSED">Ferme</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Exporter
          </button>
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

      {/* Ticket Types Display */}
      {filteredTicketTypes.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border bg-white">
          <p className="text-gray-500">Aucun type de billet trouve</p>
          {searchQuery || statusFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
              }}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Reinitialiser les filtres
            </button>
          ) : (
            <Link
              href={`/festivals/${festivalId}/tickets/new`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Creer un type de billet
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTicketTypes.map((ticketType) => (
            <TicketTypeCard
              key={ticketType.id}
              ticketType={ticketType}
              festivalId={festivalId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Nom</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Prix</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Ventes</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Check-ins</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Revenus</th>
              </tr>
            </thead>
            <tbody>
              {filteredTicketTypes.map((ticketType) => (
                <TicketTypeRow
                  key={ticketType.id}
                  ticketType={ticketType}
                  festivalId={festivalId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
