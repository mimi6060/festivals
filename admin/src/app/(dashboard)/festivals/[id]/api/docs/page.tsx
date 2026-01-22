'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Book,
  Code,
  Copy,
  ChevronRight,
  ExternalLink,
  Terminal,
  Zap,
  Shield,
  Clock,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
  permission: string
  parameters?: { name: string; type: string; required: boolean; description: string }[]
  response?: string
}

const endpoints: Record<string, Endpoint[]> = {
  'Festivals': [
    {
      method: 'GET',
      path: '/public/v1/festivals/:id',
      description: 'Recupere les informations publiques d\'un festival',
      permission: 'festivals:read',
      response: `{
  "id": "uuid",
  "name": "Summer Fest 2026",
  "slug": "summer-fest-2026",
  "description": "...",
  "startDate": "2026-06-15",
  "endDate": "2026-06-17",
  "location": "Brussels, Belgium",
  "timezone": "Europe/Brussels",
  "currencyName": "Jetons",
  "status": "ACTIVE",
  "settings": {
    "logoUrl": "https://...",
    "primaryColor": "#FF5733"
  }
}`,
    },
  ],
  'Lineup': [
    {
      method: 'GET',
      path: '/public/v1/festivals/:id/lineup',
      description: 'Recupere la programmation complete du festival',
      permission: 'lineup:read',
      response: `{
  "festivalId": "uuid",
  "days": ["2026-06-15", "2026-06-16"],
  "stages": [...],
  "schedule": {...}
}`,
    },
    {
      method: 'GET',
      path: '/public/v1/festivals/:id/artists',
      description: 'Liste tous les artistes',
      permission: 'lineup:read',
      parameters: [
        { name: 'page', type: 'integer', required: false, description: 'Numero de page (defaut: 1)' },
        { name: 'per_page', type: 'integer', required: false, description: 'Elements par page (defaut: 50)' },
      ],
    },
    {
      method: 'GET',
      path: '/public/v1/festivals/:id/stages',
      description: 'Liste toutes les scenes',
      permission: 'lineup:read',
    },
    {
      method: 'GET',
      path: '/public/v1/festivals/:id/schedule',
      description: 'Recupere le programme d\'un jour specifique',
      permission: 'lineup:read',
      parameters: [
        { name: 'day', type: 'string', required: false, description: 'Date au format YYYY-MM-DD' },
      ],
    },
  ],
  'Tickets': [
    {
      method: 'GET',
      path: '/public/v1/festivals/:id/tickets',
      description: 'Liste tous les types de billets disponibles',
      permission: 'tickets:read',
      parameters: [
        { name: 'status', type: 'string', required: false, description: 'Filtrer par statut (ACTIVE, SOLD_OUT)' },
      ],
    },
    {
      method: 'GET',
      path: '/public/v1/festivals/:id/tickets/:ticketTypeId',
      description: 'Recupere les details d\'un type de billet',
      permission: 'tickets:read',
    },
    {
      method: 'GET',
      path: '/public/v1/festivals/:id/tickets/:ticketTypeId/availability',
      description: 'Verifie la disponibilite des billets',
      permission: 'tickets:read',
      parameters: [
        { name: 'quantity', type: 'integer', required: false, description: 'Quantite souhaitee (defaut: 1)' },
      ],
      response: `{
  "ticketTypeId": "uuid",
  "name": "Pass 3 jours",
  "available": 150,
  "requested": 2,
  "canPurchase": true,
  "status": "ACTIVE",
  "message": "Tickets are available."
}`,
    },
  ],
  'Webhooks': [
    {
      method: 'POST',
      path: '/public/v1/webhooks/receive',
      description: 'Endpoint de test pour recevoir des webhooks',
      permission: 'webhooks:manage',
    },
  ],
}

const codeExamples = {
  curl: `curl -X GET "https://api.festivals.app/public/v1/festivals/{festivalId}/lineup" \\
  -H "X-API-Key: pk_live_xxxxx..."`,
  javascript: `const response = await fetch(
  'https://api.festivals.app/public/v1/festivals/{festivalId}/lineup',
  {
    headers: {
      'X-API-Key': 'pk_live_xxxxx...',
      'Content-Type': 'application/json'
    }
  }
);
const lineup = await response.json();`,
  python: `import requests

response = requests.get(
    'https://api.festivals.app/public/v1/festivals/{festivalId}/lineup',
    headers={
        'X-API-Key': 'pk_live_xxxxx...',
        'Content-Type': 'application/json'
    }
)
lineup = response.json()`,
  php: `<?php
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.festivals.app/public/v1/festivals/{festivalId}/lineup');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'X-API-Key: pk_live_xxxxx...',
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$lineup = json_decode($response, true);
curl_close($ch);`,
}

const webhookEvents = [
  { event: 'ticket.sold', description: 'Declenche quand un billet est achete' },
  { event: 'ticket.scanned', description: 'Declenche quand un billet est scanne' },
  { event: 'ticket.transferred', description: 'Declenche quand un billet est transfere' },
  { event: 'wallet.topup', description: 'Declenche quand un wallet est recharge' },
  { event: 'wallet.transaction', description: 'Declenche pour chaque transaction' },
  { event: 'refund.requested', description: 'Declenche quand un remboursement est demande' },
  { event: 'refund.processed', description: 'Declenche quand un remboursement est traite' },
  { event: 'festival.updated', description: 'Declenche quand le festival est modifie' },
  { event: 'lineup.changed', description: 'Declenche quand la programmation change' },
]

export default function APIDocsPage() {
  const params = useParams()
  const festivalId = params.id as string
  const [activeSection, setActiveSection] = useState('getting-started')
  const [activeLanguage, setActiveLanguage] = useState<keyof typeof codeExamples>('curl')
  const [copiedCode, setCopiedCode] = useState(false)

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code.replace('{festivalId}', festivalId))
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-100 text-green-700'
      case 'POST':
        return 'bg-blue-100 text-blue-700'
      case 'PATCH':
        return 'bg-yellow-100 text-yellow-700'
      case 'DELETE':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="flex gap-8">
      {/* Sidebar Navigation */}
      <nav className="w-64 flex-shrink-0">
        <div className="sticky top-6 space-y-1">
          <h3 className="px-3 text-xs font-semibold uppercase text-gray-500">Documentation</h3>
          <button
            onClick={() => setActiveSection('getting-started')}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm',
              activeSection === 'getting-started'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Zap className="h-4 w-4" />
            Demarrage rapide
          </button>
          <button
            onClick={() => setActiveSection('authentication')}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm',
              activeSection === 'authentication'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Shield className="h-4 w-4" />
            Authentification
          </button>
          <button
            onClick={() => setActiveSection('rate-limiting')}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm',
              activeSection === 'rate-limiting'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Clock className="h-4 w-4" />
            Rate Limiting
          </button>
          <button
            onClick={() => setActiveSection('endpoints')}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm',
              activeSection === 'endpoints'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Terminal className="h-4 w-4" />
            Endpoints
          </button>
          <button
            onClick={() => setActiveSection('webhooks')}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm',
              activeSection === 'webhooks'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Code className="h-4 w-4" />
            Webhooks
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 min-w-0 max-w-4xl">
        {/* Getting Started */}
        {activeSection === 'getting-started' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Documentation API Publique</h1>
              <p className="mt-2 text-gray-600">
                Integrez les donnees de votre festival dans vos applications tierces.
              </p>
            </div>

            <div className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Demarrage rapide</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-medium">
                    1
                  </div>
                  <div>
                    <h3 className="font-medium">Obtenez une cle API</h3>
                    <p className="text-sm text-gray-500">
                      Creez une cle API dans la section "Cles API" avec les permissions necessaires.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-medium">
                    2
                  </div>
                  <div>
                    <h3 className="font-medium">Faites votre premiere requete</h3>
                    <p className="text-sm text-gray-500">
                      Utilisez votre cle API dans l'en-tete X-API-Key de vos requetes.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-medium">
                    3
                  </div>
                  <div>
                    <h3 className="font-medium">Configurez les webhooks (optionnel)</h3>
                    <p className="text-sm text-gray-500">
                      Recevez des notifications en temps reel pour les evenements importants.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Code Examples */}
            <div className="rounded-lg border bg-white overflow-hidden">
              <div className="border-b px-4 py-2 flex items-center gap-2">
                {Object.keys(codeExamples).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveLanguage(lang as keyof typeof codeExamples)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg',
                      activeLanguage === lang
                        ? 'bg-gray-200 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </button>
                ))}
                <button
                  onClick={() => handleCopyCode(codeExamples[activeLanguage])}
                  className="ml-auto flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  {copiedCode ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Copie!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copier
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 bg-gray-900 text-gray-100 text-sm overflow-x-auto">
                <code>{codeExamples[activeLanguage].replace('{festivalId}', festivalId)}</code>
              </pre>
            </div>

            {/* Base URL */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <h3 className="font-medium text-blue-900">URL de base</h3>
              <code className="mt-2 block text-sm text-blue-800">
                https://api.festivals.app/public/v1
              </code>
            </div>
          </div>
        )}

        {/* Authentication */}
        {activeSection === 'authentication' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Authentification</h1>
              <p className="mt-2 text-gray-600">
                Toutes les requetes a l'API publique necessitent une cle API valide.
              </p>
            </div>

            <div className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold mb-4">Utilisation de la cle API</h2>
              <p className="text-gray-600 mb-4">
                Incluez votre cle API dans l'en-tete <code className="bg-gray-100 px-1 rounded">X-API-Key</code> de chaque requete.
              </p>
              <pre className="rounded-lg bg-gray-900 p-4 text-sm text-gray-100 overflow-x-auto">
{`curl -X GET "https://api.festivals.app/public/v1/festivals/${festivalId}" \\
  -H "X-API-Key: pk_live_votre_cle_ici"`}
              </pre>
            </div>

            <div className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold mb-4">Types de cles</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-yellow-100 p-2">
                    <Code className="h-5 w-5 text-yellow-700" />
                  </div>
                  <div>
                    <h3 className="font-medium">Sandbox (pk_test_...)</h3>
                    <p className="text-sm text-gray-500">
                      Pour le developpement et les tests. Donnees de test uniquement.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-green-100 p-2">
                    <Shield className="h-5 w-5 text-green-700" />
                  </div>
                  <div>
                    <h3 className="font-medium">Production (pk_live_...)</h3>
                    <p className="text-sm text-gray-500">
                      Pour les applications en production. Donnees reelles.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="font-medium text-red-900">Important</h3>
              <ul className="mt-2 text-sm text-red-800 space-y-1 list-disc list-inside">
                <li>Ne partagez jamais vos cles API</li>
                <li>N'incluez pas les cles dans le code source public</li>
                <li>Utilisez des variables d'environnement</li>
                <li>Revoquez immediatement les cles compromises</li>
              </ul>
            </div>
          </div>
        )}

        {/* Rate Limiting */}
        {activeSection === 'rate-limiting' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rate Limiting</h1>
              <p className="mt-2 text-gray-600">
                L'API applique des limites de taux pour garantir la stabilite du service.
              </p>
            </div>

            <div className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold mb-4">Limites par defaut</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Requetes par minute</p>
                  <p className="text-2xl font-bold">60</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Requetes par jour</p>
                  <p className="text-2xl font-bold">10,000</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold mb-4">En-tetes de reponse</h2>
              <p className="text-gray-600 mb-4">
                Chaque reponse inclut des en-tetes pour vous aider a gerer votre utilisation.
              </p>
              <div className="space-y-2 font-mono text-sm">
                <p><code className="text-blue-600">X-RateLimit-Limit</code>: Limite par minute</p>
                <p><code className="text-blue-600">X-RateLimit-Remaining</code>: Requetes restantes</p>
                <p><code className="text-blue-600">X-RateLimit-Reset</code>: Timestamp de reinitialisation</p>
              </div>
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <h3 className="font-medium text-yellow-900">Depassement de limite</h3>
              <p className="mt-2 text-sm text-yellow-800">
                Si vous depassez la limite, vous recevrez une reponse 429 Too Many Requests.
                Attendez quelques secondes avant de reessayer.
              </p>
            </div>
          </div>
        )}

        {/* Endpoints */}
        {activeSection === 'endpoints' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Endpoints API</h1>
              <p className="mt-2 text-gray-600">
                Reference complete des endpoints disponibles.
              </p>
            </div>

            {Object.entries(endpoints).map(([category, categoryEndpoints]) => (
              <div key={category} className="rounded-lg border bg-white overflow-hidden">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h2 className="font-semibold text-gray-900">{category}</h2>
                </div>
                <div className="divide-y">
                  {categoryEndpoints.map((endpoint, index) => (
                    <div key={index} className="p-4">
                      <div className="flex items-start gap-3">
                        <span className={cn(
                          'rounded px-2 py-0.5 text-xs font-bold',
                          getMethodColor(endpoint.method)
                        )}>
                          {endpoint.method}
                        </span>
                        <div className="flex-1">
                          <code className="text-sm font-medium text-gray-900">
                            {endpoint.path.replace(':id', festivalId)}
                          </code>
                          <p className="mt-1 text-sm text-gray-500">{endpoint.description}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            Permission: <code>{endpoint.permission}</code>
                          </p>
                          {endpoint.parameters && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-gray-700 mb-2">Parametres:</p>
                              <div className="space-y-1">
                                {endpoint.parameters.map((param) => (
                                  <div key={param.name} className="text-xs">
                                    <code className="text-blue-600">{param.name}</code>
                                    <span className="text-gray-400"> ({param.type})</span>
                                    {param.required && <span className="text-red-500">*</span>}
                                    <span className="text-gray-500"> - {param.description}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {endpoint.response && (
                            <details className="mt-3">
                              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                Voir exemple de reponse
                              </summary>
                              <pre className="mt-2 rounded bg-gray-100 p-3 text-xs overflow-x-auto">
                                {endpoint.response}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Webhooks */}
        {activeSection === 'webhooks' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
              <p className="mt-2 text-gray-600">
                Recevez des notifications en temps reel pour les evenements importants.
              </p>
            </div>

            <div className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold mb-4">Evenements disponibles</h2>
              <div className="space-y-2">
                {webhookEvents.map((event) => (
                  <div key={event.event} className="flex items-center justify-between py-2 border-b last:border-0">
                    <code className="text-sm text-blue-600">{event.event}</code>
                    <span className="text-sm text-gray-500">{event.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold mb-4">Format du payload</h2>
              <pre className="rounded-lg bg-gray-900 p-4 text-sm text-gray-100 overflow-x-auto">
{`{
  "id": "whd_123abc...",
  "timestamp": "2026-01-23T10:30:00Z",
  "event": "ticket.sold",
  "festivalId": "${festivalId}",
  "data": {
    "ticketId": "uuid",
    "ticketTypeId": "uuid",
    "holderEmail": "user@example.com",
    "price": 5000
  }
}`}
              </pre>
            </div>

            <div className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold mb-4">Verification de signature</h2>
              <p className="text-gray-600 mb-4">
                Chaque webhook inclut une signature HMAC-SHA256 dans l'en-tete <code className="bg-gray-100 px-1 rounded">X-Webhook-Signature</code>.
              </p>
              <pre className="rounded-lg bg-gray-900 p-4 text-sm text-gray-100 overflow-x-auto">
{`import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)`}
              </pre>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="font-medium text-blue-900">Conseils</h3>
              <ul className="mt-2 text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Repondez avec un code 2xx dans les 30 secondes</li>
                <li>Les webhooks sont reessayes jusqu'a 3 fois en cas d'echec</li>
                <li>Implementez une logique d'idempotence avec l'ID unique</li>
                <li>Verifiez toujours la signature pour la securite</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
