'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ShoppingCart, User, Music2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { useCartStore } from '@/stores/cart'

const navigation = [
  { name: 'Accueil', href: '/' },
  { name: 'Programme', href: '/programme' },
  { name: 'Infos Pratiques', href: '/infos' },
  { name: 'Billetterie', href: '/tickets' },
]

export function Header() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const totalItems = useCartStore((state) => state.getTotalItems())

  return (
    <header className="fixed top-0 z-50 w-full">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl border-b border-white/10" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-festival-500 to-festival-600 shadow-lg shadow-festival-500/25">
            <Music2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white hidden sm:block">
            Festival
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex lg:items-center lg:gap-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                pathname === item.href
                  ? 'text-white bg-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Cart */}
          <Link href="/tickets" className="relative">
            <Button variant="ghost" size="sm" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-festival-500 text-[10px] font-bold text-white">
                  {totalItems}
                </span>
              )}
            </Button>
          </Link>

          {/* Account */}
          <Link href="/compte" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              <User className="h-5 w-5" />
            </Button>
          </Link>

          {/* CTA Button */}
          <Link href="/tickets" className="hidden sm:block">
            <Button variant="primary" size="sm">
              Acheter
            </Button>
          </Link>

          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-black/95 backdrop-blur-xl border-b border-white/10">
          <div className="px-4 py-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block px-4 py-3 rounded-lg text-base font-medium transition-colors',
                  pathname === item.href
                    ? 'text-white bg-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                {item.name}
              </Link>
            ))}
            <div className="pt-4 border-t border-white/10 mt-4 flex gap-3">
              <Link href="/compte" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="secondary" className="w-full">
                  <User className="h-4 w-4 mr-2" />
                  Mon Compte
                </Button>
              </Link>
              <Link href="/tickets" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" className="w-full">
                  Acheter
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
