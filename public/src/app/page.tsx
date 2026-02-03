import Link from 'next/link'
import { ArrowRight, Calendar, MapPin, Users, Music2, Zap, Shield } from 'lucide-react'
import { HeroSection, LineupPreview } from '@/components/features'
import { Button, Card, CardContent } from '@/components/ui'
import type { Artist } from '@/lib/api'

// Demo data - in production, this would be fetched from API
const demoArtists: Artist[] = [
  {
    id: '1',
    festivalId: 'demo',
    name: 'Daft Punk',
    description: 'Legendary French electronic duo',
    genre: 'Electronic',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=600&fit=crop',
    socialLinks: {},
  },
  {
    id: '2',
    festivalId: 'demo',
    name: 'The Weeknd',
    description: 'Canadian singer-songwriter',
    genre: 'R&B / Pop',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=600&fit=crop',
    socialLinks: {},
  },
  {
    id: '3',
    festivalId: 'demo',
    name: 'Disclosure',
    description: 'British electronic music duo',
    genre: 'House',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=600&fit=crop',
    socialLinks: {},
  },
  {
    id: '4',
    festivalId: 'demo',
    name: 'Billie Eilish',
    description: 'American singer-songwriter',
    genre: 'Alternative',
    imageUrl: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=400&h=600&fit=crop',
    socialLinks: {},
  },
  {
    id: '5',
    festivalId: 'demo',
    name: 'Stromae',
    description: 'Belgian singer-songwriter',
    genre: 'Electronic / Hip-Hop',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=600&fit=crop',
    socialLinks: {},
  },
  {
    id: '6',
    festivalId: 'demo',
    name: 'Anitta',
    description: 'Brazilian singer and actress',
    genre: 'Pop / Reggaeton',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=600&fit=crop',
    socialLinks: {},
  },
]

const features = [
  {
    icon: Music2,
    title: '50+ Artistes',
    description: '3 scenes, 3 jours de musique non-stop avec les meilleurs artistes internationaux.',
  },
  {
    icon: Users,
    title: '30 000 Festivaliers',
    description: 'Rejoignez une communaute passionnee pour une experience unique.',
  },
  {
    icon: Zap,
    title: 'Experience Unique',
    description: "Installations artistiques, food trucks gastronomiques et bien plus encore.",
  },
  {
    icon: Shield,
    title: 'Securise & Sans Contact',
    description: 'Paiement cashless, billets QR code et securite renforcee.',
  },
]

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <HeroSection
        festivalName="Festival 2026"
        tagline="L'experience musicale ultime"
        dates="15 - 17 Juillet 2026"
        location="Parc des Expositions, Paris"
        imageUrl="https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1920&q=80"
      />

      {/* Features Section */}
      <section className="relative py-24 bg-black">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} hoverable gradient className="p-6">
                <CardContent className="p-0">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-festival-500 to-festival-600 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Lineup Preview */}
      <LineupPreview artists={demoArtists} />

      {/* CTA Section */}
      <section className="relative py-24 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-festival-600 to-festival-900" />
        <div className="absolute inset-0 bg-[url('/images/noise.png')] opacity-10" />

        {/* Decorative elements */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-pink/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-festival-400/30 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-festival-200 text-sm font-semibold tracking-wider uppercase mb-4">
            Ne manquez pas
          </span>
          <h2 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl mb-6">
            Reservez vos places maintenant
          </h2>
          <p className="text-lg text-festival-100 max-w-2xl mx-auto mb-10">
            Les places partent vite ! Securisez votre entree pour 3 jours de folie musicale avec les meilleurs artistes.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/tickets">
              <Button variant="secondary" size="xl" rightIcon={<ArrowRight className="h-5 w-5" />}>
                Acheter des billets
              </Button>
            </Link>
            <Link href="/infos">
              <Button variant="ghost" size="xl">
                En savoir plus
              </Button>
            </Link>
          </div>

          {/* Quick info */}
          <div className="mt-12 flex flex-wrap justify-center gap-8">
            <div className="flex items-center gap-2 text-festival-100">
              <Calendar className="h-5 w-5" />
              <span>15-17 Juillet 2026</span>
            </div>
            <div className="flex items-center gap-2 text-festival-100">
              <MapPin className="h-5 w-5" />
              <span>Paris, France</span>
            </div>
          </div>
        </div>
      </section>

      {/* Info Cards */}
      <section className="relative py-24 bg-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card hoverable className="p-6">
              <CardContent className="p-0">
                <h3 className="text-xl font-semibold text-white mb-4">Infos Pratiques</h3>
                <p className="text-gray-400 mb-6">
                  Tout ce que vous devez savoir sur le festival : acces, hebergement, regles, etc.
                </p>
                <Link href="/infos">
                  <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
                    Consulter
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card hoverable className="p-6">
              <CardContent className="p-0">
                <h3 className="text-xl font-semibold text-white mb-4">Programme</h3>
                <p className="text-gray-400 mb-6">
                  Decouvrez le programme complet : horaires, scenes, et tous les artistes.
                </p>
                <Link href="/programme">
                  <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
                    Voir le programme
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card hoverable className="p-6">
              <CardContent className="p-0">
                <h3 className="text-xl font-semibold text-white mb-4">Mon Compte</h3>
                <p className="text-gray-400 mb-6">
                  Accedez a vos billets, telechargez vos QR codes et gerez vos reservations.
                </p>
                <Link href="/compte">
                  <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
                    Se connecter
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
