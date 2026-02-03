'use client'

import { useUser } from '@auth0/nextjs-auth0/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function LoginPage() {
  const { user, isLoading: authLoading } = useUser()
  const router = useRouter()
  const [isAuth0Configured, setIsAuth0Configured] = useState(true)

  useEffect(() => {
    // Check if Auth0 is configured by trying to access user endpoint
    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 500) {
          setIsAuth0Configured(false)
        }
      })
      .catch(() => setIsAuth0Configured(false))
  }, [])

  useEffect(() => {
    if (user) {
      router.push('/')
    }
  }, [user, router])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Festivals</h1>
          <p className="mt-2 text-gray-600">Back-office de gestion</p>
        </div>

        {!isAuth0Configured ? (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-yellow-800 text-sm font-medium">Auth0 non configuré</p>
            <p className="text-yellow-700 text-xs mt-1">
              Configurez les variables AUTH0_* dans .env pour activer l&apos;authentification.
              Consultez docs/setup/AUTH0.md pour plus d&apos;informations.
            </p>
          </div>
        ) : (
          <a
            href="/api/auth/login"
            className="block w-full rounded-lg bg-primary px-4 py-3 text-white text-center hover:bg-primary/90"
          >
            Se connecter avec Auth0
          </a>
        )}

        <p className="text-center text-sm text-gray-500">
          Connexion sécurisée via Auth0
        </p>
      </div>
    </div>
  )
}
