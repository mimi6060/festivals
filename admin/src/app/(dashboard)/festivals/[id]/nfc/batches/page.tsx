'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  MoreVertical,
  Download,
  Trash2,
} from 'lucide-react'
import { cn, formatNumber, formatDate } from '@/lib/utils'
import BatchUploader from '@/components/nfc/BatchUploader'
import { Table, Pagination } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'

interface NFCBatch {
  id: string
  name: string
  description: string
  totalCount: number
  activeCount: number
  blockedCount: number
  status: 'PENDING' | 'ACTIVE' | 'CLOSED' | 'CANCELLED'
  importedBy: string
  importedAt: string
  activatedAt: string | null
  notes: string
  createdAt: string
}

// Mock data
const mockBatches: NFCBatch[] = [
  {
    id: '1',
    name: 'Lot Initial - Pass 3 Jours',
    description: 'Premier lot de bracelets pour les pass 3 jours',
    totalCount: 5000,
    activeCount: 4523,
    blockedCount: 45,
    status: 'ACTIVE',
    importedBy: 'admin@festival.com',
    importedAt: '2026-01-10T08:00:00Z',
    activatedAt: '2026-01-10T10:00:00Z',
    notes: 'Lot principal pour le festival',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: '2',
    name: 'Lot VIP Premium',
    description: 'Bracelets VIP avec acces premium',
    totalCount: 500,
    activeCount: 450,
    blockedCount: 5,
    status: 'ACTIVE',
    importedBy: 'admin@festival.com',
    importedAt: '2026-01-12T08:00:00Z',
    activatedAt: '2026-01-12T10:00:00Z',
    notes: 'Bracelets VIP avec puces speciales',
    createdAt: '2026-01-12T08:00:00Z',
  },
  {
    id: '3',
    name: 'Lot Remplacement',
    description: 'Bracelets de remplacement pour les perdus/defectueux',
    totalCount: 200,
    activeCount: 0,
    blockedCount: 0,
    status: 'PENDING',
    importedBy: 'staff@festival.com',
    importedAt: '2026-01-15T14:00:00Z',
    activatedAt: null,
    notes: 'Reserve pour remplacements sur site',
    createdAt: '2026-01-15T14:00:00Z',
  },
]

const statusConfig = {
  PENDING: { label: 'En attente', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
  ACTIVE: { label: 'Actif', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  CLOSED: { label: 'Cloture', bg: 'bg-gray-100', text: 'text-gray-700', icon: Package },
  CANCELLED: { label: 'Annule', bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
}

export default function NFCBatchesPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [batches, setBatches] = useState<NFCBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadBatches()
  }, [festivalId, currentPage])

  const loadBatches = async () => {
    setLoading(true)
    try {
      // API call
      // const response = await nfcApi.listBatches(festivalId, currentPage)
      // setBatches(response.data)
      // setTotalPages(Math.ceil(response.total / 20))

      // Mock data
      setBatches(mockBatches)
      setTotalPages(1)
    } catch (error) {
      console.error('Failed to load batches:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleActivateBatch = async (batchId: string) => {
    if (!confirm('Activer ce lot ? Les bracelets seront disponibles pour utilisation.')) return

    try {
      // await nfcApi.activateBatch(festivalId, batchId)
      setBatches((prev) =>
        prev.map((batch) =>
          batch.id === batchId
            ? { ...batch, status: 'ACTIVE' as const, activatedAt: new Date().toISOString() }
            : batch
        )
      )
    } catch (error) {
      console.error('Failed to activate batch:', error)
    }
  }

  const handleUploadComplete = (result: { uids: string[]; batchId: string }) => {
    setShowUploadModal(false)
    loadBatches()
  }

  const columns = [
    {
      key: 'name',
      header: 'Lot',
      cell: (batch: NFCBatch) => (
        <div>
          <Link
            href={`/festivals/${festivalId}/nfc/batches/${batch.id}`}
            className="font-medium text-gray-900 hover:text-primary"
          >
            {batch.name}
          </Link>
          <p className="text-sm text-gray-500 truncate max-w-xs">{batch.description}</p>
        </div>
      ),
    },
    {
      key: 'counts',
      header: 'Bracelets',
      cell: (batch: NFCBatch) => (
        <div className="text-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="font-medium">{formatNumber(batch.totalCount)}</span>
              <span className="text-gray-500 ml-1">total</span>
            </div>
            <div className="text-green-600">
              <span className="font-medium">{formatNumber(batch.activeCount)}</span>
              <span className="ml-1">actifs</span>
            </div>
            {batch.blockedCount > 0 && (
              <div className="text-red-600">
                <span className="font-medium">{formatNumber(batch.blockedCount)}</span>
                <span className="ml-1">bloques</span>
              </div>
            )}
          </div>
          <div className="mt-1 h-2 w-48 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500"
              style={{ width: `${(batch.activeCount / batch.totalCount) * 100}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (batch: NFCBatch) => {
        const status = statusConfig[batch.status]
        const Icon = status.icon
        return (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', status.bg, status.text)}>
            <Icon className="h-3 w-3" />
            {status.label}
          </span>
        )
      },
    },
    {
      key: 'importedAt',
      header: 'Importe le',
      cell: (batch: NFCBatch) => (
        <div className="text-sm text-gray-500">
          {formatDate(batch.importedAt)}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (batch: NFCBatch) => (
        <div className="flex items-center gap-2">
          {batch.status === 'PENDING' && (
            <button
              onClick={() => handleActivateBatch(batch.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              <CheckCircle className="h-3 w-3" />
              Activer
            </button>
          )}
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <Download className="h-4 w-4" />
          </button>
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/nfc`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lots de bracelets</h1>
            <p className="text-gray-500">Gerez les lots de bracelets NFC importes</p>
          </div>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nouveau lot
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Total lots</p>
          <p className="text-3xl font-bold">{batches.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Total bracelets</p>
          <p className="text-3xl font-bold">
            {formatNumber(batches.reduce((sum, b) => sum + b.totalCount, 0))}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Bracelets actifs</p>
          <p className="text-3xl font-bold text-green-600">
            {formatNumber(batches.reduce((sum, b) => sum + b.activeCount, 0))}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">En attente</p>
          <p className="text-3xl font-bold text-yellow-600">
            {formatNumber(
              batches
                .filter((b) => b.status === 'PENDING')
                .reduce((sum, b) => sum + b.totalCount, 0)
            )}
          </p>
        </div>
      </div>

      {/* Batches Table */}
      <Table
        columns={columns}
        data={batches}
        loading={loading}
        emptyMessage="Aucun lot de bracelets"
      />

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Upload Modal */}
      <Modal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Importer un lot de bracelets"
      >
        <BatchUploader
          festivalId={festivalId}
          onComplete={handleUploadComplete}
          onCancel={() => setShowUploadModal(false)}
        />
      </Modal>
    </div>
  )
}
