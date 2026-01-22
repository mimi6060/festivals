'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Search,
  Filter,
  MessageCircle,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Star,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import ConversationViewer from '@/components/chatbot/ConversationViewer'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

interface Conversation {
  id: string
  userId: string
  userName: string
  status: 'ACTIVE' | 'CLOSED' | 'ESCALATED'
  messageCount: number
  lastActivity: string
  createdAt: string
  rating?: number
  feedback?: string
  messages: Message[]
}

const statusConfig = {
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-800', icon: MessageCircle },
  CLOSED: { label: 'Fermee', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
  ESCALATED: { label: 'Escaladee', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
}

export default function ConversationsPage() {
  const params = useParams()
  const festivalId = params.id as string

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const perPage = 20

  useEffect(() => {
    loadConversations()
  }, [festivalId, currentPage, statusFilter])

  const loadConversations = async () => {
    setIsLoading(true)
    try {
      // In real implementation:
      // const params = new URLSearchParams({
      //   page: currentPage.toString(),
      //   per_page: perPage.toString(),
      //   ...(statusFilter && { status: statusFilter })
      // })
      // const response = await fetch(`/api/admin/chatbot/conversations/${festivalId}?${params}`)
      // const data = await response.json()
      // setConversations(data.items)
      // setTotalPages(data.totalPages)

      // Mock data
      await new Promise(resolve => setTimeout(resolve, 500))
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          userId: 'user-1',
          userName: 'Marie Dupont',
          status: 'CLOSED',
          messageCount: 8,
          lastActivity: '2026-01-23T14:30:00Z',
          createdAt: '2026-01-23T14:15:00Z',
          rating: 5,
          feedback: 'Tres utile !',
          messages: [
            { id: 'm1', role: 'assistant', content: "Bonjour ! Comment puis-je vous aider ?", createdAt: '2026-01-23T14:15:00Z' },
            { id: 'm2', role: 'user', content: "Quels sont les horaires du festival ?", createdAt: '2026-01-23T14:15:30Z' },
            { id: 'm3', role: 'assistant', content: "Le festival est ouvert de 14h a 2h du matin chaque jour.", createdAt: '2026-01-23T14:15:45Z' },
            { id: 'm4', role: 'user', content: "Et les scenes commencent a quelle heure ?", createdAt: '2026-01-23T14:16:00Z' },
            { id: 'm5', role: 'assistant', content: "Les scenes principales commencent a 16h.", createdAt: '2026-01-23T14:16:15Z' },
            { id: 'm6', role: 'user', content: "Super merci !", createdAt: '2026-01-23T14:20:00Z' },
            { id: 'm7', role: 'assistant', content: "Je vous en prie ! Bonne journee au festival !", createdAt: '2026-01-23T14:20:15Z' },
            { id: 'm8', role: 'system', content: "Conversation fermee par l'utilisateur", createdAt: '2026-01-23T14:30:00Z' },
          ],
        },
        {
          id: 'conv-2',
          userId: 'user-2',
          userName: 'Pierre Martin',
          status: 'ESCALATED',
          messageCount: 12,
          lastActivity: '2026-01-23T13:45:00Z',
          createdAt: '2026-01-23T13:00:00Z',
          messages: [
            { id: 'm1', role: 'assistant', content: "Bonjour ! Comment puis-je vous aider ?", createdAt: '2026-01-23T13:00:00Z' },
            { id: 'm2', role: 'user', content: "J'ai un probleme avec mon bracelet, il ne fonctionne plus", createdAt: '2026-01-23T13:00:30Z' },
            { id: 'm3', role: 'assistant', content: "Je suis desole pour ce desagrement. Pouvez-vous me decrire plus precisement le probleme ?", createdAt: '2026-01-23T13:00:45Z' },
            { id: 'm4', role: 'user', content: "Il ne bippe plus aux bornes et j'ai 50 euros dessus", createdAt: '2026-01-23T13:01:00Z' },
            { id: 'm5', role: 'assistant', content: "Je comprends. Avez-vous essaye de le presenter sur une autre borne ?", createdAt: '2026-01-23T13:01:15Z' },
            { id: 'm6', role: 'user', content: "Oui, j'ai essaye 3 bornes differentes", createdAt: '2026-01-23T13:10:00Z' },
            { id: 'm7', role: 'assistant', content: "Dans ce cas, je vous recommande de vous rendre au point accueil pres de l'entree principale.", createdAt: '2026-01-23T13:10:15Z' },
            { id: 'm8', role: 'user', content: "Je veux parler a quelqu'un maintenant", createdAt: '2026-01-23T13:30:00Z' },
            { id: 'm9', role: 'system', content: "Conversation escaladee vers un agent. Raison: Demande utilisateur", createdAt: '2026-01-23T13:45:00Z' },
          ],
        },
        {
          id: 'conv-3',
          userId: 'user-3',
          userName: 'Sophie Bernard',
          status: 'ACTIVE',
          messageCount: 4,
          lastActivity: '2026-01-23T15:00:00Z',
          createdAt: '2026-01-23T14:55:00Z',
          messages: [
            { id: 'm1', role: 'assistant', content: "Bonjour ! Comment puis-je vous aider ?", createdAt: '2026-01-23T14:55:00Z' },
            { id: 'm2', role: 'user', content: "Ou sont les toilettes ?", createdAt: '2026-01-23T14:55:30Z' },
            { id: 'm3', role: 'assistant', content: "Les toilettes sont situees pres de chaque scene et aux points centraux du festival.", createdAt: '2026-01-23T14:55:45Z' },
            { id: 'm4', role: 'user', content: "Et il y en a des accessibles PMR ?", createdAt: '2026-01-23T15:00:00Z' },
          ],
        },
        {
          id: 'conv-4',
          userId: 'user-4',
          userName: 'Lucas Petit',
          status: 'CLOSED',
          messageCount: 6,
          lastActivity: '2026-01-23T12:00:00Z',
          createdAt: '2026-01-23T11:30:00Z',
          rating: 4,
          messages: [],
        },
        {
          id: 'conv-5',
          userId: 'user-5',
          userName: 'Emma Rousseau',
          status: 'CLOSED',
          messageCount: 10,
          lastActivity: '2026-01-23T10:30:00Z',
          createdAt: '2026-01-23T10:00:00Z',
          rating: 3,
          feedback: "Reponses parfois generiques",
          messages: [],
        },
      ]

      // Filter by status
      const filtered = statusFilter
        ? mockConversations.filter(c => c.status === statusFilter)
        : mockConversations

      setConversations(filtered)
      setTotalPages(Math.ceil(filtered.length / perPage))
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 60) return `Il y a ${minutes}m`
    if (hours < 24) return `Il y a ${hours}h`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const getStatusStats = () => {
    const active = conversations.filter(c => c.status === 'ACTIVE').length
    const closed = conversations.filter(c => c.status === 'CLOSED').length
    const escalated = conversations.filter(c => c.status === 'ESCALATED').length
    return { active, closed, escalated }
  }

  const stats = getStatusStats()

  // Filter by search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true
    return conv.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           conv.id.toLowerCase().includes(searchQuery.toLowerCase())
  })

  if (selectedConversation) {
    return (
      <ConversationViewer
        conversation={selectedConversation}
        onClose={() => setSelectedConversation(null)}
        onEscalate={async () => {
          // Handle escalation
          setSelectedConversation(null)
          loadConversations()
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
            <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
            <p className="text-sm text-gray-500">
              Historique des conversations du chatbot
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={loadConversations} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{conversations.length}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                <p className="text-sm text-gray-500">Actives</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-100 p-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.escalated}</p>
                <p className="text-sm text-gray-500">Escaladees</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gray-100 p-2">
                <CheckCircle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.closed}</p>
                <p className="text-sm text-gray-500">Fermees</p>
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
                placeholder="Rechercher par nom ou ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">Tous les statuts</option>
              <option value="ACTIVE">Actives</option>
              <option value="ESCALATED">Escaladees</option>
              <option value="CLOSED">Fermees</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Conversations List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">Aucune conversation trouvee</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredConversations.map((conv) => {
                const status = statusConfig[conv.status]
                const StatusIcon = status.icon

                return (
                  <div
                    key={conv.id}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedConversation(conv)}
                  >
                    {/* User avatar */}
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-500" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{conv.userName}</p>
                        <Badge className={status.color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {conv.messageCount} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(conv.lastActivity)}
                        </span>
                        {conv.rating && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                            {conv.rating}/5
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              Page {currentPage} sur {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
