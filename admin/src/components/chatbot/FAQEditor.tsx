'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Save,
  Tag,
  Layers,
  Eye,
  EyeOff,
  Plus,
  X,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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

interface FAQEditorProps {
  faq?: FAQEntry | null
  onSave: (data: Partial<FAQEntry>) => void
  onCancel: () => void
}

const categories = [
  { value: 'general', label: 'General' },
  { value: 'cashless', label: 'Cashless' },
  { value: 'tickets', label: 'Billets' },
  { value: 'schedule', label: 'Horaires' },
  { value: 'practical', label: 'Pratique' },
  { value: 'refunds', label: 'Remboursements' },
]

export default function FAQEditor({ faq, onSave, onCancel }: FAQEditorProps) {
  const [formData, setFormData] = useState({
    question: faq?.question || '',
    answer: faq?.answer || '',
    category: faq?.category || 'general',
    tags: faq?.tags || [],
    priority: faq?.priority || 0,
    isActive: faq?.isActive !== false,
  })
  const [newTag, setNewTag] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleAddTag = () => {
    if (!newTag.trim()) return
    if (formData.tags.includes(newTag.trim().toLowerCase())) return
    setFormData({
      ...formData,
      tags: [...formData.tags, newTag.trim().toLowerCase()],
    })
    setNewTag('')
  }

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tag),
    })
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.question.trim()) {
      newErrors.question = 'La question est requise'
    } else if (formData.question.length < 10) {
      newErrors.question = 'La question doit faire au moins 10 caracteres'
    }

    if (!formData.answer.trim()) {
      newErrors.answer = 'La reponse est requise'
    } else if (formData.answer.length < 20) {
      newErrors.answer = 'La reponse doit faire au moins 20 caracteres'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setIsSaving(true)
    try {
      await onSave(formData)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {faq ? 'Modifier la question' : 'Nouvelle question'}
            </h1>
            <p className="text-sm text-gray-500">
              {faq ? 'Modifiez les informations de la FAQ' : 'Ajoutez une nouvelle question a la FAQ'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Question */}
            <Card>
              <CardHeader>
                <CardTitle>Question</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question des utilisateurs
                    </label>
                    <Input
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      placeholder="Ex: Quels sont les horaires du festival ?"
                      className={errors.question ? 'border-red-500' : ''}
                    />
                    {errors.question && (
                      <p className="mt-1 text-sm text-red-500">{errors.question}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Formulez la question comme les utilisateurs la poseraient
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Answer */}
            <Card>
              <CardHeader>
                <CardTitle>Reponse</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reponse du chatbot
                    </label>
                    <textarea
                      value={formData.answer}
                      onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                      placeholder="Redigez une reponse complete et claire..."
                      rows={6}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary ${
                        errors.answer ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.answer && (
                      <p className="mt-1 text-sm text-red-500">{errors.answer}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.answer.length} caracteres - Soyez precis et complet
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Ajouter un tag..."
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={handleAddTag}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    Les tags aident l'IA a mieux matcher les questions des utilisateurs
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Publication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Statut</p>
                    <p className="text-sm text-gray-500">
                      {formData.isActive ? 'Visible par les utilisateurs' : 'Masque'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isActive ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  {formData.isActive ? (
                    <>
                      <Eye className="h-4 w-4 text-green-600" />
                      <span className="text-green-600">Active</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-400">Inactive</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Category */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Categorie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>

            {/* Priority */}
            <Card>
              <CardHeader>
                <CardTitle>Priorite</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500">
                    Les questions avec une priorite plus elevee sont affichees en premier
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Stats (only for existing FAQ) */}
            {faq && (
              <Card>
                <CardHeader>
                  <CardTitle>Statistiques</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Utilisations</span>
                    <span className="font-medium">{faq.hitCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Creee le</span>
                    <span className="font-medium">
                      {new Date(faq.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Modifiee le</span>
                    <span className="font-medium">
                      {new Date(faq.updatedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </div>
  )
}
