'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  User,
  Ticket,
  ShoppingBag,
  Wallet,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const navigation = [
  { name: 'Apercu', href: '/account', icon: User, exact: true },
  { name: 'Mes billets', href: '/account/tickets', icon: Ticket },
  { name: 'Mes commandes', href: '/account/orders', icon: ShoppingBag },
  { name: 'Mon portefeuille', href: '/account/wallet', icon: Wallet },
]

interface AccountLayoutProps {
  children: React.ReactNode
}

export default function AccountLayout({ children }: AccountLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Use the auth hook for authentication state
  const { user, isLoading, isAuthenticated, isDevMode, logout, loginUrl } = useAuth()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const returnUrl = encodeURIComponent(pathname)
      router.push(`${loginUrl}?returnTo=${returnUrl}`)
    }
  }, [isLoading, isAuthenticated, pathname, router, loginUrl])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  // If not authenticated, show loading (will redirect)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const handleLogout = async () => {
    // Clear any local storage tokens
    localStorage.removeItem('auth_token')
    // Clear any cookies
    document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    // Use the logout function from useAuth (handles both Auth0 and dev mode)
    logout()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary">Festivals</span>
            </Link>

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navigation.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 text-sm font-medium transition-colors',
                      isActive ? 'text-primary' : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-4">
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
                Deconnexion
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden rounded-lg p-2 hover:bg-gray-100"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t bg-white py-4">
            <div className="mx-auto max-w-7xl px-4 space-y-1">
              {navigation.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-4 py-3',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </Link>
                )
              })}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Deconnexion</span>
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700">
            Accueil
          </Link>
          <ChevronRight className="h-4 w-4" />
          {navigation.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && (item.exact || pathname !== '/account')
            if (isActive) {
              return (
                <span key={item.name} className="text-gray-900 font-medium">
                  {item.name}
                </span>
              )
            }
            return null
          })}
        </nav>

        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-8 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              2026 Festivals. Tous droits reserves.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/help" className="text-gray-500 hover:text-gray-700">
                Aide
              </Link>
              <Link href="/privacy" className="text-gray-500 hover:text-gray-700">
                Confidentialite
              </Link>
              <Link href="/terms" className="text-gray-500 hover:text-gray-700">
                Conditions
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
