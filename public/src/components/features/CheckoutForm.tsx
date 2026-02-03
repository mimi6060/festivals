'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { User, Mail, Phone, ArrowRight, Lock, CreditCard, AlertCircle } from 'lucide-react'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { useCartStore, type CartValidationError } from '@/stores/cart'
import { createOrder } from '@/lib/api'
import type { CustomerInfo } from '@/types'

interface CheckoutFormProps {
  festivalId: string
}

// Input length limits
const INPUT_LIMITS = {
  firstName: 50,
  lastName: 50,
  email: 254,
  phone: 20,
}

// Phone validation regex - supports international formats
// Allows: +33 6 12 34 56 78, 0612345678, +33612345678, etc.
const PHONE_REGEX = /^(\+?\d{1,3}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{0,4}$/

// More strict phone validation for common formats
function validatePhoneNumber(phone: string): { valid: boolean; message?: string } {
  if (!phone.trim()) {
    // Phone is optional
    return { valid: true }
  }

  // Remove all whitespace and common separators for length check
  const digitsOnly = phone.replace(/[\s.-]/g, '')
  const cleanDigits = digitsOnly.replace(/^\+/, '')

  // Check minimum length (at least 6 digits for a valid phone)
  if (cleanDigits.length < 6) {
    return { valid: false, message: 'Numero de telephone trop court' }
  }

  // Check maximum length
  if (cleanDigits.length > 15) {
    return { valid: false, message: 'Numero de telephone trop long' }
  }

  // Check format
  if (!PHONE_REGEX.test(phone.trim())) {
    return { valid: false, message: 'Format de telephone invalide' }
  }

  return { valid: true }
}

export function CheckoutForm({ festivalId }: CheckoutFormProps) {
  const router = useRouter()
  const { items, options, clearCart, validateCart } = useCartStore()
  const [isLoading, setIsLoading] = React.useState(false)
  const [isValidating, setIsValidating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [cartErrors, setCartErrors] = React.useState<CartValidationError[]>([])
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

    // First name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Le prenom est requis'
    } else if (formData.firstName.trim().length > INPUT_LIMITS.firstName) {
      newErrors.firstName = `Le prenom ne peut pas depasser ${INPUT_LIMITS.firstName} caracteres`
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Le nom est requis'
    } else if (formData.lastName.trim().length > INPUT_LIMITS.lastName) {
      newErrors.lastName = `Le nom ne peut pas depasser ${INPUT_LIMITS.lastName} caracteres`
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis"
    } else if (formData.email.trim().length > INPUT_LIMITS.email) {
      newErrors.email = `L'email ne peut pas depasser ${INPUT_LIMITS.email} caracteres`
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide'
    }

    // Phone validation (optional but must be valid if provided)
    const phoneValidation = validatePhoneNumber(formData.phone)
    if (!phoneValidation.valid) {
      newErrors.phone = phoneValidation.message
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setIsLoading(true)
    setIsValidating(true)
    setError(null)
    setCartErrors([])

    try {
      // Validate cart with server before checkout
      const validationResult = await validateCart()

      setIsValidating(false)

      if (!validationResult.valid) {
        setCartErrors(validationResult.errors)
        setError('Certains articles de votre panier ont ete mis a jour. Veuillez verifier votre commande.')
        setIsLoading(false)
        return
      }

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
      setIsValidating(false)
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
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p>{error}</p>
                  {cartErrors.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {cartErrors.map((cartError, index) => (
                        <li key={index}>- {cartError.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
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
              maxLength={INPUT_LIMITS.firstName}
            />
            <Input
              label="Nom"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              error={errors.lastName}
              placeholder="Dupont"
              maxLength={INPUT_LIMITS.lastName}
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
            maxLength={INPUT_LIMITS.email}
          />

          {/* Phone */}
          <Input
            label="Telephone (optionnel)"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            error={errors.phone}
            placeholder="+33 6 12 34 56 78"
            leftIcon={<Phone className="h-4 w-4" />}
            maxLength={INPUT_LIMITS.phone}
            hint="Format: +33 6 12 34 56 78"
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
            disabled={isLoading || items.length === 0}
            rightIcon={<CreditCard className="h-5 w-5" />}
          >
            {isValidating ? 'Verification du panier...' : 'Proceder au paiement'}
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
