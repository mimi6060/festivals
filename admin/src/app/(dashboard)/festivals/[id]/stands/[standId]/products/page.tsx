'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import {
  standsApi,
  StandProduct,
  CreateProductRequest,
  UpdateProductRequest,
} from '@/lib/api/stands'
import {
  ArrowLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Package,
  Upload,
  Download,
  MoreVertical,
  Loader2,
  AlertTriangle,
  Check,
} from 'lucide-react'

interface ProductFormData {
  name: string
  description: string
  price: string
  vatRate: string
  category: string
  stock: string
}

export default function StandProductsPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const festivalId = params.id as string
  const standId = params.standId as string

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<StandProduct | null>(null)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkImportText, setBulkImportText] = useState('')

  // Fetch stand
  const { data: stand } = useQuery({
    queryKey: ['stand', festivalId, standId],
    queryFn: () => standsApi.get(festivalId, standId),
  })

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['stand-products', festivalId, standId, selectedCategory],
    queryFn: () =>
      standsApi.listProducts(festivalId, standId, {
        category: selectedCategory || undefined,
      }),
  })

  // Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    defaultValues: {
      name: '',
      description: '',
      price: '',
      vatRate: '21',
      category: '',
      stock: '',
    },
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateProductRequest) =>
      standsApi.createProduct(festivalId, standId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stand-products', festivalId, standId] })
      setShowAddModal(false)
      reset()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: UpdateProductRequest }) =>
      standsApi.updateProduct(festivalId, standId, productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stand-products', festivalId, standId] })
      setEditingProduct(null)
      reset()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (productId: string) =>
      standsApi.deleteProduct(festivalId, standId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stand-products', festivalId, standId] })
    },
  })

  const bulkImportMutation = useMutation({
    mutationFn: (products: CreateProductRequest[]) =>
      standsApi.bulkImportProducts(festivalId, standId, { products }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stand-products', festivalId, standId] })
      setShowBulkImport(false)
      setBulkImportText('')
      alert(`${data.imported} produits importes avec succes`)
    },
  })

  const toggleProductStatus = useMutation({
    mutationFn: ({ productId, isActive }: { productId: string; isActive: boolean }) =>
      standsApi.updateProduct(festivalId, standId, productId, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stand-products', festivalId, standId] })
    },
  })

  // Filter products by search
  const filteredProducts =
    productsData?.products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || []

  // Get unique categories
  const categories = [
    ...new Set(productsData?.products.map((p) => p.category).filter(Boolean)),
  ] as string[]

  const onSubmit = (data: ProductFormData) => {
    const request: CreateProductRequest = {
      name: data.name,
      description: data.description || undefined,
      price: parseFloat(data.price),
      vatRate: parseFloat(data.vatRate),
      category: data.category || undefined,
      stock: data.stock ? parseInt(data.stock) : undefined,
    }

    if (editingProduct) {
      updateMutation.mutate({ productId: editingProduct.id, data: request })
    } else {
      createMutation.mutate(request)
    }
  }

  const openEditModal = (product: StandProduct) => {
    setEditingProduct(product)
    setValue('name', product.name)
    setValue('description', product.description || '')
    setValue('price', product.price.toString())
    setValue('vatRate', product.vatRate.toString())
    setValue('category', product.category || '')
    setValue('stock', product.stock?.toString() || '')
    setShowAddModal(true)
  }

  const closeModal = () => {
    setShowAddModal(false)
    setEditingProduct(null)
    reset()
  }

  const handleDelete = (product: StandProduct) => {
    if (confirm(`Supprimer le produit "${product.name}" ?`)) {
      deleteMutation.mutate(product.id)
    }
  }

  const parseBulkImport = () => {
    try {
      // Parse CSV: name,price,vatRate,category,stock
      const lines = bulkImportText.trim().split('\n')
      const products: CreateProductRequest[] = []

      for (const line of lines) {
        if (!line.trim()) continue
        const [name, price, vatRate, category, stock] = line.split(',').map((s) => s.trim())
        if (!name || !price) continue

        products.push({
          name,
          price: parseFloat(price),
          vatRate: vatRate ? parseFloat(vatRate) : 21,
          category: category || undefined,
          stock: stock ? parseInt(stock) : undefined,
        })
      }

      if (products.length === 0) {
        alert('Aucun produit valide trouve dans le fichier')
        return
      }

      bulkImportMutation.mutate(products)
    } catch (error) {
      alert('Erreur lors du parsing du fichier CSV')
    }
  }

  const exportProducts = () => {
    if (!productsData?.products.length) return

    const csv = [
      'name,price,vatRate,category,stock,isActive',
      ...productsData.products.map(
        (p) =>
          `"${p.name}",${p.price},${p.vatRate},"${p.category || ''}",${p.stock || ''},${p.isActive}`
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `products-${stand?.name || standId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/stands/${standId}`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
            <p className="mt-1 text-sm text-gray-500">{stand?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
          <button
            onClick={exportProducts}
            disabled={!productsData?.products.length}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Ajouter un produit
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-lg border bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border py-2 pl-10 pr-4 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                selectedCategory === null
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              Tous
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                  selectedCategory === category
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Products list */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-white p-4">
              <div className="mb-3 h-6 w-3/4 rounded bg-gray-200" />
              <div className="mb-2 h-4 w-1/2 rounded bg-gray-200" />
              <div className="h-8 w-1/3 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Package className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            {searchQuery || selectedCategory
              ? 'Aucun produit trouve'
              : 'Aucun produit'}
          </h3>
          <p className="mb-6 text-gray-500">
            {searchQuery || selectedCategory
              ? 'Essayez de modifier vos filtres'
              : 'Commencez par ajouter des produits a ce stand'}
          </p>
          {!searchQuery && !selectedCategory && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
            >
              <Plus className="h-5 w-5" />
              Ajouter un produit
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Produit
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Categorie
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Prix
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  TVA
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Stock
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Statut
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      {product.description && (
                        <p className="text-sm text-gray-500 line-clamp-1">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {product.category ? (
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {product.category}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(product.price)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{product.vatRate}%</span>
                  </td>
                  <td className="px-4 py-3">
                    {product.stock !== undefined && product.stock !== null ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            product.stock <= 10
                              ? 'text-red-600'
                              : product.stock <= 50
                              ? 'text-amber-600'
                              : 'text-gray-900'
                          )}
                        >
                          {product.stock}
                        </span>
                        {product.stock <= 10 && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Illimite</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        toggleProductStatus.mutate({
                          productId: product.id,
                          isActive: !product.isActive,
                        })
                      }
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                        product.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {product.isActive ? (
                        <>
                          <Check className="h-3 w-3" />
                          Actif
                        </>
                      ) : (
                        'Inactif'
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        disabled={deleteMutation.isPending}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Results count */}
      {!isLoading && filteredProducts.length > 0 && (
        <p className="text-sm text-gray-500">
          {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}
          {searchQuery && ` pour "${searchQuery}"`}
        </p>
      )}

      {/* Add/Edit product modal */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={closeModal} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingProduct ? 'Modifier le produit' : 'Ajouter un produit'}
              </h3>
              <button
                onClick={closeModal}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nom du produit *
                </label>
                <input
                  type="text"
                  {...register('name', { required: 'Le nom est requis' })}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                    errors.name && 'border-red-500'
                  )}
                  placeholder="Ex: Biere pression, Hot-dog..."
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
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Description optionnelle..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Prix (EUR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('price', {
                      required: 'Le prix est requis',
                      min: { value: 0, message: 'Le prix doit etre positif' },
                    })}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                      errors.price && 'border-red-500'
                    )}
                    placeholder="0.00"
                  />
                  {errors.price && (
                    <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Taux TVA (%)
                  </label>
                  <select
                    {...register('vatRate')}
                    className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="0">0% (Exonere)</option>
                    <option value="6">6%</option>
                    <option value="12">12%</option>
                    <option value="21">21%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Categorie
                  </label>
                  <input
                    type="text"
                    {...register('category')}
                    className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ex: Boissons, Snacks..."
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    {...register('stock')}
                    className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Illimite si vide"
                  />
                </div>
              </div>

              {(createMutation.error || updateMutation.error) && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {(createMutation.error as Error)?.message ||
                    (updateMutation.error as Error)?.message}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {editingProduct ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Bulk import modal */}
      {showBulkImport && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowBulkImport(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Import CSV
              </h3>
              <button
                onClick={() => setShowBulkImport(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Collez vos donnees CSV avec le format suivant:
              </p>
              <code className="block rounded bg-gray-100 p-2 text-xs text-gray-700">
                nom,prix,tva,categorie,stock
              </code>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Donnees CSV
                </label>
                <textarea
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Biere,5.00,21,Boissons,100
Hot-dog,4.50,6,Snacks,50"
                />
              </div>

              {bulkImportMutation.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {(bulkImportMutation.error as Error).message}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowBulkImport(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={parseBulkImport}
                  disabled={!bulkImportText.trim() || bulkImportMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {bulkImportMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Importer
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
