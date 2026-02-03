'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Settings,
  Ticket,
  Users,
  DollarSign,
  Wallet,
  Calendar,
  MapPin,
  Play,
  Pause,
  Archive,
  CheckCircle,
  ShoppingBag,
  Music,
  AlertTriangle,
  TrendingUp,
  MoreVertical,
} from 'lucide-react'
import { cn, formatDate, formatCurrency, formatNumber } from '@/lib/utils'
import { festivalsApi, FestivalStats } from '@/lib/api/festivals'
import { Festival } from '@/types/api'
import { useFestivalStore } from '@/stores/festivalStore'

const statusConfig: Record<Festival['status'], { label: string; className: string; icon: typeof Play }> = {
  DRAFT: {
    label: 'Brouillon',
    className: 'bg-gray-100 text-gray-800',
    icon: Pause,
  },
  ACTIVE: {
    label: 'Actif',
    className: 'bg-green-100 text-green-800',
    icon: Play,
  },
  COMPLETED: {
    label: 'Terminé',
    className: 'bg-blue-100 text-blue-800',
    icon: CheckCircle,
  },
  ARCHIVED: {
    label: 'Archivé',
    className: 'bg-red-100 text-red-800',
    icon: Archive,
  },
}

const navigationItems = [
  { name: 'Billets', href: 'tickets', icon: Ticket, description: 'Gérer les types de billets' },
  { name: 'Produits', href: 'products', icon: ShoppingBag, description: 'Configurer les stands et produits' },
  { name: 'Équipe', href: 'team', icon: Users, description: 'Gérer le staff et les accès' },
  { name: 'Lineup', href: 'lineup', icon: Music, description: 'Programmer les artistes' },
  { name: 'Finance', href: 'finance', icon: DollarSign, description: 'Voir les rapports financiers' },
  { name: 'Paramètres', href: 'settings', icon: Settings, description: 'Configuration du festival' },
]

interface StatCardProps {
  title: string
  value: string | number
  icon: typeof Ticket
  trend?: { value: number; label: string }
  className?: string
}

function StatCard({ title, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('rounded-lg border bg-white p-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className={cn('mt-2 flex items-center text-sm', trend.value >= 0 ? 'text-green-600' : 'text-red-600')}>
              <TrendingUp className={cn('mr-1 h-4 w-4', trend.value < 0 && 'rotate-180')} />
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  )
}

export default function FestivalDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const { currentFestival, setCurrentFestival, updateFestival } = useFestivalStore()
  const [festival, setFestival] = useState<Festival | null>(currentFestival)
  const [stats, setStats] = useState<FestivalStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadFestival()
    loadStats()
  }, [festivalId])

  const loadFestival = async () => {
    try {
      const data = await festivalsApi.get(festivalId)
      setFestival(data)
      setCurrentFestival(data)
    } catch (error) {
      console.error('Failed to load festival:', error)
      // Use store data if API fails and we have cached data for this festival
      if (currentFestival && currentFestival.id === festivalId) {
        setFestival(currentFestival)
      }
      // If no cached data, festival will remain null and error state will be shown
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await festivalsApi.getStats(festivalId)
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
      // Stats will remain null - UI should handle this gracefully
    }
  }

  const handleActivate = async () => {
    if (!festival) return
    setIsProcessing(true)
    try {
      const updated = await festivalsApi.activate(festivalId)
      setFestival(updated)
      updateFestival(festivalId, { status: 'ACTIVE' })
    } catch (error) {
      console.error('Failed to activate festival:', error)
      // Show error to user - do not silently fake success
      alert('Erreur lors de l\'activation du festival. Veuillez réessayer.')
    } finally {
      setIsProcessing(false)
      setActionMenuOpen(false)
    }
  }

  const handleComplete = async () => {
    if (!festival) return
    setIsProcessing(true)
    try {
      const updated = await festivalsApi.complete(festivalId)
      setFestival(updated)
      updateFestival(festivalId, { status: 'COMPLETED' })
    } catch (error) {
      console.error('Failed to complete festival:', error)
      // Show error to user - do not silently fake success
      alert('Erreur lors de la finalisation du festival. Veuillez réessayer.')
    } finally {
      setIsProcessing(false)
      setActionMenuOpen(false)
    }
  }

  const handleArchive = async () => {
    if (!festival) return
    setIsProcessing(true)
    try {
      const updated = await festivalsApi.archive(festivalId)
      setFestival(updated)
      updateFestival(festivalId, { status: 'ARCHIVED' })
    } catch (error) {
      console.error('Failed to archive festival:', error)
      // Show error to user - do not silently fake success
      alert('Erreur lors de l\'archivage du festival. Veuillez réessayer.')
    } finally {
      setIsProcessing(false)
      setActionMenuOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  if (!festival) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-gray-500">Festival non trouvé</p>
        <Link href="/festivals" className="mt-4 text-primary hover:underline">
          Retour à la liste
        </Link>
      </div>
    )
  }

  const statusInfo = statusConfig[festival.status]
  const StatusIcon = statusInfo.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/festivals"
            className="mt-1 rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{festival.name}</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  statusInfo.className
                )}
              >
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(festival.startDate)} - {formatDate(festival.endDate)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {festival.location}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="relative">
          <button
            onClick={() => setActionMenuOpen(!actionMenuOpen)}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            Actions rapides
            <MoreVertical className="h-4 w-4" />
          </button>

          {actionMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setActionMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                <div className="py-1">
                  {festival.status === 'DRAFT' && (
                    <button
                      onClick={handleActivate}
                      disabled={isProcessing}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Play className="h-4 w-4 text-green-600" />
                      Activer le festival
                    </button>
                  )}
                  {festival.status === 'ACTIVE' && (
                    <button
                      onClick={handleComplete}
                      disabled={isProcessing}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      Marquer comme terminé
                    </button>
                  )}
                  {festival.status !== 'ARCHIVED' && (
                    <button
                      onClick={handleArchive}
                      disabled={isProcessing}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Archive className="h-4 w-4" />
                      Archiver
                    </button>
                  )}
                  <Link
                    href={`/festivals/${festivalId}/settings`}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Settings className="h-4 w-4" />
                    Paramètres
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Billets vendus"
          value={formatNumber(stats?.ticketsSold ?? 0)}
          icon={Ticket}
          trend={{ value: 12, label: 'vs semaine dernière' }}
        />
        <StatCard
          title="Revenus totaux"
          value={formatCurrency(stats?.totalRevenue ?? 0)}
          icon={DollarSign}
          trend={{ value: 8, label: 'vs semaine dernière' }}
        />
        <StatCard
          title="Wallets créés"
          value={formatNumber(stats?.walletsCreated ?? 0)}
          icon={Wallet}
        />
        <StatCard
          title="Staff actif"
          value={stats?.activeStaff ?? 0}
          icon={Users}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">Entrées aujourd'hui</h3>
          <p className="mt-2 text-2xl font-bold">{formatNumber(stats?.todayEntries ?? 0)}</p>
          <div className="mt-3 h-2 rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.min(((stats?.todayEntries ?? 0) / (stats?.ticketsSold ?? 1)) * 100, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {Math.round(((stats?.todayEntries ?? 0) / (stats?.ticketsSold ?? 1)) * 100)}% de la capacité
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">Monnaie du festival</h3>
          <p className="mt-2 text-2xl font-bold">{festival.currencyName}</p>
          <p className="mt-2 text-sm text-gray-500">
            1 {festival.currencyName} = {festival.exchangeRate} EUR
          </p>
          <p className="text-sm text-gray-500">
            10 EUR = {Math.round(10 / festival.exchangeRate)} {festival.currencyName}
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">Utilisateurs actifs</h3>
          <p className="mt-2 text-2xl font-bold">{formatNumber(stats?.activeUsers ?? 0)}</p>
          <p className="mt-2 text-sm text-gray-500">
            Festivaliers avec wallet actif
          </p>
        </div>
      </div>

      {/* Quick Navigation */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Gestion du festival</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {navigationItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={`/festivals/${festivalId}/${item.href}`}
                className="flex items-start gap-4 rounded-lg border bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="rounded-lg bg-primary/10 p-3">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{item.description}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent Activity (placeholder) */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Activité récente</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="rounded-full bg-green-100 p-2">
              <Ticket className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-gray-900">15 nouveaux billets vendus</p>
              <p className="text-gray-500">Il y a 5 minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="rounded-full bg-blue-100 p-2">
              <Wallet className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-900">8 rechargements de wallet</p>
              <p className="text-gray-500">Il y a 12 minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="rounded-full bg-yellow-100 p-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-gray-900">Nouvel incident signalé - Zone B</p>
              <p className="text-gray-500">Il y a 23 minutes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
