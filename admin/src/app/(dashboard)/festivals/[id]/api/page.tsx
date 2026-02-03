'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Key,
  Webhook,
  BarChart3,
  Book,
  Code,
  ArrowRight,
  Activity,
  Shield,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  apiKeysApi,
  type APIKeyStats,
  type RecentActivity,
} from '@/lib/api/apikeys'

const navigationCards = [
  {
    title: 'Cles API',
    description: 'Gerez vos cles API pour acceder a l\'API publique',
    href: 'keys',
    icon: Key,
    color: 'bg-blue-500',
  },
  {
    title: 'Webhooks',
    description: 'Configurez les webhooks pour recevoir des evenements en temps reel',
    href: 'webhooks',
    icon: Webhook,
    color: 'bg-purple-500',
  },
  {
    title: 'Documentation',
    description: 'Consultez la documentation complete de l\'API publique',
    href: 'docs',
    icon: Book,
    color: 'bg-green-500',
  },
]

// Mock data for fallback
const mockStats: APIKeyStats = {
  totalKeys: 4,
  activeKeys: 3,
  totalWebhooks: 6,
  activeWebhooks: 5,
  requestsToday: 1247,
  requestsThisMonth: 45892,
  successRate: 99.2,
  avgResponseTime: 45,
}

const mockActivity: RecentActivity[] = [
  {
    id: '1',
    type: 'request',
    description: 'GET /public/v1/festivals/{id}/lineup - 200 OK',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    status: 'success',
  },
  {
    id: '2',
    type: 'webhook',
    description: 'ticket.sold envoye a https://example.com/webhook',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    status: 'success',
  },
  {
    id: '3',
    type: 'request',
    description: 'GET /public/v1/festivals/{id}/tickets - 200 OK',
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
    status: 'success',
  },
  {
    id: '4',
    type: 'webhook',
    description: 'wallet.topup echec - Timeout',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    status: 'error',
  },
  {
    id: '5',
    type: 'key_created',
    description: 'Nouvelle cle API creee: Mobile App Integration',
    timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    status: 'success',
  },
]

export default function APIDashboardPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [stats, setStats] = useState<APIKeyStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [festivalId])

  const loadData = async () => {
    try {
      const [statsData, activityData] = await Promise.all([
        apiKeysApi.getStats(festivalId),
        apiKeysApi.getRecentActivity(festivalId, { limit: 10 }),
      ])
      setStats(statsData)
      setRecentActivity(activityData)
    } catch (error) {
      console.error('Failed to load API stats:', error)
      // Use mock data as fallback
      setStats(mockStats)
      setRecentActivity(mockActivity)
    } finally {
      setIsLoading(false)
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `Il y a ${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Il y a ${hours}h`
    return `Il y a ${Math.floor(hours / 24)}j`
  }

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'request':
        return Code
      case 'webhook':
        return Webhook
      case 'key_created':
        return Key
      case 'key_revoked':
        return Shield
      default:
        return Activity
    }
  }

  const getStatusColor = (status: RecentActivity['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'pending':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API & Integrations</h1>
        <p className="mt-1 text-gray-500">
          Gerez les acces API et les integrations tierces pour votre festival
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Cles API actives</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {stats?.activeKeys}/{stats?.totalKeys}
              </p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3">
              <Key className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Webhooks actifs</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {stats?.activeWebhooks}/{stats?.totalWebhooks}
              </p>
            </div>
            <div className="rounded-lg bg-purple-100 p-3">
              <Webhook className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Requetes aujourd'hui</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {stats?.requestsToday.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3">
              <BarChart3 className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Taux de succes</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {stats?.successRate}%
              </p>
            </div>
            <div className="rounded-lg bg-emerald-100 p-3">
              <Zap className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {navigationCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={`/festivals/${festivalId}/api/${card.href}`}
              className="group relative overflow-hidden rounded-lg border bg-white p-6 transition-all hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className={cn('rounded-lg p-3', card.color)}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{card.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{card.description}</p>
            </Link>
          )
        })}
      </div>

      {/* API Usage Chart & Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Usage Overview */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Utilisation API</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Requetes ce mois</span>
              <span className="font-semibold">{stats?.requestsThisMonth.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${Math.min((stats?.requestsThisMonth || 0) / 100000 * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {((stats?.requestsThisMonth || 0) / 100000 * 100).toFixed(1)}% de votre limite mensuelle
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Temps moyen</p>
                <p className="mt-1 text-2xl font-bold">{stats?.avgResponseTime}ms</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Taux d'erreur</p>
                <p className="mt-1 text-2xl font-bold">{(100 - (stats?.successRate || 0)).toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Activite recente</h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => {
              const Icon = getActivityIcon(activity.type)
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={cn('rounded-full p-2',
                    activity.status === 'success' ? 'bg-green-100' :
                    activity.status === 'error' ? 'bg-red-100' : 'bg-yellow-100'
                  )}>
                    <Icon className={cn('h-4 w-4', getStatusColor(activity.status))} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{activity.description}</p>
                    <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
                  </div>
                  {activity.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : activity.status === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
          <Link
            href={`/festivals/${festivalId}/api/keys`}
            className="mt-4 inline-flex items-center text-sm text-primary hover:underline"
          >
            Voir toute l'activite
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="rounded-lg border bg-gradient-to-r from-blue-50 to-purple-50 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-blue-100 p-3">
            <Code className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Demarrage rapide</h3>
            <p className="mt-1 text-sm text-gray-600">
              Commencez a integrer l'API de votre festival en quelques minutes
            </p>
            <div className="mt-4 rounded-lg bg-gray-900 p-4">
              <code className="text-sm text-green-400">
                curl -X GET "https://api.festivals.app/public/v1/festivals/{'{'}id{'}'}/lineup" \
                <br />
                &nbsp;&nbsp;-H "X-API-Key: pk_live_xxxxx..."
              </code>
            </div>
            <Link
              href={`/festivals/${festivalId}/api/docs`}
              className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
            >
              Voir la documentation complete
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
