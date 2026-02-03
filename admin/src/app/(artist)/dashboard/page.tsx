'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Mail,
  FileText,
  TrendingUp,
  Clock,
  MapPin,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Music,
  Eye,
} from 'lucide-react'

// Types
interface UpcomingPerformance {
  id: string
  festivalName: string
  festivalLogo?: string
  stageName: string
  date: string
  startTime: string
  endTime: string
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED'
}

interface PendingInvitation {
  id: string
  festivalName: string
  festivalLogo?: string
  proposedDate?: string
  proposedFee?: number
  currency: string
  expiresAt?: string
}

interface ProfileCompletion {
  percentage: number
  missingItems: string[]
}

// Mock data
const mockPerformances: UpcomingPerformance[] = [
  {
    id: '1',
    festivalName: 'Summer Fest 2026',
    stageName: 'Main Stage',
    date: '2026-06-15',
    startTime: '21:00',
    endTime: '22:30',
    status: 'CONFIRMED',
  },
  {
    id: '2',
    festivalName: 'Electric Dreams',
    stageName: 'Electronic Arena',
    date: '2026-07-20',
    startTime: '23:00',
    endTime: '01:00',
    status: 'PENDING',
  },
]

const mockInvitations: PendingInvitation[] = [
  {
    id: '1',
    festivalName: 'Sunset Festival',
    proposedDate: '2026-08-12',
    proposedFee: 45000,
    currency: 'EUR',
    expiresAt: '2026-02-15',
  },
  {
    id: '2',
    festivalName: 'Mountain Beats',
    proposedFee: 35000,
    currency: 'EUR',
    expiresAt: '2026-02-01',
  },
]

const mockProfileCompletion: ProfileCompletion = {
  percentage: 75,
  missingItems: ['Photos de couverture', 'Bio complete', 'Tech rider par defaut'],
}

export default function ArtistDashboardPage() {
  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
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

  const getDaysUntil = (dateStr: string) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bienvenue, ODESZA</h1>
        <p className="mt-1 text-gray-500">
          Voici un apercu de votre activite et de vos prochains evenements.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-purple-100 p-3">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Performances a venir</p>
              <p className="text-2xl font-bold text-gray-900">{mockPerformances.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-pink-100 p-3">
              <Mail className="h-6 w-6 text-pink-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Invitations en attente</p>
              <p className="text-2xl font-bold text-gray-900">{mockInvitations.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-100 p-3">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tech Riders</p>
              <p className="text-2xl font-bold text-gray-900">3</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-green-100 p-3">
              <Eye className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vues du profil</p>
              <p className="text-2xl font-bold text-gray-900">1,234</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Performances */}
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold text-gray-900">Prochaines performances</h2>
            <Link
              href="/schedule"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Voir tout
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y">
            {mockPerformances.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p>Aucune performance programmee</p>
              </div>
            ) : (
              mockPerformances.map((performance) => (
                <div key={performance.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {performance.festivalName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">
                          {performance.festivalName}
                        </h3>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            performance.status === 'CONFIRMED' && 'bg-green-100 text-green-700',
                            performance.status === 'PENDING' && 'bg-yellow-100 text-yellow-700',
                            performance.status === 'CANCELLED' && 'bg-red-100 text-red-700'
                          )}
                        >
                          {performance.status === 'CONFIRMED' && 'Confirme'}
                          {performance.status === 'PENDING' && 'En attente'}
                          {performance.status === 'CANCELLED' && 'Annule'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(performance.date)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {performance.startTime} - {performance.endTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {performance.stageName}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-purple-600">
                        J-{getDaysUntil(performance.date)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Invitations */}
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold text-gray-900">Invitations recentes</h2>
            <Link
              href="/invitations"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Voir tout
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y">
            {mockInvitations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Mail className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p>Aucune invitation en attente</p>
              </div>
            ) : (
              mockInvitations.map((invitation) => (
                <div key={invitation.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                      {invitation.festivalName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {invitation.festivalName}
                      </h3>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                        {invitation.proposedDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(invitation.proposedDate)}
                          </span>
                        )}
                      </div>
                      {invitation.proposedFee && (
                        <p className="mt-1 text-sm font-medium text-green-600">
                          {formatCurrency(invitation.proposedFee, invitation.currency)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {invitation.expiresAt && (
                        <p
                          className={cn(
                            'text-xs',
                            getDaysUntil(invitation.expiresAt) <= 7
                              ? 'text-red-600 font-medium'
                              : 'text-gray-500'
                          )}
                        >
                          Expire dans {getDaysUntil(invitation.expiresAt)} jours
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/invitations/${invitation.id}`}
                      className="flex-1 rounded-lg border border-gray-300 py-1.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Voir details
                    </Link>
                    <button className="flex-1 rounded-lg bg-primary py-1.5 text-center text-sm font-medium text-white hover:bg-primary/90">
                      Repondre
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Profile Completion */}
      {mockProfileCompletion.percentage < 100 && (
        <div className="rounded-xl border bg-gradient-to-r from-purple-50 to-pink-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-purple-100 p-3">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Completez votre profil</h3>
                <span className="text-2xl font-bold text-purple-600">
                  {mockProfileCompletion.percentage}%
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Un profil complet augmente vos chances de recevoir des invitations de festivals.
              </p>
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-purple-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                    style={{ width: `${mockProfileCompletion.percentage}%` }}
                  />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Elements manquants:</p>
                <div className="flex flex-wrap gap-2">
                  {mockProfileCompletion.missingItems.map((item, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm text-gray-600 shadow-sm"
                    >
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href="/profile"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                Completer mon profil
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
