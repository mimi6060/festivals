'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { standsApi, CreateStandRequest, StandCategory } from '@/lib/api/stands'
import {
  ArrowLeft,
  Beer,
  UtensilsCrossed,
  ShoppingBag,
  Wallet,
  Info,
  Heart,
  Shield,
  Upload,
  X,
  Loader2,
  MapPin,
} from 'lucide-react'

const categories: { value: StandCategory; label: string; description: string; icon: typeof Beer }[] = [
  { value: 'BAR', label: 'Bar', description: 'Vente de boissons', icon: Beer },
  { value: 'FOOD', label: 'Restauration', description: 'Vente de nourriture', icon: UtensilsCrossed },
  { value: 'MERCHANDISE', label: 'Boutique', description: 'Vente de merchandising', icon: ShoppingBag },
  { value: 'RECHARGE', label: 'Recharge', description: 'Point de recharge cashless', icon: Wallet },
  { value: 'INFO', label: 'Information', description: 'Point d\'information', icon: Info },
  { value: 'MEDICAL', label: 'Medical', description: 'Point medical / premiers soins', icon: Heart },
  { value: 'SECURITY', label: 'Securite', description: 'Point de securite', icon: Shield },
]

interface FormData {
  name: string
  description: string
  category: StandCategory
  zone: string
  latitude: string
  longitude: string
  acceptsOnlyTokens: boolean
  requiresPin: boolean
  allowsNegativeBalance: boolean
  maxTransactionAmount: string
}

export default function NewStandPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const festivalId = params.id as string

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<StandCategory | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      description: '',
      category: '' as StandCategory,
      zone: '',
      latitude: '',
      longitude: '',
      acceptsOnlyTokens: true,
      requiresPin: false,
      allowsNegativeBalance: false,
      maxTransactionAmount: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateStandRequest) => standsApi.create(festivalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stands', festivalId] })
      router.push(`/festivals/${festivalId}/stands`)
    },
  })

  const onSubmit = (data: FormData) => {
    const request: CreateStandRequest = {
      name: data.name,
      description: data.description || undefined,
      category: data.category,
      location: data.latitude && data.longitude
        ? {
            lat: parseFloat(data.latitude),
            lng: parseFloat(data.longitude),
            zone: data.zone || undefined,
          }
        : data.zone
        ? { lat: 0, lng: 0, zone: data.zone }
        : undefined,
      settings: {
        acceptsOnlyTokens: data.acceptsOnlyTokens,
        requiresPin: data.requiresPin,
        allowsNegativeBalance: data.allowsNegativeBalance,
        maxTransactionAmount: data.maxTransactionAmount
          ? parseFloat(data.maxTransactionAmount)
          : undefined,
      },
      imageUrl: imagePreview || undefined,
    }

    createMutation.mutate(request)
  }

  const handleCategorySelect = (category: StandCategory) => {
    setSelectedCategory(category)
    setValue('category', category)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImagePreview(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/festivals/${festivalId}/stands`}
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau stand</h1>
          <p className="mt-1 text-sm text-gray-500">
            Creez un nouveau point de vente pour le festival
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Category selection */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Type de stand</h2>
          <p className="mb-4 text-sm text-gray-500">
            Selectionnez le type de stand que vous souhaitez creer
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => handleCategorySelect(category.value)}
                  className={cn(
                    'flex flex-col items-center rounded-lg border-2 p-4 text-center transition-colors',
                    selectedCategory === category.value
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <Icon
                    className={cn(
                      'mb-2 h-8 w-8',
                      selectedCategory === category.value ? 'text-primary' : 'text-gray-400'
                    )}
                  />
                  <span
                    className={cn(
                      'font-medium',
                      selectedCategory === category.value ? 'text-primary' : 'text-gray-900'
                    )}
                  >
                    {category.label}
                  </span>
                  <span className="mt-1 text-xs text-gray-500">{category.description}</span>
                </button>
              )
            })}
          </div>
          {errors.category && (
            <p className="mt-2 text-sm text-red-600">Veuillez selectionner un type de stand</p>
          )}
          <input type="hidden" {...register('category', { required: true })} />
        </div>

        {/* Basic info */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Informations generales</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
                Nom du stand *
              </label>
              <input
                id="name"
                type="text"
                {...register('name', { required: 'Le nom est requis' })}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                  errors.name && 'border-red-500'
                )}
                placeholder="Ex: Bar Central, Food Truck Veggie..."
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                {...register('description')}
                rows={3}
                className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Decrivez le stand, les produits proposes..."
              />
            </div>

            {/* Image upload */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Image du stand
              </label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100">
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <span className="text-sm text-gray-500">Cliquez pour uploader une image</span>
                  <span className="text-xs text-gray-400">PNG, JPG jusqu'a 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Emplacement</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="zone" className="mb-1 block text-sm font-medium text-gray-700">
                Zone / Secteur
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="zone"
                  type="text"
                  {...register('zone')}
                  className="w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Ex: Zone A, Entree principale, Scene nord..."
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="latitude" className="mb-1 block text-sm font-medium text-gray-700">
                  Latitude
                </label>
                <input
                  id="latitude"
                  type="text"
                  {...register('latitude', {
                    pattern: {
                      value: /^-?([1-8]?[0-9]\.{1}\d+|90\.{1}0+)$/,
                      message: 'Latitude invalide',
                    },
                  })}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                    errors.latitude && 'border-red-500'
                  )}
                  placeholder="Ex: 50.8503"
                />
                {errors.latitude && (
                  <p className="mt-1 text-sm text-red-600">{errors.latitude.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="longitude" className="mb-1 block text-sm font-medium text-gray-700">
                  Longitude
                </label>
                <input
                  id="longitude"
                  type="text"
                  {...register('longitude', {
                    pattern: {
                      value: /^-?((1[0-7][0-9]|[1-9]?[0-9])\.{1}\d+|180\.{1}0+)$/,
                      message: 'Longitude invalide',
                    },
                  })}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                    errors.longitude && 'border-red-500'
                  )}
                  placeholder="Ex: 4.3517"
                />
                {errors.longitude && (
                  <p className="mt-1 text-sm text-red-600">{errors.longitude.message}</p>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-500">
              Les coordonnees GPS permettent d'afficher le stand sur la carte du festival
            </p>
          </div>
        </div>

        {/* Settings */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Parametres</h2>

          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                {...register('acceptsOnlyTokens')}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="font-medium text-gray-900">Accepte uniquement les tokens</span>
                <p className="text-sm text-gray-500">
                  Le stand n'acceptera que les paiements en tokens cashless
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                {...register('requiresPin')}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="font-medium text-gray-900">Code PIN requis</span>
                <p className="text-sm text-gray-500">
                  Demande un code PIN au festivalier pour valider chaque transaction
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                {...register('allowsNegativeBalance')}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="font-medium text-gray-900">Autoriser le solde negatif</span>
                <p className="text-sm text-gray-500">
                  Permet aux festivaliers de payer meme avec un solde insuffisant
                </p>
              </div>
            </label>

            <div>
              <label htmlFor="maxTransactionAmount" className="mb-1 block text-sm font-medium text-gray-700">
                Montant maximum par transaction (tokens)
              </label>
              <input
                id="maxTransactionAmount"
                type="number"
                step="1"
                min="0"
                {...register('maxTransactionAmount')}
                className="w-full max-w-xs rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Illimite si vide"
              />
              <p className="mt-1 text-sm text-gray-500">
                Laissez vide pour ne pas limiter le montant
              </p>
            </div>
          </div>
        </div>

        {/* Error message */}
        {createMutation.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-medium">Erreur lors de la creation du stand</p>
            <p className="mt-1 text-sm">{(createMutation.error as Error).message}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/festivals/${festivalId}/stands`}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {(isSubmitting || createMutation.isPending) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Creer le stand
          </button>
        </div>
      </form>
    </div>
  )
}
