'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { cn, slugify } from '@/lib/utils'
import { festivalsApi, CreateFestivalInput } from '@/lib/api/festivals'
import { useFestivalStore } from '@/stores/festivalStore'

interface FormData extends CreateFestivalInput {
  slug: string
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

export default function NewFestivalPage() {
  const router = useRouter()
  const { addFestival, setCurrentFestival } = useFestivalStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      startDate: '',
      endDate: '',
      location: '',
      timezone: 'Europe/Brussels',
      currencyName: '',
      exchangeRate: 0.1,
    },
  })

  const watchName = watch('name')
  const watchCurrencyName = watch('currencyName')
  const watchExchangeRate = watch('exchangeRate')

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setValue('name', name)
    setValue('slug', slugify(name))
  }

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const { slug, ...createData } = data
      const festival = await festivalsApi.create(createData)
      addFestival(festival)
      setCurrentFestival(festival)
      router.push(`/festivals/${festival.id}`)
    } catch (err) {
      console.error('Failed to create festival:', err)
      setError('Une erreur est survenue lors de la création du festival.')

      // For development, create a mock festival
      const mockFestival = {
        id: Date.now().toString(),
        name: data.name,
        slug: data.slug,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        location: data.location,
        timezone: data.timezone,
        currencyName: data.currencyName,
        exchangeRate: data.exchangeRate,
        status: 'DRAFT' as const,
        settings: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      addFestival(mockFestival)
      setCurrentFestival(mockFestival)
      router.push(`/festivals/${mockFestival.id}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/festivals"
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau festival</h1>
          <p className="mt-1 text-sm text-gray-500">
            Créez un nouveau festival ou événement
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Informations générales</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nom du festival <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('name', { required: 'Le nom est requis' })}
                onChange={handleNameChange}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                  errors.name && 'border-red-500'
                )}
                placeholder="Summer Fest 2026"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Slug (URL)
              </label>
              <input
                type="text"
                {...register('slug')}
                className="w-full rounded-lg border bg-gray-50 px-3 py-2"
                readOnly
              />
              <p className="mt-1 text-sm text-gray-500">
                Généré automatiquement à partir du nom
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Description du festival..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Date de début <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  {...register('startDate', { required: 'La date de début est requise' })}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                    errors.startDate && 'border-red-500'
                  )}
                />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-500">{errors.startDate.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Date de fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  {...register('endDate', { required: 'La date de fin est requise' })}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                    errors.endDate && 'border-red-500'
                  )}
                />
                {errors.endDate && (
                  <p className="mt-1 text-sm text-red-500">{errors.endDate.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Lieu <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('location', { required: 'Le lieu est requis' })}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                  errors.location && 'border-red-500'
                )}
                placeholder="Brussels, Belgium"
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-500">{errors.location.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Fuseau horaire <span className="text-red-500">*</span>
              </label>
              <select
                {...register('timezone', { required: 'Le fuseau horaire est requis' })}
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

        {/* Currency Settings */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Configuration de la monnaie</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nom de la monnaie <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('currencyName', { required: 'Le nom de la monnaie est requis' })}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                  errors.currencyName && 'border-red-500'
                )}
                placeholder="Griffons, Tokens, Jetons..."
              />
              {errors.currencyName && (
                <p className="mt-1 text-sm text-red-500">{errors.currencyName.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Taux de change (1 {watchCurrencyName || 'token'} = X EUR){' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                {...register('exchangeRate', {
                  required: 'Le taux de change est requis',
                  min: { value: 0.01, message: 'Le taux doit être supérieur à 0' },
                  valueAsNumber: true,
                })}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                  errors.exchangeRate && 'border-red-500'
                )}
              />
              {errors.exchangeRate && (
                <p className="mt-1 text-sm text-red-500">{errors.exchangeRate.message}</p>
              )}
              {watchExchangeRate > 0 && watchCurrencyName && (
                <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  <strong>Exemple:</strong> 10 EUR ={' '}
                  {Math.round(10 / watchExchangeRate)} {watchCurrencyName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/festivals"
            className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer le festival
          </button>
        </div>
      </form>
    </div>
  )
}
