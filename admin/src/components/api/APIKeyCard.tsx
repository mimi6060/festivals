'use client'

import { useState } from 'react'
import {
  Key,
  Copy,
  Eye,
  EyeOff,
  MoreVertical,
  RefreshCw,
  Trash2,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface APIKey {
  id: string
  name: string
  description: string
  keyPrefix: string
  permissions: string[]
  rateLimit: {
    requestsPerMinute: number
    requestsPerDay: number
    enabled: boolean
  }
  status: 'ACTIVE' | 'INACTIVE' | 'REVOKED' | 'EXPIRED'
  environment: 'SANDBOX' | 'PRODUCTION'
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface APIKeyCardProps {
  apiKey: APIKey
  onRevoke: () => void
  onRotate: () => void
  disabled?: boolean
}

const statusConfig = {
  ACTIVE: { label: 'Actif', className: 'bg-green-100 text-green-800', icon: CheckCircle },
  INACTIVE: { label: 'Inactif', className: 'bg-gray-100 text-gray-800', icon: XCircle },
  REVOKED: { label: 'Revoque', className: 'bg-red-100 text-red-800', icon: XCircle },
  EXPIRED: { label: 'Expire', className: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
}

const permissionLabels: Record<string, string> = {
  'festivals:read': 'Festivals (lecture)',
  'lineup:read': 'Lineup (lecture)',
  'tickets:read': 'Billets (lecture)',
  'tickets:write': 'Billets (ecriture)',
  'wallets:read': 'Wallets (lecture)',
  'wallets:write': 'Wallets (ecriture)',
  'stats:read': 'Statistiques (lecture)',
  'webhooks:manage': 'Webhooks (gestion)',
  '*': 'Toutes permissions',
}

export function APIKeyCard({ apiKey, onRevoke, onRotate, disabled }: APIKeyCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  const status = statusConfig[apiKey.status]
  const StatusIcon = status.icon

  const handleCopyPrefix = () => {
    navigator.clipboard.writeText(apiKey.keyPrefix)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Jamais'
    const diff = Date.now() - new Date(dateString).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `Il y a ${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Il y a ${hours}h`
    const days = Math.floor(hours / 24)
    return `Il y a ${days}j`
  }

  return (
    <div className={cn(
      'rounded-lg border bg-white p-4',
      disabled && 'opacity-60'
    )}>
      <div className="flex items-start justify-between">
        {/* Key Info */}
        <div className="flex items-start gap-4">
          <div className={cn(
            'rounded-lg p-2',
            apiKey.environment === 'PRODUCTION' ? 'bg-green-100' : 'bg-yellow-100'
          )}>
            <Key className={cn(
              'h-5 w-5',
              apiKey.environment === 'PRODUCTION' ? 'text-green-600' : 'text-yellow-600'
            )} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">{apiKey.name}</h3>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                status.className
              )}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                apiKey.environment === 'PRODUCTION'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-yellow-50 text-yellow-700'
              )}>
                {apiKey.environment === 'PRODUCTION' ? 'Production' : 'Sandbox'}
              </span>
            </div>

            {apiKey.description && (
              <p className="mt-1 text-sm text-gray-500">{apiKey.description}</p>
            )}

            {/* Key Prefix */}
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-600">
                {apiKey.keyPrefix}
              </code>
              <button
                onClick={handleCopyPrefix}
                className="text-gray-400 hover:text-gray-600"
                title="Copier le prefixe"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Permissions */}
            <div className="mt-3 flex flex-wrap gap-1">
              {apiKey.permissions.slice(0, 4).map((perm) => (
                <span
                  key={perm}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {permissionLabels[perm] || perm}
                </span>
              ))}
              {apiKey.permissions.length > 4 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  +{apiKey.permissions.length - 4} autres
                </span>
              )}
            </div>

            {/* Meta Info */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Derniere utilisation: {formatTimeAgo(apiKey.lastUsedAt)}
              </span>
              <span>Cree le {formatDate(apiKey.createdAt)}</span>
              {apiKey.expiresAt && (
                <span className="text-yellow-600">
                  Expire le {formatDate(apiKey.expiresAt)}
                </span>
              )}
            </div>

            {/* Rate Limit */}
            {apiKey.rateLimit.enabled && (
              <div className="mt-2 text-xs text-gray-400">
                Limite: {apiKey.rateLimit.requestsPerMinute}/min, {apiKey.rateLimit.requestsPerDay.toLocaleString()}/jour
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={disabled}
            className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50"
          >
            <MoreVertical className="h-5 w-5 text-gray-400" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                <div className="py-1">
                  {apiKey.status === 'ACTIVE' && (
                    <>
                      <button
                        onClick={() => {
                          setShowMenu(false)
                          onRotate()
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Regenerer la cle
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false)
                          onRevoke()
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        Revoquer
                      </button>
                    </>
                  )}
                  {apiKey.status !== 'ACTIVE' && (
                    <p className="px-4 py-2 text-sm text-gray-500">
                      Aucune action disponible
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
