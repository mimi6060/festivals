import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, Mail, Download, Calendar, ArrowRight } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Commande confirmee',
  description: 'Votre commande a ete confirmee avec succes.',
}

interface ConfirmationPageProps {
  params: {
    orderId: string
  }
}

export default function ConfirmationPage({ params }: ConfirmationPageProps) {
  // In production, fetch order details from API
  const orderNumber = params.orderId.slice(0, 8).toUpperCase()

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="overflow-hidden">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-500 p-8 text-center">
            <CheckCircle className="h-16 w-16 text-white mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">
              Commande confirmee !
            </h1>
            <p className="text-green-100">
              Merci pour votre achat. Votre commande a ete traitee avec succes.
            </p>
          </div>

          <CardContent className="p-8 space-y-8">
            {/* Order Info */}
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">Numero de commande</p>
              <p className="text-2xl font-mono font-bold text-white">
                #{orderNumber}
              </p>
            </div>

            {/* Next Steps */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">
                Prochaines etapes
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-lg bg-white/5">
                  <div className="h-10 w-10 rounded-full bg-festival-500/20 flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5 text-festival-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">Email de confirmation</h3>
                    <p className="text-sm text-gray-400">
                      Un email de confirmation avec vos billets a ete envoye a votre adresse email.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-lg bg-white/5">
                  <div className="h-10 w-10 rounded-full bg-festival-500/20 flex items-center justify-center shrink-0">
                    <Download className="h-5 w-5 text-festival-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">Telechargez vos billets</h3>
                    <p className="text-sm text-gray-400">
                      Vous pouvez telecharger vos billets depuis votre espace Mon Compte a tout moment.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-lg bg-white/5">
                  <div className="h-10 w-10 rounded-full bg-festival-500/20 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-festival-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">Rendez-vous le 15 juillet !</h3>
                    <p className="text-sm text-gray-400">
                      Presentez le QR code de votre billet a l&apos;entree du festival.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/compte" className="flex-1">
                <Button variant="primary" className="w-full" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Voir mes billets
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button variant="secondary" className="w-full">
                  Retour a l&apos;accueil
                </Button>
              </Link>
            </div>

            {/* Support */}
            <div className="text-center pt-6 border-t border-white/10">
              <p className="text-sm text-gray-400">
                Une question ? Contactez-nous a{' '}
                <a
                  href="mailto:support@festival.com"
                  className="text-festival-400 hover:text-festival-300 transition-colors"
                >
                  support@festival.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
