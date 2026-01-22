'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  LayoutGrid,
  List,
  Search,
  Download,
  Upload,
  CreditCard,
  Ban,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { NFCTagCard, NFCTagRow } from '@/components/nfc/NFCTagCard'
import { nfcApi, type NFCTag, type NFCTagStatus, type NFCTagStats } from '@/lib/api/nfc'

type ViewMode = 'grid' | 'list'

// Mock data for development
const mockTags: NFCTag[] = [
  {
    id: '1',
    festivalId: '1',
    uid: '04:A2:B3:C4:D5:E6:F7',
    status: 'ACTIVE',
    walletId: 'wallet-123',
    walletBalance: 45.50,
    holderName: 'Jean Dupont',
    holderEmail: 'jean.dupont@email.com',
    ticketId: 'ticket-1',
    ticketTypeName: 'Pass 3 Jours',
    activatedAt: '2026-06-15T10:30:00Z',
    activatedBy: 'staff@festival.com',
    blockedAt: null,
    blockedBy: null,
    blockedReason: null,
    lastUsedAt: '2026-06-15T14:22:00Z',
    transactionCount: 12,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-06-15T14:22:00Z',
  },
  {
    id: '2',
    festivalId: '1',
    uid: '04:B3:C4:D5:E6:F7:A8',
    status: 'ACTIVE',
    walletId: 'wallet-456',
    walletBalance: 120.00,
    holderName: 'Marie Martin',
    holderEmail: 'marie.martin@email.com',
    ticketId: 'ticket-2',
    ticketTypeName: 'Pass VIP Premium',
    activatedAt: '2026-06-15T09:15:00Z',
    activatedBy: 'staff@festival.com',
    blockedAt: null,
    blockedBy: null,
    blockedReason: null,
    lastUsedAt: '2026-06-15T16:45:00Z',
    transactionCount: 8,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-06-15T16:45:00Z',
  },
  {
    id: '3',
    festivalId: '1',
    uid: '04:C4:D5:E6:F7:A8:B9',
    status: 'UNASSIGNED',
    walletId: null,
    walletBalance: null,
    holderName: null,
    holderEmail: null,
    ticketId: null,
    ticketTypeName: null,
    activatedAt: null,
    activatedBy: null,
    blockedAt: null,
    blockedBy: null,
    blockedReason: null,
    lastUsedAt: null,
    transactionCount: 0,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z',
  },
  {
    id: '4',
    festivalId: '1',
    uid: '04:D5:E6:F7:A8:B9:CA',
    status: 'BLOCKED',
    walletId: 'wallet-789',
    walletBalance: 0,
    holderName: 'Pierre Bernard',
    holderEmail: 'pierre.bernard@email.com',
    ticketId: 'ticket-3',
    ticketTypeName: 'Pass Journee',
    activatedAt: '2026-06-15T11:00:00Z',
    activatedBy: 'staff@festival.com',
    blockedAt: '2026-06-15T15:30:00Z',
    blockedBy: 'admin@festival.com',
    blockedReason: 'Fraude suspectee',
    lastUsedAt: '2026-06-15T15:28:00Z',
    transactionCount: 3,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-06-15T15:30:00Z',
  },
  {
    id: '5',
    festivalId: '1',
    uid: '04:E6:F7:A8:B9:CA:DB',
    status: 'LOST',
    walletId: 'wallet-012',
    walletBalance: 25.00,
    holderName: 'Sophie Leroy',
    holderEmail: 'sophie.leroy@email.com',
    ticketId: 'ticket-4',
    ticketTypeName: 'Pass 3 Jours',
    activatedAt: '2026-06-15T10:00:00Z',
    activatedBy: 'staff@festival.com',
    blockedAt: '2026-06-15T17:00:00Z',
    blockedBy: 'sophie.leroy@email.com',
    blockedReason: 'Bracelet perdu',
    lastUsedAt: '2026-06-15T13:45:00Z',
    transactionCount: 5,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-06-15T17:00:00Z',
  },
  {
    id: '6',
    festivalId: '1',
    uid: '04:F7:A8:B9:CA:DB:EC',
    status: 'UNASSIGNED',
    walletId: null,
    walletBalance: null,
    holderName: null,
    holderEmail: null,
    ticketId: null,
    ticketTypeName: null,
    activatedAt: null,
    activatedBy: null,
    blockedAt: null,
    blockedBy: null,
    blockedReason: null,
    lastUsedAt: null,
    transactionCount: 0,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z',
  },
]

const mockStats: NFCTagStats = {
  total: 10000,
  unassigned: 4523,
  active: 5234,
  blocked: 156,
  lost: 87,
  totalTransactions: 45678,
  totalVolume: 234567.50,
}

const statusConfig: Record<NFCTagStatus, { label: string; bg: string; text: string; icon: typeof CheckCircle }> = {
  UNASSIGNED: { label: 'Non assigne', bg: 'bg-gray-100', text: 'text-gray-700', icon: CreditCard },
  ACTIVE: { label: 'Actif', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  BLOCKED: { label: 'Bloque', bg: 'bg-red-100', text: 'text-red-700', icon: Ban },
  LOST: { label: 'Perdu', bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle },
}

export default function NFCTagsListPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [tags, setTags] = useState<NFCTag[]>([])
  const [stats, setStats] = useState<NFCTagStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [batchActionLoading, setBatchActionLoading] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        // const [tagsResponse, statsResponse] = await Promise.all([
        //   nfcApi.listTags(festivalId),
        //   nfcApi.getStats(festivalId),
        // ])
        // setTags(tagsResponse.data)
        // setStats(statsResponse)
        // Using mock data for now
        setTags(mockTags)
        setStats(mockStats)
      } catch (error) {
        console.error('Failed to load NFC tags:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [festivalId])

  // Filter tags
  const filteredTags = tags.filter((tag) => {
    const matchesSearch =
      searchQuery === '' ||
      tag.uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.holderName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.holderEmail?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || tag.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleSelectTag = (tagId: string, selected: boolean) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(tagId)
      } else {
        next.delete(tagId)
      }
      return next
    })
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedTags(new Set(filteredTags.map((t) => t.id)))
    } else {
      setSelectedTags(new Set())
    }
  }

  const handleBatchDeactivate = async () => {
    if (selectedTags.size === 0) return
    if (!confirm(`Desactiver ${selectedTags.size} tag(s) NFC ?`)) return

    setBatchActionLoading(true)
    try {
      await nfcApi.batchDeactivate(festivalId, Array.from(selectedTags))
      // Refresh data
      setTags((prev) =>
        prev.map((tag) =>
          selectedTags.has(tag.id) ? { ...tag, status: 'UNASSIGNED' as NFCTagStatus, walletId: null } : tag
        )
      )
      setSelectedTags(new Set())
    } catch (error) {
      console.error('Failed to batch deactivate:', error)
    } finally {
      setBatchActionLoading(false)
    }
  }

  const handleBatchBlock = async () => {
    if (selectedTags.size === 0) return
    const reason = prompt('Raison du blocage:')
    if (!reason) return

    setBatchActionLoading(true)
    try {
      await nfcApi.batchBlock(festivalId, Array.from(selectedTags), reason)
      setTags((prev) =>
        prev.map((tag) =>
          selectedTags.has(tag.id)
            ? { ...tag, status: 'BLOCKED' as NFCTagStatus, blockedReason: reason }
            : tag
        )
      )
      setSelectedTags(new Set())
    } catch (error) {
      console.error('Failed to batch block:', error)
    } finally {
      setBatchActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tags NFC</h1>
          <p className="text-gray-500">Gerez les bracelets et cartes NFC du festival</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/festivals/${festivalId}/nfc/batches`}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <CreditCard className="h-4 w-4" />
            Lots
          </Link>
          <Link
            href={`/festivals/${festivalId}/nfc/activate`}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Activation masse
          </Link>
          <Link
            href={`/festivals/${festivalId}/nfc/import`}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            Importer
          </Link>
          <button className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Exporter
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <div className="rounded-lg border bg-white p-6">
            <p className="text-sm text-gray-500">Total tags</p>
            <p className="text-3xl font-bold">{formatNumber(stats.total)}</p>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gray-400" />
              <p className="text-sm text-gray-500">Non assignes</p>
            </div>
            <p className="text-3xl font-bold">{formatNumber(stats.unassigned)}</p>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <p className="text-sm text-gray-500">Actifs</p>
            </div>
            <p className="text-3xl font-bold">{formatNumber(stats.active)}</p>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <p className="text-sm text-gray-500">Bloques</p>
            </div>
            <p className="text-3xl font-bold">{formatNumber(stats.blocked)}</p>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <p className="text-sm text-gray-500">Perdus</p>
            </div>
            <p className="text-3xl font-bold">{formatNumber(stats.lost)}</p>
          </div>
        </div>
      )}

      {/* Filters and View Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par UID, nom ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border pl-10 pr-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Tous les statuts</option>
            <option value="UNASSIGNED">Non assigne</option>
            <option value="ACTIVE">Actif</option>
            <option value="BLOCKED">Bloque</option>
            <option value="LOST">Perdu</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {selectedTags.size > 0 && (
            <div className="flex items-center gap-2 mr-4">
              <span className="text-sm text-gray-500">{selectedTags.size} selectionne(s)</span>
              <button
                onClick={handleBatchDeactivate}
                disabled={batchActionLoading}
                className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Desactiver
              </button>
              <button
                onClick={handleBatchBlock}
                disabled={batchActionLoading}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                Bloquer
              </button>
            </div>
          )}
          <div className="flex rounded-lg border bg-white">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-l-lg p-2',
                viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-r-lg p-2',
                viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tags Display */}
      {filteredTags.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border bg-white">
          <CreditCard className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">Aucun tag NFC trouve</p>
          {searchQuery || statusFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
              }}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Reinitialiser les filtres
            </button>
          ) : (
            <Link
              href={`/festivals/${festivalId}/nfc/import`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" />
              Importer des tags
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTags.map((tag) => (
            <NFCTagCard
              key={tag.id}
              tag={tag}
              festivalId={festivalId}
              selected={selectedTags.has(tag.id)}
              onSelect={(selected) => handleSelectTag(tag.id, selected)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedTags.size === filteredTags.length && filteredTags.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">UID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Titulaire</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Solde</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Transactions</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filteredTags.map((tag) => (
                <NFCTagRow
                  key={tag.id}
                  tag={tag}
                  festivalId={festivalId}
                  selected={selectedTags.has(tag.id)}
                  onSelect={(selected) => handleSelectTag(tag.id, selected)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
