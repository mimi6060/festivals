'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  User,
  Bot,
  AlertCircle,
  Clock,
  Star,
  Send,
  AlertTriangle,
  CheckCircle,
  MessageCircle,
  Flag,
  Trash2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'

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

interface ConversationViewerProps {
  conversation: Conversation
  onClose: () => void
  onEscalate?: () => Promise<void>
}

const statusConfig = {
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-800', icon: MessageCircle },
  CLOSED: { label: 'Fermee', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
  ESCALATED: { label: 'Escaladee', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
}

export default function ConversationViewer({
  conversation,
  onClose,
  onEscalate,
}: ConversationViewerProps) {
  const [isEscalating, setIsEscalating] = useState(false)
  const [adminNote, setAdminNote] = useState('')

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleEscalate = async () => {
    if (!onEscalate) return
    setIsEscalating(true)
    try {
      await onEscalate()
    } finally {
      setIsEscalating(false)
    }
  }

  const status = statusConfig[conversation.status]
  const StatusIcon = status.icon

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user'
    const isSystem = message.role === 'system'

    if (isSystem) {
      return (
        <div key={message.id} className="flex justify-center my-4">
          <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600">
            <AlertCircle className="h-4 w-4" />
            <span>{message.content}</span>
            <span className="text-gray-400">-</span>
            <span className="text-gray-400">{formatTime(message.createdAt)}</span>
          </div>
        </div>
      )
    }

    return (
      <div
        key={message.id}
        className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}
      >
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          {isUser ? (
            <User className="h-4 w-4 text-white" />
          ) : (
            <Bot className="h-4 w-4 text-gray-600" />
          )}
        </div>

        {/* Message */}
        <div className={`max-w-[70%] ${isUser ? 'text-right' : ''}`}>
          <div
            className={`rounded-2xl px-4 py-2 ${
              isUser
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-900 rounded-bl-sm'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
          <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : ''}`}>
            {formatTime(message.createdAt)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{conversation.userName}</h1>
              <Badge className={status.color}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {status.label}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              Conversation demarree le {formatDate(conversation.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {conversation.status === 'ACTIVE' && onEscalate && (
            <Button
              variant="outline"
              onClick={handleEscalate}
              disabled={isEscalating}
              className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {isEscalating ? 'Escalade...' : 'Escalader'}
            </Button>
          )}
          <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-50">
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Messages */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Messages ({conversation.messageCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto">
                {conversation.messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucun message a afficher
                  </div>
                ) : (
                  conversation.messages.map(renderMessage)
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Utilisateur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Nom</p>
                <p className="font-medium">{conversation.userName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">ID Utilisateur</p>
                <p className="font-mono text-xs text-gray-600">{conversation.userId}</p>
              </div>
            </CardContent>
          </Card>

          {/* Conversation Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">ID Conversation</p>
                <p className="font-mono text-xs text-gray-600">{conversation.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Debut</p>
                <p className="text-sm">{formatDate(conversation.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Derniere activite</p>
                <p className="text-sm">{formatDate(conversation.lastActivity)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Messages</p>
                <p className="text-sm">{conversation.messageCount}</p>
              </div>
            </CardContent>
          </Card>

          {/* Rating */}
          {conversation.rating && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Evaluation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= conversation.rating!
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="ml-2 font-medium">{conversation.rating}/5</span>
                </div>
                {conversation.feedback && (
                  <p className="text-sm text-gray-600 italic">
                    "{conversation.feedback}"
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Admin Note */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Note interne
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Ajouter une note interne..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <Button size="sm" variant="outline" className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
