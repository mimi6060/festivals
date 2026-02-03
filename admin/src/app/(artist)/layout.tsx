'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  User,
  FileText,
  Mail,
  Calendar,
  Settings,
  LogOut,
  Music,
  Menu,
  Bell,
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Mon Profil', href: '/profile', icon: User },
  { name: 'Tech Rider', href: '/rider', icon: FileText },
  { name: 'Invitations', href: '/invitations', icon: Mail },
  { name: 'Planning', href: '/schedule', icon: Calendar },
]

// Mock artist data
const mockArtist = {
  name: 'Harrison Clayton',
  stageName: 'ODESZA',
  profileImageUrl: null,
  unreadInvitations: 2,
}

export default function ArtistPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-gradient-to-b from-purple-900 to-purple-800 transition-transform lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-purple-700/50 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <Music className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Portail Artiste</h1>
            <p className="text-xs text-purple-300">Festivals</p>
          </div>
        </div>

        {/* Artist Info */}
        <div className="border-b border-purple-700/50 p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
              {mockArtist.stageName?.charAt(0) || mockArtist.name.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-white">{mockArtist.stageName || mockArtist.name}</p>
              <p className="text-sm text-purple-300">{mockArtist.name}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-purple-200 hover:bg-white/10 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
                {item.name === 'Invitations' && mockArtist.unreadInvitations > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-xs font-bold text-white">
                    {mockArtist.unreadInvitations}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-purple-700/50 p-4">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-purple-200 hover:bg-white/10 hover:text-white transition-all"
          >
            <Settings className="h-5 w-5" />
            Parametres
          </Link>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-purple-200 hover:bg-white/10 hover:text-white transition-all">
            <LogOut className="h-5 w-5" />
            Deconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex items-center gap-4 ml-auto">
            {/* Notifications */}
            <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <Bell className="h-5 w-5" />
              {mockArtist.unreadInvitations > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white">
                  {mockArtist.unreadInvitations}
                </span>
              )}
            </button>

            {/* Profile */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white font-medium">
                {mockArtist.stageName?.charAt(0) || mockArtist.name.charAt(0)}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{mockArtist.stageName}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
