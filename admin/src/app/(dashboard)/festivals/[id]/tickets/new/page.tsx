'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ticketsApi, type CreateTicketTypeInput, type TicketTypeSettings } from '@/lib/api/tickets'

const defaultSettings: TicketTypeSettings = {
  allowReentry: true,
  initialTopUpAmount: 0,
  transferable: true,
  transferDeadline: null,
  maxTransfers: 1,
  requiresId: false,
}

export default function NewTicketTypePage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [isUnlimited, setIsUnlimited] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [benefits, setBenefits] = useState<string[]>([])
  const [newBenefit, setNewBenefit] = useState('')
  const [settings, setSettings] = useState<TicketTypeSettings>(defaultSettings)
  const [useTransferDeadline, setUseTransferDeadline] = useState(false)

  const handleAddBenefit = () => {
    if (newBenefit.trim()) {
      setBenefits([...benefits, newBenefit.trim()])
      setNewBenefit('')
    }
  }

  const handleRemoveBenefit = (index: number) => {
    setBenefits(benefits.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }
    if (!price || parseFloat(price) < 0) {
      setError('Le prix doit etre positif')
      return
    }
    if (!isUnlimited && (!quantity || parseInt(quantity) <= 0)) {
      setError('La quantite doit etre positive')
      return
    }
    if (!validFrom || !validUntil) {
      setError('Les dates de validite sont requises')
      return
    }

    setLoading(true)

    try {
      const data: CreateTicketTypeInput = {
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        quantity: isUnlimited ? null : parseInt(quantity),
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        benefits,
        settings: {
          ...settings,
          transferDeadline: useTransferDeadline && settings.transferDeadline
            ? new Date(settings.transferDeadline).toISOString()
            : null,
        },
      }

      // const ticketType = await ticketsApi.createTicketType(festivalId, data)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      router.push(`/festivals/${festivalId}/tickets`)
    } catch (err) {
      console.error('Failed to create ticket type:', err)
      setError('Une erreur est survenue lors de la creation du type de billet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/festivals/${festivalId}/tickets`}
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau type de billet</h1>
          <p className="text-gray-500">Creez un nouveau type de billet pour votre festival</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Informations generales</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nom du billet *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pass 3 Jours, Pass VIP, Pass Journee..."
                className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Decrivez ce que comprend ce type de billet..."
                className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Prix (EUR) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Quantite disponible
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={isUnlimited}
                    placeholder="0"
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                      isUnlimited && 'bg-gray-50 text-gray-400'
                    )}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isUnlimited}
                      onChange={(e) => setIsUnlimited(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    Illimite
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validity Period */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Periode de validite</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Valide a partir de *
              </label>
              <input
                type="datetime-local"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Valide jusqu au *
              </label>
              <input
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Avantages inclus</h2>

          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newBenefit}
                onChange={(e) => setNewBenefit(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBenefit())}
                placeholder="Ajouter un avantage..."
                className="flex-1 rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleAddBenefit}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
            </div>

            {benefits.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {benefits.map((benefit, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                  >
                    {benefit}
                    <button
                      type="button"
                      onClick={() => handleRemoveBenefit(index)}
                      className="ml-1 rounded-full p-0.5 hover:bg-primary/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Aucun avantage ajoute</p>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Parametres</h2>

          <div className="space-y-6">
            {/* Reentry */}
            <div className="flex items-start justify-between">
              <div>
                <label className="font-medium text-gray-700">Re-entree autorisee</label>
                <p className="text-sm text-gray-500">
                  Les detenteurs peuvent sortir et re-entrer dans le festival
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.allowReentry}
                  onChange={(e) => setSettings({ ...settings, allowReentry: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20" />
              </label>
            </div>

            {/* Initial Top-up */}
            <div>
              <label className="font-medium text-gray-700">Montant top-up initial</label>
              <p className="mb-2 text-sm text-gray-500">
                Solde cashless offert avec ce type de billet
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.initialTopUpAmount}
                  onChange={(e) =>
                    setSettings({ ...settings, initialTopUpAmount: parseFloat(e.target.value) || 0 })
                  }
                  className="w-32 rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-gray-500">EUR</span>
              </div>
            </div>

            {/* Transfer Settings */}
            <div className="border-t pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <label className="font-medium text-gray-700">Transfert autorise</label>
                  <p className="text-sm text-gray-500">
                    Les billets peuvent etre transferes a une autre personne
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.transferable}
                    onChange={(e) => setSettings({ ...settings, transferable: e.target.checked })}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20" />
                </label>
              </div>

              {settings.transferable && (
                <div className="mt-4 space-y-4 rounded-lg bg-gray-50 p-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Nombre maximum de transferts
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.maxTransfers}
                      onChange={(e) =>
                        setSettings({ ...settings, maxTransfers: parseInt(e.target.value) || 1 })
                      }
                      className="w-32 rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={useTransferDeadline}
                        onChange={(e) => setUseTransferDeadline(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      Date limite de transfert
                    </label>
                    {useTransferDeadline && (
                      <input
                        type="datetime-local"
                        value={settings.transferDeadline || ''}
                        onChange={(e) =>
                          setSettings({ ...settings, transferDeadline: e.target.value })
                        }
                        className="mt-2 w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ID Required */}
            <div className="flex items-start justify-between border-t pt-6">
              <div>
                <label className="font-medium text-gray-700">Piece d identite requise</label>
                <p className="text-sm text-gray-500">
                  Une verification d identite sera demandee a l entree
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.requiresId}
                  onChange={(e) => setSettings({ ...settings, requiresId: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20" />
              </label>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">Bon a savoir</p>
            <p className="mt-1">
              Vous pourrez modifier ces parametres tant qu aucun billet n aura ete vendu.
              Apres la premiere vente, seuls certains parametres resteront modifiables.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href={`/festivals/${festivalId}/tickets`}
            className="rounded-lg border px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </Link>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={loading}
            className="rounded-lg border bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Enregistrer comme brouillon
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Creation...' : 'Creer et mettre en vente'}
          </button>
        </div>
      </form>
    </div>
  )
}
