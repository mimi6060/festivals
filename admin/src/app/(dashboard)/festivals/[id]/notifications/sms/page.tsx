'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  MessageSquare,
  Send,
  History,
  CreditCard,
  BarChart3,
  Loader2,
  RefreshCw,
  AlertCircle,
  Check,
  Users,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { SMSComposer } from '@/components/notifications/SMSComposer'
import { SMSHistory } from '@/components/notifications/SMSHistory'
import { SMSCredits } from '@/components/notifications/SMSCredits'
import { smsApi, SMSStats, SMSBalance } from '@/lib/api/sms'

export default function SMSDashboardPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [activeTab, setActiveTab] = useState('compose')
  const [stats, setStats] = useState<SMSStats | null>(null)
  const [balance, setBalance] = useState<SMSBalance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [festivalId])

  const loadData = async () => {
    try {
      const [statsData, balanceData] = await Promise.all([
        smsApi.getStats(festivalId).catch(() => null),
        smsApi.getBalance().catch(() => null),
      ])
      setStats(statsData || {
        totalSent: 0,
        totalFailed: 0,
        totalOptedOut: 0,
        totalBroadcasts: 0,
        byTemplate: {},
      })
      setBalance(balanceData || { currency: 'USD', balance: 0 })
    } catch (error) {
      console.error('Failed to load data:', error)
      // Set mock data for development
      setStats({
        totalSent: 1250,
        totalFailed: 23,
        totalOptedOut: 45,
        totalBroadcasts: 12,
        byTemplate: {
          BROADCAST: 800,
          TICKET_REMINDER: 300,
          TOPUP_CONFIRMATION: 100,
          WELCOME: 50,
        },
      })
      setBalance({ currency: 'USD', balance: 145.50 })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
    setIsRefreshing(false)
    setMessage({ type: 'success', text: 'Data refreshed successfully' })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleBroadcastSuccess = () => {
    setMessage({ type: 'success', text: 'Broadcast sent successfully!' })
    setTimeout(() => setMessage(null), 3000)
    loadData()
    setActiveTab('history')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const deliveryRate = stats ? (stats.totalSent / (stats.totalSent + stats.totalFailed) * 100) || 0 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/settings`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SMS Notifications</h1>
            <p className="mt-1 text-sm text-gray-500">
              Send SMS messages to festival participants via Twilio
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          leftIcon={<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />}
        >
          Refresh
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-4',
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          )}
        >
          {message.type === 'success' ? (
            <Check className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Sent</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {stats?.totalSent.toLocaleString() || 0}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Send className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
              <span className="text-green-600">{deliveryRate.toFixed(1)}% delivery rate</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Failed</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {stats?.totalFailed.toLocaleString() || 0}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingDown className="mr-1 h-4 w-4 text-red-500" />
              <span className="text-gray-500">{stats?.totalFailed || 0} failed messages</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Broadcasts</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {stats?.totalBroadcasts.toLocaleString() || 0}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-gray-500">{stats?.totalOptedOut || 0} opted out</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Twilio Balance</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {balance ? `${balance.currency} ${balance.balance.toFixed(2)}` : 'N/A'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className={cn(
                balance && balance.balance < 10 ? 'text-red-600' : 'text-gray-500'
              )}>
                {balance && balance.balance < 10 ? 'Low balance!' : 'Account active'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="compose">
            <MessageSquare className="mr-2 h-4 w-4" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="credits">
            <CreditCard className="mr-2 h-4 w-4" />
            Credits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-6">
          <SMSComposer festivalId={festivalId} onSuccess={handleBroadcastSuccess} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <SMSHistory festivalId={festivalId} />
        </TabsContent>

        <TabsContent value="credits" className="mt-6">
          <SMSCredits balance={balance} stats={stats} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
