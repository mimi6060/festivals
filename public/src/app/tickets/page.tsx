import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Shield, Zap, CreditCard } from 'lucide-react'
import { TicketCard, CartSummary } from '@/components/features'
import { Card, CardContent, Button } from '@/components/ui'
import type { TicketType } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Billetterie',
  description: 'Achetez vos billets pour le Festival 2026. Pass 3 jours, Pass VIP et plus.',
}

// Demo data - in production, this would be fetched from API
const demoTickets: TicketType[] = [
  {
    id: 'pass-3j',
    festivalId: 'demo',
    name: 'Pass 3 Jours',
    description: 'Acces complet aux 3 jours du festival',
    price: 18900, // 189 EUR in cents
    priceDisplay: '189,00 EUR',
    quantity: 5000,
    quantitySold: 4500,
    available: 500,
    validFrom: '2026-07-15T00:00:00Z',
    validUntil: '2026-07-17T23:59:59Z',
    benefits: [
      'Acces aux 3 scenes',
      'Acces aux 3 jours complets',
      'Bracelet cashless inclus',
    ],
    settings: {
      allowReentry: true,
      includesTopUp: false,
      topUpAmount: 0,
      requiresId: false,
      transferAllowed: true,
      maxTransfers: 1,
    },
    status: 'ACTIVE',
  },
  {
    id: 'pass-vip',
    festivalId: 'demo',
    name: 'Pass VIP 3 Jours',
    description: 'Experience premium avec acces exclusifs',
    price: 34900, // 349 EUR in cents
    priceDisplay: '349,00 EUR',
    quantity: 500,
    quantitySold: 380,
    available: 120,
    validFrom: '2026-07-15T00:00:00Z',
    validUntil: '2026-07-17T23:59:59Z',
    benefits: [
      'Acces aux 3 scenes',
      'Acces aux 3 jours complets',
      'Zone VIP avec bar prive',
      'Viewing deck privilegie',
      'Fast lane entree',
      '20 EUR de credit offert',
    ],
    settings: {
      allowReentry: true,
      includesTopUp: true,
      topUpAmount: 2000,
      requiresId: true,
      transferAllowed: true,
      maxTransfers: 2,
    },
    status: 'ACTIVE',
  },
  {
    id: 'pass-1j-ven',
    festivalId: 'demo',
    name: 'Pass Vendredi',
    description: 'Acces au festival le vendredi 15 juillet',
    price: 7500, // 75 EUR in cents
    priceDisplay: '75,00 EUR',
    quantity: 2000,
    quantitySold: 1800,
    available: 200,
    validFrom: '2026-07-15T00:00:00Z',
    validUntil: '2026-07-15T23:59:59Z',
    benefits: [
      'Acces aux 3 scenes',
      'Vendredi 15 juillet uniquement',
      'Bracelet cashless inclus',
    ],
    settings: {
      allowReentry: true,
      includesTopUp: false,
      topUpAmount: 0,
      requiresId: false,
      transferAllowed: true,
      maxTransfers: 1,
    },
    status: 'ACTIVE',
  },
  {
    id: 'pass-1j-sam',
    festivalId: 'demo',
    name: 'Pass Samedi',
    description: 'Acces au festival le samedi 16 juillet',
    price: 7500, // 75 EUR in cents
    priceDisplay: '75,00 EUR',
    quantity: 2000,
    quantitySold: 2000,
    available: 0,
    validFrom: '2026-07-16T00:00:00Z',
    validUntil: '2026-07-16T23:59:59Z',
    benefits: [
      'Acces aux 3 scenes',
      'Samedi 16 juillet uniquement',
      'Bracelet cashless inclus',
    ],
    settings: {
      allowReentry: true,
      includesTopUp: false,
      topUpAmount: 0,
      requiresId: false,
      transferAllowed: true,
      maxTransfers: 1,
    },
    status: 'SOLD_OUT',
  },
  {
    id: 'pass-1j-dim',
    festivalId: 'demo',
    name: 'Pass Dimanche',
    description: 'Acces au festival le dimanche 17 juillet',
    price: 7500, // 75 EUR in cents
    priceDisplay: '75,00 EUR',
    quantity: 2000,
    quantitySold: 1500,
    available: 500,
    validFrom: '2026-07-17T00:00:00Z',
    validUntil: '2026-07-17T23:59:59Z',
    benefits: [
      'Acces aux 3 scenes',
      'Dimanche 17 juillet uniquement',
      'Bracelet cashless inclus',
    ],
    settings: {
      allowReentry: true,
      includesTopUp: false,
      topUpAmount: 0,
      requiresId: false,
      transferAllowed: true,
      maxTransfers: 1,
    },
    status: 'ACTIVE',
  },
]

const features = [
  {
    icon: Shield,
    title: 'Paiement securise',
    description: 'Transactions cryptees via Stripe',
  },
  {
    icon: Zap,
    title: 'Billets instantanes',
    description: 'Recevez vos billets par email immediatement',
  },
  {
    icon: CreditCard,
    title: 'Plusieurs moyens de paiement',
    description: 'CB, Apple Pay, Google Pay',
  },
]

export default function TicketsPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-festival-950/30 to-black" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-festival-500/20 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-festival-400 text-sm font-semibold tracking-wider uppercase mb-4">
            Billetterie officielle
          </span>
          <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl mb-6">
            Choisissez votre pass
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Securisez votre place pour 3 jours de folie musicale. Places limitees !
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <Card key={index} className="p-4">
                <CardContent className="p-0 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-festival-500/20 flex items-center justify-center shrink-0">
                    <feature.icon className="h-5 w-5 text-festival-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{feature.title}</h3>
                    <p className="text-sm text-gray-400">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tickets and Cart */}
      <section className="py-12 pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Ticket Types */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-xl font-semibold text-white mb-4">Pass disponibles</h2>

              {/* Featured tickets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <TicketCard ticket={demoTickets[0]} />
                <TicketCard ticket={demoTickets[1]} featured />
              </div>

              {/* Day passes */}
              <h3 className="text-lg font-medium text-white mb-4">Pass journee</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {demoTickets.slice(2).map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            </div>

            {/* Cart Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <CartSummary />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-12 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400 mb-4">
            Billetterie officielle du Festival 2026
          </p>
          <p className="text-sm text-gray-500">
            En achetant sur ce site, vous beneficiez de la garantie officielle du festival.
            Tous les billets sont nominatifs et non cessibles (sauf mention contraire).
          </p>
        </div>
      </section>
    </div>
  )
}
