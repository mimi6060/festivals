'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Settings,
  Ticket,
  ShoppingBag,
  Users,
  Music,
  DollarSign,
  Mail,
  AlertTriangle,
  Menu,
  LogOut,
  ChevronDown,
  User,
  Shield,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner'
import { useImpersonation } from '@/lib/impersonation'
import { useAuth } from '@/hooks/useAuth'
import { DevModeIndicator } from '@/components/auth/DevModeIndicator'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, exact: true },
  { name: 'Configuration', href: '/festival/config', icon: Settings },
  { name: 'Billets', href: '/festival/tickets', icon: Ticket },
  { name: 'Produits', href: '/festival/products', icon: ShoppingBag },
  { name: 'Équipe', href: '/festival/team', icon: Users },
  { name: 'Lineup', href: '/lineup', icon: Music },
  { name: 'Finance', href: '/finance', icon: DollarSign },
  { name: 'Communication', href: '/communication', icon: Mail },
  { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { isImpersonating } = useImpersonation()
  const { user, isDevMode, logout, isLoading } = useAuth()

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return '?'
    const parts = user.name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return user.name[0].toUpperCase()
  }

  // Get role display name
  const getRoleDisplayName = () => {
    if (!user?.roles?.length) return 'User'
    const roleMap: Record<string, string> = {
      ADMIN: 'Administrateur',
      ORGANIZER: 'Organisateur',
      MANAGER: 'Manager',
      STAFF: 'Staff',
      FESTIVALIER: 'Festivalier',
    }
    return roleMap[user.roles[0]] || user.roles[0]
  }

  return (
    <div className="flex min-h-screen">
      {/* Impersonation Banner */}
      <ImpersonationBanner />
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-gray-900 transition-transform lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-center border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">Festivals Admin</h1>
        </div>

        <nav className="mt-6 px-3">
          {navigation.map((item) => {
            const isActive = 'exact' in item && item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className={cn("flex flex-1 flex-col", isImpersonating && "pt-10")}>
        {/* Dev Mode Indicator */}
        {isDevMode && <DevModeIndicator />}

        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Summer Fest 2026</span>

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors"
              >
                {isLoading ? (
                  <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
                ) : (
                  <>
                    <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                      {getUserInitials()}
                    </div>
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                      <p className="text-xs text-gray-500">{getRoleDisplayName()}</p>
                    </div>
                    <ChevronDown className="hidden md:block h-4 w-4 text-gray-400" />
                  </>
                )}
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg border bg-white shadow-lg z-50">
                  <div className="px-4 py-3 border-b">
                    <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    <div className="mt-2 flex items-center gap-1">
                      <Shield className="h-3 w-3 text-primary" />
                      <span className="text-xs text-primary font-medium">{getRoleDisplayName()}</span>
                      {isDevMode && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                          Dev Mode
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/account"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <User className="h-4 w-4" />
                      Mon compte
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Settings className="h-4 w-4" />
                      Parametres
                    </Link>
                  </div>
                  <div className="border-t py-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        logout()
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Deconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-gray-50 p-6">{children}</main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
