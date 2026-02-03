'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Target,
  TrendingDown,
  Plus,
  ChevronDown,
  AlertCircle,
} from 'lucide-react'
import { FunnelChart } from '@/components/analytics/FunnelChart'
import { analyticsApi, analyticsQueryKeys, type Funnel } from '@/lib/api/stats'
import { formatNumber, cn } from '@/lib/utils'

export default function FunnelsPage() {
  const params = useParams()
  const festivalId = params.id as string
  const queryClient = useQueryClient()
  const [selectedFunnel, setSelectedFunnel] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newFunnel, setNewFunnel] = useState({ name: '', description: '', steps: ['', ''] })
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')

  const getDateRange = () => {
    const end = new Date()
    const start = new Date()
    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7)
        break
      case '30d':
        start.setDate(start.getDate() - 30)
        break
      case '90d':
        start.setDate(start.getDate() - 90)
        break
    }
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    }
  }

  const { startDate, endDate } = getDateRange()

  // Fetch all funnels
  const { data: funnels, isLoading } = useQuery({
    queryKey: [...analyticsQueryKeys.funnels(festivalId), dateRange],
    queryFn: () => analyticsApi.getAllFunnels(festivalId, startDate, endDate),
  })

  // Create funnel mutation
  const createFunnelMutation = useMutation({
    mutationFn: (data: { name: string; description: string; steps: string[] }) =>
      analyticsApi.createFunnel(festivalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.funnels(festivalId) })
      setShowCreateModal(false)
      setNewFunnel({ name: '', description: '', steps: ['', ''] })
    },
  })

  const activeFunnel = selectedFunnel
    ? funnels?.find((f) => f.id === selectedFunnel)
    : funnels?.[0]

  const handleAddStep = () => {
    setNewFunnel((prev) => ({ ...prev, steps: [...prev.steps, ''] }))
  }

  const handleStepChange = (index: number, value: string) => {
    setNewFunnel((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? value : s)),
    }))
  }

  const handleCreateFunnel = () => {
    const validSteps = newFunnel.steps.filter((s) => s.trim() !== '')
    if (validSteps.length >= 2 && newFunnel.name.trim()) {
      createFunnelMutation.mutate({
        name: newFunnel.name.trim(),
        description: newFunnel.description.trim(),
        steps: validSteps,
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/analytics`}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux Analytics
          </Link>
          <h1 className="text-2xl font-bold">Entonnoirs de Conversion</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border bg-white p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  dateRange === range
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {range === '7d' ? '7 jours' : range === '30d' ? '30 jours' : '90 jours'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Creer un Entonnoir
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : funnels && funnels.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Funnel List */}
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-700">Entonnoirs Disponibles</h2>
            {funnels.map((funnel) => (
              <button
                key={funnel.id}
                onClick={() => setSelectedFunnel(funnel.id)}
                className={cn(
                  'w-full rounded-lg border p-4 text-left transition-all',
                  activeFunnel?.id === funnel.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-gray-300'
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{funnel.name}</h3>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      funnel.conversionRate > 10
                        ? 'bg-green-100 text-green-800'
                        : funnel.conversionRate > 5
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    )}
                  >
                    {funnel.conversionRate.toFixed(1)}%
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{funnel.steps.length} etapes</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  <span>{formatNumber(funnel.totalStarted)} departs</span>
                  <span>{formatNumber(funnel.totalCompleted)} completions</span>
                </div>
              </button>
            ))}
          </div>

          {/* Funnel Visualization */}
          <div className="lg:col-span-2">
            {activeFunnel ? (
              <div className="rounded-lg border bg-card shadow-sm">
                <div className="border-b px-6 py-4">
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <Target className="h-5 w-5 text-primary" />
                    {activeFunnel.name}
                  </h3>
                  {activeFunnel.description && (
                    <p className="mt-1 text-sm text-gray-600">{activeFunnel.description}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Periode: {activeFunnel.period}</p>
                </div>
                <div className="p-6">
                  <FunnelChart funnel={activeFunnel} />

                  {/* Drop-off Analysis */}
                  <div className="mt-6 rounded-lg bg-gray-50 p-4">
                    <h4 className="flex items-center gap-2 font-semibold text-gray-900">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      Analyse des Abandons
                    </h4>
                    <div className="mt-3 space-y-2">
                      {activeFunnel.steps.slice(1).map((step, index) => {
                        const dropOff = 100 - step.percentage
                        return (
                          <div key={step.name} className="flex items-center justify-between">
                            <span className="text-sm">
                              {activeFunnel.steps[index].name} → {step.name}
                            </span>
                            <span
                              className={cn(
                                'text-sm font-medium',
                                dropOff > 50 ? 'text-red-600' : dropOff > 25 ? 'text-yellow-600' : 'text-green-600'
                              )}
                            >
                              -{dropOff.toFixed(1)}% abandon
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {activeFunnel.dropOffStep > 0 && (
                      <div className="mt-3 flex items-start gap-2 rounded bg-red-50 p-3">
                        <AlertCircle className="mt-0.5 h-4 w-4 text-red-500" />
                        <div>
                          <p className="text-sm font-medium text-red-800">
                            Point de friction principal
                          </p>
                          <p className="text-sm text-red-700">
                            L'etape "{activeFunnel.steps[activeFunnel.dropOffStep].name}" a le plus
                            fort taux d'abandon
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-blue-50 p-4 text-center">
                      <p className="text-2xl font-bold text-blue-900">
                        {formatNumber(activeFunnel.totalStarted)}
                      </p>
                      <p className="text-sm text-blue-700">Utilisateurs entres</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-4 text-center">
                      <p className="text-2xl font-bold text-green-900">
                        {formatNumber(activeFunnel.totalCompleted)}
                      </p>
                      <p className="text-sm text-green-700">Conversions</p>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-4 text-center">
                      <p className="text-2xl font-bold text-purple-900">
                        {activeFunnel.conversionRate.toFixed(1)}%
                      </p>
                      <p className="text-sm text-purple-700">Taux global</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border bg-gray-50">
                <p className="text-gray-500">Selectionnez un entonnoir</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-lg border bg-gray-50">
          <div className="text-center">
            <Target className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Aucun entonnoir</h3>
            <p className="mt-2 text-sm text-gray-600">
              Commencez par creer votre premier entonnoir de conversion
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              Creer un Entonnoir
            </button>
          </div>
        </div>
      )}

      {/* Create Funnel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Creer un Entonnoir</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom</label>
                <input
                  type="text"
                  value={newFunnel.name}
                  onChange={(e) => setNewFunnel((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="ex: Parcours d'achat"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  type="text"
                  value={newFunnel.description}
                  onChange={(e) => setNewFunnel((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="ex: De la visite a l'achat de billet"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Etapes</label>
                <div className="mt-2 space-y-2">
                  {newFunnel.steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-6 text-center text-sm font-medium text-gray-500">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={step}
                        onChange={(e) => handleStepChange(index, e.target.value)}
                        className="flex-1 rounded-md border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder={`Etape ${index + 1} (ex: PAGE_VIEW, TICKET_BUY)`}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddStep}
                  className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter une etape
                </button>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateFunnel}
                disabled={createFunnelMutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createFunnelMutation.isPending ? 'Creation...' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
