'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Plus,
  FileText,
  Edit,
  Trash2,
  Copy,
  Star,
  StarOff,
  Clock,
  Speaker,
  Lightbulb,
  Music,
  Coffee,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Upload,
  ExternalLink,
} from 'lucide-react'

// Types
interface TechRider {
  id: string
  name: string
  description?: string
  isDefault: boolean
  setupTime: number
  soundcheckTime: number
  teardownTime: number
  hasSound: boolean
  hasLight: boolean
  hasBackline: boolean
  hasHospitality: boolean
  createdAt: string
  updatedAt: string
}

// Mock data
const mockRiders: TechRider[] = [
  {
    id: '1',
    name: 'Full Live Show',
    description: 'Complete live setup with full band and production',
    isDefault: true,
    setupTime: 90,
    soundcheckTime: 60,
    teardownTime: 45,
    hasSound: true,
    hasLight: true,
    hasBackline: true,
    hasHospitality: true,
    createdAt: '2025-06-01T10:00:00Z',
    updatedAt: '2025-12-15T14:30:00Z',
  },
  {
    id: '2',
    name: 'DJ Set',
    description: 'Minimal DJ setup for club and festival appearances',
    isDefault: false,
    setupTime: 15,
    soundcheckTime: 15,
    teardownTime: 10,
    hasSound: true,
    hasLight: true,
    hasBackline: false,
    hasHospitality: true,
    createdAt: '2025-08-15T10:00:00Z',
    updatedAt: '2025-12-10T09:00:00Z',
  },
  {
    id: '3',
    name: 'Acoustic Set',
    description: 'Stripped-down acoustic performance',
    isDefault: false,
    setupTime: 30,
    soundcheckTime: 30,
    teardownTime: 20,
    hasSound: true,
    hasLight: false,
    hasBackline: true,
    hasHospitality: false,
    createdAt: '2025-10-01T10:00:00Z',
    updatedAt: '2025-11-20T11:00:00Z',
  },
]

export default function ArtistRiderPage() {
  const [riders, setRiders] = useState(mockRiders)
  const [expandedRider, setExpandedRider] = useState<string | null>(null)
  const [showNewRiderForm, setShowNewRiderForm] = useState(false)
  const [editingRider, setEditingRider] = useState<string | null>(null)

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr))
  }

  const handleSetDefault = (riderId: string) => {
    setRiders((prev) =>
      prev.map((r) => ({
        ...r,
        isDefault: r.id === riderId,
      }))
    )
  }

  const handleDelete = (riderId: string) => {
    if (confirm('Etes-vous sur de vouloir supprimer ce tech rider ?')) {
      setRiders((prev) => prev.filter((r) => r.id !== riderId))
    }
  }

  const handleDuplicate = (rider: TechRider) => {
    const newRider: TechRider = {
      ...rider,
      id: Date.now().toString(),
      name: `${rider.name} (copie)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setRiders((prev) => [...prev, newRider])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tech Riders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez vos fiches techniques pour differents types de performances
          </p>
        </div>
        <button
          onClick={() => setShowNewRiderForm(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nouveau Tech Rider
        </button>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">
              Pourquoi avoir plusieurs tech riders ?
            </h3>
            <p className="mt-1 text-sm text-blue-700">
              Creez des fiches techniques pour chaque type de performance (live complet, DJ set,
              acoustique...). Les organisateurs pourront consulter le rider approprie selon le
              contexte du festival.
            </p>
          </div>
        </div>
      </div>

      {/* Riders List */}
      <div className="space-y-4">
        {riders.map((rider) => (
          <div
            key={rider.id}
            className={cn(
              'rounded-xl border bg-white overflow-hidden transition-shadow',
              rider.isDefault && 'ring-2 ring-primary'
            )}
          >
            {/* Rider Header */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedRider(expandedRider === rider.id ? null : rider.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{rider.name}</h3>
                  {rider.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <Star className="h-3 w-3 fill-current" />
                      Par defaut
                    </span>
                  )}
                </div>
                {rider.description && (
                  <p className="mt-1 text-sm text-gray-500">{rider.description}</p>
                )}
              </div>

              {/* Time indicators */}
              <div className="hidden md:flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Montage: {rider.setupTime}min</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>SC: {rider.soundcheckTime}min</span>
                </div>
              </div>

              {/* Section indicators */}
              <div className="hidden md:flex items-center gap-2">
                {rider.hasSound && (
                  <div className="rounded-full bg-green-100 p-1.5" title="Exigences son">
                    <Speaker className="h-4 w-4 text-green-600" />
                  </div>
                )}
                {rider.hasLight && (
                  <div className="rounded-full bg-yellow-100 p-1.5" title="Exigences lumiere">
                    <Lightbulb className="h-4 w-4 text-yellow-600" />
                  </div>
                )}
                {rider.hasBackline && (
                  <div className="rounded-full bg-blue-100 p-1.5" title="Backline">
                    <Music className="h-4 w-4 text-blue-600" />
                  </div>
                )}
                {rider.hasHospitality && (
                  <div className="rounded-full bg-purple-100 p-1.5" title="Hospitalite">
                    <Coffee className="h-4 w-4 text-purple-600" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {expandedRider === rider.id ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded Content */}
            {expandedRider === rider.id && (
              <div className="border-t bg-gray-50 p-4">
                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="rounded-lg bg-white border p-3 flex-1 min-w-[150px]">
                    <p className="text-xs text-gray-500">Montage</p>
                    <p className="text-lg font-bold text-gray-900">{rider.setupTime} min</p>
                  </div>
                  <div className="rounded-lg bg-white border p-3 flex-1 min-w-[150px]">
                    <p className="text-xs text-gray-500">Soundcheck</p>
                    <p className="text-lg font-bold text-gray-900">{rider.soundcheckTime} min</p>
                  </div>
                  <div className="rounded-lg bg-white border p-3 flex-1 min-w-[150px]">
                    <p className="text-xs text-gray-500">Demontage</p>
                    <p className="text-lg font-bold text-gray-900">{rider.teardownTime} min</p>
                  </div>
                  <div className="rounded-lg bg-white border p-3 flex-1 min-w-[150px]">
                    <p className="text-xs text-gray-500">Mise a jour</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(rider.updatedAt)}</p>
                  </div>
                </div>

                {/* Sections */}
                <div className="grid gap-3 md:grid-cols-4 mb-4">
                  <div
                    className={cn(
                      'rounded-lg border p-3',
                      rider.hasSound ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Speaker
                        className={cn('h-5 w-5', rider.hasSound ? 'text-green-600' : 'text-gray-400')}
                      />
                      <span
                        className={cn(
                          'font-medium',
                          rider.hasSound ? 'text-green-700' : 'text-gray-400'
                        )}
                      >
                        Son
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'rounded-lg border p-3',
                      rider.hasLight ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-100 border-gray-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb
                        className={cn('h-5 w-5', rider.hasLight ? 'text-yellow-600' : 'text-gray-400')}
                      />
                      <span
                        className={cn(
                          'font-medium',
                          rider.hasLight ? 'text-yellow-700' : 'text-gray-400'
                        )}
                      >
                        Lumiere
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'rounded-lg border p-3',
                      rider.hasBackline ? 'bg-blue-50 border-blue-200' : 'bg-gray-100 border-gray-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Music
                        className={cn('h-5 w-5', rider.hasBackline ? 'text-blue-600' : 'text-gray-400')}
                      />
                      <span
                        className={cn(
                          'font-medium',
                          rider.hasBackline ? 'text-blue-700' : 'text-gray-400'
                        )}
                      >
                        Backline
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'rounded-lg border p-3',
                      rider.hasHospitality
                        ? 'bg-purple-50 border-purple-200'
                        : 'bg-gray-100 border-gray-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Coffee
                        className={cn(
                          'h-5 w-5',
                          rider.hasHospitality ? 'text-purple-600' : 'text-gray-400'
                        )}
                      />
                      <span
                        className={cn(
                          'font-medium',
                          rider.hasHospitality ? 'text-purple-700' : 'text-gray-400'
                        )}
                      >
                        Hospitalite
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingRider(rider.id)
                    }}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white"
                  >
                    <Edit className="h-4 w-4" />
                    Modifier
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDuplicate(rider)
                    }}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white"
                  >
                    <Copy className="h-4 w-4" />
                    Dupliquer
                  </button>
                  {!rider.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSetDefault(rider.id)
                      }}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white"
                    >
                      <Star className="h-4 w-4" />
                      Definir par defaut
                    </button>
                  )}
                  <div className="flex-1" />
                  {!rider.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(rider.id)
                      }}
                      className="flex items-center gap-2 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {riders.length === 0 && (
          <div className="rounded-xl border border-dashed bg-gray-50 p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun tech rider</h3>
            <p className="text-sm text-gray-500 mb-4">
              Creez votre premier tech rider pour communiquer vos besoins techniques aux
              organisateurs.
            </p>
            <button
              onClick={() => setShowNewRiderForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Creer un tech rider
            </button>
          </div>
        )}
      </div>

      {/* Documents Section */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents associes</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-4 rounded-lg border p-3">
            <FileText className="h-8 w-8 text-red-500" />
            <div className="flex-1">
              <p className="font-medium text-gray-900">ODESZA_Full_Rider_2026.pdf</p>
              <p className="text-sm text-gray-500">PDF - 2.4 MB</p>
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <ExternalLink className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-4 rounded-lg border p-3">
            <FileText className="h-8 w-8 text-red-500" />
            <div className="flex-1">
              <p className="font-medium text-gray-900">Stage_Plot_Live_Show.pdf</p>
              <p className="text-sm text-gray-500">PDF - 1.1 MB</p>
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <ExternalLink className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-4 rounded-lg border p-3">
            <FileText className="h-8 w-8 text-blue-500" />
            <div className="flex-1">
              <p className="font-medium text-gray-900">Input_List.xlsx</p>
              <p className="text-sm text-gray-500">Excel - 45 KB</p>
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <ExternalLink className="h-5 w-5" />
            </button>
          </div>
        </div>
        <button className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-gray-300 w-full py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 justify-center">
          <Upload className="h-4 w-4" />
          Ajouter un document
        </button>
      </div>

      {/* New Rider Modal */}
      {showNewRiderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Nouveau Tech Rider</h2>
              <button
                onClick={() => setShowNewRiderForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du rider
                </label>
                <input
                  type="text"
                  placeholder="Ex: Full Live Show, DJ Set, Acoustic..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Description courte de ce type de performance..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montage (min)
                  </label>
                  <input
                    type="number"
                    placeholder="60"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Soundcheck (min)
                  </label>
                  <input
                    type="number"
                    placeholder="30"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Demontage (min)
                  </label>
                  <input
                    type="number"
                    placeholder="30"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="isDefault" className="text-sm text-gray-700">
                  Definir comme rider par defaut
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewRiderForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                >
                  <Save className="h-4 w-4" />
                  Creer le rider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
