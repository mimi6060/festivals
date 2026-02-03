'use client'

import * as React from 'react'
import {
  User,
  Calendar,
  Activity,
  Server,
  Globe,
  Shield,
  FileText,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
} from '@/components/ui/Modal'
import {
  AuditLog,
  getActionLabel,
  getResourceLabel,
  getActionColor,
  getSeverityLabel,
} from '@/lib/api/audit'

interface AuditLogDetailProps {
  log: AuditLog | null
  isOpen: boolean
  onClose: () => void
}

export function AuditLogDetail({ log, isOpen, onClose }: AuditLogDetailProps) {
  const [showRawData, setShowRawData] = React.useState(false)
  const [copiedField, setCopiedField] = React.useState<string | null>(null)

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (!log) return null

  const getActionBadgeClass = (action: string): string => {
    const color = getActionColor(action as any)
    const classes: Record<string, string> = {
      green: 'bg-green-100 text-green-700',
      blue: 'bg-blue-100 text-blue-700',
      red: 'bg-red-100 text-red-700',
      orange: 'bg-orange-100 text-orange-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      purple: 'bg-purple-100 text-purple-700',
      gray: 'bg-gray-100 text-gray-700',
    }
    return classes[color] || 'bg-gray-100 text-gray-700'
  }

  const getSeverityBadgeClass = (severity: string): string => {
    const classes: Record<string, string> = {
      info: 'bg-gray-100 text-gray-700',
      warning: 'bg-yellow-100 text-yellow-700',
      critical: 'bg-red-100 text-red-700',
    }
    return classes[severity] || 'bg-gray-100 text-gray-700'
  }

  const hasChanges = log.changes && log.changes.length > 0
  const hasOldNewValues = log.oldValue || log.newValue

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="lg" className="max-h-[90vh] overflow-hidden">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                getActionBadgeClass(log.action)
              )}
            >
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span>{getActionLabel(log.action)}</span>
              <span className="mx-2 text-gray-400">-</span>
              <span className="text-gray-600">{getResourceLabel(log.resource)}</span>
            </div>
          </ModalTitle>
        </ModalHeader>

        <ModalBody className="max-h-[60vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Description */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-gray-700">{log.description}</p>
            </div>

            {/* Meta Information */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Date/Time */}
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date et heure</p>
                  <p className="font-medium text-gray-900">
                    {formatDateTime(log.createdAt)}
                  </p>
                </div>
              </div>

              {/* Severity */}
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-100">
                  <Shield className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Severite</p>
                  <Badge className={getSeverityBadgeClass(log.severity)}>
                    {getSeverityLabel(log.severity)}
                  </Badge>
                </div>
              </div>

              {/* Actor */}
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
                  <User className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Utilisateur</p>
                  <p className="font-medium text-gray-900">
                    {log.actor?.name || log.actorId}
                  </p>
                  {log.actor?.email && (
                    <p className="text-sm text-gray-500">{log.actor.email}</p>
                  )}
                </div>
              </div>

              {/* Resource */}
              {log.resourceName && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                    <FileText className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Resource</p>
                    <p className="font-medium text-gray-900">{log.resourceName}</p>
                    {log.resourceId && (
                      <p className="text-xs text-gray-400 font-mono">
                        ID: {log.resourceId}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Target User (if different from actor) */}
            {log.targetUser && log.targetUserId !== log.actorId && (
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="mb-3 text-sm font-medium text-gray-700">
                  Utilisateur cible
                </h4>
                <div className="flex items-center gap-3">
                  {log.targetUser.avatarUrl ? (
                    <img
                      src={log.targetUser.avatarUrl}
                      alt={log.targetUser.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                      <User className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {log.targetUser.name}
                    </p>
                    <p className="text-sm text-gray-500">{log.targetUser.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Changes */}
            {hasChanges && (
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="mb-3 text-sm font-medium text-gray-700">
                  Modifications
                </h4>
                <div className="space-y-3">
                  {log.changes!.map((change, index) => (
                    <div
                      key={index}
                      className="rounded-lg bg-gray-50 p-3"
                    >
                      <p className="mb-2 text-sm font-medium text-gray-700">
                        {change.field}
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex-1 rounded bg-red-50 px-2 py-1 text-red-700 font-mono text-xs">
                          {String(change.oldValue ?? 'null')}
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
                        <div className="flex-1 rounded bg-green-50 px-2 py-1 text-green-700 font-mono text-xs">
                          {String(change.newValue ?? 'null')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Old/New Values (for non-structured changes) */}
            {hasOldNewValues && !hasChanges && (
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="mb-3 text-sm font-medium text-gray-700">
                  Donnees modifiees
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  {log.oldValue && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-gray-500">
                        Avant
                      </p>
                      <pre className="rounded-lg bg-red-50 p-3 text-xs text-red-700 overflow-x-auto">
                        {JSON.stringify(log.oldValue, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.newValue && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-gray-500">
                        Apres
                      </p>
                      <pre className="rounded-lg bg-green-50 p-3 text-xs text-green-700 overflow-x-auto">
                        {JSON.stringify(log.newValue, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="mb-3 text-sm font-medium text-gray-700">
                  Informations techniques
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {log.metadata.ipAddress && (
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Adresse IP</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <code className="text-sm font-mono text-gray-900">
                          {log.metadata.ipAddress}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(log.metadata!.ipAddress!, 'ip')
                          }
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          {copiedField === 'ip' ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  {log.metadata.userAgent && (
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">User Agent</span>
                      </div>
                      <code className="text-xs font-mono text-gray-900 truncate max-w-[150px]">
                        {log.metadata.userAgent}
                      </code>
                    </div>
                  )}
                  {log.metadata.sessionId && (
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Session</span>
                      </div>
                      <code className="text-xs font-mono text-gray-900 truncate max-w-[150px]">
                        {log.metadata.sessionId}
                      </code>
                    </div>
                  )}
                  {log.metadata.location && (
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Localisation</span>
                      </div>
                      <span className="text-sm text-gray-900">
                        {log.metadata.location}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Raw Data Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowRawData(!showRawData)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
              >
                {showRawData ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Voir les donnees brutes
              </button>
              {showRawData && (
                <div className="mt-3 rounded-lg bg-gray-900 p-4">
                  <pre className="text-xs text-gray-300 overflow-x-auto">
                    {JSON.stringify(log, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default AuditLogDetail
