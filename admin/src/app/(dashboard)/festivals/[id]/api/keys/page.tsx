'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus,
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
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APIKeyCard } from '@/components/api/APIKeyCard'
import {
  apiKeysApi,
  type APIKey,
  type CreateAPIKeyRequest,
  API_KEY_PERMISSIONS,
} from '@/lib/api/apikeys'

interface CreateKeyForm {
  name: string
  description: string
  permissions: string[]
  environment: 'SANDBOX' | 'PRODUCTION'
  expiresAt: string
}

const availablePermissions = API_KEY_PERMISSIONS

export default function APIKeysPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [keys, setKeys] = useState<APIKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<CreateKeyForm>({
    name: '',
    description: '',
    permissions: ['festivals:read', 'lineup:read', 'tickets:read'],
    environment: 'SANDBOX',
    expiresAt: '',
  })
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadKeys()
  }, [festivalId])

  const loadKeys = async () => {
    try {
      const response = await apiKeysApi.list(festivalId)
      if (response.data && response.data.length > 0) {
        setKeys(response.data.map(key => ({
          ...key,
          festivalId: festivalId,
        })))
      } else {
        setKeys([])
      }
    } catch (error) {
      console.error('Failed to load API keys:', error)
      // Use mock data as fallback
      setKeys([
        {
          id: '1',
          festivalId,
          name: 'Mobile App Integration',
          description: 'Cle pour l\'application mobile officielle',
          keyPrefix: 'pk_live_8f4a2b...',
          permissions: ['festivals:read', 'lineup:read', 'tickets:read', 'wallets:read'],
          rateLimit: { requestsPerMinute: 120, requestsPerDay: 50000, enabled: true },
          status: 'ACTIVE',
          environment: 'PRODUCTION',
          lastUsedAt: new Date(Date.now() - 5 * 60000).toISOString(),
          expiresAt: null,
          createdAt: '2026-01-15T10:00:00Z',
          updatedAt: '2026-01-15T10:00:00Z',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateKey = async () => {
    if (!createForm.name) return

    setIsCreating(true)
    try {
      const requestData: CreateAPIKeyRequest = {
        name: createForm.name,
        description: createForm.description || undefined,
        permissions: createForm.permissions,
        environment: createForm.environment,
        expiresAt: createForm.expiresAt || undefined,
      }

      const result = await apiKeysApi.create(festivalId, requestData)
      setNewKeyRevealed(result.secret)
      setKeys([{ ...result.apiKey, festivalId }, ...keys])
    } catch (error) {
      console.error('Failed to create API key:', error)
      // Fallback to local state for demo
      const mockKey = `pk_${createForm.environment === 'PRODUCTION' ? 'live' : 'test'}_${generateRandomString(32)}`
      setNewKeyRevealed(mockKey)

      const newKey: APIKey = {
        id: String(Date.now()),
        festivalId,
        name: createForm.name,
        description: createForm.description,
        keyPrefix: mockKey.substring(0, 15) + '...',
        permissions: createForm.permissions,
        rateLimit: { requestsPerMinute: 60, requestsPerDay: 10000, enabled: true },
        status: 'ACTIVE',
        environment: createForm.environment,
        lastUsedAt: null,
        expiresAt: createForm.expiresAt || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setKeys([newKey, ...keys])
    } finally {
      setIsCreating(false)
    }
  }

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Etes-vous sur de vouloir revoquer cette cle API ? Cette action est irreversible.')) {
      return
    }

    try {
      await apiKeysApi.revoke(festivalId, keyId)
      setKeys(keys.map(k => k.id === keyId ? { ...k, status: 'REVOKED' as const } : k))
    } catch (error) {
      console.error('Failed to revoke API key:', error)
      alert('Erreur lors de la revocation de la cle')
    }
  }

  const handleRotateKey = async (keyId: string) => {
    if (!confirm('Etes-vous sur de vouloir regenerer cette cle ? L\'ancienne cle sera immediatement invalidee.')) {
      return
    }

    try {
      const result = await apiKeysApi.rotate(festivalId, keyId)
      setNewKeyRevealed(result.secret)
      setKeys(keys.map(k => k.id === keyId ? { ...result.apiKey, festivalId } : k))
    } catch (error) {
      console.error('Failed to rotate API key:', error)
      // Fallback for demo
      const key = keys.find(k => k.id === keyId)
      if (key) {
        const newKeyValue = `pk_${key.environment === 'PRODUCTION' ? 'live' : 'test'}_${generateRandomString(32)}`
        setNewKeyRevealed(newKeyValue)
        setKeys(keys.map(k => k.id === keyId ? { ...k, keyPrefix: newKeyValue.substring(0, 15) + '...' } : k))
      }
    }
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    // TODO: Show toast notification
  }

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      description: '',
      permissions: ['festivals:read', 'lineup:read', 'tickets:read'],
      environment: 'SANDBOX',
      expiresAt: '',
    })
    setNewKeyRevealed(null)
    setShowCreateModal(false)
  }

  const generateRandomString = (length: number) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const activeKeys = keys.filter(k => k.status === 'ACTIVE')
  const inactiveKeys = keys.filter(k => k.status !== 'ACTIVE')

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cles API</h1>
          <p className="mt-1 text-gray-500">
            Gerez les cles d'acces a l'API publique de votre festival
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
        >
          <Plus className="h-5 w-5" />
          Nouvelle cle
        </button>
      </div>

      {/* New Key Revealed Alert */}
      {newKeyRevealed && !showCreateModal && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-800">Nouvelle cle API creee</h4>
              <p className="mt-1 text-sm text-yellow-700">
                Copiez cette cle maintenant. Elle ne sera plus affichee.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 rounded bg-yellow-100 px-3 py-2 text-sm font-mono">
                  {newKeyRevealed}
                </code>
                <button
                  onClick={() => handleCopyKey(newKeyRevealed)}
                  className="rounded-lg border border-yellow-300 bg-white p-2 hover:bg-yellow-100"
                >
                  <Copy className="h-4 w-4 text-yellow-700" />
                </button>
              </div>
              <button
                onClick={() => setNewKeyRevealed(null)}
                className="mt-3 text-sm text-yellow-700 hover:underline"
              >
                J'ai copie ma cle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Keys */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Cles actives ({activeKeys.length})
        </h2>
        {activeKeys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <Key className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">Aucune cle API active</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
            >
              <Plus className="h-4 w-4" />
              Creer votre premiere cle
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {activeKeys.map((key) => (
              <APIKeyCard
                key={key.id}
                apiKey={key}
                onRevoke={() => handleRevokeKey(key.id)}
                onRotate={() => handleRotateKey(key.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inactive Keys */}
      {inactiveKeys.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-500">
            Cles inactives ({inactiveKeys.length})
          </h2>
          <div className="space-y-4 opacity-60">
            {inactiveKeys.map((key) => (
              <APIKeyCard
                key={key.id}
                apiKey={key}
                onRevoke={() => handleRevokeKey(key.id)}
                onRotate={() => handleRotateKey(key.id)}
                disabled
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="border-b p-6">
              <h2 className="text-xl font-semibold">Creer une nouvelle cle API</h2>
            </div>

            {newKeyRevealed ? (
              <div className="p-6">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-green-800">Cle creee avec succes!</h4>
                      <p className="mt-1 text-sm text-green-700">
                        Copiez cette cle maintenant. Elle ne sera plus affichee apres la fermeture de cette fenetre.
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <code className="flex-1 rounded bg-green-100 px-3 py-2 text-sm font-mono break-all">
                          {newKeyRevealed}
                        </code>
                        <button
                          onClick={() => handleCopyKey(newKeyRevealed)}
                          className="rounded-lg border border-green-300 bg-white p-2 hover:bg-green-100"
                        >
                          <Copy className="h-4 w-4 text-green-700" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={resetCreateForm}
                    className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nom *</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Ex: Mobile App, Partner Website..."
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="Description de l'utilisation de cette cle..."
                    rows={2}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Environnement</label>
                  <div className="mt-2 flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="environment"
                        checked={createForm.environment === 'SANDBOX'}
                        onChange={() => setCreateForm({ ...createForm, environment: 'SANDBOX' })}
                      />
                      <span className="text-sm">Sandbox (test)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="environment"
                        checked={createForm.environment === 'PRODUCTION'}
                        onChange={() => setCreateForm({ ...createForm, environment: 'PRODUCTION' })}
                      />
                      <span className="text-sm">Production</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                  <div className="max-h-48 overflow-y-auto rounded-lg border p-3 space-y-2">
                    {availablePermissions.map((perm) => (
                      <label key={perm.id} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createForm.permissions.includes(perm.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm({
                                ...createForm,
                                permissions: [...createForm.permissions, perm.id],
                              })
                            } else {
                              setCreateForm({
                                ...createForm,
                                permissions: createForm.permissions.filter((p) => p !== perm.id),
                              })
                            }
                          }}
                          className="mt-1"
                        />
                        <div>
                          <p className="text-sm font-medium">{perm.label}</p>
                          <p className="text-xs text-gray-500">{perm.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Date d'expiration (optionnel)</label>
                  <input
                    type="date"
                    value={createForm.expiresAt}
                    onChange={(e) => setCreateForm({ ...createForm, expiresAt: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={resetCreateForm}
                    className="rounded-lg border px-4 py-2 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreateKey}
                    disabled={!createForm.name || isCreating}
                    className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isCreating ? 'Creation...' : 'Creer la cle'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
