'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WebhookConfig {
  id?: string
  url: string
  description: string
  events: string[]
  status?: 'ACTIVE' | 'INACTIVE' | 'FAILING' | 'DISABLED'
  headers?: Record<string, string>
}

interface WebhookEvent {
  id: string
  label: string
  description: string
}

interface WebhookEditorProps {
  webhook: WebhookConfig | null
  events: WebhookEvent[]
  onSave: (data: Partial<WebhookConfig>) => void
  onClose: () => void
}

export function WebhookEditor({ webhook, events, onSave, onClose }: WebhookEditorProps) {
  const [formData, setFormData] = useState<Partial<WebhookConfig>>({
    url: '',
    description: '',
    events: [],
    headers: {},
  })
  const [customHeaders, setCustomHeaders] = useState<{ key: string; value: string }[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (webhook) {
      setFormData({
        url: webhook.url,
        description: webhook.description,
        events: webhook.events,
        headers: webhook.headers || {},
      })
      if (webhook.headers) {
        setCustomHeaders(
          Object.entries(webhook.headers).map(([key, value]) => ({ key, value }))
        )
      }
    }
  }, [webhook])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.url) {
      newErrors.url = 'L\'URL est requise'
    } else {
      try {
        new URL(formData.url)
      } catch {
        newErrors.url = 'URL invalide'
      }
    }

    if (!formData.events || formData.events.length === 0) {
      newErrors.events = 'Selectionnez au moins un evenement'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsSaving(true)
    try {
      // Convert custom headers array to object
      const headers: Record<string, string> = {}
      customHeaders.forEach(({ key, value }) => {
        if (key.trim()) {
          headers[key.trim()] = value
        }
      })

      await onSave({
        ...formData,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleEvent = (eventId: string) => {
    const currentEvents = formData.events || []
    if (currentEvents.includes(eventId)) {
      setFormData({
        ...formData,
        events: currentEvents.filter((e) => e !== eventId),
      })
    } else {
      setFormData({
        ...formData,
        events: [...currentEvents, eventId],
      })
    }
  }

  const addHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }])
  }

  const removeHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index))
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders]
    updated[index][field] = value
    setCustomHeaders(updated)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-6">
          <h2 className="text-xl font-semibold">
            {webhook ? 'Modifier le webhook' : 'Creer un nouveau webhook'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
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
                'mt-1 w-full rounded-lg border px-3 py-2',
                errors.url && 'border-red-500'
              )}
            />
            {errors.url && (
              <p className="mt-1 text-sm text-red-500">{errors.url}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              L'URL qui recevra les evenements POST
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
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>

          {/* Events */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evenements a ecouter *
            </label>
            {errors.events && (
              <p className="mb-2 text-sm text-red-500">{errors.events}</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {events.map((event) => (
                <label
                  key={event.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                    formData.events?.includes(event.id)
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-gray-50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={formData.events?.includes(event.id) || false}
                    onChange={() => toggleEvent(event.id)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{event.label}</p>
                    <p className="text-xs text-gray-500">{event.description}</p>
                    <code className="text-xs text-gray-400">{event.id}</code>
                  </div>
                </label>
              ))}
            </div>
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
            {customHeaders.length === 0 ? (
              <p className="text-sm text-gray-500">
                Aucun en-tete personnalise. Cliquez sur "Ajouter" pour en creer.
              </p>
            ) : (
              <div className="space-y-2">
                {customHeaders.map((header, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      placeholder="Nom de l'en-tete"
                      className="flex-1 rounded-lg border px-3 py-2 text-sm"
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
              pour verifier l'authenticite.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white p-6">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Enregistrement...' : webhook ? 'Modifier' : 'Creer'}
          </button>
        </div>
      </div>
    </div>
  )
}
