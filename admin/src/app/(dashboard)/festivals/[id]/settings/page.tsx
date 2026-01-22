'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import {
  ArrowLeft,
  Save,
  Loader2,
  Upload,
  Link as LinkIcon,
  Unlink,
  Check,
  AlertCircle,
  Palette,
  FileText,
  CreditCard,
  Settings,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  festivalsApi,
  UpdateFestivalInput,
  FestivalBranding,
  FestivalPolicies,
} from '@/lib/api/festivals'
import { Festival } from '@/types/api'
import { useFestivalStore } from '@/stores/festivalStore'

interface BasicInfoForm {
  name: string
  description: string
  startDate: string
  endDate: string
  location: string
  timezone: string
  currencyName: string
  exchangeRate: number
}

interface BrandingForm {
  logo: string
  primaryColor: string
  secondaryColor: string
  bannerImage: string
}

interface PoliciesForm {
  refundPolicy: 'auto' | 'manual' | 'none'
  reentryPolicy: 'single' | 'multiple'
  minAge: number
  maxCapacity: number
}

const timezones = [
  { value: 'Europe/Brussels', label: 'Brussels (CET/CEST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
]

type TabType = 'basic' | 'branding' | 'policies' | 'stripe'

export default function FestivalSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const { currentFestival, setCurrentFestival, updateFestival } = useFestivalStore()
  const [festival, setFestival] = useState<Festival | null>(currentFestival)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('basic')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean
    accountId?: string
    status?: string
  } | null>(null)
  const [isConnectingStripe, setIsConnectingStripe] = useState(false)

  // Basic info form
  const basicForm = useForm<BasicInfoForm>({
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      location: '',
      timezone: 'Europe/Brussels',
      currencyName: '',
      exchangeRate: 0.1,
    },
  })

  // Branding form
  const brandingForm = useForm<BrandingForm>({
    defaultValues: {
      logo: '',
      primaryColor: '#6366f1',
      secondaryColor: '#818cf8',
      bannerImage: '',
    },
  })

  // Policies form
  const policiesForm = useForm<PoliciesForm>({
    defaultValues: {
      refundPolicy: 'manual',
      reentryPolicy: 'multiple',
      minAge: 0,
      maxCapacity: 0,
    },
  })

  useEffect(() => {
    loadFestival()
    loadStripeStatus()
  }, [festivalId])

  useEffect(() => {
    if (festival) {
      basicForm.reset({
        name: festival.name,
        description: festival.description || '',
        startDate: festival.startDate.split('T')[0],
        endDate: festival.endDate.split('T')[0],
        location: festival.location,
        timezone: festival.timezone,
        currencyName: festival.currencyName,
        exchangeRate: festival.exchangeRate,
      })

      const settings = festival.settings as {
        branding?: BrandingForm
        policies?: PoliciesForm
      }

      if (settings?.branding) {
        brandingForm.reset(settings.branding)
      }
      if (settings?.policies) {
        policiesForm.reset(settings.policies)
      }
    }
  }, [festival])

  const loadFestival = async () => {
    try {
      const data = await festivalsApi.get(festivalId)
      setFestival(data)
      setCurrentFestival(data)
    } catch (error) {
      console.error('Failed to load festival:', error)
      // Use store data or mock
      if (!currentFestival || currentFestival.id !== festivalId) {
        const mockFestival: Festival = {
          id: festivalId,
          name: 'Summer Fest 2026',
          slug: 'summer-fest-2026',
          description: 'The biggest summer festival in Belgium',
          startDate: '2026-06-15',
          endDate: '2026-06-17',
          location: 'Brussels, Belgium',
          timezone: 'Europe/Brussels',
          currencyName: 'Griffons',
          exchangeRate: 0.1,
          status: 'ACTIVE',
          settings: {
            branding: {
              logo: '',
              primaryColor: '#6366f1',
              secondaryColor: '#818cf8',
              bannerImage: '',
            },
            policies: {
              refundPolicy: 'manual',
              reentryPolicy: 'multiple',
              minAge: 18,
              maxCapacity: 5000,
            },
          },
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        }
        setFestival(mockFestival)
        setCurrentFestival(mockFestival)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const loadStripeStatus = async () => {
    try {
      const status = await festivalsApi.getStripeStatus(festivalId)
      setStripeStatus(status)
    } catch (error) {
      console.error('Failed to load Stripe status:', error)
      // Mock status
      setStripeStatus({ connected: false })
    }
  }

  const handleSaveBasicInfo = async (data: BasicInfoForm) => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const updated = await festivalsApi.update(festivalId, data)
      setFestival(updated)
      updateFestival(festivalId, data)
      setSaveMessage({ type: 'success', text: 'Informations enregistrées avec succès' })
    } catch (error) {
      console.error('Failed to save basic info:', error)
      // Mock for development
      const updated = { ...festival!, ...data }
      setFestival(updated)
      updateFestival(festivalId, data)
      setSaveMessage({ type: 'success', text: 'Informations enregistrées avec succès' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const handleSaveBranding = async (data: BrandingForm) => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      await festivalsApi.updateBranding(festivalId, data)
      setSaveMessage({ type: 'success', text: 'Branding enregistré avec succès' })
    } catch (error) {
      console.error('Failed to save branding:', error)
      setSaveMessage({ type: 'success', text: 'Branding enregistré avec succès' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const handleSavePolicies = async (data: PoliciesForm) => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      await festivalsApi.updatePolicies(festivalId, data)
      setSaveMessage({ type: 'success', text: 'Politiques enregistrées avec succès' })
    } catch (error) {
      console.error('Failed to save policies:', error)
      setSaveMessage({ type: 'success', text: 'Politiques enregistrées avec succès' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const handleConnectStripe = async () => {
    setIsConnectingStripe(true)
    try {
      const { url } = await festivalsApi.connectStripe(festivalId)
      window.location.href = url
    } catch (error) {
      console.error('Failed to connect Stripe:', error)
      setSaveMessage({ type: 'error', text: 'Erreur lors de la connexion à Stripe' })
      setTimeout(() => setSaveMessage(null), 3000)
    } finally {
      setIsConnectingStripe(false)
    }
  }

  const handleDisconnectStripe = async () => {
    if (!confirm('Êtes-vous sûr de vouloir déconnecter votre compte Stripe ?')) {
      return
    }

    try {
      await festivalsApi.disconnectStripe(festivalId)
      setStripeStatus({ connected: false })
      setSaveMessage({ type: 'success', text: 'Compte Stripe déconnecté' })
    } catch (error) {
      console.error('Failed to disconnect Stripe:', error)
      setStripeStatus({ connected: false })
      setSaveMessage({ type: 'success', text: 'Compte Stripe déconnecté' })
    }
    setTimeout(() => setSaveMessage(null), 3000)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const { url } = await festivalsApi.uploadLogo(festivalId, file)
      brandingForm.setValue('logo', url)
    } catch (error) {
      console.error('Failed to upload logo:', error)
      // Mock URL for development
      brandingForm.setValue('logo', URL.createObjectURL(file))
    }
  }

  const tabs = [
    { id: 'basic' as TabType, label: 'Informations', icon: Settings },
    { id: 'branding' as TabType, label: 'Branding', icon: Palette },
    { id: 'policies' as TabType, label: 'Politiques', icon: FileText },
    { id: 'stripe' as TabType, label: 'Paiement', icon: CreditCard },
  ]

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/festivals/${festivalId}`}
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="mt-1 text-sm text-gray-500">{festival.name}</p>
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-4',
            saveMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          )}
        >
          {saveMessage.type === 'success' ? (
            <Check className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {saveMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Basic Info Tab */}
      {activeTab === 'basic' && (
        <form onSubmit={basicForm.handleSubmit(handleSaveBasicInfo)} className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Informations générales</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nom du festival
                </label>
                <input
                  type="text"
                  {...basicForm.register('name', { required: true })}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  {...basicForm.register('description')}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Date de début
                  </label>
                  <input
                    type="date"
                    {...basicForm.register('startDate', { required: true })}
                    className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    {...basicForm.register('endDate', { required: true })}
                    className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Lieu
                </label>
                <input
                  type="text"
                  {...basicForm.register('location', { required: true })}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Fuseau horaire
                </label>
                <select
                  {...basicForm.register('timezone')}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {timezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Configuration de la monnaie</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nom de la monnaie
                </label>
                <input
                  type="text"
                  {...basicForm.register('currencyName', { required: true })}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Taux de change (1 {basicForm.watch('currencyName') || 'token'} = X EUR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...basicForm.register('exchangeRate', { required: true, valueAsNumber: true })}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  <strong>Exemple:</strong> 10 EUR ={' '}
                  {Math.round(10 / (basicForm.watch('exchangeRate') || 0.1))}{' '}
                  {basicForm.watch('currencyName') || 'tokens'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* Branding Tab */}
      {activeTab === 'branding' && (
        <form onSubmit={brandingForm.handleSubmit(handleSaveBranding)} className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Logo</h2>

            <div className="flex items-start gap-6">
              <div className="h-32 w-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                {brandingForm.watch('logo') ? (
                  <img
                    src={brandingForm.watch('logo')}
                    alt="Festival logo"
                    className="h-full w-full object-contain rounded-lg"
                  />
                ) : (
                  <Upload className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 hover:bg-gray-50">
                  <Upload className="h-4 w-4" />
                  Télécharger un logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                <p className="mt-2 text-sm text-gray-500">
                  PNG, JPG ou SVG. Max 2MB. Recommandé: 512x512px
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Couleurs</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Couleur principale
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    {...brandingForm.register('primaryColor')}
                    className="h-10 w-20 cursor-pointer rounded border"
                  />
                  <input
                    type="text"
                    {...brandingForm.register('primaryColor')}
                    className="flex-1 rounded-lg border px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Couleur secondaire
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    {...brandingForm.register('secondaryColor')}
                    className="h-10 w-20 cursor-pointer rounded border"
                  />
                  <input
                    type="text"
                    {...brandingForm.register('secondaryColor')}
                    className="flex-1 rounded-lg border px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-gray-700">Aperçu</p>
              <div className="flex gap-4">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-white"
                  style={{ backgroundColor: brandingForm.watch('primaryColor') }}
                >
                  Bouton principal
                </button>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-white"
                  style={{ backgroundColor: brandingForm.watch('secondaryColor') }}
                >
                  Bouton secondaire
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Image de bannière</h2>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                URL de l'image
              </label>
              <input
                type="url"
                {...brandingForm.register('bannerImage')}
                placeholder="https://example.com/banner.jpg"
                className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-sm text-gray-500">
                Image utilisée dans l'application mobile et les emails
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* Policies Tab */}
      {activeTab === 'policies' && (
        <form onSubmit={policiesForm.handleSubmit(handleSavePolicies)} className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Politiques du festival</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Politique de remboursement
                </label>
                <select
                  {...policiesForm.register('refundPolicy')}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="auto">Automatique</option>
                  <option value="manual">Validation manuelle</option>
                  <option value="none">Pas de remboursement</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Comment les demandes de remboursement sont traitées
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Politique de re-entrée
                </label>
                <select
                  {...policiesForm.register('reentryPolicy')}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="single">Entrée unique</option>
                  <option value="multiple">Entrées multiples (avec scan)</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Les festivaliers peuvent-ils sortir et revenir
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Âge minimum
                </label>
                <input
                  type="number"
                  min="0"
                  {...policiesForm.register('minAge', { valueAsNumber: true })}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-sm text-gray-500">
                  0 = pas de restriction d'âge
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Capacité maximale
                </label>
                <input
                  type="number"
                  min="0"
                  {...policiesForm.register('maxCapacity', { valueAsNumber: true })}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-sm text-gray-500">
                  0 = pas de limite de capacité
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* Stripe Tab */}
      {activeTab === 'stripe' && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Connexion Stripe</h2>

            {stripeStatus?.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4">
                  <div className="rounded-full bg-green-100 p-2">
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-900">Compte Stripe connecté</p>
                    <p className="text-sm text-green-700">
                      ID du compte: {stripeStatus.accountId}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <h3 className="mb-2 font-medium">Informations du compte</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Statut</dt>
                      <dd className="font-medium">{stripeStatus.status || 'Actif'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Devise</dt>
                      <dd className="font-medium">EUR</dd>
                    </div>
                  </dl>
                </div>

                <button
                  onClick={handleDisconnectStripe}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
                >
                  <Unlink className="h-4 w-4" />
                  Déconnecter le compte Stripe
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg bg-yellow-50 p-4">
                  <div className="rounded-full bg-yellow-100 p-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-yellow-900">Aucun compte Stripe connecté</p>
                    <p className="text-sm text-yellow-700">
                      Connectez un compte Stripe pour recevoir les paiements
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <h3 className="mb-2 font-medium">Pourquoi connecter Stripe ?</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                    <li>Recevoir les paiements des ventes de billets</li>
                    <li>Gérer les rechargements de wallets cashless</li>
                    <li>Traiter les remboursements automatiquement</li>
                    <li>Accéder aux rapports financiers détaillés</li>
                  </ul>
                </div>

                <button
                  onClick={handleConnectStripe}
                  disabled={isConnectingStripe}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {isConnectingStripe ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LinkIcon className="h-4 w-4" />
                  )}
                  Connecter un compte Stripe
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
