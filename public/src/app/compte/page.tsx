'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { UserTickets } from '@/components/features'
import { Card, CardContent, Button, Input } from '@/components/ui'
import { User, Ticket, ShoppingBag, Settings, LogIn, Mail, Lock } from 'lucide-react'
import type { UserTicket, Order } from '@/lib/api'

// Demo data - in production, fetch from API with auth
const demoUserTickets: UserTicket[] = [
  {
    id: '1',
    ticketTypeId: 'pass-3j',
    festivalId: 'demo',
    code: 'FEST-ABC123',
    holderName: 'Jean Dupont',
    holderEmail: 'jean.dupont@email.com',
    status: 'VALID',
    qrCodeData: 'FEST-ABC123-VALID-2026',
    createdAt: '2026-01-15T10:00:00Z',
    ticketType: {
      id: 'pass-3j',
      festivalId: 'demo',
      name: 'Pass 3 Jours',
      description: 'Acces complet aux 3 jours',
      price: 18900,
      priceDisplay: '189,00 EUR',
      quantitySold: 0,
      available: 100,
      validFrom: '2026-07-15T00:00:00Z',
      validUntil: '2026-07-17T23:59:59Z',
      benefits: [],
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
    festival: {
      id: 'demo',
      name: 'Festival 2026',
      slug: 'festival-2026',
      description: 'Le festival de l\'ete',
      startDate: '2026-07-15',
      endDate: '2026-07-17',
      location: 'Paris, France',
      timezone: 'Europe/Paris',
      currencyName: 'EUR',
      exchangeRate: 1,
      settings: {},
      status: 'ACTIVE',
    },
  },
]

const demoOrders: Order[] = [
  {
    id: 'order-1',
    festivalId: 'demo',
    orderNumber: 'ORD-2026-001',
    status: 'PAID',
    items: [
      { ticketTypeId: 'pass-3j', quantity: 2, unitPrice: 18900, totalPrice: 37800 },
    ],
    totalAmount: 37800,
    customerEmail: 'jean.dupont@email.com',
    customerName: 'Jean Dupont',
    createdAt: '2026-01-15T10:00:00Z',
  },
]

export default function ComptePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activeTab, setActiveTab] = useState('tickets')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // For demo purposes, simulate login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (email && password) {
      setIsLoggedIn(true)
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-festival-600 to-festival-500 p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Mon Compte</h1>
              <p className="text-festival-100 mt-2">
                Connectez-vous pour acceder a vos billets
              </p>
            </div>

            <CardContent className="p-8">
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean.dupont@email.com"
                  leftIcon={<Mail className="h-4 w-4" />}
                />
                <Input
                  label="Mot de passe"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  leftIcon={<Lock className="h-4 w-4" />}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  leftIcon={<LogIn className="h-4 w-4" />}
                >
                  Se connecter
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/compte/reset"
                  className="text-sm text-festival-400 hover:text-festival-300 transition-colors"
                >
                  Mot de passe oublie ?
                </Link>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <p className="text-gray-400 mb-4">Pas encore de compte ?</p>
                <Button variant="outline" className="w-full">
                  Creer un compte
                </Button>
              </div>

              {/* Demo hint */}
              <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-300 text-center">
                  Demo: Entrez n&apos;importe quel email et mot de passe pour voir l&apos;interface.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <section className="py-12 border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Mon Compte</h1>
              <p className="text-gray-400 mt-2">
                Bienvenue, Jean Dupont
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => setIsLoggedIn(false)}
            >
              Deconnexion
            </Button>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="tickets" className="flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Mes billets
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Mes commandes
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Parametres
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tickets">
              <UserTickets tickets={demoUserTickets} />
            </TabsContent>

            <TabsContent value="orders">
              <div className="space-y-4">
                {demoOrders.map((order) => (
                  <Card key={order.id} className="p-6">
                    <CardContent className="p-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-white">
                            Commande {order.orderNumber}
                          </h3>
                          <p className="text-sm text-gray-400 mt-1">
                            {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-white">
                            {(order.totalAmount / 100).toFixed(2)} EUR
                          </p>
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                            order.status === 'PAID'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {order.status === 'PAID' ? 'Paye' : 'En attente'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-gray-400">
                              Pass 3 Jours x{item.quantity}
                            </span>
                            <span className="text-gray-300">
                              {(item.totalPrice / 100).toFixed(2)} EUR
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <Card className="p-6">
                <CardContent className="p-0 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Informations personnelles
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Prenom"
                        defaultValue="Jean"
                      />
                      <Input
                        label="Nom"
                        defaultValue="Dupont"
                      />
                      <Input
                        label="Email"
                        type="email"
                        defaultValue="jean.dupont@email.com"
                      />
                      <Input
                        label="Telephone"
                        type="tel"
                        defaultValue="+33 6 12 34 56 78"
                      />
                    </div>
                    <Button variant="primary" className="mt-6">
                      Enregistrer les modifications
                    </Button>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Securite
                    </h3>
                    <Button variant="outline">
                      Changer de mot de passe
                    </Button>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Zone de danger
                    </h3>
                    <Button variant="danger">
                      Supprimer mon compte
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  )
}
