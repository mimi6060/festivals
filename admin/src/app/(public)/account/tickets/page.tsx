'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { TicketCard, TicketCardSkeleton } from '@/components/account/TicketCard'
import { accountApi, UserTicket, TransferTicketInput } from '@/lib/api/account'
import {
  Ticket,
  Search,
  Filter,
  X,
  Send,
  AlertCircle,
} from 'lucide-react'

const statusFilters = [
  { value: '', label: 'Tous' },
  { value: 'VALID', label: 'Valides' },
  { value: 'USED', label: 'Utilises' },
  { value: 'EXPIRED', label: 'Expires' },
  { value: 'CANCELLED', label: 'Annules' },
  { value: 'TRANSFERRED', label: 'Transferes' },
]

export default function TicketsPage() {
  const [tickets, setTickets] = useState<UserTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Transfer modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [transferEmail, setTransferEmail] = useState('')
  const [transferName, setTransferName] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)

  useEffect(() => {
    loadTickets()
  }, [statusFilter])

  const loadTickets = async () => {
    try {
      setLoading(true)
      const response = await accountApi.getMyTickets({
        status: statusFilter || undefined,
        limit: 50,
      })
      setTickets(response.data)
    } catch (err) {
      console.error('Failed to load tickets:', err)
      setError('Impossible de charger vos billets. Veuillez reessayer.')
    } finally {
      setLoading(false)
    }
  }

  const handleTransferClick = (ticketId: string) => {
    setSelectedTicketId(ticketId)
    setTransferEmail('')
    setTransferName('')
    setTransferError(null)
    setTransferModalOpen(true)
  }

  const handleTransfer = async () => {
    if (!selectedTicketId || !transferEmail || !transferName) return

    setTransferring(true)
    setTransferError(null)

    try {
      const data: TransferTicketInput = {
        ticketId: selectedTicketId,
        recipientEmail: transferEmail,
        recipientName: transferName,
      }
      await accountApi.transferTicket(data)
      setTransferModalOpen(false)
      loadTickets() // Reload tickets
    } catch (err: any) {
      console.error('Failed to transfer ticket:', err)
      setTransferError(err.message || 'Le transfert a echoue. Veuillez reessayer.')
    } finally {
      setTransferring(false)
    }
  }

  // Filter tickets by search query
  const filteredTickets = tickets.filter((ticket) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      ticket.festivalName.toLowerCase().includes(query) ||
      ticket.ticketTypeName.toLowerCase().includes(query) ||
      ticket.code.toLowerCase().includes(query)
    )
  })

  // Group tickets by status
  const activeTickets = filteredTickets.filter((t) => t.status === 'VALID')
  const pastTickets = filteredTickets.filter((t) => t.status !== 'VALID')

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-red-700">{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            setError(null)
            loadTickets()
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
        <h1 className="text-2xl font-bold text-gray-900">Mes billets</h1>
        <p className="text-gray-600 mt-1">
          Gerez vos billets, telechargez vos QR codes et transferez vos places
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un billet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {statusFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <TicketCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredTickets.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <Ticket className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || statusFilter ? 'Aucun billet trouve' : 'Aucun billet'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || statusFilter
                ? 'Essayez de modifier vos filtres'
                : 'Achetez des billets pour vos festivals preferes'}
            </p>
            {!searchQuery && !statusFilter && (
              <Button variant="primary" asChild>
                <a href="/festivals">Decouvrir les festivals</a>
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      {/* Active tickets */}
      {!loading && activeTickets.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Badge variant="success">{activeTickets.length}</Badge>
            Billets valides
          </h2>
          <div className="space-y-4">
            {activeTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onTransfer={handleTransferClick}
              />
            ))}
          </div>
        </section>
      )}

      {/* Past tickets */}
      {!loading && pastTickets.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Badge variant="default">{pastTickets.length}</Badge>
            Autres billets
          </h2>
          <div className="space-y-4">
            {pastTickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} showActions={false} />
            ))}
          </div>
        </section>
      )}

      {/* Transfer modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Transferer le billet</h3>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="rounded-lg p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email du destinataire
                </label>
                <input
                  type="email"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  placeholder="destinataire@email.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du destinataire
                </label>
                <input
                  type="text"
                  value={transferName}
                  onChange={(e) => setTransferName(e.target.value)}
                  placeholder="Prenom Nom"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {transferError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {transferError}
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                <p className="font-medium mb-1">Attention</p>
                <p>Le transfert est irreversible. Le destinataire recevra un email avec son nouveau billet.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setTransferModalOpen(false)}
                disabled={transferring}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleTransfer}
                loading={transferring}
                disabled={!transferEmail || !transferName}
                leftIcon={<Send className="h-4 w-4" />}
              >
                Transferer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
