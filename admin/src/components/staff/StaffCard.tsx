'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import {
  User,
  Mail,
  Phone,
  MapPin,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  StaffMember,
  StaffRole,
  getRoleLabel,
  getRoleColor,
  getStatusLabel,
} from '@/lib/api/staff'

interface StaffCardProps {
  staff: StaffMember
  festivalId: string
  onEdit?: (staff: StaffMember) => void
  onDelete?: (staffId: string) => void
  onResendInvite?: (staffId: string) => void
  viewMode?: 'grid' | 'list'
}

export function StaffCard({
  staff,
  festivalId,
  onEdit,
  onDelete,
  onResendInvite,
  viewMode = 'grid',
}: StaffCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const roleColor = getRoleColor(staff.role)

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
    if (onDelete && confirm(`Supprimer ${staff.user.name} de l'equipe ?`)) {
      onDelete(staff.id)
    }
    setMenuOpen(false)
  }

  const handleResendInvite = () => {
    if (onResendInvite) {
      onResendInvite(staff.id)
    }
    setMenuOpen(false)
  }

  if (viewMode === 'list') {
    return (
      <tr className="border-b hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {staff.user.avatarUrl ? (
                <img
                  src={staff.user.avatarUrl}
                  alt={staff.user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div>
              <Link
                href={`/festivals/${festivalId}/staff/${staff.id}`}
                className="font-medium text-gray-900 hover:text-primary"
              >
                {staff.user.name}
              </Link>
              <p className="text-sm text-gray-500">{staff.user.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              roleColor.bg,
              roleColor.text
            )}
          >
            {getRoleLabel(staff.role)}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {staff.assignedStands.length > 0 ? (
              staff.assignedStands.slice(0, 2).map((stand) => (
                <span
                  key={stand.standId}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  <MapPin className="h-3 w-3" />
                  {stand.standName}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-400">Non assigne</span>
            )}
            {staff.assignedStands.length > 2 && (
              <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                +{staff.assignedStands.length - 2}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              staff.status === 'ACTIVE'
                ? 'bg-green-100 text-green-700'
                : staff.status === 'PENDING'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            {getStatusLabel(staff.status)}
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
                  href={`/festivals/${festivalId}/staff/${staff.id}`}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4" />
                  Voir le profil
                </Link>
                <Link
                  href={`/festivals/${festivalId}/staff/schedule?staffId=${staff.id}`}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Calendar className="h-4 w-4" />
                  Planning
                </Link>
                {onEdit && (
                  <button
                    onClick={() => {
                      onEdit(staff)
                      setMenuOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Edit className="h-4 w-4" />
                    Modifier
                  </button>
                )}
                {staff.status === 'PENDING' && onResendInvite && (
                  <button
                    onClick={handleResendInvite}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Renvoyer l'invitation
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Retirer
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
      {/* Menu button */}
      <div className="absolute right-3 top-3" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100"
        >
          <MoreVertical className="h-5 w-5 text-gray-500" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
            <Link
              href={`/festivals/${festivalId}/staff/${staff.id}`}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Eye className="h-4 w-4" />
              Voir le profil
            </Link>
            <Link
              href={`/festivals/${festivalId}/staff/schedule?staffId=${staff.id}`}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Calendar className="h-4 w-4" />
              Planning
            </Link>
            {onEdit && (
              <button
                onClick={() => {
                  onEdit(staff)
                  setMenuOpen(false)
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Edit className="h-4 w-4" />
                Modifier
              </button>
            )}
            {staff.status === 'PENDING' && onResendInvite && (
              <button
                onClick={handleResendInvite}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
                Renvoyer l'invitation
              </button>
            )}
            <button
              onClick={handleDelete}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Retirer
            </button>
          </div>
        )}
      </div>

      {/* Avatar and name */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
          {staff.user.avatarUrl ? (
            <img
              src={staff.user.avatarUrl}
              alt={staff.user.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <User className="h-6 w-6 text-gray-400" />
          )}
        </div>
        <div>
          <Link
            href={`/festivals/${festivalId}/staff/${staff.id}`}
            className="font-semibold text-gray-900 hover:text-primary"
          >
            {staff.user.name}
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                roleColor.bg,
                roleColor.text
              )}
            >
              {getRoleLabel(staff.role)}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                staff.status === 'ACTIVE'
                  ? 'bg-green-100 text-green-700'
                  : staff.status === 'PENDING'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              {getStatusLabel(staff.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Mail className="h-4 w-4" />
          <span className="truncate">{staff.user.email}</span>
        </div>
        {staff.user.phone && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Phone className="h-4 w-4" />
            <span>{staff.user.phone}</span>
          </div>
        )}
      </div>

      {/* Assigned stands */}
      <div className="border-t pt-3">
        <p className="mb-2 text-xs font-medium text-gray-500 uppercase">Stands assignes</p>
        {staff.assignedStands.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {staff.assignedStands.map((stand) => (
              <span
                key={stand.standId}
                className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
              >
                <MapPin className="h-3 w-3" />
                {stand.standName}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Aucun stand assigne</p>
        )}
      </div>
    </div>
  )
}

// Skeleton for loading state
export function StaffCardSkeleton({ viewMode = 'grid' }: { viewMode?: 'grid' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <tr className="border-b animate-pulse">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
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
          <div className="h-5 w-24 rounded bg-gray-200" />
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
      <div className="mb-4 flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-full bg-gray-200" />
            <div className="h-5 w-14 rounded-full bg-gray-200" />
          </div>
        </div>
      </div>
      <div className="mb-4 space-y-2">
        <div className="h-4 w-48 rounded bg-gray-200" />
        <div className="h-4 w-32 rounded bg-gray-200" />
      </div>
      <div className="border-t pt-3">
        <div className="h-3 w-24 rounded bg-gray-200 mb-2" />
        <div className="flex gap-1">
          <div className="h-6 w-20 rounded bg-gray-200" />
          <div className="h-6 w-24 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  )
}
