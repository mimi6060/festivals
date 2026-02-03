'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Eye, EyeOff, Copy, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WebhookEventSelector } from './WebhookEventSelector'
import type { Webhook, CreateWebhookInput, UpdateWebhookInput } from '@/lib/api/webhooks'

interface WebhookFormProps {
  webhook?: Webhook | null
  onSave: (data: CreateWebhookInput | UpdateWebhookInput) => Promise<void>
  onClose: () => void
  newSecret?: string | null
  onSecretAcknowledged?: () => void
}

export function WebhookForm({
  webhook,
  onSave,
  onClose,
  newSecret,
  onSecretAcknowledged,
}: WebhookFormProps) {
  const [formData, setFormData] = useState<{
    url: string
    description: string
    events: string[]
    headers: { key: string; value: string }[]
  }>({
    url: '',
    description: '',
    events: [],
    headers: [],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)

  const isEditing = !!webhook

  useEffect(() => {
    if (webhook) {
      setFormData({
        url: webhook.url,
        description: webhook.description || '',
        events: webhook.events,
        headers: webhook.headers
          ? Object.entries(webhook.headers).map(([key, value]) => ({ key, value }))
          : [],
      })
    }
  }, [webhook])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.url.trim()) {
      newErrors.url = 'L\'URL est requise'
    } else {
      try {
        const url = new URL(formData.url)
        if (!['http:', 'https:'].includes(url.protocol)) {
          newErrors.url = 'L\'URL doit utiliser HTTP ou HTTPS'
        }
      } catch {
        newErrors.url = 'URL invalide'
      }
    }

    if (formData.events.length === 0) {
      newErrors.events = 'Selectionnez au moins un evenement'
    }

    // Validate headers
    const headerKeys = new Set<string>()
    formData.headers.forEach((header, index) => {
      if (header.key.trim() && headerKeys.has(header.key.trim().toLowerCase())) {
        newErrors[`header_${index}`] = 'Nom d\'en-tete en double'
      }
      if (header.key.trim()) {
        headerKeys.add(header.key.trim().toLowerCase())
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSaving(true)
    try {
      const headers: Record<string, string> = {}
      formData.headers.forEach(({ key, value }) => {
        if (key.trim()) {
          headers[key.trim()] = value
        }
      })

      const data: CreateWebhookInput | UpdateWebhookInput = {
        url: formData.url.trim(),
        description: formData.description.trim() || undefined,
        events: formData.events,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      }

      await onSave(data)
    } finally {
      setIsSaving(false)
    }
  }

  const addHeader = () => {
    setFormData({
      ...formData,
      headers: [...formData.headers, { key: '', value: '' }],
    })
  }

  const removeHeader = (index: number) => {
    setFormData({
      ...formData,
      headers: formData.headers.filter((_, i) => i !== index),
    })
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...formData.headers]
    updated[index][field] = value
    setFormData({ ...formData, headers: updated })
  }

  const copySecret = async () => {
    if (!newSecret) return
    await navigator.clipboard.writeText(newSecret)
    setSecretCopied(true)
    setTimeout(() => setSecretCopied(false), 2000)
  }

  // Show secret acknowledgement screen after creation
  if (newSecret && !isEditing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
          <div className="border-b p-6">
            <h2 className="text-xl font-semibold text-green-700">Webhook cree avec succes</h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-yellow-800">Secret de signature</h4>
                  <p className="mt-1 text-sm text-yellow-700">
                    Copiez ce secret maintenant. Il ne sera plus jamais affiche.
                    Utilisez-le pour verifier la signature des webhooks.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Secret de signature HMAC-SHA256
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={newSecret}
                    readOnly
                    className="w-full rounded-lg border bg-gray-50 px-3 py-2 pr-20 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {secretCopied && (
                <p className="text-sm text-green-600">Copie dans le presse-papiers!</p>
              )}
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <h4 className="font-medium text-blue-900 mb-2">Comment verifier la signature</h4>
              <p className="text-sm text-blue-800 mb-2">
                Chaque requete webhook inclut un en-tete <code className="bg-blue-100 px-1 rounded">X-Webhook-Signature</code>.
              </p>
              <pre className="text-xs bg-blue-100 p-2 rounded overflow-x-auto">
{`const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from('sha256=' + expected)
  );
}`}
              </pre>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t p-6">
            <button
              onClick={onSecretAcknowledged}
              className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
            >
              J'ai copie le secret
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-6">
          <h2 className="text-xl font-semibold">
            {isEditing ? 'Modifier le webhook' : 'Creer un nouveau webhook'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                URL du webhook *
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com/webhooks/receive"
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                  errors.url && 'border-red-500'
                )}
              />
              {errors.url && (
                <p className="mt-1 text-sm text-red-500">{errors.url}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                L'URL HTTPS qui recevra les evenements POST
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description de l'utilisation de ce webhook..."
                rows={2}
                className="mt-1 w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Events */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Evenements a ecouter *
              </label>
              <WebhookEventSelector
                selectedEvents={formData.events}
                onChange={(events) => setFormData({ ...formData, events })}
                error={errors.events}
              />
            </div>

            {/* Custom Headers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  En-tetes personnalises
                </label>
                <button
                  type="button"
                  onClick={addHeader}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter
                </button>
              </div>
              {formData.headers.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Aucun en-tete personnalise. Cliquez sur "Ajouter" pour en creer.
                </p>
              ) : (
                <div className="space-y-2">
                  {formData.headers.map((header, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={header.key}
                        onChange={(e) => updateHeader(index, 'key', e.target.value)}
                        placeholder="Nom de l'en-tete"
                        className={cn(
                          'flex-1 rounded-lg border px-3 py-2 text-sm',
                          errors[`header_${index}`] && 'border-red-500'
                        )}
                      />
                      <input
                        type="text"
                        value={header.value}
                        onChange={(e) => updateHeader(index, 'value', e.target.value)}
                        placeholder="Valeur"
                        className="flex-1 rounded-lg border px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeHeader(index)}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Ces en-tetes seront inclus dans chaque requete webhook
              </p>
            </div>

            {/* Signature Info */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <h4 className="font-medium text-blue-900 mb-2">Signature de securite</h4>
              <p className="text-sm text-blue-800">
                Chaque requete webhook inclura une signature HMAC-SHA256 dans l'en-tete
                <code className="mx-1 bg-blue-100 px-1 rounded">X-Webhook-Signature</code>
                pour verifier l'authenticite. {isEditing ? 'Le secret existant reste inchange.' : 'Un secret sera genere a la creation.'}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white p-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : isEditing ? 'Modifier' : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
