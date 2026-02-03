'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Clock,
  Tag,
  Loader2,
  RefreshCw,
  AlertCircle,
  Zap,
  DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFestivalStore } from '@/stores/festivalStore'
import {
  pricingApi,
  PricingRule,
  CreatePricingRuleRequest,
  UpdatePricingRuleRequest,
  CurrentPricesResponse,
} from '@/lib/api/pricing'
import { standsApi, Stand, StandProduct } from '@/lib/api/stands'
import { PricingRuleCard } from '@/components/pricing/PricingRuleCard'
import { PricingRuleForm } from '@/components/pricing/PricingRuleForm'
import { ActiveDiscountsList, PriceDisplay } from '@/components/pricing/ActiveDiscountBadge'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
} from '@/components/ui/Modal'

type TabType = 'rules' | 'current-prices'

export default function StandPricingPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const standId = params.standId as string
  const { currentFestival } = useFestivalStore()

  // State
  const [activeTab, setActiveTab] = useState<TabType>('rules')
  const [stand, setStand] = useState<Stand | null>(null)
  const [products, setProducts] = useState<StandProduct[]>([])
  const [rules, setRules] = useState<PricingRule[]>([])
  const [currentPrices, setCurrentPrices] = useState<CurrentPricesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingPrices, setIsLoadingPrices] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<PricingRule | null>(null)

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [standData, productsData, rulesData] = await Promise.all([
        standsApi.get(festivalId, standId),
        standsApi.listProducts(festivalId, standId),
        pricingApi.list(festivalId, standId),
      ])

      setStand(standData)
      setProducts(productsData.products || [])
      setRules(Array.isArray(rulesData) ? rulesData : [])
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('Failed to load pricing data. Please try again.')
      // Set mock data for development
      setStand({
        id: standId,
        festivalId,
        name: 'Demo Stand',
        category: 'BAR',
        isActive: true,
        settings: {
          acceptsOnlyTokens: true,
          requiresPin: false,
          allowsNegativeBalance: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setProducts([
        { id: '1', standId, name: 'Beer', price: 500, vatRate: 20, isActive: true, createdAt: '', updatedAt: '' },
        { id: '2', standId, name: 'Cocktail', price: 1000, vatRate: 20, isActive: true, createdAt: '', updatedAt: '' },
        { id: '3', standId, name: 'Soft Drink', price: 300, vatRate: 20, isActive: true, createdAt: '', updatedAt: '' },
      ])
      setRules([])
    } finally {
      setIsLoading(false)
    }
  }, [festivalId, standId])

  const loadCurrentPrices = useCallback(async () => {
    setIsLoadingPrices(true)
    try {
      const prices = await pricingApi.getCurrentPrices(festivalId, standId)
      setCurrentPrices(prices)
    } catch (err) {
      console.error('Failed to load current prices:', err)
      // Mock data
      setCurrentPrices({
        standId,
        prices: products.map((p) => ({
          productId: p.id,
          productName: p.name,
          originalPrice: p.price,
          discountedPrice: p.price,
          discount: 0,
        })),
        activeRules: [],
        calculatedAt: new Date().toISOString(),
      })
    } finally {
      setIsLoadingPrices(false)
    }
  }, [festivalId, standId, products])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (activeTab === 'current-prices' && products.length > 0) {
      loadCurrentPrices()
    }
  }, [activeTab, products.length, loadCurrentPrices])

  // Handlers
  const handleCreateRule = async (data: CreatePricingRuleRequest) => {
    setIsSubmitting(true)
    try {
      const newRule = await pricingApi.create(festivalId, standId, data)
      setRules([...rules, newRule])
      setIsModalOpen(false)
    } catch (err: any) {
      console.error('Failed to create rule:', err)
      alert(err.message || 'Failed to create pricing rule')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateRule = async (data: UpdatePricingRuleRequest) => {
    if (!editingRule) return
    setIsSubmitting(true)
    try {
      const updatedRule = await pricingApi.update(editingRule.id, data)
      setRules(rules.map((r) => (r.id === editingRule.id ? updatedRule : r)))
      setEditingRule(null)
      setIsModalOpen(false)
    } catch (err: any) {
      console.error('Failed to update rule:', err)
      alert(err.message || 'Failed to update pricing rule')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRule = async () => {
    if (!deleteConfirm) return
    try {
      await pricingApi.delete(deleteConfirm.id)
      setRules(rules.filter((r) => r.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete rule:', err)
      alert('Failed to delete pricing rule')
    }
  }

  const handleToggleActive = async (rule: PricingRule, active: boolean) => {
    try {
      const updatedRule = await pricingApi.toggleActive(rule.id, active)
      setRules(rules.map((r) => (r.id === rule.id ? updatedRule : r)))
    } catch (err) {
      console.error('Failed to toggle rule:', err)
      // Optimistic update for development
      setRules(
        rules.map((r) => (r.id === rule.id ? { ...r, active } : r))
      )
    }
  }

  const openEditModal = (rule: PricingRule) => {
    setEditingRule(rule)
    setIsModalOpen(true)
  }

  const openCreateModal = () => {
    setEditingRule(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setEditingRule(null)
    setIsModalOpen(false)
  }

  const tabs = [
    { id: 'rules' as TabType, label: 'Pricing Rules', icon: Tag },
    { id: 'current-prices' as TabType, label: 'Current Prices', icon: DollarSign },
  ]

  const activeRulesCount = rules.filter((r) => r.isCurrentlyActive && r.active).length

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/stands`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Pricing & Happy Hours
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {stand?.name || 'Stand'} - {currentFestival?.name || 'Festival'}
            </p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Pricing Rule
        </button>
      </div>

      {/* Active Discounts Banner */}
      {activeRulesCount > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-800">
            <Zap className="h-5 w-5" />
            <span className="font-medium">
              {activeRulesCount} discount{activeRulesCount > 1 ? 's' : ''} currently active
            </span>
          </div>
          <ActiveDiscountsList rules={rules} className="mt-3" />
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <button
            onClick={loadData}
            className="ml-auto inline-flex items-center gap-1 text-sm hover:underline"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Clock className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No pricing rules yet
              </h3>
              <p className="mt-2 text-gray-500">
                Create your first happy hour or dynamic pricing rule to offer
                discounts during specific times.
              </p>
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Create Your First Rule
              </button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {rules.map((rule) => (
                <PricingRuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={openEditModal}
                  onDelete={(r) => setDeleteConfirm(r)}
                  onToggleActive={handleToggleActive}
                  productName={
                    rule.productId
                      ? products.find((p) => p.id === rule.productId)?.name
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Current Prices Tab */}
      {activeTab === 'current-prices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing prices as of{' '}
              {currentPrices
                ? new Date(currentPrices.calculatedAt).toLocaleString()
                : 'now'}
            </p>
            <button
              onClick={loadCurrentPrices}
              disabled={isLoadingPrices}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <RefreshCw
                className={cn('h-4 w-4', isLoadingPrices && 'animate-spin')}
              />
              Refresh
            </button>
          </div>

          {isLoadingPrices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : currentPrices?.prices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <DollarSign className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-gray-500">No products in this stand</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      Original Price
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      Current Price
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Applied Rule
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {currentPrices?.prices.map((price) => (
                    <tr key={price.productId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {price.productName}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        ${(price.originalPrice / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PriceDisplay
                          originalPrice={price.originalPrice}
                          discountedPrice={price.discountedPrice}
                          discount={price.discount}
                          className="justify-end"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {price.appliedRule ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            <Zap className="h-3 w-3" />
                            {price.appliedRule.name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {currentPrices && currentPrices.activeRules.length > 0 && (
            <div className="rounded-lg bg-gray-50 p-4">
              <h3 className="font-medium text-gray-900">
                Active Rules Right Now
              </h3>
              <div className="mt-2 space-y-2">
                {currentPrices.activeRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{rule.name}</span>
                    <span className="text-gray-500">
                      {rule.discountType === 'PERCENTAGE'
                        ? `${rule.discountValue}% off`
                        : `$${(rule.discountValue / 100).toFixed(2)} off`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>
              {editingRule ? 'Edit Pricing Rule' : 'Create Pricing Rule'}
            </ModalTitle>
          </ModalHeader>
          <ModalBody>
            <PricingRuleForm
              rule={editingRule}
              products={products.map((p) => ({ id: p.id, name: p.name }))}
              onSubmit={editingRule ? handleUpdateRule : handleCreateRule}
              onCancel={closeModal}
              isLoading={isSubmitting}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Delete Pricing Rule</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-gray-600">
              Are you sure you want to delete the rule{' '}
              <strong>{deleteConfirm?.name}</strong>? This action cannot be
              undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRule}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  )
}
