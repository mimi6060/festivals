'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Send,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Calendar,
  DollarSign,
  FileText,
  MoreVertical,
  Mail,
  User,
  Music,
  RefreshCw,
} from 'lucide-react'
import { InvitationForm } from '@/components/artists/InvitationForm'

// Types
type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED' | 'NEGOTIATING'
type ContractStatus = 'NONE' | 'PENDING' | 'SENT' | 'SIGNED' | 'REJECTED'

interface Invitation {
  id: string
  artistProfileId: string
  artistName: string
  artistStageName?: string
  artistGenre?: string
  artistImageUrl?: string
  status: InvitationStatus
  proposedFee?: number
  currency: string
  proposedDate?: string
  stageName?: string
  setDuration?: number
  message: string
  artistResponse?: string
  respondedAt?: string
  expiresAt?: string
  contractStatus: ContractStatus
  createdAt: string
}

// Mock data
const mockInvitations: Invitation[] = [
  {
    id: '1',
    artistProfileId: 'a1',
    artistName: 'ODESZA',
    artistStageName: 'ODESZA',
    artistGenre: 'Electronic',
    status: 'ACCEPTED',
    proposedFee: 75000,
    currency: 'EUR',
    proposedDate: '2026-06-15T21:00:00Z',
    stageName: 'Main Stage',
    setDuration: 90,
    message: 'We would love to have you headline our Saturday night!',
    artistResponse: 'We are excited to be part of Summer Fest 2026!',
    respondedAt: '2025-11-15T10:30:00Z',
    contractStatus: 'SIGNED',
    createdAt: '2025-11-01T09:00:00Z',
  },
  {
    id: '2',
    artistProfileId: 'a2',
    artistName: 'Disclosure',
    artistStageName: 'Disclosure',
    artistGenre: 'House',
    status: 'PENDING',
    proposedFee: 50000,
    currency: 'EUR',
    proposedDate: '2026-06-16T22:00:00Z',
    stageName: 'Electronic Tent',
    setDuration: 120,
    message: 'Would you be interested in closing our Electronic Tent on Sunday?',
    expiresAt: '2026-02-01T23:59:59Z',
    contractStatus: 'NONE',
    createdAt: '2025-12-20T14:00:00Z',
  },
  {
    id: '3',
    artistProfileId: 'a3',
    artistName: 'Kaytranada',
    artistGenre: 'R&B / Electronic',
    status: 'NEGOTIATING',
    proposedFee: 35000,
    currency: 'EUR',
    proposedDate: '2026-06-16T20:00:00Z',
    stageName: 'Electronic Tent',
    setDuration: 90,
    message: 'We have a prime slot available for you on Sunday evening.',
    artistResponse: 'Interested but would need at least 45k for this date.',
    respondedAt: '2025-12-22T16:00:00Z',
    contractStatus: 'NONE',
    createdAt: '2025-12-15T11:00:00Z',
  },
  {
    id: '4',
    artistProfileId: 'a4',
    artistName: 'Khruangbin',
    artistStageName: 'Khruangbin',
    artistGenre: 'Psychedelic Soul',
    status: 'DECLINED',
    proposedFee: 40000,
    currency: 'EUR',
    proposedDate: '2026-06-15T19:00:00Z',
    stageName: 'Acoustic Garden',
    setDuration: 75,
    message: 'Perfect fit for our Acoustic Garden stage!',
    artistResponse: 'Unfortunately we have a conflicting booking for those dates.',
    respondedAt: '2025-12-10T09:00:00Z',
    contractStatus: 'NONE',
    createdAt: '2025-12-01T10:00:00Z',
  },
]

const statusConfig: Record<InvitationStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  ACCEPTED: { label: 'Acceptee', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  DECLINED: { label: 'Refusee', color: 'bg-red-100 text-red-700', icon: XCircle },
  EXPIRED: { label: 'Expiree', color: 'bg-gray-100 text-gray-700', icon: Clock },
  CANCELLED: { label: 'Annulee', color: 'bg-gray-100 text-gray-700', icon: XCircle },
  NEGOTIATING: { label: 'Negociation', color: 'bg-blue-100 text-blue-700', icon: MessageSquare },
}

const contractStatusConfig: Record<ContractStatus, { label: string; color: string }> = {
  NONE: { label: '-', color: 'text-gray-400' },
  PENDING: { label: 'En preparation', color: 'text-yellow-600' },
  SENT: { label: 'Envoye', color: 'text-blue-600' },
  SIGNED: { label: 'Signe', color: 'text-green-600' },
  REJECTED: { label: 'Rejete', color: 'text-red-600' },
}

export default function InvitationsPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [invitations] = useState<Invitation[]>(mockInvitations)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | 'ALL'>('ALL')
  const [showNewInvitation, setShowNewInvitation] = useState(false)
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null)

  // Filter invitations
  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      const matchesSearch =
        searchQuery === '' ||
        inv.artistName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.artistStageName?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [invitations, searchQuery, statusFilter])

  // Stats
  const stats = useMemo(() => {
    return {
      total: invitations.length,
      pending: invitations.filter((i) => i.status === 'PENDING').length,
      accepted: invitations.filter((i) => i.status === 'ACCEPTED').length,
      negotiating: invitations.filter((i) => i.status === 'NEGOTIATING').length,
      contractsSigned: invitations.filter((i) => i.contractStatus === 'SIGNED').length,
    }
  }, [invitations])

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr))
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invitations Artistes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez les invitations envoyees aux artistes pour votre festival
          </p>
        </div>
        <button
          onClick={() => setShowNewInvitation(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nouvelle Invitation
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Send className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-100 p-2">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Acceptees</p>
              <p className="text-2xl font-bold">{stats.accepted}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Negociation</p>
              <p className="text-2xl font-bold">{stats.negotiating}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <FileText className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Contrats signes</p>
              <p className="text-2xl font-bold">{stats.contractsSigned}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un artiste..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvitationStatus | 'ALL')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="ACCEPTED">Acceptees</option>
            <option value="DECLINED">Refusees</option>
            <option value="NEGOTIATING">En negociation</option>
            <option value="EXPIRED">Expirees</option>
            <option value="CANCELLED">Annulees</option>
          </select>
        </div>
      </div>

      {/* Invitations List */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Artiste
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Proposition
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date / Scene
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contrat
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Envoyee le
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredInvitations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Aucune invitation trouvee.
                </td>
              </tr>
            ) : (
              filteredInvitations.map((invitation) => {
                const statusConf = statusConfig[invitation.status]
                const StatusIcon = statusConf.icon
                const contractConf = contractStatusConfig[invitation.contractStatus]

                return (
                  <tr
                    key={invitation.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedInvitation(invitation)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium">
                          {invitation.artistName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {invitation.artistStageName || invitation.artistName}
                          </div>
                          <div className="text-sm text-gray-500">{invitation.artistGenre}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {invitation.proposedFee ? (
                        <div className="font-medium text-gray-900">
                          {formatCurrency(invitation.proposedFee, invitation.currency)}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      {invitation.setDuration && (
                        <div className="text-sm text-gray-500">{invitation.setDuration} min</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {invitation.proposedDate ? (
                        <>
                          <div className="text-sm text-gray-900">
                            {formatDate(invitation.proposedDate)}
                          </div>
                          <div className="text-sm text-gray-500">{invitation.stageName}</div>
                        </>
                      ) : (
                        <span className="text-gray-400">A definir</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                          statusConf.color
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusConf.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn('text-sm font-medium', contractConf.color)}>
                        {contractConf.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {formatDate(invitation.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // Open actions menu
                        }}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* New Invitation Modal */}
      {showNewInvitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Nouvelle Invitation</h2>
              <button
                onClick={() => setShowNewInvitation(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <InvitationForm
              festivalId={festivalId}
              onSubmit={(data) => {
                setShowNewInvitation(false)
              }}
              onCancel={() => setShowNewInvitation(false)}
            />
          </div>
        </div>
      )}

      {/* Invitation Detail Modal */}
      {selectedInvitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-medium">
                    {selectedInvitation.artistName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedInvitation.artistStageName || selectedInvitation.artistName}
                    </h2>
                    <p className="text-sm text-gray-500">{selectedInvitation.artistGenre}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInvitation(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
                    statusConfig[selectedInvitation.status].color
                  )}
                >
                  {(() => {
                    const Icon = statusConfig[selectedInvitation.status].icon
                    return <Icon className="h-4 w-4" />
                  })()}
                  {statusConfig[selectedInvitation.status].label}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    contractStatusConfig[selectedInvitation.contractStatus].color
                  )}
                >
                  Contrat: {contractStatusConfig[selectedInvitation.contractStatus].label}
                </span>
              </div>

              {/* Details */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Cachet propose</p>
                      <p className="font-medium">
                        {selectedInvitation.proposedFee
                          ? formatCurrency(selectedInvitation.proposedFee, selectedInvitation.currency)
                          : 'Non specifie'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Date proposee</p>
                      <p className="font-medium">
                        {selectedInvitation.proposedDate
                          ? formatDate(selectedInvitation.proposedDate)
                          : 'A definir'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Music className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Scene</p>
                      <p className="font-medium">{selectedInvitation.stageName || 'A definir'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Duree du set</p>
                      <p className="font-medium">
                        {selectedInvitation.setDuration
                          ? `${selectedInvitation.setDuration} minutes`
                          : 'A definir'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Message envoye</h3>
                <p className="text-sm text-gray-600">{selectedInvitation.message}</p>
              </div>

              {/* Response */}
              {selectedInvitation.artistResponse && (
                <div className="rounded-lg bg-blue-50 p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Reponse de l'artiste</h3>
                  <p className="text-sm text-gray-600">{selectedInvitation.artistResponse}</p>
                  {selectedInvitation.respondedAt && (
                    <p className="text-xs text-gray-400 mt-2">
                      Repondu le {formatDate(selectedInvitation.respondedAt)}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t">
                {selectedInvitation.status === 'PENDING' && (
                  <>
                    <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <RefreshCw className="h-4 w-4" />
                      Relancer
                    </button>
                    <button className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                      <XCircle className="h-4 w-4" />
                      Annuler
                    </button>
                  </>
                )}
                {selectedInvitation.status === 'ACCEPTED' &&
                  selectedInvitation.contractStatus !== 'SIGNED' && (
                    <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
                      <FileText className="h-4 w-4" />
                      Envoyer le contrat
                    </button>
                  )}
                {selectedInvitation.status === 'NEGOTIATING' && (
                  <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
                    <MessageSquare className="h-4 w-4" />
                    Repondre
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
