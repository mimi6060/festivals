'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  DollarSign,
  TrendingUp,
  ArrowRight,
  CreditCard,
  Wallet,
  Download,
  Calendar,
  Receipt,
  PiggyBank,
  Store,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { RevenueChart } from '@/components/finance/RevenueChart'
import {
  financeApi,
  financeQueryKeys,
  DailyRevenue,
  PLATFORM_FEE_RATE,
  getPayoutStatusLabel,
} from '@/lib/api/finance'
import { formatCurrency, formatNumber, formatDate, cn } from '@/lib/utils'

type PeriodFilter = 'day' | 'week' | 'month'

export default function FinancePage() {
  const params = useParams()
  const festivalId = params.id as string
  const [period, setPeriod] = useState<PeriodFilter>('day')
  const [chartDays, setChartDays] = useState(30)

  // Fetch revenue stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: financeQueryKeys.revenueStats(festivalId, period),
    queryFn: () => financeApi.getRevenueStats(festivalId, period),
  })

  // Fetch daily revenue for chart
  const { data: dailyRevenue, isLoading: chartLoading } = useQuery({
    queryKey: financeQueryKeys.dailyRevenue(festivalId, chartDays),
    queryFn: () => financeApi.getDailyRevenue(festivalId, chartDays),
  })

  // Fetch payout summary
  const { data: payoutSummary, isLoading: payoutLoading } = useQuery({
    queryKey: financeQueryKeys.payoutSummary(festivalId),
    queryFn: () => financeApi.getPayoutSummary(festivalId),
  })

  // Fetch Stripe status
  const { data: stripeStatus, isLoading: stripeLoading } = useQuery({
    queryKey: financeQueryKeys.stripeStatus(festivalId),
    queryFn: () => financeApi.getStripeAccountStatus(festivalId),
  })

  const handleExport = async () => {
    try {
      const result = await financeApi.exportTransactions(festivalId, { format: 'xlsx' })
      window.open(result.downloadUrl, '_blank')
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const periodOptions = [
    { value: 'day' as PeriodFilter, label: 'Jour' },
    { value: 'week' as PeriodFilter, label: 'Semaine' },
    { value: 'month' as PeriodFilter, label: 'Mois' },
  ]

  const chartPeriodOptions = [
    { value: 7, label: '7 jours' },
    { value: 30, label: '30 jours' },
    { value: 90, label: '90 jours' },
  ]

  const getStripeStatusBadge = () => {
    if (!stripeStatus) return null
    const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
      ACTIVE: 'success',
      PENDING: 'warning',
      RESTRICTED: 'error',
      DISABLED: 'error',
    }
    const statusLabels: Record<string, string> = {
      ACTIVE: 'Actif',
      PENDING: 'En attente',
      RESTRICTED: 'Restreint',
      DISABLED: 'Desactive',
    }
    return (
      <Badge variant={statusColors[stripeStatus.status] || 'default'}>
        {statusLabels[stripeStatus.status] || stripeStatus.status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez les revenus et les paiements du festival
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport} leftIcon={<Download className="h-4 w-4" />}>
            Exporter
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Revenus totaux</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : formatCurrency(stats?.totalRevenue || 0)}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <Receipt className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Frais plateforme (1%)</p>
                <p className="text-2xl font-bold text-orange-600">
                  {statsLoading ? '...' : formatCurrency(stats?.totalFees || 0)}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <PiggyBank className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Revenus nets</p>
                <p className="text-2xl font-bold text-blue-600">
                  {statsLoading ? '...' : formatCurrency(stats?.netRevenue || 0)}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <CreditCard className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Transactions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : formatNumber(stats?.totalTransactions || 0)}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Stripe Account Status */}
      {stripeStatus && !stripeStatus.payoutsEnabled && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardBody>
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 flex-shrink-0 text-yellow-600" />
              <div className="flex-1">
                <h3 className="font-medium text-yellow-800">Configuration Stripe requise</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Votre compte Stripe necessite des informations supplementaires pour activer les versements.
                </p>
                {stripeStatus.requirements && stripeStatus.requirements.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-sm text-yellow-700">
                    {stripeStatus.requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                )}
              </div>
              {stripeStatus.dashboardUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(stripeStatus.dashboardUrl, '_blank')}
                >
                  Completer
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Evolution des revenus</h2>
            <div className="flex rounded-lg border border-gray-300">
              {chartPeriodOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setChartDays(option.value)}
                  className={cn(
                    'px-3 py-1.5 text-sm transition-colors first:rounded-l-lg last:rounded-r-lg',
                    chartDays === option.value
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <RevenueChart
            data={dailyRevenue || []}
            loading={chartLoading}
            period="day"
            title="Revenus journaliers"
            subtitle={`Derniers ${chartDays} jours`}
            showFees
            showRefunds
            showTransactions
          />
        </div>

        {/* Payouts sidebar */}
        <div className="space-y-6">
          {/* Pending payout */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Prochain versement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payoutLoading ? (
                <div className="space-y-3">
                  <div className="h-8 w-2/3 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              ) : payoutSummary ? (
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(payoutSummary.pendingAmount)}
                  </p>
                  {payoutSummary.nextPayoutDate && (
                    <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="h-4 w-4" />
                      Prevu le {formatDate(payoutSummary.nextPayoutDate)}
                    </p>
                  )}
                  <div className="mt-4 border-t pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Total verse</span>
                      <span className="font-medium">
                        {formatCurrency(payoutSummary.totalPaidOut)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-gray-500">Frais totaux</span>
                      <span className="font-medium text-orange-600">
                        {formatCurrency(payoutSummary.totalFeesPaid)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Aucun versement en attente</p>
              )}
              <div className="mt-4">
                <Link href={`/festivals/${festivalId}/finance/payouts`}>
                  <Button variant="outline" className="w-full">
                    Voir les versements
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Stripe Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Compte Stripe
                </CardTitle>
                {getStripeStatusBadge()}
              </div>
            </CardHeader>
            <CardContent>
              {stripeLoading ? (
                <div className="space-y-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              ) : stripeStatus ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Paiements actifs</span>
                    <span
                      className={cn(
                        'font-medium',
                        stripeStatus.chargesEnabled ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {stripeStatus.chargesEnabled ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Oui
                        </span>
                      ) : (
                        'Non'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Versements actifs</span>
                    <span
                      className={cn(
                        'font-medium',
                        stripeStatus.payoutsEnabled ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {stripeStatus.payoutsEnabled ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Oui
                        </span>
                      ) : (
                        'Non'
                      )}
                    </span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Solde disponible</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(stripeStatus.availableBalance)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-gray-500">Solde en attente</span>
                      <span className="font-medium text-gray-600">
                        {formatCurrency(stripeStatus.pendingBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Compte non configure</p>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card>
            <CardHeader>
              <CardTitle>Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href={`/festivals/${festivalId}/finance/transactions`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
              >
                <span className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">Transactions</span>
                </span>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </Link>
              <Link
                href={`/festivals/${festivalId}/finance/payouts`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
              >
                <span className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">Versements</span>
                </span>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top stands and products */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Stands */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Top Stands par revenus
            </CardTitle>
            <CardDescription>Classement des stands les plus performants</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.topStands && stats.topStands.length > 0 ? (
              <div className="space-y-4">
                {stats.topStands.map((stand, index) => (
                  <div key={stand.standId} className="flex items-center gap-4">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                        index === 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : index === 1
                          ? 'bg-gray-200 text-gray-700'
                          : index === 2
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{stand.standName}</p>
                      <p className="text-sm text-gray-500">
                        {formatNumber(stand.transactions)} transactions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatCurrency(stand.revenue)}</p>
                      <p className="text-sm text-gray-500">{stand.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500">Aucune donnee disponible</p>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top Produits par revenus
            </CardTitle>
            <CardDescription>Produits les plus vendus</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.topProducts && stats.topProducts.length > 0 ? (
              <div className="space-y-4">
                {stats.topProducts.map((product, index) => (
                  <div key={product.productId} className="flex items-center gap-4">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                        index === 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : index === 1
                          ? 'bg-gray-200 text-gray-700'
                          : index === 2
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.productName}</p>
                      <p className="text-sm text-gray-500">
                        {product.standName} - {formatNumber(product.quantity)} vendus
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500">Aucune donnee disponible</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform fees info */}
      <Card className="border-blue-100 bg-blue-50">
        <CardBody>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900">Frais de plateforme</h3>
              <p className="mt-1 text-sm text-blue-700">
                Les frais de plateforme s'elevent a <strong>{(PLATFORM_FEE_RATE * 100).toFixed(0)}%</strong> du
                montant total des transactions. Ces frais couvrent les couts d'infrastructure, de maintenance
                et de support de la plateforme FestivalPay.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
