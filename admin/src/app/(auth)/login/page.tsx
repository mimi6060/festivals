'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      // TODO: Replace with Auth0 login
      // For now, mock login
      setUser({
        id: '1',
        email: 'admin@festivals.app',
        name: 'Admin',
        roles: ['SUPER_ADMIN'],
      })
      router.push('/festival/config')
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Festivals</h1>
          <p className="mt-2 text-gray-600">Back-office de gestion</p>
        </div>

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full rounded-lg bg-primary px-4 py-3 text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? 'Connexion...' : 'Se connecter'}
        </button>

        <p className="text-center text-sm text-gray-500">
          Connexion sécurisée via Auth0
        </p>
      </div>
    </div>
  )
}
