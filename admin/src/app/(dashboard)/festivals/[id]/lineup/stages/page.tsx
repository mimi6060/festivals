'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  Users,
  X,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Music,
  Tent,
  Building,
  Trees,
} from 'lucide-react'
import { stagesApi, type StageWithDetails, type CreateStageRequest, type UpdateStageRequest } from '@/lib/api/lineup'

// Mock data for demonstration
const mockStages = [
  {
    id: '1',
    name: 'Main Stage',
    capacity: 15000,
    type: 'MAIN',
    description: 'La scene principale du festival avec un systeme son de pointe.',
    isActive: true,
    performanceCount: 12,
    location: { lat: 50.8503, lng: 4.3517 },
  },
  {
    id: '2',
    name: 'Electronic Tent',
    capacity: 5000,
    type: 'TENT',
    description: 'Un espace couvert dedie a la musique electronique.',
    isActive: true,
    performanceCount: 18,
    location: { lat: 50.8505, lng: 4.352 },
  },
  {
    id: '3',
    name: 'Acoustic Garden',
    capacity: 2000,
    type: 'OUTDOOR',
    description: 'Un cadre naturel et intime pour les performances acoustiques.',
    isActive: true,
    performanceCount: 8,
    location: { lat: 50.8501, lng: 4.3515 },
  },
  {
    id: '4',
    name: 'Discovery Stage',
    capacity: 1000,
    type: 'SECONDARY',
    description: 'Decouvrez les artistes emergents et talents locaux.',
    isActive: true,
    performanceCount: 15,
    location: { lat: 50.8502, lng: 4.3522 },
  },
  {
    id: '5',
    name: 'VIP Lounge',
    capacity: 300,
    type: 'INDOOR',
    description: 'Scene exclusive pour les detenteurs de pass VIP.',
    isActive: false,
    performanceCount: 0,
    location: { lat: 50.8504, lng: 4.3518 },
  },
]

const stageTypeLabels: Record<string, { label: string; icon: typeof MapPin }> = {
  MAIN: { label: 'Principale', icon: Music },
  SECONDARY: { label: 'Secondaire', icon: MapPin },
  TENT: { label: 'Chapiteau', icon: Tent },
  OUTDOOR: { label: 'Exterieur', icon: Trees },
  INDOOR: { label: 'Interieur', icon: Building },
}

interface StageFormData {
  id?: string
  name: string
  capacity: number | ''
  type: 'MAIN' | 'SECONDARY' | 'TENT' | 'OUTDOOR' | 'INDOOR' | ''
  description: string
  isActive: boolean
}

const initialFormData: StageFormData = {
  name: '',
  capacity: '',
  type: '',
  description: '',
  isActive: true,
}

export default function StagesPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [stages, setStages] = useState(mockStages)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState<StageFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof StageFormData, string>>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  // Load stages from API
  useEffect(() => {
    const loadStages = async () => {
      setIsLoading(true)
      try {
        const data = await stagesApi.list(festivalId)
        if (data && data.length > 0) {
          setStages(data.map(s => ({
            id: s.id,
            name: s.name,
            capacity: s.capacity || 0,
            type: s.type || 'SECONDARY',
            description: s.description || '',
            isActive: s.isActive,
            performanceCount: 0, // Would need to be calculated or fetched
            location: { lat: 50.8503, lng: 4.3517 },
          })))
        }
      } catch (error) {
        console.error('Failed to load stages:', error)
        // Keep mock data on error
      } finally {
        setIsLoading(false)
      }
    }
    loadStages()
  }, [festivalId])

  const isEditing = !!formData.id

  const openCreateModal = () => {
    setFormData(initialFormData)
    setErrors({})
    setIsModalOpen(true)
  }

  const openEditModal = (stage: typeof mockStages[0]) => {
    setFormData({
      id: stage.id,
      name: stage.name,
      capacity: stage.capacity || '',
      type: stage.type as StageFormData['type'],
      description: stage.description || '',
      isActive: stage.isActive,
    })
    setErrors({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setFormData(initialFormData)
    setErrors({})
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData((prev) => ({ ...prev, [name]: checked }))
    } else if (name === 'capacity') {
      setFormData((prev) => ({ ...prev, [name]: value ? parseInt(value) : '' }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }

    if (errors[name as keyof StageFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof StageFormData, string>> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis'
    }

    if (!formData.type) {
      newErrors.type = 'Le type est requis'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError(null)

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      if (isEditing && formData.id) {
        // Update existing stage
        const updateData: UpdateStageRequest = {
          name: formData.name,
          capacity: formData.capacity || undefined,
          description: formData.description || undefined,
          type: formData.type || undefined,
          isActive: formData.isActive,
        }
        await stagesApi.update(festivalId, formData.id, updateData)

        setStages((prev) =>
          prev.map((s) =>
            s.id === formData.id
              ? { ...s, ...formData, capacity: formData.capacity || 0 }
              : s
          )
        )
      } else {
        // Create new stage
        const createData: CreateStageRequest = {
          name: formData.name,
          capacity: formData.capacity || undefined,
          description: formData.description || undefined,
          type: formData.type || undefined,
        }
        const newStage = await stagesApi.create(festivalId, createData)

        setStages((prev) => [
          ...prev,
          {
            id: newStage.id,
            name: newStage.name,
            capacity: newStage.capacity || 0,
            type: newStage.type || 'SECONDARY',
            description: newStage.description || '',
            isActive: newStage.isActive,
            performanceCount: 0,
            location: { lat: 50.8503, lng: 4.3517 },
          },
        ])
      }

      closeModal()
    } catch (error) {
      console.error('Error saving stage:', error)
      setApiError('Erreur lors de la sauvegarde de la scene')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (stageId: string) => {
    try {
      await stagesApi.delete(festivalId, stageId)
      setStages((prev) => prev.filter((s) => s.id !== stageId))
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting stage:', error)
      alert('Erreur lors de la suppression de la scene')
    }
  }

  const toggleActive = async (stageId: string) => {
    const stage = stages.find((s) => s.id === stageId)
    if (!stage) return

    try {
      await stagesApi.update(festivalId, stageId, { isActive: !stage.isActive })
      setStages((prev) =>
        prev.map((s) => (s.id === stageId ? { ...s, isActive: !s.isActive } : s))
      )
    } catch (error) {
      console.error('Error toggling stage status:', error)
      alert('Erreur lors de la modification du statut')
    }
  }

  const totalCapacity = stages.filter((s) => s.isActive).reduce((sum, s) => sum + s.capacity, 0)
  const activeStages = stages.filter((s) => s.isActive).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href={`/festivals/${festivalId}/lineup`} className="hover:text-primary">
              Lineup
            </Link>
            <span>/</span>
            <span>Scenes</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Scenes</h1>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Ajouter une scene
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <MapPin className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total scenes</p>
              <p className="text-2xl font-bold">{stages.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Music className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Scenes actives</p>
              <p className="text-2xl font-bold">{activeStages}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Capacite totale</p>
              <p className="text-2xl font-bold">{totalCapacity.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stages List */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="divide-y">
          {stages.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <MapPin className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Aucune scene</h3>
              <p className="mt-2 text-sm text-gray-500">
                Commencez par ajouter une scene a votre festival
              </p>
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Ajouter une scene
              </button>
            </div>
          ) : (
            stages.map((stage) => {
              const TypeIcon = stageTypeLabels[stage.type]?.icon || MapPin
              const isExpanded = expandedStage === stage.id

              return (
                <div key={stage.id} className="relative">
                  {/* Main row */}
                  <div
                    className={cn(
                      'flex items-center justify-between px-4 py-4 transition-colors',
                      !stage.isActive && 'bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'rounded-lg p-2',
                          stage.isActive ? 'bg-purple-100' : 'bg-gray-200'
                        )}
                      >
                        <TypeIcon
                          className={cn(
                            'h-5 w-5',
                            stage.isActive ? 'text-purple-600' : 'text-gray-400'
                          )}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3
                            className={cn(
                              'font-semibold',
                              stage.isActive ? 'text-gray-900' : 'text-gray-500'
                            )}
                          >
                            {stage.name}
                          </h3>
                          {!stage.isActive && (
                            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500">
                              Inactif
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {stage.capacity.toLocaleString()} places
                          </span>
                          <span className="flex items-center gap-1">
                            <Music className="h-4 w-4" />
                            {stage.performanceCount} performances
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              stage.type === 'MAIN' && 'bg-purple-100 text-purple-700',
                              stage.type === 'SECONDARY' && 'bg-blue-100 text-blue-700',
                              stage.type === 'TENT' && 'bg-orange-100 text-orange-700',
                              stage.type === 'OUTDOOR' && 'bg-green-100 text-green-700',
                              stage.type === 'INDOOR' && 'bg-gray-100 text-gray-700'
                            )}
                          >
                            {stageTypeLabels[stage.type]?.label || stage.type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditModal(stage)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(stage.id)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50 px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Description</h4>
                          <p className="mt-1 text-sm text-gray-600">
                            {stage.description || 'Aucune description'}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Statut</h4>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => toggleActive(stage.id)}
                              className={cn(
                                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                                stage.isActive ? 'bg-primary' : 'bg-gray-200'
                              )}
                            >
                              <span
                                className={cn(
                                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                                  stage.isActive ? 'translate-x-5' : 'translate-x-0'
                                )}
                              />
                            </button>
                            <span className="text-sm text-gray-600">
                              {stage.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Delete confirmation overlay */}
                  {deleteConfirm === stage.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/95 px-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">
                          Supprimer la scene <strong>{stage.name}</strong> ?
                        </p>
                        {stage.performanceCount > 0 && (
                          <p className="mt-1 text-xs text-red-500">
                            Attention: {stage.performanceCount} performances sont programmees
                          </p>
                        )}
                        <div className="mt-4 flex justify-center gap-2">
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleDelete(stage.id)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
          />

          {/* Modal content */}
          <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Modifier la scene' : 'Ajouter une scene'}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {apiError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nom de la scene <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ex: Main Stage"
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-1',
                    errors.name
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : 'focus:border-primary focus:ring-primary'
                  )}
                />
                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-1',
                      errors.type
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'focus:border-primary focus:ring-primary'
                    )}
                  >
                    <option value="">Selectionner</option>
                    <option value="MAIN">Scene principale</option>
                    <option value="SECONDARY">Scene secondaire</option>
                    <option value="TENT">Chapiteau</option>
                    <option value="OUTDOOR">Exterieur</option>
                    <option value="INDOOR">Interieur</option>
                  </select>
                  {errors.type && <p className="mt-1 text-sm text-red-500">{errors.type}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Capacite
                  </label>
                  <input
                    type="number"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleInputChange}
                    min="0"
                    placeholder="Ex: 5000"
                    className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Decrivez la scene, son ambiance, ses specificites..."
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Scene active (visible dans le programme)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {isEditing ? 'Modifier' : 'Ajouter'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
