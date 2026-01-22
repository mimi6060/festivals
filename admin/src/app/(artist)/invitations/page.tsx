'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Mail,
  Filter,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Calendar,
  DollarSign,
  MapPin,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'

// Types
type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED' | 'NEGOTIATING'

interface Invitation {
  id: string
  festivalName: string
  festivalLogo?: string
  festivalLocation?: string
  festivalDates?: string
  status: InvitationStatus
  proposedFee?: number
  currency: string
  proposedDate?: string
  stageName?: string
  setDuration?: number
  message: string
  expiresAt?: string
  createdAt: string
}

// Mock data
const mockInvitations: Invitation[] = [
  {
    id: '1',
    festivalName: 'Sunset Festival',
    festivalLocation: 'Ibiza, Spain',
    festivalDates: '12-14 Aout 2026',
    status: 'PENDING',
    proposedFee: 45000,
    currency: 'EUR',
    proposedDate: '2026-08-13T22:00:00Z',
    stageName: 'Main Stage',
    setDuration: 90,
    message:
      'Cher ODESZA, nous serions honores de vous accueillir en tete d\'affiche de notre scene principale le samedi soir. Votre style musical correspond parfaitement a l\'ambiance de notre festival.',
    expiresAt: '2026-02-15',
    createdAt: '2026-01-10',
  },
  {
    id: '2',
    festivalName: 'Mountain Beats',
    festivalLocation: 'Chamonix, France',
    festivalDates: '5-7 Juillet 2026',
    status: 'PENDING',
    proposedFee: 35000,
    currency: 'EUR',
    proposedDate: '2026-07-06T21:00:00Z',
    stageName: 'Alpine Stage',
    setDuration: 75,
    message:
      'Bonjour, notre festival alpin aimerait vous proposer un creneau le vendredi soir. Le cadre exceptionnel des montagnes ajoutera une dimension unique a votre performance.',
    expiresAt: '2026-02-01',
    createdAt: '2026-01-05',
  },
  {
    id: '3',
    festivalName: 'Summer Fest 2026',
    festivalLocation: 'Paris, France',
    festivalDates: '15-17 Juin 2026',
    status: 'ACCEPTED',
    proposedFee: 75000,
    currency: 'EUR',
    proposedDate: '2026-06-15T21:00:00Z',
    stageName: 'Main Stage',
    setDuration: 90,
    message: 'Nous souhaitons vous avoir en tete d\'affiche pour notre edition 2026.',
    createdAt: '2025-11-01',
  },
  {
    id: '4',
    festivalName: 'Techno Paradise',
    festivalLocation: 'Berlin, Germany',
    festivalDates: '20-22 Aout 2026',
    status: 'DECLINED',
    proposedFee: 40000,
    currency: 'EUR',
    message: 'Invitation pour notre festival techno.',
    createdAt: '2025-12-15',
  },
  {
    id: '5',
    festivalName: 'Electric Dreams',
    festivalLocation: 'Amsterdam, Netherlands',
    festivalDates: '18-20 Juillet 2026',
    status: 'NEGOTIATING',
    proposedFee: 55000,
    currency: 'EUR',
    proposedDate: '2026-07-20T23:00:00Z',
    stageName: 'Electronic Arena',
    setDuration: 120,
    message: 'Nous aimerions vous avoir pour notre closing set.',
    createdAt: '2025-12-20',
  },
]

const statusConfig: Record<InvitationStatus, { label: string; color: string; icon: React.ElementType }> =
  {
    PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    ACCEPTED: { label: 'Acceptee', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    DECLINED: { label: 'Refusee', color: 'bg-red-100 text-red-700', icon: XCircle },
    EXPIRED: { label: 'Expiree', color: 'bg-gray-100 text-gray-700', icon: Clock },
    CANCELLED: { label: 'Annulee', color: 'bg-gray-100 text-gray-700', icon: XCircle },
    NEGOTIATING: { label: 'Negociation', color: 'bg-blue-100 text-blue-700', icon: MessageSquare },
  }

export default function ArtistInvitationsPage() {
  const [invitations] = useState(mockInvitations)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | 'ALL'>('ALL')
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null)

  // Filter invitations
  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      const matchesSearch =
        searchQuery === '' ||
        inv.festivalName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [invitations, searchQuery, statusFilter])

  // Stats
  const stats = useMemo(() => {
    return {
      pending: invitations.filter((i) => i.status === 'PENDING').length,
      accepted: invitations.filter((i) => i.status === 'ACCEPTED').length,
      negotiating: invitations.filter((i) => i.status === 'NEGOTIATING').length,
    }
  }, [invitations])

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
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

  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diffTime = expiry.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mes Invitations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gerez les invitations recues des festivals
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-100 p-2.5">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2.5">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Acceptees</p>
              <p className="text-2xl font-bold text-gray-900">{stats.accepted}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En negociation</p>
              <p className="text-2xl font-bold text-gray-900">{stats.negotiating}</p>
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
            placeholder="Rechercher un festival..."
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
          </select>
        </div>
      </div>

      {/* Invitations List */}
      <div className="space-y-4">
        {filteredInvitations.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center">
            <Mail className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune invitation</h3>
            <p className="text-sm text-gray-500">
              Vous n'avez pas encore recu d'invitation de festivals.
            </p>
          </div>
        ) : (
          filteredInvitations.map((invitation) => {
            const statusConf = statusConfig[invitation.status]
            const StatusIcon = statusConf.icon
            const daysUntilExpiry = invitation.expiresAt
              ? getDaysUntilExpiry(invitation.expiresAt)
              : null
            const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7

            return (
              <div
                key={invitation.id}
                onClick={() => setSelectedInvitation(invitation)}
                className={cn(
                  'rounded-xl border bg-white p-5 cursor-pointer transition-all hover:shadow-md',
                  invitation.status === 'PENDING' && isExpiringSoon && 'border-amber-300 bg-amber-50/50'
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Festival Logo */}
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {invitation.festivalName.charAt(0)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{invitation.festivalName}</h3>
                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                          {invitation.festivalLocation && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {invitation.festivalLocation}
                            </span>
                          )}
                          {invitation.festivalDates && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {invitation.festivalDates}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shrink-0',
                          statusConf.color
                        )}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusConf.label}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                      {invitation.proposedFee && (
                        <span className="flex items-center gap-1 font-medium text-green-600">
                          <DollarSign className="h-4 w-4" />
                          {formatCurrency(invitation.proposedFee, invitation.currency)}
                        </span>
                      )}
                      {invitation.stageName && (
                        <span className="text-gray-500">{invitation.stageName}</span>
                      )}
                      {invitation.setDuration && (
                        <span className="text-gray-500">{invitation.setDuration} min</span>
                      )}
                    </div>

                    {/* Message Preview */}
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">{invitation.message}</p>

                    {/* Expiry Warning */}
                    {invitation.status === 'PENDING' && isExpiringSoon && (
                      <div className="mt-3 flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Expire dans {daysUntilExpiry} jour{daysUntilExpiry !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Invitation Detail Modal */}
      {selectedInvitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-bold">
                    {selectedInvitation.festivalName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedInvitation.festivalName}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedInvitation.festivalLocation} - {selectedInvitation.festivalDates}
                    </p>
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

            {/* Content */}
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
                <span className="text-sm text-gray-500">
                  Recue le {formatDate(selectedInvitation.createdAt)}
                </span>
              </div>

              {/* Offer Details */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm">Cachet propose</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {selectedInvitation.proposedFee
                      ? formatCurrency(selectedInvitation.proposedFee, selectedInvitation.currency)
                      : 'A negocier'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Date proposee</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {selectedInvitation.proposedDate
                      ? formatDate(selectedInvitation.proposedDate)
                      : 'A definir'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">Scene</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {selectedInvitation.stageName || 'A definir'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Duree du set</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {selectedInvitation.setDuration
                      ? `${selectedInvitation.setDuration} minutes`
                      : 'A definir'}
                  </p>
                </div>
              </div>

              {/* Message */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Message de l'organisateur</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{selectedInvitation.message}</p>
              </div>

              {/* Expiry Warning */}
              {selectedInvitation.status === 'PENDING' && selectedInvitation.expiresAt && (
                <div
                  className={cn(
                    'rounded-lg p-4',
                    getDaysUntilExpiry(selectedInvitation.expiresAt) <= 7
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Clock
                      className={cn(
                        'h-5 w-5',
                        getDaysUntilExpiry(selectedInvitation.expiresAt) <= 7
                          ? 'text-amber-600'
                          : 'text-gray-400'
                      )}
                    />
                    <span
                      className={cn(
                        'text-sm font-medium',
                        getDaysUntilExpiry(selectedInvitation.expiresAt) <= 7
                          ? 'text-amber-700'
                          : 'text-gray-600'
                      )}
                    >
                      Cette invitation expire le {formatDate(selectedInvitation.expiresAt)} (
                      {getDaysUntilExpiry(selectedInvitation.expiresAt)} jour
                      {getDaysUntilExpiry(selectedInvitation.expiresAt) !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedInvitation.status === 'PENDING' && (
                <div className="flex gap-3 pt-4 border-t">
                  <button className="flex-1 rounded-lg border border-red-300 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                    Decliner
                  </button>
                  <button className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Negocier
                  </button>
                  <button className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700">
                    Accepter
                  </button>
                </div>
              )}

              {selectedInvitation.status === 'NEGOTIATING' && (
                <div className="flex gap-3 pt-4 border-t">
                  <button className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Envoyer un message
                  </button>
                  <button className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700">
                    Accepter l'offre
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
