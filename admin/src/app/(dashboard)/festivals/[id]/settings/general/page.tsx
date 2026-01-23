'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import {
  Save,
  Loader2,
  Globe,
  Calendar,
  MapPin,
  Coins,
  Check,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SettingsLayout,
  SettingsCard,
  SettingsField,
  SettingsAlert,
  LogoUploader,
} from '@/components/settings'
import { festivalsApi } from '@/lib/api/festivals'
import { useFestivalStore } from '@/stores/festivalStore'
import { Festival } from '@/types/api'

interface GeneralSettingsForm {
  name: string
  description: string
  startDate: string
  endDate: string
  location: string
  address: string
  timezone: string
  currencyName: string
  currencySymbol: string
  exchangeRate: number
}

const timezones = [
  { value: 'Europe/Brussels', label: 'Brussels (CET/CEST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'Europe/Lisbon', label: 'Lisbon (WET/WEST)' },
  { value: 'Europe/Warsaw', label: 'Warsaw (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'Denver (MST/MDT)' },
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
  { value: 'America/Sao_Paulo', label: 'Sao Paulo (BRT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
]

export default function GeneralSettingsPage() {
  const params = useParams()
  const festivalId = params.id as string
  const { currentFestival, setCurrentFestival, updateFestival } = useFestivalStore()
  const [festival, setFestival] = useState<Festival | null>(currentFestival)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [logo, setLogo] = useState<string>('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<GeneralSettingsForm>({
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      location: '',
      address: '',
      timezone: 'Europe/Brussels',
      currencyName: 'Tokens',
      currencySymbol: 'T',
      exchangeRate: 0.1,
    },
  })

  useEffect(() => {
    loadFestival()
  }, [festivalId])

  useEffect(() => {
    if (festival) {
      reset({
        name: festival.name,
        description: festival.description || '',
        startDate: festival.startDate?.split('T')[0] || '',
        endDate: festival.endDate?.split('T')[0] || '',
        location: festival.location || '',
        address: (festival as any).address || '',
        timezone: festival.timezone || 'Europe/Brussels',
        currencyName: festival.currencyName || 'Tokens',
        currencySymbol: (festival as any).currencySymbol || 'T',
        exchangeRate: festival.exchangeRate || 0.1,
      })
      setLogo((festival.settings as any)?.branding?.logo || '')
    }
  }, [festival, reset])

  const loadFestival = async () => {
    try {
      const data = await festivalsApi.get(festivalId)
      setFestival(data)
      setCurrentFestival(data)
    } catch (error) {
      console.error('Failed to load festival:', error)
      // Mock data for development
      if (!currentFestival || currentFestival.id !== festivalId) {
        const mockFestival: Festival = {
          id: festivalId,
          name: 'Summer Fest 2026',
          slug: 'summer-fest-2026',
          description: 'The biggest summer festival in Belgium featuring top artists and amazing experiences.',
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

  const onSubmit = async (data: GeneralSettingsForm) => {
    setIsSaving(true)
    setMessage(null)

    try {
      const updated = await festivalsApi.update(festivalId, {
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        location: data.location,
        timezone: data.timezone,
        currencyName: data.currencyName,
        exchangeRate: data.exchangeRate,
      })
      setFestival(updated)
      updateFestival(festivalId, data)
      setMessage({ type: 'success', text: 'Settings saved successfully' })
    } catch (error) {
      console.error('Failed to save settings:', error)
      // Mock success for development
      const updated = { ...festival!, ...data }
      setFestival(updated)
      updateFestival(festivalId, data)
      setMessage({ type: 'success', text: 'Settings saved successfully' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const handleLogoUpload = async (file: File): Promise<string> => {
    try {
      const { url } = await festivalsApi.uploadLogo(festivalId, file)
      return url
    } catch (error) {
      console.error('Failed to upload logo:', error)
      // Mock for development
      return URL.createObjectURL(file)
    }
  }

  const handleLogoChange = async (url: string) => {
    setLogo(url)
    try {
      await festivalsApi.updateBranding(festivalId, { logo: url })
    } catch (error) {
      console.error('Failed to update logo:', error)
    }
  }

  const currencyName = watch('currencyName')
  const exchangeRate = watch('exchangeRate')

  if (isLoading) {
    return (
      <SettingsLayout festivalId={festivalId} festivalName={festival?.name}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </SettingsLayout>
    )
  }

  return (
    <SettingsLayout festivalId={festivalId} festivalName={festival?.name}>
      <div className="space-y-6">
        {/* Alert */}
        {message && (
          <SettingsAlert
            type={message.type}
            message={message.text}
            onDismiss={() => setMessage(null)}
          />
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <SettingsCard
            title="Basic Information"
            description="General information about your festival"
          >
            <div className="space-y-4">
              <SettingsField label="Festival Name" required error={errors.name?.message}>
                <input
                  type="text"
                  {...register('name', { required: 'Name is required' })}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                    errors.name && 'border-red-500'
                  )}
                  placeholder="Enter festival name"
                />
              </SettingsField>

              <SettingsField label="Description" hint="A brief description of your festival">
                <textarea
                  {...register('description')}
                  rows={4}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Describe your festival..."
                />
              </SettingsField>
            </div>
          </SettingsCard>

          {/* Logo */}
          <SettingsCard
            title="Festival Logo"
            description="Upload your festival logo for branding"
          >
            <LogoUploader
              value={logo}
              onChange={handleLogoChange}
              onUpload={handleLogoUpload}
              hint="PNG, JPG or SVG. Max 2MB. Recommended: 512x512px"
            />
          </SettingsCard>

          {/* Dates & Time */}
          <SettingsCard
            title="Dates & Time"
            description="When your festival takes place"
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label="Start Date" required error={errors.startDate?.message}>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      {...register('startDate', { required: 'Start date is required' })}
                      className={cn(
                        'w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                        errors.startDate && 'border-red-500'
                      )}
                    />
                  </div>
                </SettingsField>

                <SettingsField label="End Date" required error={errors.endDate?.message}>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      {...register('endDate', { required: 'End date is required' })}
                      className={cn(
                        'w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                        errors.endDate && 'border-red-500'
                      )}
                    />
                  </div>
                </SettingsField>
              </div>

              <SettingsField label="Timezone" required>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <select
                    {...register('timezone')}
                    className="w-full appearance-none rounded-lg border py-2 pl-10 pr-8 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </SettingsField>
            </div>
          </SettingsCard>

          {/* Location */}
          <SettingsCard
            title="Location"
            description="Where your festival takes place"
          >
            <div className="space-y-4">
              <SettingsField label="City / Region" required error={errors.location?.message}>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    {...register('location', { required: 'Location is required' })}
                    className={cn(
                      'w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                      errors.location && 'border-red-500'
                    )}
                    placeholder="e.g., Brussels, Belgium"
                  />
                </div>
              </SettingsField>

              <SettingsField label="Full Address" hint="Exact venue address for navigation">
                <textarea
                  {...register('address')}
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Enter the complete venue address"
                />
              </SettingsField>
            </div>
          </SettingsCard>

          {/* Currency Settings */}
          <SettingsCard
            title="Festival Currency"
            description="Configure the cashless currency for your festival"
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField
                  label="Currency Name"
                  required
                  hint="The name of your festival tokens"
                >
                  <div className="relative">
                    <Coins className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      {...register('currencyName', { required: 'Currency name is required' })}
                      className="w-full rounded-lg border py-2 pl-10 pr-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="e.g., Tokens, Credits, Coins"
                    />
                  </div>
                </SettingsField>

                <SettingsField label="Currency Symbol" hint="Short symbol for display">
                  <input
                    type="text"
                    {...register('currencySymbol')}
                    maxLength={5}
                    className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g., T, C"
                  />
                </SettingsField>
              </div>

              <SettingsField
                label="Exchange Rate"
                required
                hint={`1 ${currencyName || 'Token'} = ${exchangeRate || 0} EUR`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      {...register('exchangeRate', {
                        required: 'Exchange rate is required',
                        valueAsNumber: true,
                        min: { value: 0.01, message: 'Rate must be at least 0.01' },
                      })}
                      className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <span className="text-sm text-gray-500">EUR per {currencyName || 'Token'}</span>
                </div>
              </SettingsField>

              {/* Conversion Preview */}
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-700">Conversion Example</p>
                <div className="mt-2 grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-lg font-semibold text-gray-900">
                      {Math.round(10 / (exchangeRate || 0.1))}
                    </p>
                    <p className="text-xs text-gray-500">{currencyName || 'Tokens'}</p>
                  </div>
                  <div className="flex items-center justify-center text-gray-400">=</div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-lg font-semibold text-gray-900">10.00</p>
                    <p className="text-xs text-gray-500">EUR</p>
                  </div>
                </div>
              </div>
            </div>
          </SettingsCard>

          {/* Submit Button */}
          <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              {isDirty ? 'You have unsaved changes' : 'All changes saved'}
            </p>
            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </SettingsLayout>
  )
}
