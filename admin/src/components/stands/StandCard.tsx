'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Beer,
  UtensilsCrossed,
  ShoppingBag,
  Wallet,
  Info,
  Heart,
  Shield,
  MapPin,
  Users,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Package,
} from 'lucide-react'
import { Stand, StandCategory } from '@/lib/api/stands'
import { useState, useRef, useEffect } from 'react'

interface StandCardProps {
  stand: Stand
  festivalId: string
  onDelete?: (standId: string) => void
  viewMode?: 'grid' | 'table'
}

const categoryConfig: Record<StandCategory, { icon: typeof Beer; label: string; color: string; bgColor: string }> = {
  BAR: { icon: Beer, label: 'Bar', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  FOOD: { icon: UtensilsCrossed, label: 'Restauration', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  MERCHANDISE: { icon: ShoppingBag, label: 'Boutique', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  RECHARGE: { icon: Wallet, label: 'Recharge', color: 'text-green-600', bgColor: 'bg-green-100' },
  INFO: { icon: Info, label: 'Information', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  MEDICAL: { icon: Heart, label: 'Medical', color: 'text-red-600', bgColor: 'bg-red-100' },
  SECURITY: { icon: Shield, label: 'Securite', color: 'text-slate-600', bgColor: 'bg-slate-100' },
}

export function StandCard({ stand, festivalId, onDelete, viewMode = 'grid' }: StandCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const config = categoryConfig[stand.category] || categoryConfig.INFO
  const Icon = config.icon

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDelete = () => {
    if (onDelete && confirm(`Supprimer le stand "${stand.name}" ?`)) {
      onDelete(stand.id)
    }
    setMenuOpen(false)
  }

  if (viewMode === 'table') {
    return (
      <tr className="border-b hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-lg p-2', config.bgColor)}>
              <Icon className={cn('h-5 w-5', config.color)} />
            </div>
            <div>
              <Link
                href={`/festivals/${festivalId}/stands/${stand.id}`}
                className="font-medium text-gray-900 hover:text-primary"
              >
                {stand.name}
              </Link>
              {stand.description && (
                <p className="text-sm text-gray-500 line-clamp-1">{stand.description}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', config.bgColor, config.color)}>
            {config.label}
          </span>
        </td>
        <td className="px-4 py-3">
          {stand.location?.zone && (
            <span className="inline-flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-4 w-4" />
              {stand.location.zone}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              stand.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            {stand.isActive ? 'Actif' : 'Inactif'}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg p-1.5 hover:bg-gray-100"
            >
              <MoreVertical className="h-5 w-5 text-gray-500" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
                <Link
                  href={`/festivals/${festivalId}/stands/${stand.id}`}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4" />
                  Voir les details
                </Link>
                <Link
                  href={`/festivals/${festivalId}/stands/${stand.id}/products`}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Package className="h-4 w-4" />
                  Gerer les produits
                </Link>
                <Link
                  href={`/festivals/${festivalId}/stands/${stand.id}?edit=true`}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4" />
                  Modifier
                </Link>
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="group relative rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header with category icon and menu */}
      <div className="mb-3 flex items-start justify-between">
        <div className={cn('rounded-lg p-2', config.bgColor)}>
          <Icon className={cn('h-6 w-6', config.color)} />
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100"
          >
            <MoreVertical className="h-5 w-5 text-gray-500" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
              <Link
                href={`/festivals/${festivalId}/stands/${stand.id}`}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Eye className="h-4 w-4" />
                Voir les details
              </Link>
              <Link
                href={`/festivals/${festivalId}/stands/${stand.id}/products`}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Package className="h-4 w-4" />
                Gerer les produits
              </Link>
              <Link
                href={`/festivals/${festivalId}/stands/${stand.id}?edit=true`}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Edit className="h-4 w-4" />
                Modifier
              </Link>
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stand info */}
      <Link href={`/festivals/${festivalId}/stands/${stand.id}`}>
        <h3 className="mb-1 font-semibold text-gray-900 hover:text-primary">
          {stand.name}
        </h3>
      </Link>
      {stand.description && (
        <p className="mb-3 text-sm text-gray-500 line-clamp-2">{stand.description}</p>
      )}

      {/* Category badge */}
      <div className="mb-3">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', config.bgColor, config.color)}>
          {config.label}
        </span>
      </div>

      {/* Footer with location and status */}
      <div className="flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {stand.location?.zone && (
            <>
              <MapPin className="h-4 w-4" />
              <span>{stand.location.zone}</span>
            </>
          )}
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            stand.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          )}
        >
          {stand.isActive ? 'Actif' : 'Inactif'}
        </span>
      </div>

      {/* Settings indicators */}
      <div className="mt-3 flex gap-2">
        {stand.settings.acceptsOnlyTokens && (
          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
            <Wallet className="h-3 w-3" />
            Tokens uniquement
          </span>
        )}
        {stand.settings.requiresPin && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
            PIN requis
          </span>
        )}
      </div>
    </div>
  )
}

// Skeleton for loading state
export function StandCardSkeleton({ viewMode = 'grid' }: { viewMode?: 'grid' | 'table' }) {
  if (viewMode === 'table') {
    return (
      <tr className="border-b animate-pulse">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-200" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="h-3 w-48 rounded bg-gray-200" />
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="h-5 w-20 rounded-full bg-gray-200" />
        </td>
        <td className="px-4 py-3">
          <div className="h-4 w-24 rounded bg-gray-200" />
        </td>
        <td className="px-4 py-3">
          <div className="h-5 w-16 rounded-full bg-gray-200" />
        </td>
        <td className="px-4 py-3">
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
        </td>
      </tr>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm animate-pulse">
      <div className="mb-3 flex items-start justify-between">
        <div className="h-10 w-10 rounded-lg bg-gray-200" />
      </div>
      <div className="mb-1 h-5 w-32 rounded bg-gray-200" />
      <div className="mb-3 h-4 w-full rounded bg-gray-200" />
      <div className="mb-3 h-5 w-20 rounded-full bg-gray-200" />
      <div className="flex items-center justify-between border-t pt-3">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-5 w-16 rounded-full bg-gray-200" />
      </div>
    </div>
  )
}
