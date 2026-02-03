'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Download,
  FileText,
  Music,
  Lightbulb,
  Mic,
  Speaker,
  Coffee,
  Clock,
  Check,
  X,
  ExternalLink,
  User,
  Mail,
  Phone,
} from 'lucide-react'
import { TechRiderViewer } from '@/components/artists/TechRiderViewer'

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

interface ArtistProfile {
  id: string
  name: string
  stageName?: string
  genre?: string
  profileImageUrl?: string
  contactInfo: {
    email?: string
    phone?: string
    managerName?: string
    managerEmail?: string
  }
}

// Mock data
const mockArtist: ArtistProfile = {
  id: 'a1',
  name: 'Harrison Clayton',
  stageName: 'ODESZA',
  genre: 'Electronic',
  contactInfo: {
    email: 'booking@odesza.com',
    managerName: 'Sarah Chen',
    managerEmail: 'sarah@redlightmanagement.com',
  },
}

const mockRider: TechRider = {
  id: 'r1',
  name: 'Full Live Show',
  description: 'Complete live performance setup with full band and visual production',
  isDefault: true,
  setupTime: 90,
  soundcheckTime: 60,
  teardownTime: 45,
  soundRequirements: {
    minPaWatts: 50000,
    monitorChannels: 12,
    inEarMonitors: true,
    inEarChannels: 6,
    microphoneList: [
      { name: 'Shure SM58', quantity: 4, required: true, notes: 'Vocals' },
      { name: 'Shure SM57', quantity: 6, required: true, notes: 'Drums/Instruments' },
      { name: 'Sennheiser e906', quantity: 2, required: false, notes: 'Guitar amps' },
      { name: 'AKG C414', quantity: 2, required: true, notes: 'Overheads' },
    ],
    diBoxes: 8,
    mixerChannels: 32,
    specialEffects: ['Reverb (Lexicon PCM or similar)', 'Delay', 'Compression on all channels'],
    notes: 'Prefer Midas or Allen & Heath consoles. No Behringer please.',
  },
  lightRequirements: {
    requiresFog: true,
    requiresHaze: true,
    requiresStrobe: true,
    colorPreferences: ['Purple', 'Blue', 'Cyan', 'White'],
    avoidColors: ['Red', 'Green'],
    specialFixtures: ['Moving heads (min 8)', 'LED strips', 'Blinders (4x)', 'Laser (optional)'],
    hasLightingDesign: true,
    lightingDesignUrl: 'https://example.com/odesza-lighting-design.pdf',
    notes: 'We travel with our own lighting designer who will program the show.',
  },
  backlineRequirements: {
    needsBackline: true,
    bringsOwnGear: true,
    drums: {
      needed: true,
      kit: 'DW Collectors Series or similar professional kit',
      kickDrums: 1,
      snareDrums: 1,
      toms: 3,
      cymbals: ['Hi-hats', 'Crash x2', 'Ride', 'China (optional)'],
      hardware: ['Double bass pedal', 'Hi-hat stand', 'Snare stand', 'Cymbal stands x4'],
      notes: 'Drummer brings own snare and cymbals. Need hardware and shells only.',
    },
    keyboards: [
      {
        name: 'Nord Stage 3',
        quantity: 1,
        required: true,
        notes: 'Or Nord Stage 4. Must have 88 keys.',
      },
      {
        name: 'Keyboard stand',
        model: 'X-style double braced',
        quantity: 2,
        required: true,
      },
    ],
    amplifiers: [
      { name: 'Guitar Amp', model: 'Fender Twin Reverb or similar', quantity: 1, required: true },
      { name: 'Bass Amp', model: 'Ampeg SVT or similar', quantity: 1, required: true },
    ],
    notes: 'All backline must be in working condition and tuned before soundcheck.',
  },
  stageRequirements: {
    minWidth: 12,
    minDepth: 10,
    minHeight: 6,
    requiresRisers: true,
    riserDetails: '8x8 drum riser, 4x4 keyboard risers (x2)',
    powerRequirements: '200A three-phase power. Clean power essential for electronics.',
    stagePlotUrl: 'https://example.com/odesza-stage-plot.pdf',
    notes: 'Stage must be covered if outdoor. Minimum 30m throw distance to FOH.',
  },
  hospitalityRequirements: {
    partySize: 12,
    dressingRoomNeeded: true,
    privateDressingRoom: true,
    dietaryRestrictions: ['Vegetarian options required', 'Vegan options for 2 people', 'Gluten-free for 1'],
    mealRequests: [
      'Hot meal before show',
      'Fresh fruit and vegetables',
      'Assorted sandwiches',
      'Hummus and pita',
    ],
    beverageRequests: [
      'Still water (24 bottles)',
      'Sparkling water (12 bottles)',
      'Red Bull (12 cans)',
      'Coffee (fresh brewed)',
      'Assorted teas',
      'Local craft beer (12 bottles)',
    ],
    towelQuantity: 12,
    transportNeeds: 'Ground transport for 12 people from hotel to venue and back.',
    accommodationNeeds: '6 hotel rooms (single occupancy) within 15 min of venue.',
    notes: 'Dressing room should have full-length mirror and good lighting for makeup.',
  },
  additionalNotes:
    'Please contact our production manager at least 48 hours before the show to confirm all technical details. We require a minimum 60-minute changeover time before our set.',
  documentUrls: [
    'https://example.com/odesza-full-rider.pdf',
    'https://example.com/odesza-input-list.pdf',
    'https://example.com/odesza-stage-plot.pdf',
  ],
  createdAt: '2025-06-01T10:00:00Z',
  updatedAt: '2025-12-15T14:30:00Z',
}

export default function ArtistRiderPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const artistId = params.artistId as string

  const [activeTab, setActiveTab] = useState<'sound' | 'light' | 'backline' | 'stage' | 'hospitality'>('sound')

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateStr))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-medium">
              {mockArtist.stageName?.charAt(0) || mockArtist.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Tech Rider - {mockArtist.stageName || mockArtist.name}
              </h1>
              <p className="text-sm text-gray-500">{mockRider.name}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Telecharger PDF
          </button>
        </div>
      </div>

      {/* Contact Info */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Contact</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">Manager:</span>
            <span>{mockArtist.contactInfo.managerName || '-'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-gray-400" />
            <a
              href={`mailto:${mockArtist.contactInfo.managerEmail}`}
              className="text-primary hover:underline"
            >
              {mockArtist.contactInfo.managerEmail || '-'}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">Mis a jour:</span>
            <span>{formatDate(mockRider.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Time Requirements */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Montage</p>
              <p className="text-xl font-bold">{mockRider.setupTime} min</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Mic className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Soundcheck</p>
              <p className="text-xl font-bold">{mockRider.soundcheckTime} min</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Demontage</p>
              <p className="text-xl font-bold">{mockRider.teardownTime} min</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tech Rider Tabs */}
      <div className="rounded-lg border bg-white overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b">
          <nav className="flex overflow-x-auto">
            {[
              { id: 'sound', label: 'Son', icon: Speaker },
              { id: 'light', label: 'Lumiere', icon: Lightbulb },
              { id: 'backline', label: 'Backline', icon: Music },
              { id: 'stage', label: 'Scene', icon: FileText },
              { id: 'hospitality', label: 'Hospitalite', icon: Coffee },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <TechRiderViewer rider={mockRider} activeTab={activeTab} />
        </div>
      </div>

      {/* Additional Notes */}
      {mockRider.additionalNotes && (
        <div className="rounded-lg border bg-yellow-50 border-yellow-200 p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">Notes importantes</h3>
          <p className="text-sm text-yellow-700">{mockRider.additionalNotes}</p>
        </div>
      )}

      {/* Documents */}
      {mockRider.documentUrls && mockRider.documentUrls.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Documents joints</h3>
          <div className="space-y-2">
            {mockRider.documentUrls.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50 transition-colors"
              >
                <FileText className="h-5 w-5 text-gray-400" />
                <span className="flex-1 text-sm text-gray-700">
                  {url.split('/').pop() || `Document ${index + 1}`}
                </span>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
