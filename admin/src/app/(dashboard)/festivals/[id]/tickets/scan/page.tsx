'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Users,
  LogIn,
  LogOut,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { cn, formatNumber, formatDateTime } from '@/lib/utils'
import { ticketsApi, type ScanResult, type ScanStats } from '@/lib/api/tickets'

// Mock data for development
const mockStats: ScanStats = {
  totalEntriesToday: 2847,
  totalExitsToday: 1234,
  currentlyInside: 1613,
  totalScansToday: 4581,
  successRate: 97.2,
}

const mockRecentScans: ScanResult[] = [
  {
    id: '1',
    ticketId: 't1',
    ticketCode: 'FEST-2026-A1B2C3',
    ticketTypeName: 'Pass 3 Jours',
    holderName: 'Jean Dupont',
    action: 'ENTRY',
    status: 'SUCCESS',
    message: 'Entree validee',
    scannedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    scannedBy: 'staff@festival.com',
  },
  {
    id: '2',
    ticketId: 't2',
    ticketCode: 'FEST-2026-D4E5F6',
    ticketTypeName: 'Pass Journee - Samedi',
    holderName: 'Marie Martin',
    action: 'ENTRY',
    status: 'ALREADY_USED',
    message: 'Billet deja utilise',
    scannedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    scannedBy: 'staff@festival.com',
  },
  {
    id: '3',
    ticketId: 't3',
    ticketCode: 'FEST-2026-G7H8I9',
    ticketTypeName: 'Pass VIP Premium',
    holderName: 'Pierre Bernard',
    action: 'REENTRY',
    status: 'SUCCESS',
    message: 'Re-entree validee',
    scannedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    scannedBy: 'staff@festival.com',
  },
  {
    id: '4',
    ticketId: 't4',
    ticketCode: 'FEST-2026-INVALID',
    ticketTypeName: null,
    holderName: null,
    action: 'ENTRY',
    status: 'INVALID',
    message: 'Code billet invalide',
    scannedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    scannedBy: 'staff@festival.com',
  },
  {
    id: '5',
    ticketId: 't5',
    ticketCode: 'FEST-2026-J1K2L3',
    ticketTypeName: 'Pass Camping',
    holderName: 'Sophie Leroy',
    action: 'EXIT',
    status: 'SUCCESS',
    message: 'Sortie enregistree',
    scannedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    scannedBy: 'staff@festival.com',
  },
]

const statusConfig: Record<ScanResult['status'], { bg: string; text: string; icon: typeof CheckCircle; label: string }> = {
  SUCCESS: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Succes' },
  ALREADY_USED: { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertCircle, label: 'Deja utilise' },
  INVALID: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Invalide' },
  EXPIRED: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock, label: 'Expire' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Annule' },
}

const actionConfig: Record<ScanResult['action'], { icon: typeof LogIn; label: string }> = {
  ENTRY: { icon: LogIn, label: 'Entree' },
  EXIT: { icon: LogOut, label: 'Sortie' },
  REENTRY: { icon: RotateCcw, label: 'Re-entree' },
}

export default function TicketScanPage() {
  const params = useParams()
  const festivalId = params.id as string
  const inputRef = useRef<HTMLInputElement>(null)

  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [recentScans, setRecentScans] = useState<ScanResult[]>([])
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [scanAction, setScanAction] = useState<'ENTRY' | 'EXIT'>('ENTRY')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [autoFocus, setAutoFocus] = useState(true)

  // Load initial data
  useEffect(() => {
    loadStats()
    loadRecentScans()
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [festivalId])

  // Auto-focus input
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus, lastResult])

  const loadStats = async () => {
    try {
      // const data = await ticketsApi.getScanStats(festivalId)
      // setStats(data)
      setStats(mockStats)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const loadRecentScans = async () => {
    try {
      // const data = await ticketsApi.getRecentScans(festivalId)
      // setRecentScans(data)
      setRecentScans(mockRecentScans)
    } catch (error) {
      console.error('Failed to load recent scans:', error)
    }
  }

  const playSound = (success: boolean) => {
    if (!soundEnabled) return
    // In production, use actual audio files
    const audio = new Audio(success ? '/sounds/success.mp3' : '/sounds/error.mp3')
    audio.play().catch(() => {
      // Ignore audio play errors (browser restrictions)
    })
  }

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || scanning) return

    setScanning(true)
    try {
      // const result = await ticketsApi.scanTicket(festivalId, code.trim(), scanAction)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Mock result based on code
      const isValid = code.startsWith('FEST-2026-') && code.length > 15
      const result: ScanResult = {
        id: Date.now().toString(),
        ticketId: 'mock-ticket',
        ticketCode: code.trim(),
        ticketTypeName: isValid ? 'Pass 3 Jours' : null,
        holderName: isValid ? 'Festivalier' : null,
        action: scanAction,
        status: isValid ? 'SUCCESS' : 'INVALID',
        message: isValid ? (scanAction === 'ENTRY' ? 'Entree validee' : 'Sortie enregistree') : 'Code invalide',
        scannedAt: new Date().toISOString(),
        scannedBy: 'staff@festival.com',
      }

      setLastResult(result)
      setRecentScans((prev) => [result, ...prev.slice(0, 19)])
      playSound(result.status === 'SUCCESS')

      // Update stats optimistically
      if (stats && result.status === 'SUCCESS') {
        if (scanAction === 'ENTRY') {
          setStats({
            ...stats,
            totalEntriesToday: stats.totalEntriesToday + 1,
            currentlyInside: stats.currentlyInside + 1,
            totalScansToday: stats.totalScansToday + 1,
          })
        } else {
          setStats({
            ...stats,
            totalExitsToday: stats.totalExitsToday + 1,
            currentlyInside: stats.currentlyInside - 1,
            totalScansToday: stats.totalScansToday + 1,
          })
        }
      }
    } catch (error) {
      console.error('Scan failed:', error)
      const errorResult: ScanResult = {
        id: Date.now().toString(),
        ticketId: '',
        ticketCode: code.trim(),
        ticketTypeName: null,
        holderName: null,
        action: scanAction,
        status: 'INVALID',
        message: 'Erreur de scan',
        scannedAt: new Date().toISOString(),
        scannedBy: 'staff@festival.com',
      }
      setLastResult(errorResult)
      playSound(false)
    } finally {
      setScanning(false)
      setCode('')
    }
  }

  const getTimeSince = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/tickets`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scanner de billets</h1>
            <p className="text-gray-500">Scannez les billets pour controler l acces</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              'rounded-lg p-2',
              soundEnabled ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
            )}
            title={soundEnabled ? 'Desactiver le son' : 'Activer le son'}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <LogIn className="h-4 w-4" />
              Entrees aujourd hui
            </div>
            <p className="mt-1 text-2xl font-bold">{formatNumber(stats.totalEntriesToday)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <LogOut className="h-4 w-4" />
              Sorties aujourd hui
            </div>
            <p className="mt-1 text-2xl font-bold">{formatNumber(stats.totalExitsToday)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="h-4 w-4" />
              Actuellement sur site
            </div>
            <p className="mt-1 text-2xl font-bold text-primary">{formatNumber(stats.currentlyInside)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle className="h-4 w-4" />
              Taux de succes
            </div>
            <p className="mt-1 text-2xl font-bold text-green-600">{stats.successRate}%</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scan Input */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Saisie manuelle</h2>

            {/* Action Toggle */}
            <div className="mb-4 flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setScanAction('ENTRY')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
                  scanAction === 'ENTRY'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <LogIn className="h-4 w-4" />
                Entree
              </button>
              <button
                onClick={() => setScanAction('EXIT')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
                  scanAction === 'EXIT'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <LogOut className="h-4 w-4" />
                Sortie
              </button>
            </div>

            <form onSubmit={handleScan}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Entrez ou scannez le code billet..."
                  className="w-full rounded-lg border py-4 pl-10 pr-4 text-lg font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                disabled={!code.trim() || scanning}
                className="mt-4 w-full rounded-lg bg-primary py-3 text-lg font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {scanning ? 'Verification...' : 'Valider'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoFocus}
                  onChange={(e) => setAutoFocus(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                Focus automatique
              </label>
              <span>Appuyez sur Entree pour valider</span>
            </div>
          </div>

          {/* Last Result */}
          {lastResult && (
            <div
              className={cn(
                'rounded-lg border-2 p-6 transition-all',
                lastResult.status === 'SUCCESS'
                  ? 'border-green-500 bg-green-50'
                  : lastResult.status === 'ALREADY_USED'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-red-500 bg-red-50'
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-full',
                    lastResult.status === 'SUCCESS'
                      ? 'bg-green-100'
                      : lastResult.status === 'ALREADY_USED'
                      ? 'bg-orange-100'
                      : 'bg-red-100'
                  )}
                >
                  {lastResult.status === 'SUCCESS' ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : lastResult.status === 'ALREADY_USED' ? (
                    <AlertCircle className="h-8 w-8 text-orange-600" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-600" />
                  )}
                </div>

                <div className="flex-1">
                  <p
                    className={cn(
                      'text-xl font-bold',
                      lastResult.status === 'SUCCESS'
                        ? 'text-green-700'
                        : lastResult.status === 'ALREADY_USED'
                        ? 'text-orange-700'
                        : 'text-red-700'
                    )}
                  >
                    {lastResult.message}
                  </p>
                  {lastResult.holderName && (
                    <p className="mt-1 text-lg font-medium text-gray-900">
                      {lastResult.holderName}
                    </p>
                  )}
                  {lastResult.ticketTypeName && (
                    <p className="text-gray-600">{lastResult.ticketTypeName}</p>
                  )}
                  <p className="mt-2 font-mono text-sm text-gray-500">{lastResult.ticketCode}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Scans */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Scans recents</h2>
            <button
              onClick={loadRecentScans}
              className="text-sm text-primary hover:underline"
            >
              Actualiser
            </button>
          </div>

          {recentScans.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-gray-500">
              Aucun scan enregistre
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {recentScans.map((scan) => {
                const config = statusConfig[scan.status]
                const actionInfo = actionConfig[scan.action]
                const StatusIcon = config.icon
                const ActionIcon = actionInfo.icon

                return (
                  <div
                    key={scan.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3',
                      scan.status === 'SUCCESS' ? 'border-green-200 bg-green-50' :
                      scan.status === 'ALREADY_USED' ? 'border-orange-200 bg-orange-50' :
                      'border-red-200 bg-red-50'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full',
                        config.bg
                      )}
                    >
                      <StatusIcon className={cn('h-5 w-5', config.text)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="truncate text-sm font-mono text-gray-700">
                          {scan.ticketCode}
                        </code>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
                            config.bg,
                            config.text
                          )}
                        >
                          <ActionIcon className="h-3 w-3" />
                          {actionInfo.label}
                        </span>
                      </div>
                      {scan.holderName && (
                        <p className="truncate text-sm text-gray-600">{scan.holderName}</p>
                      )}
                      {scan.ticketTypeName && (
                        <p className="truncate text-xs text-gray-400">{scan.ticketTypeName}</p>
                      )}
                    </div>

                    <div className="text-right text-xs text-gray-400">
                      {getTimeSince(scan.scannedAt)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
