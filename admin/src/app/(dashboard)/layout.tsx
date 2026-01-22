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
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/festival/config', icon: LayoutDashboard },
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

  return (
    <div className="flex min-h-screen">
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
            const isActive = pathname.startsWith(item.href)
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
      <div className="flex flex-1 flex-col">
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
            <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center">
              A
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
