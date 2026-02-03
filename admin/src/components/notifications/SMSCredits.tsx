'use client'

import { useState } from 'react'
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  PieChart,
  BarChart3,
  Info,
  MessageSquare,
  Users,
  Check,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SMSStats, SMSBalance } from '@/lib/api/sms'

interface SMSCreditsProps {
  balance: SMSBalance | null
  stats: SMSStats | null
}

// Average SMS cost (varies by country)
const AVG_SMS_COST = 0.0075

export function SMSCredits({ balance, stats }: SMSCreditsProps) {
  const [showPricing, setShowPricing] = useState(false)

  // Calculate estimated messages remaining
  const estimatedRemaining = balance ? Math.floor(balance.balance / AVG_SMS_COST) : 0

  // Calculate template usage percentages
  const templateUsage = stats?.byTemplate
    ? Object.entries(stats.byTemplate).map(([template, count]) => ({
        template,
        count,
        percentage: stats.totalSent > 0 ? (count / (stats.totalSent + stats.totalFailed)) * 100 : 0,
      }))
    : []

  // Sort by count descending
  templateUsage.sort((a, b) => b.count - a.count)

  const templateColors: Record<string, string> = {
    BROADCAST: 'bg-purple-500',
    TICKET_REMINDER: 'bg-blue-500',
    TOPUP_CONFIRMATION: 'bg-green-500',
    SOS_CONFIRMATION: 'bg-red-500',
    WELCOME: 'bg-yellow-500',
    LINEUP_CHANGE: 'bg-pink-500',
    EMERGENCY: 'bg-red-600',
    PAYMENT_CONFIRM: 'bg-emerald-500',
  }

  const templateNames: Record<string, string> = {
    BROADCAST: 'Broadcast',
    TICKET_REMINDER: 'Ticket Reminder',
    TOPUP_CONFIRMATION: 'Top-Up Confirmation',
    SOS_CONFIRMATION: 'SOS Confirmation',
    WELCOME: 'Welcome',
    LINEUP_CHANGE: 'Lineup Change',
    EMERGENCY: 'Emergency',
    PAYMENT_CONFIRM: 'Payment Confirmation',
  }

  // Balance status
  const balanceStatus = balance
    ? balance.balance < 5
      ? 'critical'
      : balance.balance < 20
      ? 'warning'
      : 'good'
    : 'unknown'

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Current Balance Card */}
        <Card
          className={cn(
            'border-2',
            balanceStatus === 'critical'
              ? 'border-red-200 bg-red-50'
              : balanceStatus === 'warning'
              ? 'border-yellow-200 bg-yellow-50'
              : 'border-green-200 bg-green-50'
          )}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Balance</p>
                <p className="mt-1 text-3xl font-bold">
                  {balance ? `$${balance.balance.toFixed(2)}` : 'N/A'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {balance?.currency || 'USD'} account
                </p>
              </div>
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full',
                  balanceStatus === 'critical'
                    ? 'bg-red-100'
                    : balanceStatus === 'warning'
                    ? 'bg-yellow-100'
                    : 'bg-green-100'
                )}
              >
                <DollarSign
                  className={cn(
                    'h-7 w-7',
                    balanceStatus === 'critical'
                      ? 'text-red-600'
                      : balanceStatus === 'warning'
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  )}
                />
              </div>
            </div>
            {balanceStatus !== 'good' && (
              <div
                className={cn(
                  'mt-4 flex items-center gap-2 rounded-lg px-3 py-2',
                  balanceStatus === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                )}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                  {balanceStatus === 'critical' ? 'Balance critically low!' : 'Balance running low'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estimated Messages */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Estimated Remaining</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {estimatedRemaining.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-gray-500">messages (approx.)</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                <MessageSquare className="h-7 w-7 text-blue-600" />
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-400">
              Based on average cost of ${AVG_SMS_COST} per SMS
            </p>
          </CardContent>
        </Card>

        {/* Top Up Button */}
        <Card>
          <CardContent className="flex h-full flex-col items-center justify-center pt-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
              <CreditCard className="h-7 w-7 text-purple-600" />
            </div>
            <p className="mt-4 text-center text-sm text-gray-600">
              Add credits to your Twilio account to continue sending SMS
            </p>
            <Button
              className="mt-4"
              onClick={() => window.open('https://console.twilio.com/us1/billing/manage-billing/billing-details', '_blank')}
              rightIcon={<ExternalLink className="h-4 w-4" />}
            >
              Add Credits
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Usage Statistics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Template Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Usage by Template
            </CardTitle>
            <CardDescription>Distribution of SMS sent by template type</CardDescription>
          </CardHeader>
          <CardContent>
            {templateUsage.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="h-10 w-10 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No usage data yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Bar representation */}
                <div className="flex h-4 overflow-hidden rounded-full bg-gray-100">
                  {templateUsage.map(({ template, percentage }) => (
                    <div
                      key={template}
                      className={cn(templateColors[template] || 'bg-gray-400')}
                      style={{ width: `${percentage}%` }}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="space-y-2">
                  {templateUsage.map(({ template, count, percentage }) => (
                    <div key={template} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'h-3 w-3 rounded-full',
                            templateColors[template] || 'bg-gray-400'
                          )}
                        />
                        <span className="text-sm text-gray-700">
                          {templateNames[template] || template}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">
                          {count.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Delivery Statistics
            </CardTitle>
            <CardDescription>Overall SMS delivery performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Success Rate */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Delivery Rate</span>
                  <span className="text-sm font-bold text-green-600">
                    {stats && stats.totalSent + stats.totalFailed > 0
                      ? ((stats.totalSent / (stats.totalSent + stats.totalFailed)) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${
                        stats && stats.totalSent + stats.totalFailed > 0
                          ? (stats.totalSent / (stats.totalSent + stats.totalFailed)) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-green-50 p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">
                      {stats?.totalSent.toLocaleString() || 0}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-green-600">Delivered</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-2xl font-bold text-red-600">
                      {stats?.totalFailed.toLocaleString() || 0}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-red-600">Failed</p>
                </div>
                <div className="rounded-lg bg-purple-50 p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="text-2xl font-bold text-purple-600">
                      {stats?.totalBroadcasts.toLocaleString() || 0}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-purple-600">Broadcasts</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-2xl font-bold text-gray-600">
                      {stats?.totalOptedOut.toLocaleString() || 0}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">Opted Out</p>
                </div>
              </div>

              {/* Estimated Cost */}
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Estimated Cost</span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">
                    ${(((stats?.totalSent || 0) + (stats?.totalFailed || 0)) * AVG_SMS_COST).toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-blue-600">
                  Based on {stats?.totalSent || 0} sent + {stats?.totalFailed || 0} failed attempts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Twilio SMS Pricing
          </CardTitle>
          <CardDescription>
            Pricing varies by destination country. Here are common rates:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-medium text-gray-500">Country</th>
                  <th className="pb-3 text-right font-medium text-gray-500">Outbound SMS</th>
                  <th className="pb-3 text-right font-medium text-gray-500">Est. per 1000</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-3">United States</td>
                  <td className="py-3 text-right font-mono">$0.0079</td>
                  <td className="py-3 text-right text-gray-500">$7.90</td>
                </tr>
                <tr>
                  <td className="py-3">Canada</td>
                  <td className="py-3 text-right font-mono">$0.0080</td>
                  <td className="py-3 text-right text-gray-500">$8.00</td>
                </tr>
                <tr>
                  <td className="py-3">United Kingdom</td>
                  <td className="py-3 text-right font-mono">$0.0420</td>
                  <td className="py-3 text-right text-gray-500">$42.00</td>
                </tr>
                <tr>
                  <td className="py-3">Germany</td>
                  <td className="py-3 text-right font-mono">$0.0850</td>
                  <td className="py-3 text-right text-gray-500">$85.00</td>
                </tr>
                <tr>
                  <td className="py-3">France</td>
                  <td className="py-3 text-right font-mono">$0.0740</td>
                  <td className="py-3 text-right text-gray-500">$74.00</td>
                </tr>
                <tr>
                  <td className="py-3">Belgium</td>
                  <td className="py-3 text-right font-mono">$0.0580</td>
                  <td className="py-3 text-right text-gray-500">$58.00</td>
                </tr>
                <tr>
                  <td className="py-3">Netherlands</td>
                  <td className="py-3 text-right font-mono">$0.0780</td>
                  <td className="py-3 text-right text-gray-500">$78.00</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Prices are approximate and may vary. Check{' '}
            <a
              href="https://www.twilio.com/sms/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Twilio&apos;s pricing page
            </a>{' '}
            for current rates.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
