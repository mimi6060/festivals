'use client'

import { cn } from '@/lib/utils'
import {
  Check,
  X,
  AlertCircle,
  Speaker,
  Mic,
  Headphones,
  Music,
  FileText,
  ExternalLink,
} from 'lucide-react'

// Types
interface Equipment {
  name: string
  model?: string
  quantity: number
  required: boolean
  notes?: string
}

interface DrumKit {
  needed: boolean
  kit?: string
  kickDrums?: number
  snareDrums?: number
  toms?: number
  cymbals?: string[]
  hardware?: string[]
  notes?: string
}

interface DJSetup {
  cdjs?: number
  cdjModel?: string
  turntables?: number
  turntableModel?: string
  mixer?: string
  needsLaptopStand?: boolean
  needsUsb?: boolean
  notes?: string
}

interface TechRider {
  id: string
  name: string
  description?: string
  isDefault: boolean
  setupTime: number
  soundcheckTime: number
  teardownTime: number
  soundRequirements: {
    minPaWatts?: number
    monitorChannels?: number
    inEarMonitors?: boolean
    inEarChannels?: number
    microphoneList?: Equipment[]
    diBoxes?: number
    mixerChannels?: number
    specialEffects?: string[]
    notes?: string
  }
  lightRequirements: {
    requiresFog?: boolean
    requiresHaze?: boolean
    requiresStrobe?: boolean
    colorPreferences?: string[]
    avoidColors?: string[]
    specialFixtures?: string[]
    hasLightingDesign?: boolean
    lightingDesignUrl?: string
    notes?: string
  }
  backlineRequirements: {
    needsBackline: boolean
    bringsOwnGear: boolean
    drums?: DrumKit
    keyboards?: Equipment[]
    amplifiers?: Equipment[]
    djEquipment?: DJSetup
    otherEquipment?: Equipment[]
    notes?: string
  }
  stageRequirements: {
    minWidth?: number
    minDepth?: number
    minHeight?: number
    requiresRisers?: boolean
    riserDetails?: string
    requiresCatwalk?: boolean
    powerRequirements?: string
    stagePlotUrl?: string
    notes?: string
  }
  hospitalityRequirements: {
    partySize?: number
    dressingRoomNeeded?: boolean
    privateDressingRoom?: boolean
    dietaryRestrictions?: string[]
    mealRequests?: string[]
    beverageRequests?: string[]
    towelQuantity?: number
    transportNeeds?: string
    accommodationNeeds?: string
    notes?: string
  }
  additionalNotes?: string
  documentUrls?: string[]
  createdAt: string
  updatedAt: string
}

interface TechRiderViewerProps {
  rider: TechRider
  activeTab: 'sound' | 'light' | 'backline' | 'stage' | 'hospitality'
}

function BooleanIndicator({ value, label }: { value?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-gray-400" />
      )}
      <span className={cn('text-sm', value ? 'text-gray-900' : 'text-gray-400')}>{label}</span>
    </div>
  )
}

function EquipmentTable({ items, title }: { items: Equipment[]; title: string }) {
  if (!items || items.length === 0) return null

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Equipement
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Modele
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                Qte
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                Requis
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={index} className="bg-white">
                <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.model || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity}</td>
                <td className="px-4 py-3 text-center">
                  {item.required ? (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Requis
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      Optionnel
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ListSection({ items, title }: { items?: string[]; title: string }) {
  if (!items || items.length === 0) return null

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      <ul className="list-disc list-inside space-y-1">
        {items.map((item, index) => (
          <li key={index} className="text-sm text-gray-600">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function NotesSection({ notes }: { notes?: string }) {
  if (!notes) return null

  return (
    <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-medium text-yellow-800 mb-1">Notes</h4>
          <p className="text-sm text-yellow-700">{notes}</p>
        </div>
      </div>
    </div>
  )
}

export function TechRiderViewer({ rider, activeTab }: TechRiderViewerProps) {
  // Sound Tab
  if (activeTab === 'sound') {
    const sound = rider.soundRequirements
    return (
      <div className="space-y-6">
        {/* PA and Monitors */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Speaker className="h-5 w-5" />
              Systeme PA
            </h3>
            <div className="grid gap-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Puissance minimale</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sound.minPaWatts ? `${sound.minPaWatts.toLocaleString()} W` : '-'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Canaux console</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sound.mixerChannels || '-'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Boites DI</p>
                <p className="text-2xl font-bold text-gray-900">{sound.diBoxes || '-'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              Monitoring
            </h3>
            <div className="grid gap-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Retours de scene</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sound.monitorChannels || '-'} canaux
                </p>
              </div>
              <div className="space-y-2">
                <BooleanIndicator value={sound.inEarMonitors} label="In-ear monitors requis" />
                {sound.inEarMonitors && (
                  <p className="text-sm text-gray-500 ml-6">
                    {sound.inEarChannels} canaux in-ear
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Microphones */}
        <EquipmentTable items={sound.microphoneList || []} title="Liste des microphones" />

        {/* Effects */}
        <ListSection items={sound.specialEffects} title="Effets requis" />

        {/* Notes */}
        <NotesSection notes={sound.notes} />
      </div>
    )
  }

  // Light Tab
  if (activeTab === 'light') {
    const light = rider.lightRequirements
    return (
      <div className="space-y-6">
        {/* Atmospheric Effects */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Effets atmospheriques</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <BooleanIndicator value={light.requiresFog} label="Machine a fumee" />
            </div>
            <div className="space-y-2">
              <BooleanIndicator value={light.requiresHaze} label="Hazer" />
            </div>
            <div className="space-y-2">
              <BooleanIndicator value={light.requiresStrobe} label="Stroboscope" />
            </div>
          </div>
        </div>

        {/* Color Preferences */}
        <div className="grid gap-6 md:grid-cols-2">
          {light.colorPreferences && light.colorPreferences.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Couleurs preferees</h4>
              <div className="flex flex-wrap gap-2">
                {light.colorPreferences.map((color, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700"
                  >
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}
          {light.avoidColors && light.avoidColors.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Couleurs a eviter</h4>
              <div className="flex flex-wrap gap-2">
                {light.avoidColors.map((color, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700"
                  >
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Special Fixtures */}
        <ListSection items={light.specialFixtures} title="Projecteurs speciaux" />

        {/* Lighting Design */}
        {light.hasLightingDesign && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                L'artiste dispose d'un plan lumiere
              </span>
            </div>
            {light.lightingDesignUrl && (
              <a
                href={light.lightingDesignUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                Voir le plan lumiere
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        )}

        {/* Notes */}
        <NotesSection notes={light.notes} />
      </div>
    )
  }

  // Backline Tab
  if (activeTab === 'backline') {
    const backline = rider.backlineRequirements
    return (
      <div className="space-y-6">
        {/* Overview */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <BooleanIndicator value={backline.needsBackline} label="Backline necessaire" />
          </div>
          <div className="space-y-2">
            <BooleanIndicator value={backline.bringsOwnGear} label="Apporte son propre materiel" />
          </div>
        </div>

        {/* Drums */}
        {backline.drums?.needed && (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">Batterie</h3>
            <div className="rounded-lg border p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-gray-500">Kit</p>
                  <p className="font-medium">{backline.drums.kit || 'Standard'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Grosses caisses</p>
                  <p className="font-medium">{backline.drums.kickDrums || 1}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Caisse claire</p>
                  <p className="font-medium">{backline.drums.snareDrums || 1}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Toms</p>
                  <p className="font-medium">{backline.drums.toms || 3}</p>
                </div>
              </div>
              <ListSection items={backline.drums.cymbals} title="Cymbales" />
              <ListSection items={backline.drums.hardware} title="Hardware" />
              {backline.drums.notes && (
                <p className="text-sm text-gray-500 italic">{backline.drums.notes}</p>
              )}
            </div>
          </div>
        )}

        {/* DJ Equipment */}
        {backline.djEquipment && (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">Equipement DJ</h3>
            <div className="rounded-lg border p-4">
              <div className="grid gap-4 md:grid-cols-3">
                {backline.djEquipment.cdjs && (
                  <div>
                    <p className="text-sm text-gray-500">CDJs</p>
                    <p className="font-medium">
                      {backline.djEquipment.cdjs}x {backline.djEquipment.cdjModel || 'CDJ-3000'}
                    </p>
                  </div>
                )}
                {backline.djEquipment.turntables && (
                  <div>
                    <p className="text-sm text-gray-500">Platines</p>
                    <p className="font-medium">
                      {backline.djEquipment.turntables}x{' '}
                      {backline.djEquipment.turntableModel || 'Technics 1210'}
                    </p>
                  </div>
                )}
                {backline.djEquipment.mixer && (
                  <div>
                    <p className="text-sm text-gray-500">Table de mixage</p>
                    <p className="font-medium">{backline.djEquipment.mixer}</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-4">
                <BooleanIndicator
                  value={backline.djEquipment.needsLaptopStand}
                  label="Support laptop"
                />
                <BooleanIndicator value={backline.djEquipment.needsUsb} label="Cle USB requise" />
              </div>
            </div>
          </div>
        )}

        {/* Keyboards */}
        <EquipmentTable items={backline.keyboards || []} title="Claviers" />

        {/* Amplifiers */}
        <EquipmentTable items={backline.amplifiers || []} title="Amplificateurs" />

        {/* Other Equipment */}
        <EquipmentTable items={backline.otherEquipment || []} title="Autre equipement" />

        {/* Notes */}
        <NotesSection notes={backline.notes} />
      </div>
    )
  }

  // Stage Tab
  if (activeTab === 'stage') {
    const stage = rider.stageRequirements
    return (
      <div className="space-y-6">
        {/* Dimensions */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Dimensions minimales</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Largeur</p>
              <p className="text-2xl font-bold text-gray-900">
                {stage.minWidth ? `${stage.minWidth} m` : '-'}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Profondeur</p>
              <p className="text-2xl font-bold text-gray-900">
                {stage.minDepth ? `${stage.minDepth} m` : '-'}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Hauteur</p>
              <p className="text-2xl font-bold text-gray-900">
                {stage.minHeight ? `${stage.minHeight} m` : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <BooleanIndicator value={stage.requiresRisers} label="Praticables requis" />
            {stage.requiresRisers && stage.riserDetails && (
              <p className="text-sm text-gray-500 ml-6">{stage.riserDetails}</p>
            )}
          </div>
          <div className="space-y-3">
            <BooleanIndicator value={stage.requiresCatwalk} label="Passerelle requise" />
          </div>
        </div>

        {/* Power */}
        {stage.powerRequirements && (
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Alimentation electrique</h4>
            <p className="text-sm text-gray-600">{stage.powerRequirements}</p>
          </div>
        )}

        {/* Stage Plot */}
        {stage.stagePlotUrl && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Plan de scene disponible</span>
              </div>
              <a
                href={stage.stagePlotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Telecharger
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}

        {/* Notes */}
        <NotesSection notes={stage.notes} />
      </div>
    )
  }

  // Hospitality Tab
  if (activeTab === 'hospitality') {
    const hospitality = rider.hospitalityRequirements
    return (
      <div className="space-y-6">
        {/* Party Info */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Taille du groupe</p>
            <p className="text-2xl font-bold text-gray-900">
              {hospitality.partySize || '-'} personnes
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Serviettes</p>
            <p className="text-2xl font-bold text-gray-900">{hospitality.towelQuantity || '-'}</p>
          </div>
          <div className="space-y-2 p-4">
            <BooleanIndicator value={hospitality.dressingRoomNeeded} label="Loge requise" />
            <BooleanIndicator value={hospitality.privateDressingRoom} label="Loge privee" />
          </div>
        </div>

        {/* Dietary */}
        <ListSection items={hospitality.dietaryRestrictions} title="Restrictions alimentaires" />

        {/* Catering */}
        <div className="grid gap-6 md:grid-cols-2">
          <ListSection items={hospitality.mealRequests} title="Repas demandes" />
          <ListSection items={hospitality.beverageRequests} title="Boissons demandees" />
        </div>

        {/* Transport & Accommodation */}
        {(hospitality.transportNeeds || hospitality.accommodationNeeds) && (
          <div className="grid gap-6 md:grid-cols-2">
            {hospitality.transportNeeds && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Transport</h4>
                <p className="text-sm text-gray-600">{hospitality.transportNeeds}</p>
              </div>
            )}
            {hospitality.accommodationNeeds && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Hebergement</h4>
                <p className="text-sm text-gray-600">{hospitality.accommodationNeeds}</p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <NotesSection notes={hospitality.notes} />
      </div>
    )
  }

  return null
}
