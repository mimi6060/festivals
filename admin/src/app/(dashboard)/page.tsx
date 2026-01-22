'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  DollarSign,
  Ticket,
  Wallet,
  CreditCard,
  Plus,
  Settings,
  BarChart3,
  Users,
  ChevronRight,
} from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import { RevenueChart, RevenueDataPoint } from '@/components/dashboard/RevenueChart'
import { ActivityFeed, Activity } from '@/components/dashboard/ActivityFeed'
import { statsApi, statsQueryKeys, OverviewStats, Festival } from '@/lib/api/stats'
import { useAuthStore } from '@/stores/authStore'
import { useFestivalStore } from '@/stores/festivalStore'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { festivals, setFestivals, currentFestival, setCurrentFestival } = useFestivalStore()
  const [selectedFestivalId, setSelectedFestivalId] = useState<string | null>(null)

  // Fetch festivals
  const { data: festivalsData, isLoading: festivalsLoading } = useQuery({
    queryKey: statsQueryKeys.festivals(),
    queryFn: statsApi.getFestivals,
  })

  // Fetch overview stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: statsQueryKeys.overview(),
    queryFn: statsApi.getOverviewStats,
  })

  // Fetch revenue data
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: statsQueryKeys.allRevenue(7),
    queryFn: () => statsApi.getAllRevenueData(7),
  })

  // Fetch recent activities
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: statsQueryKeys.activities(),
    queryFn: () => statsApi.getRecentActivities(undefined, 10),
  })

  // Update festivals store when data is fetched
  useEffect(() => {
    if (festivalsData) {
      setFestivals(festivalsData as unknown as import('@/stores/festivalStore').Festival[])
    }
  }, [festivalsData, setFestivals])

  // Set current festival from selection
  useEffect(() => {
    if (selectedFestivalId && festivalsData) {
      const festival = festivalsData.find((f) => f.id === selectedFestivalId)
      if (festival) {
        setCurrentFestival(festival as unknown as import('@/stores/festivalStore').Festival)
      }
    }
  }, [selectedFestivalId, festivalsData, setCurrentFestival])

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const quickActions = [
    {
      name: 'Create Festival',
      description: 'Set up a new festival event',
      href: '/festivals/new',
      icon: Plus,
      color: 'bg-blue-500',
    },
    {
      name: 'View Reports',
      description: 'Financial and sales reports',
      href: '/reports',
      icon: BarChart3,
      color: 'bg-green-500',
    },
    {
      name: 'Manage Staff',
      description: 'Add or edit team members',
      href: '/team',
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      name: 'Settings',
      description: 'Account and preferences',
      href: '/settings',
      icon: Settings,
      color: 'bg-gray-500',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}, {user?.name || 'Admin'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here&apos;s what&apos;s happening across your festivals today.
          </p>
        </div>

        {/* Festival Selector */}
        {festivalsData && festivalsData.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="festival-select" className="text-sm font-medium text-gray-700">
              Festival:
            </label>
            <select
              id="festival-select"
              value={selectedFestivalId || ''}
              onChange={(e) => setSelectedFestivalId(e.target.value || null)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Festivals</option>
              {festivalsData.map((festival) => (
                <option key={festival.id} value={festival.id}>
                  {festival.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={stats ? formatCurrency(stats.totalRevenue) : '-'}
          icon={DollarSign}
          change={stats ? { value: stats.revenueChange, period: 'last week' } : undefined}
          loading={statsLoading}
        />
        <StatCard
          title="Tickets Sold"
          value={stats ? formatNumber(stats.ticketsSold) : '-'}
          icon={Ticket}
          change={stats ? { value: stats.ticketsChange, period: 'last week' } : undefined}
          loading={statsLoading}
        />
        <StatCard
          title="Active Wallets"
          value={stats ? formatNumber(stats.activeWallets) : '-'}
          icon={Wallet}
          change={stats ? { value: stats.walletsChange, period: 'last week' } : undefined}
          loading={statsLoading}
        />
        <StatCard
          title="Today's Transactions"
          value={stats ? formatNumber(stats.todayTransactions) : '-'}
          icon={CreditCard}
          change={
            stats ? { value: stats.transactionsChange, period: 'yesterday' } : undefined
          }
          loading={statsLoading}
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart
            data={revenueData || []}
            loading={revenueLoading}
            title="Revenue Overview (Last 7 Days)"
          />
        </div>
        <div className="lg:col-span-1">
          <ActivityFeed
            activities={activities || []}
            loading={activitiesLoading}
            maxItems={5}
            showViewAll
            onViewAll={() => {
              // Navigate to activities page
              window.location.href = '/activities'
            }}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className="group flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className={cn('rounded-lg p-2', action.color)}>
                <action.icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 group-hover:text-primary">
                  {action.name}
                </p>
                <p className="text-sm text-gray-500">{action.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </div>

      {/* Festivals List */}
      {festivalsData && festivalsData.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Your Festivals</h2>
            <Link
              href="/festivals"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {festivalsData.slice(0, 3).map((festival) => (
              <Link
                key={festival.id}
                href={`/festivals/${festival.id}/dashboard`}
                className="group rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 group-hover:text-primary">
                    {festival.name}
                  </h3>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-medium',
                      festival.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : festival.status === 'DRAFT'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {festival.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {new Date(festival.startDate).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}{' '}
                  -{' '}
                  {new Date(festival.endDate).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
                <div className="mt-3 flex items-center text-sm text-primary">
                  View Dashboard
                  <ChevronRight className="ml-1 h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
