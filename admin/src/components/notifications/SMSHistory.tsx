'use client'

import { useState, useEffect } from 'react'
import {
  History,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  AlertTriangle,
  Check,
  Clock,
  Ban,
  Eye,
  RefreshCw,
  Users,
  Calendar,
  Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import {
  smsApi,
  SMSLog,
  SMSBroadcast,
  SMSLogStatus,
  statusDisplayInfo,
  templateDisplayInfo,
} from '@/lib/api/sms'

interface SMSHistoryProps {
  festivalId: string
}

const statusIcons: Record<SMSLogStatus, React.ComponentType<{ className?: string }>> = {
  PENDING: Clock,
  SENT: Send,
  DELIVERED: Check,
  FAILED: AlertTriangle,
  OPTED_OUT: Ban,
}

const statusColors: Record<SMSLogStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  SENT: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  OPTED_OUT: 'bg-gray-100 text-gray-800',
}

export function SMSHistory({ festivalId }: SMSHistoryProps) {
  const [activeTab, setActiveTab] = useState('broadcasts')
  const [broadcasts, setBroadcasts] = useState<SMSBroadcast[]>([])
  const [logs, setLogs] = useState<SMSLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<SMSLogStatus | 'all'>('all')
  const [broadcastsPage, setBroadcastsPage] = useState(1)
  const [logsPage, setLogsPage] = useState(1)
  const [broadcastsTotal, setBroadcastsTotal] = useState(0)
  const [logsTotal, setLogsTotal] = useState(0)
  const [selectedBroadcast, setSelectedBroadcast] = useState<SMSBroadcast | null>(null)
  const perPage = 10

  useEffect(() => {
    loadData()
  }, [festivalId, broadcastsPage, logsPage])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [broadcastsRes, logsRes] = await Promise.all([
        smsApi.getBroadcasts(festivalId, broadcastsPage, perPage).catch(() => ({
          data: [] as SMSBroadcast[],
          meta: { total: 0, page: 1, perPage },
        })),
        smsApi.getLogs(festivalId, logsPage, perPage).catch(() => ({
          data: [] as SMSLog[],
          meta: { total: 0, page: 1, perPage },
        })),
      ])

      setBroadcasts(broadcastsRes.data || [])
      setBroadcastsTotal(broadcastsRes.meta?.total || 0)
      setLogs(logsRes.data || [])
      setLogsTotal(logsRes.meta?.total || 0)
    } catch (error) {
      console.error('Failed to load history:', error)
      // Mock data for development
      setBroadcasts([
        {
          id: '1',
          festivalId,
          template: 'BROADCAST',
          message: 'Welcome to Summer Festival 2026! Gates open at 10 AM. See you there!',
          totalCount: 1250,
          sentCount: 1200,
          failedCount: 25,
          optedOutCount: 25,
          status: 'COMPLETED',
          startedAt: '2026-01-20T10:00:00Z',
          completedAt: '2026-01-20T10:05:00Z',
          createdAt: '2026-01-20T10:00:00Z',
        },
        {
          id: '2',
          festivalId,
          template: 'BROADCAST',
          message: 'Reminder: The headliner performs at 9 PM on Main Stage. Dont miss it!',
          totalCount: 1230,
          sentCount: 1180,
          failedCount: 20,
          optedOutCount: 30,
          status: 'COMPLETED',
          startedAt: '2026-01-19T18:00:00Z',
          completedAt: '2026-01-19T18:04:00Z',
          createdAt: '2026-01-19T18:00:00Z',
        },
      ])
      setBroadcastsTotal(2)
      setLogs([
        {
          id: '1',
          festivalId,
          toPhone: '+1234567890',
          template: 'BROADCAST',
          message: 'Welcome to Summer Festival 2026!',
          status: 'DELIVERED',
          messageSid: 'SM123abc',
          sentAt: '2026-01-20T10:00:05Z',
          createdAt: '2026-01-20T10:00:00Z',
        },
        {
          id: '2',
          festivalId,
          toPhone: '+1987654321',
          template: 'BROADCAST',
          message: 'Welcome to Summer Festival 2026!',
          status: 'FAILED',
          error: 'Invalid phone number',
          createdAt: '2026-01-20T10:00:01Z',
        },
        {
          id: '3',
          festivalId,
          toPhone: '+1555555555',
          template: 'TICKET_REMINDER',
          message: 'Your ticket for Summer Festival is confirmed!',
          status: 'SENT',
          messageSid: 'SM456def',
          sentAt: '2026-01-18T14:30:00Z',
          createdAt: '2026-01-18T14:30:00Z',
        },
      ])
      setLogsTotal(3)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  const formatPhone = (phone: string) => {
    // Mask middle digits for privacy
    if (phone.length > 8) {
      return phone.slice(0, 4) + '****' + phone.slice(-4)
    }
    return phone
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.toPhone.includes(searchQuery) ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalBroadcastPages = Math.ceil(broadcastsTotal / perPage)
  const totalLogPages = Math.ceil(logsTotal / perPage)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="broadcasts">
            <Users className="mr-2 h-4 w-4" />
            Broadcasts ({broadcastsTotal})
          </TabsTrigger>
          <TabsTrigger value="individual">
            <MessageSquare className="mr-2 h-4 w-4" />
            Individual Messages ({logsTotal})
          </TabsTrigger>
        </TabsList>

        {/* Broadcasts Tab */}
        <TabsContent value="broadcasts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Broadcast History</CardTitle>
              <CardDescription>View all bulk SMS broadcasts sent to festival participants</CardDescription>
            </CardHeader>
            <CardContent>
              {broadcasts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-500">No broadcasts sent yet</p>
                  <p className="text-sm text-gray-400">
                    Send your first broadcast from the Compose tab
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {broadcasts.map((broadcast) => (
                    <div
                      key={broadcast.id}
                      className="rounded-lg border border-gray-200 p-4 hover:border-gray-300"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                broadcast.status === 'COMPLETED'
                                  ? 'bg-green-100 text-green-800'
                                  : broadcast.status === 'IN_PROGRESS'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              )}
                            >
                              {broadcast.status}
                            </span>
                            <span className="text-sm text-gray-500">
                              <Calendar className="mr-1 inline h-3.5 w-3.5" />
                              {formatDate(broadcast.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-700 line-clamp-2">
                            {broadcast.message}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBroadcast(broadcast)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-4 grid grid-cols-4 gap-4 border-t pt-4">
                        <div className="text-center">
                          <p className="text-xl font-bold text-gray-900">{broadcast.totalCount}</p>
                          <p className="text-xs text-gray-500">Total</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-green-600">{broadcast.sentCount}</p>
                          <p className="text-xs text-gray-500">Sent</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-red-600">{broadcast.failedCount}</p>
                          <p className="text-xs text-gray-500">Failed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-gray-600">{broadcast.optedOutCount}</p>
                          <p className="text-xs text-gray-500">Opted Out</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {totalBroadcastPages > 1 && (
                    <div className="flex items-center justify-between border-t pt-4">
                      <p className="text-sm text-gray-500">
                        Showing {(broadcastsPage - 1) * perPage + 1} to{' '}
                        {Math.min(broadcastsPage * perPage, broadcastsTotal)} of {broadcastsTotal}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBroadcastsPage((p) => Math.max(1, p - 1))}
                          disabled={broadcastsPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBroadcastsPage((p) => Math.min(totalBroadcastPages, p + 1))}
                          disabled={broadcastsPage === totalBroadcastPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual Messages Tab */}
        <TabsContent value="individual" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Message Logs</CardTitle>
                  <CardDescription>View individual SMS delivery status and details</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadData}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    type="text"
                    placeholder="Search by phone or message..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="h-4 w-4" />}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as SMSLogStatus | 'all')}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="SENT">Sent</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="FAILED">Failed</option>
                    <option value="OPTED_OUT">Opted Out</option>
                  </select>
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-500">No messages found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLogs.map((log) => {
                    const StatusIcon = statusIcons[log.status]
                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full',
                              statusColors[log.status]
                            )}
                          >
                            <StatusIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {formatPhone(log.toPhone)}
                              </span>
                              <Badge variant="outline" size="sm">
                                {templateDisplayInfo[log.template]?.name || log.template}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-sm text-gray-500 line-clamp-1">
                              {log.message}
                            </p>
                            {log.error && (
                              <p className="mt-0.5 text-xs text-red-600">Error: {log.error}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              statusColors[log.status]
                            )}
                          >
                            {statusDisplayInfo[log.status].label}
                          </span>
                          <p className="mt-1 text-xs text-gray-400">
                            {formatDate(log.sentAt || log.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })}

                  {/* Pagination */}
                  {totalLogPages > 1 && (
                    <div className="flex items-center justify-between border-t pt-4">
                      <p className="text-sm text-gray-500">
                        Showing {(logsPage - 1) * perPage + 1} to{' '}
                        {Math.min(logsPage * perPage, logsTotal)} of {logsTotal}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                          disabled={logsPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsPage((p) => Math.min(totalLogPages, p + 1))}
                          disabled={logsPage === totalLogPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Broadcast Detail Modal */}
      {selectedBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Broadcast Details</h3>
                <button
                  onClick={() => setSelectedBroadcast(null)}
                  className="rounded-lg p-2 hover:bg-gray-100"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p
                    className={cn(
                      'mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium',
                      selectedBroadcast.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : selectedBroadcast.status === 'IN_PROGRESS'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    )}
                  >
                    {selectedBroadcast.status}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Message</label>
                  <p className="mt-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                    {selectedBroadcast.message}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Started At</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatDate(selectedBroadcast.startedAt)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Completed At</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatDate(selectedBroadcast.completedAt)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 rounded-lg bg-gray-50 p-4">
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-900">
                      {selectedBroadcast.totalCount}
                    </p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-600">{selectedBroadcast.sentCount}</p>
                    <p className="text-xs text-gray-500">Sent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-red-600">{selectedBroadcast.failedCount}</p>
                    <p className="text-xs text-gray-500">Failed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-600">
                      {selectedBroadcast.optedOutCount}
                    </p>
                    <p className="text-xs text-gray-500">Opted Out</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Success Rate</label>
                  <div className="mt-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${(selectedBroadcast.sentCount / selectedBroadcast.totalCount) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {((selectedBroadcast.sentCount / selectedBroadcast.totalCount) * 100).toFixed(1)}%
                      delivered successfully
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t bg-gray-50 px-6 py-4">
              <Button variant="secondary" onClick={() => setSelectedBroadcast(null)} className="w-full">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
