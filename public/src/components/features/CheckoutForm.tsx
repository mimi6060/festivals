'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { User, Mail, Phone, ArrowRight, Lock, CreditCard } from 'lucide-react'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { useCartStore } from '@/stores/cart'
import { createOrder } from '@/lib/api'
import type { CustomerInfo } from '@/types'

interface CheckoutFormProps {
  festivalId: string
}

export function CheckoutForm({ festivalId }: CheckoutFormProps) {
  const router = useRouter()
  const { items, options, clearCart } = useCartStore()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState<CustomerInfo>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  })
  const [errors, setErrors] = React.useState<Partial<CustomerInfo>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof CustomerInfo]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validate = (): boolean => {
    const newErrors: Partial<CustomerInfo> = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Le prenom est requis'
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Le nom est requis'
    }
    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setIsLoading(true)
    setError(null)

    try {
      const order = await createOrder({
        festivalId,
        items: items.map((item) => ({
          ticketTypeId: item.ticketTypeId,
          quantity: item.quantity,
        })),
        customerInfo: formData,
        options: {
          camping: options.camping,
          parking: options.parking,
        },
      })

      // Clear cart after successful order
      clearCart()

      // Redirect to payment or confirmation
      if (order.paymentUrl) {
        window.location.href = order.paymentUrl
      } else {
        router.push(`/tickets/confirmation/${order.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-festival-400" />
            Vos informations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300"
            >
              {error}
            </motion.div>
          )}

          {/* Name fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Prenom"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              error={errors.firstName}
              placeholder="Jean"
              leftIcon={<User className="h-4 w-4" />}
            />
            <Input
              label="Nom"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              error={errors.lastName}
              placeholder="Dupont"
            />
          </div>

          {/* Email */}
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            placeholder="jean.dupont@email.com"
            leftIcon={<Mail className="h-4 w-4" />}
            hint="Vos billets seront envoyes a cette adresse"
          />

          {/* Phone */}
          <Input
            label="Telephone (optionnel)"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+33 6 12 34 56 78"
            leftIcon={<Phone className="h-4 w-4" />}
          />

          {/* Security notice */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5">
            <Lock className="h-5 w-5 text-festival-400 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-400">
              <p>Vos informations sont securisees et ne seront jamais partagees.</p>
              <p className="mt-1">
                Les billets seront envoyes par email apres le paiement.
              </p>
            </div>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={isLoading}
            rightIcon={<CreditCard className="h-5 w-5" />}
          >
            Proceder au paiement
          </Button>

          {/* Payment methods */}
          <div className="text-center text-sm text-gray-500">
            <p>Paiement securise par Stripe</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="px-2 py-1 rounded bg-white/5 text-xs">Visa</span>
              <span className="px-2 py-1 rounded bg-white/5 text-xs">Mastercard</span>
              <span className="px-2 py-1 rounded bg-white/5 text-xs">Apple Pay</span>
              <span className="px-2 py-1 rounded bg-white/5 text-xs">Google Pay</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
