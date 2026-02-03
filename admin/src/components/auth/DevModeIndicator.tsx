'use client'

import { useState } from 'react'
import { AlertTriangle, X, Info } from 'lucide-react'

interface DevModeIndicatorProps {
  className?: string
}

export function DevModeIndicator({ className }: DevModeIndicatorProps) {
  const [dismissed, setDismissed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  if (dismissed) {
    return null
  }

  return (
    <div
      className={`bg-yellow-50 border-b border-yellow-200 px-4 py-2 ${className || ''}`}
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-yellow-100">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-sm font-medium text-yellow-800">
              Mode Developpement
            </span>
            <span className="text-xs text-yellow-600">
              Auth0 non configure - utilisation d&apos;un utilisateur de test
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 rounded hover:bg-yellow-100 transition-colors"
            title="Plus d'informations"
          >
            <Info className="h-4 w-4 text-yellow-600" />
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-yellow-100 transition-colors"
            title="Fermer"
          >
            <X className="h-4 w-4 text-yellow-600" />
          </button>
        </div>
      </div>

      {/* Details panel */}
      {showDetails && (
        <div className="mt-3 p-3 bg-yellow-100 rounded-lg max-w-7xl mx-auto">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">
            Configuration Auth0 requise
          </h4>
          <p className="text-xs text-yellow-700 mb-2">
            Pour activer l&apos;authentification, configurez les variables d&apos;environnement suivantes :
          </p>
          <ul className="text-xs text-yellow-700 space-y-1 font-mono">
            <li>AUTH0_SECRET</li>
            <li>AUTH0_BASE_URL</li>
            <li>AUTH0_ISSUER_BASE_URL</li>
            <li>AUTH0_CLIENT_ID</li>
            <li>AUTH0_CLIENT_SECRET</li>
          </ul>
          <p className="text-xs text-yellow-600 mt-3">
            En mode developpement, un utilisateur admin de test est automatiquement utilise.
          </p>
        </div>
      )}
    </div>
  )
}

// Export default for convenient imports
export default DevModeIndicator
