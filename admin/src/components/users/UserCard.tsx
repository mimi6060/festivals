'use client'

import { User as UserIcon, Mail, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User } from '@/lib/api/users'

interface UserCardProps {
  user: User
  variant?: 'compact' | 'full'
  className?: string
}

export function UserCard({ user, variant = 'full', className }: UserCardProps) {
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <UserIcon className="h-5 w-5 text-gray-500" />
          )}
        </div>
        <div>
          <p className="font-medium text-gray-900">{user.name}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border bg-white p-6', className)}>
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <UserIcon className="h-8 w-8 text-gray-500" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-4 w-4 text-gray-400" />
              {user.email}
            </div>
            {user.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4 text-gray-400" />
                {user.phone}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
