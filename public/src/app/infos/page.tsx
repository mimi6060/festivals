import type { Metadata } from 'next'
import Image from 'next/image'
import { MapPin, Clock, Car, Train, Tent, Shield, AlertTriangle, Phone, Mail, Download } from 'lucide-react'
import { Card, CardContent, Badge, Accordion, AccordionItem, AccordionTrigger, AccordionContent, Button } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Infos Pratiques',
  description: 'Tout ce que vous devez savoir pour le Festival 2026 : acces, horaires, reglement, FAQ.',
}

const accessInfo = [
  {
    icon: Train,
    title: 'En transport',
    items: [
      'RER B : Arret "Parc des Expositions"',
      'Navettes gratuites depuis Gare du Nord (toutes les 15 min)',
      'Ligne 7 du metro + navette',
    ],
  },
  {
    icon: Car,
    title: 'En voiture',
    items: [
      'Autoroute A1, sortie "Parc des Expositions"',
      'Parking P1 a 500m de l\'entree (20EUR/jour)',
      'Covoiturage recommande - BlaBlaCar partenaire',
    ],
  },
]

const scheduleInfo = [
  { day: 'Vendredi 15/07', gates: '14h00', end: '04h00' },
  { day: 'Samedi 16/07', gates: '12h00', end: '04h00' },
  { day: 'Dimanche 17/07', gates: '12h00', end: '00h00' },
]

const rules = [
  {
    icon: Shield,
    title: 'Objets autorises',
    items: [
      'Bouteilles d\'eau vides (max 50cl)',
      'Cremes solaires',
      'Appareils photo (usage personnel)',
      'Medicaments avec ordonnance',
    ],
    variant: 'success' as const,
  },
  {
    icon: AlertTriangle,
    title: 'Objets interdits',
    items: [
      'Alcool et drogues',
      'Objets en verre',
      'Parapluies',
      'Appareils professionnels',
      'Drones',
      'Armes et objets dangereux',
    ],
    variant: 'danger' as const,
  },
]

const faqs = [
  {
    category: 'Billetterie',
    items: [
      {
        question: 'Puis-je me faire rembourser mon billet ?',
        answer: 'Les billets sont remboursables jusqu\'a 30 jours avant le festival. Apres cette date, aucun remboursement ne sera possible sauf annulation de l\'evenement.',
      },
      {
        question: 'Comment recevoir mon billet ?',
        answer: 'Votre billet electronique sera envoye par email apres le paiement. Vous pourrez le telecharger depuis votre espace Mon Compte.',
      },
      {
        question: 'Puis-je transferer mon billet a quelqu\'un d\'autre ?',
        answer: 'Oui, le transfert de billet est possible jusqu\'a 48h avant l\'evenement via votre espace Mon Compte.',
      },
    ],
  },
  {
    category: 'Sur place',
    items: [
      {
        question: 'Y a-t-il des consignes ?',
        answer: 'Oui, des consignes securisees sont disponibles a l\'entree (5EUR/jour). Capacite limitee, arrivez tot !',
      },
      {
        question: 'Quel moyen de paiement sur place ?',
        answer: 'Le festival est 100% cashless. Rechargez votre bracelet NFC a l\'entree ou en ligne.',
      },
      {
        question: 'Y a-t-il de l\'eau potable gratuite ?',
        answer: 'Oui, des fontaines a eau sont disponibles sur tout le site. Pensez a apporter une gourde vide.',
      },
    ],
  },
  {
    category: 'Camping',
    items: [
      {
        question: 'Que dois-je apporter au camping ?',
        answer: 'Tente, sac de couchage, lampe torche. Les barbecues et bouteilles en verre sont interdits.',
      },
      {
        question: 'A quelle heure ouvre le camping ?',
        answer: 'Le camping ouvre le jeudi 14 juillet a partir de 14h et ferme le lundi 18 juillet a 12h.',
      },
    ],
  },
]

export default function InfosPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-festival-950/30 to-black" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl mb-6">
            Infos Pratiques
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Tout ce que vous devez savoir pour profiter pleinement du festival.
          </p>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <MapPin className="h-6 w-6 text-festival-400" />
            Plan du site
          </h2>
          <Card className="overflow-hidden">
            <div className="relative aspect-video bg-white/5 flex items-center justify-center">
              {/* Placeholder for map - in production, use actual site map image */}
              <div className="text-center">
                <MapPin className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">Plan du site</p>
                <p className="text-sm text-gray-500 mt-2">
                  Parc des Expositions - Villepinte
                </p>
              </div>
            </div>
            <CardContent className="p-6">
              <Button variant="primary" leftIcon={<Download className="h-4 w-4" />}>
                Telecharger le plan PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Access Section */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8">Comment venir</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accessInfo.map((info, index) => (
              <Card key={index} className="p-6">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-festival-500/20 flex items-center justify-center">
                      <info.icon className="h-5 w-5 text-festival-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{info.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {info.items.map((item, i) => (
                      <li key={i} className="text-gray-400 flex items-start gap-2">
                        <span className="text-festival-400 mt-1">-</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Schedule Section */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <Clock className="h-6 w-6 text-festival-400" />
            Horaires
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scheduleInfo.map((day, index) => (
              <Card key={index} className="p-6 text-center">
                <CardContent className="p-0">
                  <h3 className="text-lg font-semibold text-white mb-4">{day.day}</h3>
                  <div className="space-y-2">
                    <div className="text-gray-400">
                      <span className="text-festival-400 font-medium">Ouverture des portes:</span>
                      <br />
                      {day.gates}
                    </div>
                    <div className="text-gray-400">
                      <span className="text-festival-400 font-medium">Fermeture:</span>
                      <br />
                      {day.end}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Rules Section */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8">Reglement</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rules.map((rule, index) => (
              <Card key={index} className="p-6">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        rule.variant === 'success'
                          ? 'bg-green-500/20'
                          : 'bg-red-500/20'
                      }`}
                    >
                      <rule.icon
                        className={`h-5 w-5 ${
                          rule.variant === 'success' ? 'text-green-400' : 'text-red-400'
                        }`}
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{rule.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {rule.items.map((item, i) => (
                      <li key={i} className="text-gray-400 flex items-start gap-2">
                        <span
                          className={`mt-1 ${
                            rule.variant === 'success' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {rule.variant === 'success' ? '✓' : '✕'}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Camping Section */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="relative aspect-video lg:aspect-auto bg-white/5">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Tent className="h-20 w-20 text-gray-500" />
                </div>
              </div>
              <div className="p-8">
                <Badge variant="primary" className="mb-4">Option</Badge>
                <h3 className="text-2xl font-bold text-white mb-4">Camping</h3>
                <p className="text-gray-400 mb-6">
                  Vivez l&apos;experience festival a 100% avec notre camping officiel.
                  4 nuits sur place, douches chaudes, consignes securisees et ambiance garantie.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="text-gray-300 flex items-center gap-2">
                    <span className="text-festival-400">✓</span>
                    Acces du jeudi 14h au lundi 12h
                  </li>
                  <li className="text-gray-300 flex items-center gap-2">
                    <span className="text-festival-400">✓</span>
                    Douches et sanitaires inclus
                  </li>
                  <li className="text-gray-300 flex items-center gap-2">
                    <span className="text-festival-400">✓</span>
                    Zone securisee 24h/24
                  </li>
                  <li className="text-gray-300 flex items-center gap-2">
                    <span className="text-festival-400">✓</span>
                    Espace food trucks
                  </li>
                </ul>
                <p className="text-2xl font-bold text-white mb-4">50,00 EUR</p>
                <Button variant="primary">Ajouter le camping</Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-12 pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8">Questions frequentes</h2>

          <div className="space-y-12">
            {faqs.map((category, index) => (
              <div key={index}>
                <h3 className="text-xl font-semibold text-white mb-6">{category.category}</h3>
                <Accordion type="single" collapsible className="space-y-2">
                  {category.items.map((faq, faqIndex) => (
                    <AccordionItem
                      key={faqIndex}
                      value={`${index}-${faqIndex}`}
                      className="bg-white/5 rounded-xl px-6 border-none"
                    >
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent>{faq.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8">Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <CardContent className="p-0 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-festival-500/20 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-festival-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Email</p>
                  <a
                    href="mailto:contact@festival.com"
                    className="text-white hover:text-festival-400 transition-colors"
                  >
                    contact@festival.com
                  </a>
                </div>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="p-0 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-festival-500/20 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-festival-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Telephone</p>
                  <a
                    href="tel:+33123456789"
                    className="text-white hover:text-festival-400 transition-colors"
                  >
                    +33 1 23 45 67 89
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
