'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Check, Minus, Plus, Ticket as TicketIcon } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { useCartStore } from '@/stores/cart'
import type { TicketType } from '@/lib/api'

interface TicketCardProps {
  ticket: TicketType
  featured?: boolean
}

export function TicketCard({ ticket, featured = false }: TicketCardProps) {
  const [quantity, setQuantity] = React.useState(1)
  const { addItem, items } = useCartStore()

  const cartItem = items.find((item) => item.ticketTypeId === ticket.id)
  const isInCart = !!cartItem
  const isSoldOut = ticket.status === 'SOLD_OUT' || ticket.available === 0

  const handleAddToCart = () => {
    addItem(ticket, quantity)
    setQuantity(1)
  }

  const decreaseQuantity = () => {
    if (quantity > 1) setQuantity(quantity - 1)
  }

  const increaseQuantity = () => {
    const maxAvailable = ticket.available > 0 ? ticket.available : 10
    if (quantity < maxAvailable) setQuantity(quantity + 1)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <Card
        className={`relative overflow-hidden ${
          featured
            ? 'border-festival-500/50 bg-gradient-to-br from-festival-500/10 to-festival-900/10'
            : ''
        }`}
        glow={featured}
      >
        {/* Featured badge */}
        {featured && (
          <div className="absolute top-4 right-4">
            <Badge variant="primary">Populaire</Badge>
          </div>
        )}

        <CardHeader>
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                featured
                  ? 'bg-gradient-to-br from-festival-500 to-festival-600'
                  : 'bg-white/10'
              }`}
            >
              <TicketIcon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">{ticket.name}</CardTitle>
              <p className="text-gray-400 mt-1">{ticket.description}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Price */}
          <div className="mb-6">
            <span className="text-4xl font-bold text-white">
              {formatCurrency(ticket.price)}
            </span>
            {ticket.settings.includesTopUp && ticket.settings.topUpAmount > 0 && (
              <span className="text-sm text-gray-400 ml-2">
                + {formatCurrency(ticket.settings.topUpAmount)} de credit inclus
              </span>
            )}
          </div>

          {/* Benefits */}
          {ticket.benefits && ticket.benefits.length > 0 && (
            <ul className="space-y-3 mb-6">
              {ticket.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-festival-400 shrink-0 mt-0.5" />
                  <span className="text-gray-300">{benefit}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Availability */}
          {ticket.available > 0 && ticket.available < 50 && (
            <p className="text-sm text-yellow-400 mb-4">
              Plus que {ticket.available} places disponibles !
            </p>
          )}

          {/* Actions */}
          {isSoldOut ? (
            <Button variant="secondary" className="w-full" disabled>
              Epuise
            </Button>
          ) : (
            <div className="space-y-4">
              {/* Quantity selector */}
              <div className="flex items-center justify-between bg-white/5 rounded-lg p-2">
                <span className="text-sm text-gray-400 pl-2">Quantite</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={decreaseQuantity}
                    disabled={quantity <= 1}
                    className="h-8 w-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-white font-medium w-8 text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={increaseQuantity}
                    className="h-8 w-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Add to cart button */}
              <Button
                variant={featured ? 'primary' : 'secondary'}
                className="w-full"
                onClick={handleAddToCart}
              >
                {isInCart
                  ? `Ajouter (${cartItem.quantity} dans le panier)`
                  : 'Ajouter au panier'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
