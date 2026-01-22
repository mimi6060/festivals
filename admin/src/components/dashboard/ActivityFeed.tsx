'use client'

import { cn, formatDateTime, formatCurrency } from '@/lib/utils'
import {
  CreditCard,
  Ticket,
  UserCheck,
  AlertTriangle,
  Wallet,
  ShoppingBag,
  LucideIcon,
} from 'lucide-react'

export type ActivityType =
  | 'transaction'
  | 'ticket_scan'
  | 'staff_checkin'
  | 'wallet_recharge'
  | 'incident'
  | 'purchase'

export interface Activity {
  id: string
  type: ActivityType
  title: string
  description: string
  timestamp: string
  amount?: number
  metadata?: Record<string, unknown>
}

interface ActivityFeedProps {
  activities: Activity[]
  loading?: boolean
  maxItems?: number
  title?: string
  showViewAll?: boolean
  onViewAll?: () => void
}

const activityConfig: Record<
  ActivityType,
  { icon: LucideIcon; color: string; bgColor: string }
> = {
  transaction: {
    icon: CreditCard,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  ticket_scan: {
    icon: Ticket,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  staff_checkin: {
    icon: UserCheck,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  wallet_recharge: {
    icon: Wallet,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  incident: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  purchase: {
    icon: ShoppingBag,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
}

function ActivityItem({ activity }: { activity: Activity }) {
  const config = activityConfig[activity.type]
  const Icon = config.icon

  return (
    <div className="flex items-start gap-4 py-3">
      <div className={cn('rounded-full p-2', config.bgColor)}>
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-medium text-gray-900">
            {activity.title}
          </p>
          {activity.amount !== undefined && (
            <span className="ml-2 text-sm font-medium text-gray-900">
              {formatCurrency(activity.amount)}
            </span>
          )}
        </div>
        <p className="truncate text-sm text-gray-500">{activity.description}</p>
        <p className="mt-0.5 text-xs text-gray-400">
          {formatDateTime(activity.timestamp)}
        </p>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 py-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ActivityFeed({
  activities,
  loading = false,
  maxItems = 10,
  title = 'Recent Activity',
  showViewAll = false,
  onViewAll,
}: ActivityFeedProps) {
  const displayedActivities = activities.slice(0, maxItems)

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            Latest events and transactions
          </p>
        </div>
        {showViewAll && onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </button>
        )}
      </div>

      <div className="px-6">
        {loading ? (
          <LoadingSkeleton />
        ) : displayedActivities.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No recent activity
          </div>
        ) : (
          <div className="divide-y">
            {displayedActivities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
