'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft,
  Settings,
  CreditCard,
  Bell,
  Puzzle,
  Shield,
  ChevronRight,
  LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsNavItem {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

interface SettingsLayoutProps {
  festivalId: string
  festivalName?: string
  children: React.ReactNode
}

export function SettingsLayout({ festivalId, festivalName, children }: SettingsLayoutProps) {
  const pathname = usePathname()

  const navItems: SettingsNavItem[] = [
    {
      href: `/festivals/${festivalId}/settings/general`,
      label: 'General',
      description: 'Festival info, dates, logo, currency',
      icon: Settings,
    },
    {
      href: `/festivals/${festivalId}/settings/payments`,
      label: 'Payments',
      description: 'Stripe Connect, commissions, methods',
      icon: CreditCard,
    },
    {
      href: `/festivals/${festivalId}/settings/notifications`,
      label: 'Notifications',
      description: 'Email templates, SMS, push',
      icon: Bell,
    },
    {
      href: `/festivals/${festivalId}/settings/integrations`,
      label: 'Integrations',
      description: 'API keys, webhooks, third-party',
      icon: Puzzle,
    },
    {
      href: `/festivals/${festivalId}/settings/roles`,
      label: 'Roles & Permissions',
      description: 'Access control and user roles',
      icon: Shield,
    },
  ]

  const currentNav = navItems.find((item) => pathname.startsWith(item.href))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/festivals/${festivalId}`}
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          {festivalName && (
            <p className="mt-1 text-sm text-gray-500">{festivalName}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar Navigation */}
        <nav className="lg:w-64 lg:flex-shrink-0">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{item.label}</p>
                      <p className={cn(
                        'text-xs truncate',
                        isActive ? 'text-primary/70' : 'text-gray-500'
                      )}>
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className={cn(
                      'h-4 w-4 flex-shrink-0',
                      isActive ? 'text-primary' : 'text-gray-400'
                    )} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
