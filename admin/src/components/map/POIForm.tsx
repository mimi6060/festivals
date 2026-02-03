'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, MapPin, Save, Loader2 } from 'lucide-react'
import { mapApi, POI, POIType, CreatePOIRequest, UpdatePOIRequest } from '@/lib/api/map'

const poiTypes: { value: POIType; label: string; color: string }[] = [
  { value: 'STAGE', label: 'Scene', color: '#8B5CF6' },
  { value: 'BAR', label: 'Bar', color: '#EAB308' },
  { value: 'FOOD', label: 'Restauration', color: '#F97316' },
  { value: 'TOILET', label: 'Toilettes', color: '#3B82F6' },
  { value: 'FIRST_AID', label: 'Premiers secours', color: '#EF4444' },
  { value: 'ENTRANCE', label: 'Entree', color: '#22C55E' },
  { value: 'EXIT', label: 'Sortie', color: '#22C55E' },
  { value: 'CHARGING', label: 'Recharge', color: '#84CC16' },
  { value: 'CAMPING', label: 'Camping', color: '#14B8A6' },
  { value: 'VIP', label: 'VIP', color: '#A855F7' },
  { value: 'INFO', label: 'Information', color: '#06B6D4' },
  { value: 'ATM', label: 'Distributeur', color: '#0EA5E9' },
  { value: 'PARKING', label: 'Parking', color: '#6B7280' },
  { value: 'MERCH', label: 'Boutique', color: '#EC4899' },
  { value: 'SECURITY', label: 'Securite', color: '#F59E0B' },
  { value: 'WATER', label: 'Point d\'eau', color: '#3B82F6' },
  { value: 'SMOKING', label: 'Zone fumeur', color: '#78716C' },
  { value: 'LOCKERS', label: 'Consignes', color: '#6366F1' },
  { value: 'LOST_FOUND', label: 'Objets trouves', color: '#8B5CF6' },
  { value: 'ACCESSIBILITY', label: 'Accessibilite', color: '#6366F1' },
  { value: 'OTHER', label: 'Autre', color: '#9CA3AF' },
]

interface POIFormProps {
  festivalId: string
  poi?: POI | null
  onClose: () => void
  onSuccess: () => void
  initialPosition?: { lat: number; lng: number }
}

export default function POIForm({
  festivalId,
  poi,
  onClose,
  onSuccess,
  initialPosition,
}: POIFormProps) {
  const isEditing = !!poi

  const [formData, setFormData] = useState({
    name: poi?.name || '',
    description: poi?.description || '',
    type: poi?.type || ('STAGE' as POIType),
    latitude: poi?.latitude || initialPosition?.lat || 45.764,
    longitude: poi?.longitude || initialPosition?.lng || 4.8357,
    color: poi?.color || '',
    openingHours: poi?.openingHours || '',
    capacity: poi?.capacity?.toString() || '',
    isAccessible: poi?.isAccessible || false,
    isFeatured: poi?.isFeatured || false,
    iconUrl: poi?.iconUrl || '',
    imageUrl: poi?.imageUrl || '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePOIRequest) => mapApi.createPOI(festivalId, data),
    onSuccess: () => {
      onSuccess()
    },
    onError: (error: any) => {
      console.error('Failed to create POI:', error)
      setErrors({ submit: error.message || 'Erreur lors de la creation' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdatePOIRequest) => mapApi.updatePOI(festivalId, poi!.id, data),
    onSuccess: () => {
      onSuccess()
    },
    onError: (error: any) => {
      console.error('Failed to update POI:', error)
      setErrors({ submit: error.message || 'Erreur lors de la mise a jour' })
    },
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis'
    }

    if (!formData.type) {
      newErrors.type = 'Le type est requis'
    }

    if (!formData.latitude || formData.latitude < -90 || formData.latitude > 90) {
      newErrors.latitude = 'Latitude invalide'
    }

    if (!formData.longitude || formData.longitude < -180 || formData.longitude > 180) {
      newErrors.longitude = 'Longitude invalide'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    const data = {
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
      color: formData.color || undefined,
      openingHours: formData.openingHours || undefined,
      capacity: formData.capacity ? Number(formData.capacity) : undefined,
      isAccessible: formData.isAccessible,
      isFeatured: formData.isFeatured,
      iconUrl: formData.iconUrl || undefined,
      imageUrl: formData.imageUrl || undefined,
    }

    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data as CreatePOIRequest)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    // Clear error when field changes
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const selectedTypeColor =
    poiTypes.find((t) => t.value === formData.type)?.color || '#6B7280'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: selectedTypeColor + '20' }}
            >
              <MapPin className="h-5 w-5" style={{ color: selectedTypeColor }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Modifier le POI' : 'Nouveau POI'}
              </h2>
              <p className="text-sm text-gray-500">
                {isEditing ? poi?.name : 'Ajouter un point d\'interet'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nom *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Scene principale"
              className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                errors.name
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:border-primary focus:ring-primary/20'
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Type *
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                errors.type
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:border-primary focus:ring-primary/20'
              }`}
            >
              {poiTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-500">{errors.type}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Description du point d'interet..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Latitude *
              </label>
              <input
                type="number"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                step="0.000001"
                className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                  errors.latitude
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-gray-300 focus:border-primary focus:ring-primary/20'
                }`}
              />
              {errors.latitude && (
                <p className="mt-1 text-sm text-red-500">{errors.latitude}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Longitude *
              </label>
              <input
                type="number"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                step="0.000001"
                className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                  errors.longitude
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-gray-300 focus:border-primary focus:ring-primary/20'
                }`}
              />
              {errors.longitude && (
                <p className="mt-1 text-sm text-red-500">{errors.longitude}</p>
              )}
            </div>
          </div>

          {/* Opening hours */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Horaires d&apos;ouverture
            </label>
            <input
              type="text"
              name="openingHours"
              value={formData.openingHours}
              onChange={handleChange}
              placeholder="Ex: 10:00 - 02:00"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Capacity */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Capacite
            </label>
            <input
              type="number"
              name="capacity"
              value={formData.capacity}
              onChange={handleChange}
              placeholder="Nombre de personnes"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Color */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Couleur personnalisee
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                name="color"
                value={formData.color || selectedTypeColor}
                onChange={handleChange}
                className="h-10 w-14 cursor-pointer rounded-lg border border-gray-300"
              />
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                placeholder="#RRGGBB"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isAccessible"
                checked={formData.isAccessible}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Accessible PMR</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isFeatured"
                checked={formData.isFeatured}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Mis en avant</span>
            </label>
          </div>

          {/* Error message */}
          {errors.submit && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              disabled={isLoading}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? 'Enregistrer' : 'Creer'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
