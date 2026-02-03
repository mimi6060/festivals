'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  MessageCircle,
  HelpCircle,
  History,
  Settings,
  BarChart3,
  Zap,
  Save,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface ChatbotConfig {
  id: string
  festivalId: string
  isEnabled: boolean
  welcomeMessage: string
  personality: 'friendly' | 'professional' | 'casual'
  tone: 'helpful' | 'concise' | 'detailed'
  language: string
  maxMessagesPerConv: number
  escalationThreshold: number
  suggestedQuestions: string[]
  systemPrompt: string
}

interface ChatbotAnalytics {
  totalConversations: number
  totalMessages: number
  avgMessagesPerConv: number
  escalatedCount: number
  resolvedCount: number
  avgResponseTime: number
  avgRating: number
  escalationRate: number
  resolutionRate: number
}

const personalityOptions = [
  { value: 'friendly', label: 'Amical', description: 'Chaleureux et accessible' },
  { value: 'professional', label: 'Professionnel', description: 'Precis et formel' },
  { value: 'casual', label: 'Decontracte', description: 'Informel et relaxe' },
]

const toneOptions = [
  { value: 'helpful', label: 'Aidant', description: 'Cherche a aider au maximum' },
  { value: 'concise', label: 'Concis', description: 'Reponses directes et courtes' },
  { value: 'detailed', label: 'Detaille', description: 'Explications completes' },
]

export default function ChatbotConfigPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [config, setConfig] = useState<ChatbotConfig | null>(null)
  const [analytics, setAnalytics] = useState<ChatbotAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')

  useEffect(() => {
    loadData()
  }, [festivalId])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // In real implementation:
      // const [configRes, analyticsRes] = await Promise.all([
      //   fetch(`/api/admin/chatbot/config/${festivalId}`),
      //   fetch(`/api/admin/chatbot/analytics/${festivalId}?days=7`)
      // ])
      // const config = await configRes.json()
      // const analytics = await analyticsRes.json()

      // Mock data
      await new Promise(resolve => setTimeout(resolve, 500))
      setConfig({
        id: 'config-1',
        festivalId,
        isEnabled: true,
        welcomeMessage: "Bonjour ! Je suis l'assistant virtuel du festival. Comment puis-je vous aider ?",
        personality: 'friendly',
        tone: 'helpful',
        language: 'fr',
        maxMessagesPerConv: 50,
        escalationThreshold: 3,
        suggestedQuestions: [
          'Quels sont les horaires du festival ?',
          'Comment fonctionne le paiement cashless ?',
          'Ou puis-je recharger mon bracelet ?',
          'Y a-t-il des consignes pour les objets ?',
          'Comment obtenir un remboursement ?',
        ],
        systemPrompt: '',
      })
      setAnalytics({
        totalConversations: 1247,
        totalMessages: 8934,
        avgMessagesPerConv: 7.2,
        escalatedCount: 45,
        resolvedCount: 1156,
        avgResponseTime: 1.2,
        avgRating: 4.3,
        escalationRate: 3.6,
        resolutionRate: 92.7,
      })
    } catch (error) {
      console.error('Failed to load chatbot data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return
    setIsSaving(true)
    try {
      // In real implementation:
      // await fetch(`/api/admin/chatbot/config/${festivalId}`, {
      //   method: 'PATCH',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(config)
      // })
      await new Promise(resolve => setTimeout(resolve, 500))
      alert('Configuration sauvegardee avec succes !')
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddQuestion = () => {
    if (!newQuestion.trim() || !config) return
    setConfig({
      ...config,
      suggestedQuestions: [...config.suggestedQuestions, newQuestion.trim()],
    })
    setNewQuestion('')
  }

  const handleRemoveQuestion = (index: number) => {
    if (!config) return
    setConfig({
      ...config,
      suggestedQuestions: config.suggestedQuestions.filter((_, i) => i !== index),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chatbot IA</h1>
            <p className="text-sm text-gray-500">Configuration et analytiques du support automatise</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href={`/festivals/${festivalId}/chatbot/faq`}>
          <Card hoverable className="cursor-pointer">
            <CardBody>
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-blue-100 p-3">
                  <HelpCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Gerer la FAQ</h3>
                  <p className="text-sm text-gray-500">Questions et reponses</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </Link>

        <Link href={`/festivals/${festivalId}/chatbot/conversations`}>
          <Card hoverable className="cursor-pointer">
            <CardBody>
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-green-100 p-3">
                  <History className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Conversations</h3>
                  <p className="text-sm text-gray-500">Historique et escalades</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </Link>

        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-purple-100 p-3">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">IA Active</h3>
                <p className="text-sm text-gray-500">GPT-4o - Embeddings 3</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Conversations (7j)</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalConversations}</p>
              <p className="text-xs text-gray-400 mt-1">
                {analytics.avgMessagesPerConv.toFixed(1)} messages/conv
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Taux de resolution</p>
              <p className="text-2xl font-bold text-green-600">{analytics.resolutionRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-400 mt-1">
                {analytics.resolvedCount} resolues
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Escalades</p>
              <p className="text-2xl font-bold text-yellow-600">{analytics.escalatedCount}</p>
              <p className="text-xs text-gray-400 mt-1">
                {analytics.escalationRate.toFixed(1)}% des conversations
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Note moyenne</p>
              <p className="text-2xl font-bold text-primary">{analytics.avgRating.toFixed(1)}/5</p>
              <p className="text-xs text-gray-400 mt-1">
                Temps moyen: {analytics.avgResponseTime.toFixed(1)}s
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Configuration */}
      {config && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Parametres generaux
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Activer le chatbot</p>
                  <p className="text-sm text-gray-500">Rendre le chatbot disponible aux utilisateurs</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, isEnabled: !config.isEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.isEnabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Welcome Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message de bienvenue
                </label>
                <textarea
                  value={config.welcomeMessage}
                  onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Max Messages */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Messages max par conversation
                </label>
                <Input
                  type="number"
                  value={config.maxMessagesPerConv}
                  onChange={(e) => setConfig({ ...config, maxMessagesPerConv: parseInt(e.target.value) || 50 })}
                  min={10}
                  max={100}
                />
              </div>

              {/* Escalation Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seuil d'escalade (tentatives)
                </label>
                <Input
                  type="number"
                  value={config.escalationThreshold}
                  onChange={(e) => setConfig({ ...config, escalationThreshold: parseInt(e.target.value) || 3 })}
                  min={1}
                  max={10}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nombre de tentatives avant de proposer un agent humain
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Personality & Tone */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Personnalite et ton
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Personality */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personnalite
                </label>
                <div className="space-y-2">
                  {personalityOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        config.personality === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="personality"
                        value={option.value}
                        checked={config.personality === option.value}
                        onChange={(e) => setConfig({ ...config, personality: e.target.value as any })}
                        className="text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{option.label}</p>
                        <p className="text-sm text-gray-500">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ton
                </label>
                <div className="space-y-2">
                  {toneOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        config.tone === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="tone"
                        value={option.value}
                        checked={config.tone === option.value}
                        onChange={(e) => setConfig({ ...config, tone: e.target.value as any })}
                        className="text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{option.label}</p>
                        <p className="text-sm text-gray-500">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Suggested Questions */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Questions suggerees
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Ces questions seront proposees aux utilisateurs au debut de la conversation.
              </p>

              {/* Add new question */}
              <div className="flex gap-2">
                <Input
                  placeholder="Nouvelle question..."
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
                  className="flex-1"
                />
                <Button onClick={handleAddQuestion} variant="outline">
                  Ajouter
                </Button>
              </div>

              {/* Questions list */}
              <div className="space-y-2">
                {config.suggestedQuestions.map((question, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <span className="flex-1 text-sm text-gray-700">{question}</span>
                    <button
                      onClick={() => handleRemoveQuestion(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <span className="sr-only">Supprimer</span>
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Advanced: System Prompt */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Prompt systeme avance (optionnel)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-3">
                Instructions supplementaires pour l'IA. Laissez vide pour utiliser le comportement par defaut.
              </p>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                rows={4}
                placeholder="Ex: Tu dois toujours mentionner les regles de securite du festival..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
