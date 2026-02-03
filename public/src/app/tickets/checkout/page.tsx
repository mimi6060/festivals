'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import { CheckoutForm, CartSummary } from '@/components/features'
import { Button, Card } from '@/components/ui'
import { useCartStore } from '@/stores/cart'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, festivalId } = useCartStore()

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      router.push('/tickets')
    }
  }, [items, router])

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <ShoppingCart className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Panier vide</h2>
          <p className="text-gray-400 mb-6">
            Votre panier est vide. Ajoutez des billets avant de passer commande.
          </p>
          <Link href="/tickets">
            <Button variant="primary">Voir les billets</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <section className="py-12 border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/tickets"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux billets
          </Link>
          <h1 className="text-3xl font-bold text-white">Finaliser la commande</h1>
          <p className="text-gray-400 mt-2">
            Verifiez votre panier et renseignez vos informations
          </p>
        </div>
      </section>

      {/* Checkout Content */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Customer Form */}
            <div>
              <CheckoutForm festivalId={festivalId || 'demo'} />
            </div>

            {/* Order Summary */}
            <div>
              <div className="sticky top-24">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Recapitulatif
                </h2>
                <CartSummary showCheckoutButton={false} editable={false} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
