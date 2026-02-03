import type { Metadata } from 'next'
import { ScheduleView } from '@/components/features'
import type { Performance, Stage, Artist } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Programme',
  description: 'Decouvrez le programme complet du Festival 2026 : horaires, scenes et artistes.',
}

// Demo data - in production, this would be fetched from API
const demoStages: Stage[] = [
  {
    id: 'main',
    festivalId: 'demo',
    name: 'Main Stage',
    location: 'Zone A',
    capacity: 15000,
    settings: { color: '#d946ef', isIndoor: false, hasSeating: false },
  },
  {
    id: 'electro',
    festivalId: 'demo',
    name: 'Electro Arena',
    location: 'Zone B',
    capacity: 8000,
    settings: { color: '#00f5ff', isIndoor: true, hasSeating: false },
  },
  {
    id: 'chill',
    festivalId: 'demo',
    name: 'Chill Garden',
    location: 'Zone C',
    capacity: 3000,
    settings: { color: '#39ff14', isIndoor: false, hasSeating: true },
  },
]

const demoArtists: Record<string, Artist> = {
  'daft-punk': {
    id: 'daft-punk',
    festivalId: 'demo',
    name: 'Daft Punk',
    description: 'Legendary French electronic duo',
    genre: 'Electronic',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
    socialLinks: {},
  },
  'weeknd': {
    id: 'weeknd',
    festivalId: 'demo',
    name: 'The Weeknd',
    description: 'Canadian singer-songwriter',
    genre: 'R&B / Pop',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
    socialLinks: {},
  },
  'disclosure': {
    id: 'disclosure',
    festivalId: 'demo',
    name: 'Disclosure',
    description: 'British electronic music duo',
    genre: 'House',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop',
    socialLinks: {},
  },
  'billie': {
    id: 'billie',
    festivalId: 'demo',
    name: 'Billie Eilish',
    description: 'American singer-songwriter',
    genre: 'Alternative',
    imageUrl: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=200&h=200&fit=crop',
    socialLinks: {},
  },
  'stromae': {
    id: 'stromae',
    festivalId: 'demo',
    name: 'Stromae',
    description: 'Belgian singer-songwriter',
    genre: 'Electronic / Hip-Hop',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=200&h=200&fit=crop',
    socialLinks: {},
  },
  'anitta': {
    id: 'anitta',
    festivalId: 'demo',
    name: 'Anitta',
    description: 'Brazilian singer and actress',
    genre: 'Pop / Reggaeton',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200&h=200&fit=crop',
    socialLinks: {},
  },
}

const demoDays = ['2026-07-15', '2026-07-16', '2026-07-17']

const demoPerformances: Performance[] = [
  // Day 1
  {
    id: 'p1',
    festivalId: 'demo',
    artistId: 'daft-punk',
    stageId: 'main',
    startTime: '2026-07-15T22:00:00Z',
    endTime: '2026-07-15T00:00:00Z',
    day: '2026-07-15',
    status: 'SCHEDULED',
    artist: demoArtists['daft-punk'],
    stage: demoStages[0],
  },
  {
    id: 'p2',
    festivalId: 'demo',
    artistId: 'disclosure',
    stageId: 'electro',
    startTime: '2026-07-15T20:00:00Z',
    endTime: '2026-07-15T22:00:00Z',
    day: '2026-07-15',
    status: 'SCHEDULED',
    artist: demoArtists['disclosure'],
    stage: demoStages[1],
  },
  {
    id: 'p3',
    festivalId: 'demo',
    artistId: 'anitta',
    stageId: 'chill',
    startTime: '2026-07-15T18:00:00Z',
    endTime: '2026-07-15T19:30:00Z',
    day: '2026-07-15',
    status: 'SCHEDULED',
    artist: demoArtists['anitta'],
    stage: demoStages[2],
  },
  // Day 2
  {
    id: 'p4',
    festivalId: 'demo',
    artistId: 'weeknd',
    stageId: 'main',
    startTime: '2026-07-16T22:00:00Z',
    endTime: '2026-07-17T00:00:00Z',
    day: '2026-07-16',
    status: 'SCHEDULED',
    artist: demoArtists['weeknd'],
    stage: demoStages[0],
  },
  {
    id: 'p5',
    festivalId: 'demo',
    artistId: 'stromae',
    stageId: 'main',
    startTime: '2026-07-16T20:00:00Z',
    endTime: '2026-07-16T21:30:00Z',
    day: '2026-07-16',
    status: 'SCHEDULED',
    artist: demoArtists['stromae'],
    stage: demoStages[0],
  },
  {
    id: 'p6',
    festivalId: 'demo',
    artistId: 'disclosure',
    stageId: 'electro',
    startTime: '2026-07-16T23:00:00Z',
    endTime: '2026-07-17T01:00:00Z',
    day: '2026-07-16',
    status: 'SCHEDULED',
    artist: demoArtists['disclosure'],
    stage: demoStages[1],
  },
  // Day 3
  {
    id: 'p7',
    festivalId: 'demo',
    artistId: 'billie',
    stageId: 'main',
    startTime: '2026-07-17T21:00:00Z',
    endTime: '2026-07-17T23:00:00Z',
    day: '2026-07-17',
    status: 'SCHEDULED',
    artist: demoArtists['billie'],
    stage: demoStages[0],
  },
  {
    id: 'p8',
    festivalId: 'demo',
    artistId: 'daft-punk',
    stageId: 'electro',
    startTime: '2026-07-17T23:30:00Z',
    endTime: '2026-07-18T02:00:00Z',
    day: '2026-07-17',
    status: 'SCHEDULED',
    artist: demoArtists['daft-punk'],
    stage: demoStages[1],
  },
]

export default function ProgrammePage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-festival-950/30 to-black" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-festival-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-neon-blue/20 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-festival-400 text-sm font-semibold tracking-wider uppercase mb-4">
            15-17 Juillet 2026
          </span>
          <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl mb-6">
            Programme
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            3 jours, 3 scenes, 50+ artistes. Decouvrez le programme complet et planifiez votre festival.
          </p>
        </div>
      </section>

      {/* Schedule */}
      <section className="py-12 pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ScheduleView
            days={demoDays}
            stages={demoStages}
            performances={demoPerformances}
          />
        </div>
      </section>
    </div>
  )
}
