'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Plus, ShoppingCart, Tent, Car, ArrowRight } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { useCartStore } from '@/stores/cart'

interface CartSummaryProps {
  showCheckoutButton?: boolean
  editable?: boolean
}

export function CartSummary({ showCheckoutButton = true, editable = true }: CartSummaryProps) {
  const { items, options, removeItem, updateQuantity, setOptions, getTotalPrice, clearCart } =
    useCartStore()

  const subtotal = items.reduce(
    (sum, item) => sum + item.ticketType.price * item.quantity,
    0
  )
  const campingPrice = options.camping ? 5000 : 0
  const parkingPrice = options.parking ? 2000 : 0
  const total = getTotalPrice()

  if (items.length === 0) {
    return (
      <Card className="p-6 text-center">
        <ShoppingCart className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400">Votre panier est vide</p>
        <Link href="/tickets" className="mt-4 inline-block">
          <Button variant="primary">Voir les billets</Button>
        </Link>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Votre panier</CardTitle>
          {editable && (
            <button
              onClick={clearCart}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Vider le panier
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cart Items */}
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              key={item.ticketTypeId}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-4 pb-4 border-b border-white/10 last:border-0 last:pb-0"
            >
              <div className="flex-1">
                <h4 className="font-medium text-white">{item.ticketType.name}</h4>
                <p className="text-sm text-gray-400">
                  {formatCurrency(item.ticketType.price)} / billet
                </p>
              </div>

              {editable ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.ticketTypeId, item.quantity - 1)}
                    className="h-8 w-8 rounded-lg bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-white font-medium w-8 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.ticketTypeId, item.quantity + 1)}
                    className="h-8 w-8 rounded-lg bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removeItem(item.ticketTypeId)}
                    className="h-8 w-8 rounded-lg bg-white/5 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors ml-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <span className="text-white font-medium">x{item.quantity}</span>
              )}

              <span className="text-white font-semibold min-w-[80px] text-right">
                {formatCurrency(item.ticketType.price * item.quantity)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Options */}
        <div className="space-y-3">
          <h5 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Options
          </h5>
          <label className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <Tent className="h-5 w-5 text-festival-400" />
              <div>
                <span className="text-white">Camping</span>
                <p className="text-xs text-gray-400">Acces au camping 3 nuits</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400">{formatCurrency(5000)}</span>
              <input
                type="checkbox"
                checked={options.camping}
                onChange={(e) => setOptions({ camping: e.target.checked })}
                disabled={!editable}
                className="h-5 w-5 rounded border-gray-600 bg-white/10 text-festival-500 focus:ring-festival-500 focus:ring-offset-0"
              />
            </div>
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <Car className="h-5 w-5 text-festival-400" />
              <div>
                <span className="text-white">Parking</span>
                <p className="text-xs text-gray-400">Place de parking garantie</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400">{formatCurrency(2000)}</span>
              <input
                type="checkbox"
                checked={options.parking}
                onChange={(e) => setOptions({ parking: e.target.checked })}
                disabled={!editable}
                className="h-5 w-5 rounded border-gray-600 bg-white/10 text-festival-500 focus:ring-festival-500 focus:ring-offset-0"
              />
            </div>
          </label>
        </div>

        {/* Summary */}
        <div className="space-y-2 pt-4 border-t border-white/10">
          <div className="flex justify-between text-gray-400">
            <span>Sous-total billets</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {campingPrice > 0 && (
            <div className="flex justify-between text-gray-400">
              <span>Camping</span>
              <span>{formatCurrency(campingPrice)}</span>
            </div>
          )}
          {parkingPrice > 0 && (
            <div className="flex justify-between text-gray-400">
              <span>Parking</span>
              <span>{formatCurrency(parkingPrice)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold text-white pt-2 border-t border-white/10">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Checkout Button */}
        {showCheckoutButton && (
          <Link href="/tickets/checkout" className="block">
            <Button variant="primary" size="lg" className="w-full" rightIcon={<ArrowRight className="h-5 w-5" />}>
              Passer commande
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
