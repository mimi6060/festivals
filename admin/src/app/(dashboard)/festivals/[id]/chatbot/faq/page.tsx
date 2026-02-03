'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Tag,
  BarChart2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import FAQEditor from '@/components/chatbot/FAQEditor'

interface FAQEntry {
  id: string
  question: string
  answer: string
  category: string
  tags: string[]
  priority: number
  isActive: boolean
  hitCount: number
  createdAt: string
  updatedAt: string
}

const categories = [
  { value: '', label: 'Toutes' },
  { value: 'general', label: 'General' },
  { value: 'cashless', label: 'Cashless' },
  { value: 'tickets', label: 'Billets' },
  { value: 'schedule', label: 'Horaires' },
  { value: 'practical', label: 'Pratique' },
  { value: 'refunds', label: 'Remboursements' },
]

export default function FAQManagementPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [faqs, setFaqs] = useState<FAQEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showActiveOnly, setShowActiveOnly] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingFaq, setEditingFaq] = useState<FAQEntry | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadFAQs()
  }, [festivalId])

  const loadFAQs = async () => {
    setIsLoading(true)
    try {
      // In real implementation:
      // const response = await fetch(`/api/admin/chatbot/faq/${festivalId}`)
      // const data = await response.json()
      // setFaqs(data.items)

      // Mock data
      await new Promise(resolve => setTimeout(resolve, 500))
      setFaqs([
        {
          id: '1',
          question: 'Quels sont les horaires du festival ?',
          answer: "Le festival est ouvert de 14h a 2h du matin chaque jour. Les scenes principales commencent a 16h et le dernier concert se termine a 1h30.",
          category: 'schedule',
          tags: ['horaires', 'ouverture', 'fermeture'],
          priority: 10,
          isActive: true,
          hitCount: 423,
          createdAt: '2026-01-15T10:00:00Z',
          updatedAt: '2026-01-20T15:30:00Z',
        },
        {
          id: '2',
          question: 'Comment fonctionne le paiement cashless ?',
          answer: "Le festival utilise un systeme de paiement cashless via votre bracelet NFC. Vous pouvez le recharger en ligne, sur l'application, ou aux bornes presentes sur le site. Votre solde est automatiquement debite lors de vos achats aux stands.",
          category: 'cashless',
          tags: ['paiement', 'bracelet', 'NFC', 'recharge'],
          priority: 9,
          isActive: true,
          hitCount: 387,
          createdAt: '2026-01-15T10:00:00Z',
          updatedAt: '2026-01-18T09:00:00Z',
        },
        {
          id: '3',
          question: 'Ou puis-je recharger mon bracelet ?',
          answer: "Vous pouvez recharger votre bracelet de plusieurs facons: 1) En ligne via l'application mobile, 2) Aux bornes de recharge presentes a chaque entree, 3) Aux points de recharge pres des bars principaux. Les rechargements en ligne sont credites instantanement.",
          category: 'cashless',
          tags: ['recharge', 'bracelet', 'bornes'],
          priority: 8,
          isActive: true,
          hitCount: 256,
          createdAt: '2026-01-15T10:00:00Z',
          updatedAt: '2026-01-15T10:00:00Z',
        },
        {
          id: '4',
          question: 'Y a-t-il des consignes pour les objets ?',
          answer: "Oui, nous disposons de consignes securisees pres de l'entree principale. Le tarif est de 5 euros pour la journee. Vous pouvez y deposer sacs, objets de valeur et vetements. La consigne est ouverte de 12h a 3h du matin.",
          category: 'practical',
          tags: ['consignes', 'bagages', 'securite'],
          priority: 7,
          isActive: true,
          hitCount: 189,
          createdAt: '2026-01-15T10:00:00Z',
          updatedAt: '2026-01-16T14:00:00Z',
        },
        {
          id: '5',
          question: 'Comment obtenir un remboursement ?',
          answer: "Pour obtenir un remboursement de votre solde restant, rendez-vous dans l'application mobile dans les 30 jours suivant le festival. Allez dans Wallet > Remboursement et suivez les instructions. Les remboursements sont traites sous 5 jours ouvrables sur votre moyen de paiement original.",
          category: 'refunds',
          tags: ['remboursement', 'solde', 'wallet'],
          priority: 6,
          isActive: true,
          hitCount: 145,
          createdAt: '2026-01-15T10:00:00Z',
          updatedAt: '2026-01-17T11:00:00Z',
        },
        {
          id: '6',
          question: 'Puis-je entrer et sortir du festival ?',
          answer: "Oui, votre billet vous permet des entrees et sorties multiples. Gardez simplement votre bracelet attache et presentez-le au controle a chaque entree.",
          category: 'tickets',
          tags: ['entree', 'sortie', 'bracelet'],
          priority: 5,
          isActive: false,
          hitCount: 78,
          createdAt: '2026-01-15T10:00:00Z',
          updatedAt: '2026-01-15T10:00:00Z',
        },
      ])
    } catch (error) {
      console.error('Failed to load FAQs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleActive = async (faq: FAQEntry) => {
    try {
      // In real implementation:
      // await fetch(`/api/admin/chatbot/faq/${festivalId}/${faq.id}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ ...faq, isActive: !faq.isActive })
      // })

      setFaqs(faqs.map(f =>
        f.id === faq.id ? { ...f, isActive: !f.isActive } : f
      ))
    } catch (error) {
      console.error('Failed to toggle FAQ:', error)
    }
  }

  const handleDelete = async (faq: FAQEntry) => {
    if (!confirm('Etes-vous sur de vouloir supprimer cette question ?')) return

    try {
      // In real implementation:
      // await fetch(`/api/admin/chatbot/faq/${festivalId}/${faq.id}`, {
      //   method: 'DELETE'
      // })

      setFaqs(faqs.filter(f => f.id !== faq.id))
    } catch (error) {
      console.error('Failed to delete FAQ:', error)
    }
  }

  const handleSave = async (data: Partial<FAQEntry>) => {
    try {
      if (editingFaq) {
        // Update existing
        setFaqs(faqs.map(f =>
          f.id === editingFaq.id
            ? { ...f, ...data, updatedAt: new Date().toISOString() }
            : f
        ))
      } else {
        // Create new
        const newFaq: FAQEntry = {
          id: `faq-${Date.now()}`,
          question: data.question || '',
          answer: data.answer || '',
          category: data.category || 'general',
          tags: data.tags || [],
          priority: data.priority || 0,
          isActive: data.isActive !== false,
          hitCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setFaqs([newFaq, ...faqs])
      }

      setEditingFaq(null)
      setIsCreating(false)
    } catch (error) {
      console.error('Failed to save FAQ:', error)
    }
  }

  // Filter FAQs
  const filteredFaqs = faqs.filter(faq => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!faq.question.toLowerCase().includes(query) &&
          !faq.answer.toLowerCase().includes(query)) {
        return false
      }
    }
    if (selectedCategory && faq.category !== selectedCategory) {
      return false
    }
    if (showActiveOnly && !faq.isActive) {
      return false
    }
    return true
  })

  // Sort by priority
  const sortedFaqs = [...filteredFaqs].sort((a, b) => b.priority - a.priority)

  if (editingFaq || isCreating) {
    return (
      <FAQEditor
        faq={editingFaq}
        onSave={handleSave}
        onCancel={() => {
          setEditingFaq(null)
          setIsCreating(false)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/chatbot`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion de la FAQ</h1>
            <p className="text-sm text-gray-500">
              {faqs.length} questions - {faqs.filter(f => f.isActive).length} actives
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle question
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <HelpCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{faqs.length}</p>
                <p className="text-sm text-gray-500">Questions totales</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Eye className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {faqs.filter(f => f.isActive).length}
                </p>
                <p className="text-sm text-gray-500">Questions actives</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <BarChart2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {faqs.reduce((sum, f) => sum + f.hitCount, 0)}
                </p>
                <p className="text-sm text-gray-500">Utilisations totales</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-100 p-2">
                <Tag className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {new Set(faqs.map(f => f.category)).size}
                </p>
                <p className="text-sm text-gray-500">Categories</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Rechercher une question..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>

            {/* Active only toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Actives uniquement</span>
            </label>
          </div>
        </CardBody>
      </Card>

      {/* FAQ List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Chargement...</div>
          </div>
        ) : sortedFaqs.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-8">
                <HelpCircle className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-gray-500">Aucune question trouvee</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsCreating(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Creer une question
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          sortedFaqs.map((faq) => (
            <Card key={faq.id} className={!faq.isActive ? 'opacity-60' : ''}>
              <CardBody>
                <div className="flex items-start gap-4">
                  {/* Priority indicator */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => {
                        const newFaqs = faqs.map(f =>
                          f.id === faq.id ? { ...f, priority: f.priority + 1 } : f
                        )
                        setFaqs(newFaqs)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium text-gray-500">{faq.priority}</span>
                    <button
                      onClick={() => {
                        const newFaqs = faqs.map(f =>
                          f.id === faq.id ? { ...f, priority: Math.max(0, f.priority - 1) } : f
                        )
                        setFaqs(newFaqs)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{faq.question}</h3>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="secondary">{faq.category}</Badge>
                          {faq.tags.map(tag => (
                            <span key={tag} className="text-xs text-gray-400">#{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">{faq.hitCount} vues</span>
                        <button
                          onClick={() => handleToggleActive(faq)}
                          className={`p-1 rounded ${faq.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                          title={faq.isActive ? 'Desactiver' : 'Activer'}
                        >
                          {faq.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => setEditingFaq(faq)}
                          className="p-1 rounded text-gray-400 hover:text-primary hover:bg-gray-50"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(faq)}
                          className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable answer */}
                    <button
                      onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                      className="mt-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      {expandedId === faq.id ? 'Masquer' : 'Voir'} la reponse
                      {expandedId === faq.id ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>

                    {expandedId === faq.id && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
