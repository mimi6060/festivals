'use client'

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/utils'
import {
  standsApi,
  Stand,
  StandStaff,
  StandStats,
  StandTransaction,
  UpdateStandRequest,
  StandCategory,
} from '@/lib/api/stands'
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Users,
  Package,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Clock,
  UserPlus,
  Trash2,
  MoreVertical,
  Beer,
  UtensilsCrossed,
  ShoppingBag,
  Wallet,
  Info,
  Heart,
  Shield,
  MapPin,
  Loader2,
  ChevronRight,
  Activity,
} from 'lucide-react'

const categoryConfig: Record<StandCategory, { icon: typeof Beer; label: string; color: string; bgColor: string }> = {
  BAR: { icon: Beer, label: 'Bar', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  FOOD: { icon: UtensilsCrossed, label: 'Restauration', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  MERCHANDISE: { icon: ShoppingBag, label: 'Boutique', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  RECHARGE: { icon: Wallet, label: 'Recharge', color: 'text-green-600', bgColor: 'bg-green-100' },
  INFO: { icon: Info, label: 'Information', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  MEDICAL: { icon: Heart, label: 'Medical', color: 'text-red-600', bgColor: 'bg-red-100' },
  SECURITY: { icon: Shield, label: 'Securite', color: 'text-slate-600', bgColor: 'bg-slate-100' },
}

interface EditFormData {
  name: string
  description: string
  zone: string
  latitude: string
  longitude: string
  acceptsOnlyTokens: boolean
  requiresPin: boolean
  allowsNegativeBalance: boolean
  maxTransactionAmount: string
  isActive: boolean
}

export default function StandDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const festivalId = params.id as string
  const standId = params.standId as string

  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true')
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [newStaffEmail, setNewStaffEmail] = useState('')
  const [newStaffRole, setNewStaffRole] = useState<'MANAGER' | 'OPERATOR'>('OPERATOR')

  // Fetch stand details
  const { data: stand, isLoading: standLoading } = useQuery({
    queryKey: ['stand', festivalId, standId],
    queryFn: () => standsApi.get(festivalId, standId),
  })

  // Fetch staff
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['stand-staff', festivalId, standId],
    queryFn: () => standsApi.listStaff(festivalId, standId),
  })

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stand-stats', festivalId, standId],
    queryFn: () => standsApi.getStats(festivalId, standId),
  })

  // Fetch recent transactions
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['stand-transactions', festivalId, standId],
    queryFn: () => standsApi.listTransactions(festivalId, standId, { perPage: 5 }),
  })

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormData>({
    defaultValues: {
      name: stand?.name || '',
      description: stand?.description || '',
      zone: stand?.location?.zone || '',
      latitude: stand?.location?.lat?.toString() || '',
      longitude: stand?.location?.lng?.toString() || '',
      acceptsOnlyTokens: stand?.settings.acceptsOnlyTokens ?? true,
      requiresPin: stand?.settings.requiresPin ?? false,
      allowsNegativeBalance: stand?.settings.allowsNegativeBalance ?? false,
      maxTransactionAmount: stand?.settings.maxTransactionAmount?.toString() || '',
      isActive: stand?.isActive ?? true,
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateStandRequest) => standsApi.update(festivalId, standId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stand', festivalId, standId] })
      queryClient.invalidateQueries({ queryKey: ['stands', festivalId] })
      setIsEditing(false)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => standsApi.delete(festivalId, standId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stands', festivalId] })
      router.push(`/festivals/${festivalId}/stands`)
    },
  })

  // Staff mutations
  const assignStaffMutation = useMutation({
    mutationFn: (data: { userId: string; role: 'MANAGER' | 'OPERATOR' }) =>
      standsApi.assignStaff(festivalId, standId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stand-staff', festivalId, standId] })
      setShowAddStaffModal(false)
      setNewStaffEmail('')
    },
  })

  const removeStaffMutation = useMutation({
    mutationFn: (staffId: string) => standsApi.removeStaff(festivalId, standId, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stand-staff', festivalId, standId] })
    },
  })

  const onSubmit = (data: EditFormData) => {
    const request: UpdateStandRequest = {
      name: data.name,
      description: data.description || undefined,
      location: data.latitude && data.longitude
        ? {
            lat: parseFloat(data.latitude),
            lng: parseFloat(data.longitude),
            zone: data.zone || undefined,
          }
        : data.zone
        ? { lat: 0, lng: 0, zone: data.zone }
        : undefined,
      settings: {
        acceptsOnlyTokens: data.acceptsOnlyTokens,
        requiresPin: data.requiresPin,
        allowsNegativeBalance: data.allowsNegativeBalance,
        maxTransactionAmount: data.maxTransactionAmount
          ? parseFloat(data.maxTransactionAmount)
          : undefined,
      },
      isActive: data.isActive,
    }

    updateMutation.mutate(request)
  }

  const handleDelete = () => {
    if (confirm(`Supprimer le stand "${stand?.name}" ? Cette action est irreversible.`)) {
      deleteMutation.mutate()
    }
  }

  const handleCancelEdit = () => {
    reset()
    setIsEditing(false)
  }

  const handleAddStaff = () => {
    // In real app, would search for user by email first
    assignStaffMutation.mutate({ userId: newStaffEmail, role: newStaffRole })
  }

  if (standLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!stand) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">Stand non trouve</h2>
        <Link
          href={`/festivals/${festivalId}/stands`}
          className="mt-4 inline-flex items-center text-primary hover:underline"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux stands
        </Link>
      </div>
    )
  }

  const config = categoryConfig[stand.category]
  const CategoryIcon = config.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link
            href={`/festivals/${festivalId}/stands`}
            className="mt-1 rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className={cn('rounded-lg p-2', config.bgColor)}>
                <CategoryIcon className={cn('h-6 w-6', config.color)} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{stand.name}</h1>
                <div className="mt-1 flex items-center gap-2">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', config.bgColor, config.color)}>
                    {config.label}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      stand.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {stand.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                <Edit className="h-4 w-4" />
                Modifier
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Supprimer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Chiffre d'affaires</p>
              <p className="text-xl font-bold text-gray-900">
                {statsLoading ? '...' : formatCurrency(stats?.totalRevenue || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-xl font-bold text-gray-900">
                {statsLoading ? '...' : formatNumber(stats?.transactionCount || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Panier moyen</p>
              <p className="text-xl font-bold text-gray-900">
                {statsLoading ? '...' : formatCurrency(stats?.averageTransaction || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Staff assigne</p>
              <p className="text-xl font-bold text-gray-900">
                {staffLoading ? '...' : staffData?.staff.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Stand info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stand info card */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Informations du stand</h2>

            {isEditing ? (
              <form className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nom du stand
                  </label>
                  <input
                    type="text"
                    {...register('name', { required: 'Le nom est requis' })}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                      errors.name && 'border-red-500'
                    )}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Zone / Secteur
                  </label>
                  <input
                    type="text"
                    {...register('zone')}
                    className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Latitude
                    </label>
                    <input
                      type="text"
                      {...register('latitude')}
                      className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Longitude
                    </label>
                    <input
                      type="text"
                      {...register('longitude')}
                      className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-3 font-medium text-gray-900">Parametres</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...register('acceptsOnlyTokens')}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">Accepte uniquement les tokens</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...register('requiresPin')}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">Code PIN requis</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...register('allowsNegativeBalance')}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">Autoriser le solde negatif</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...register('isActive')}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">Stand actif</span>
                    </label>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {stand.description && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Description</p>
                    <p className="mt-1 text-gray-900">{stand.description}</p>
                  </div>
                )}

                {stand.location?.zone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>{stand.location.zone}</span>
                    {stand.location.lat !== 0 && (
                      <span className="text-sm text-gray-400">
                        ({stand.location.lat.toFixed(4)}, {stand.location.lng.toFixed(4)})
                      </span>
                    )}
                  </div>
                )}

                <div className="border-t pt-4">
                  <h3 className="mb-3 text-sm font-medium text-gray-500">Parametres</h3>
                  <div className="flex flex-wrap gap-2">
                    {stand.settings.acceptsOnlyTokens && (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                        <Wallet className="h-3 w-3" />
                        Tokens uniquement
                      </span>
                    )}
                    {stand.settings.requiresPin && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                        PIN requis
                      </span>
                    )}
                    {stand.settings.allowsNegativeBalance && (
                      <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                        Solde negatif autorise
                      </span>
                    )}
                    {stand.settings.maxTransactionAmount && (
                      <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                        Max: {stand.settings.maxTransactionAmount} tokens
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500">
                    Cree le {formatDateTime(stand.createdAt)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Recent transactions */}
          <div className="rounded-lg border bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Transactions recentes</h2>
              <Link
                href={`/festivals/${festivalId}/stands/${standId}/transactions`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Voir tout
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {transactionsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 rounded bg-gray-200" />
                      <div className="h-3 w-24 rounded bg-gray-200" />
                    </div>
                    <div className="h-5 w-16 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            ) : transactionsData?.transactions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucune transaction</p>
            ) : (
              <div className="space-y-3">
                {transactionsData?.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'rounded-full p-2',
                        tx.type === 'PAYMENT' ? 'bg-green-100' : tx.type === 'REFUND' ? 'bg-amber-100' : 'bg-gray-100'
                      )}>
                        <Activity className={cn(
                          'h-4 w-4',
                          tx.type === 'PAYMENT' ? 'text-green-600' : tx.type === 'REFUND' ? 'text-amber-600' : 'text-gray-600'
                        )} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {tx.type === 'PAYMENT' ? 'Paiement' : tx.type === 'REFUND' ? 'Remboursement' : 'Annulation'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDateTime(tx.createdAt)}
                          {tx.operator && ` - ${tx.operator.name}`}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      'font-semibold',
                      tx.type === 'PAYMENT' ? 'text-green-600' : tx.type === 'REFUND' ? 'text-amber-600' : 'text-gray-600'
                    )}>
                      {tx.type === 'PAYMENT' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top products */}
          {stats?.topProducts && stats.topProducts.length > 0 && (
            <div className="rounded-lg border bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Produits les plus vendus</h2>
                <Link
                  href={`/festivals/${festivalId}/stands/${standId}/products`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Gerer les produits
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="space-y-3">
                {stats.topProducts.slice(0, 5).map((product, index) => (
                  <div key={product.productId} className="flex items-center gap-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.productName}</p>
                      <p className="text-sm text-gray-500">{product.quantity} vendus</p>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(product.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column - Staff */}
        <div className="space-y-6">
          {/* Quick actions */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Actions rapides</h2>
            <div className="space-y-2">
              <Link
                href={`/festivals/${festivalId}/stands/${standId}/products`}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-gray-50"
              >
                <Package className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-700">Gerer les produits</span>
                <ChevronRight className="ml-auto h-5 w-5 text-gray-400" />
              </Link>
              <Link
                href={`/festivals/${festivalId}/stands/${standId}/transactions`}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-gray-50"
              >
                <Activity className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-700">Historique des ventes</span>
                <ChevronRight className="ml-auto h-5 w-5 text-gray-400" />
              </Link>
            </div>
          </div>

          {/* Staff management */}
          <div className="rounded-lg border bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Equipe</h2>
              <button
                onClick={() => setShowAddStaffModal(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
              >
                <UserPlus className="h-4 w-4" />
                Ajouter
              </button>
            </div>

            {staffLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 rounded bg-gray-200" />
                      <div className="h-3 w-16 rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : staffData?.staff.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucun staff assigne</p>
            ) : (
              <div className="space-y-3">
                {staffData?.staff.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                        {member.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.user.name}</p>
                        <p className="text-sm text-gray-500">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        member.role === 'MANAGER' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      )}>
                        {member.role === 'MANAGER' ? 'Manager' : 'Operateur'}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`Retirer ${member.user.name} de ce stand ?`)) {
                            removeStaffMutation.mutate(member.id)
                          }
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add staff modal */}
      {showAddStaffModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowAddStaffModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Ajouter un membre</h3>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email du membre
                </label>
                <input
                  type="email"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="staff@example.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as 'MANAGER' | 'OPERATOR')}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="OPERATOR">Operateur</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowAddStaffModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddStaff}
                  disabled={!newStaffEmail || assignStaffMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {assignStaffMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
