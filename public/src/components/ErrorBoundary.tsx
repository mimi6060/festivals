'use client'

import * as React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // Could integrate with Sentry, LogRocket, etc.
      // For now, we just suppress the error in production
    } else {
      // Only log in development
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    this.props.onError?.(error, errorInfo)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  handleGoHome = (): void => {
    window.location.href = '/'
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Une erreur est survenue
            </h2>
            <p className="text-gray-400 mb-6">
              Nous sommes desoles, quelque chose s&apos;est mal passe. Veuillez reessayer ou retourner a l&apos;accueil.
            </p>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <div className="mb-6 p-4 rounded-lg bg-white/5 text-left">
                <p className="text-sm font-mono text-red-400 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button
                variant="secondary"
                onClick={this.handleGoHome}
                leftIcon={<Home className="h-4 w-4" />}
              >
                Accueil
              </Button>
              <Button
                variant="primary"
                onClick={this.handleRetry}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Reessayer
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook-based error boundary wrapper for functional components
interface UseErrorBoundaryReturn {
  ErrorBoundaryWrapper: React.FC<{ children: React.ReactNode }>
  resetError: () => void
}

export function useErrorBoundary(): UseErrorBoundaryReturn {
  const [key, setKey] = React.useState(0)

  const resetError = React.useCallback(() => {
    setKey(prev => prev + 1)
  }, [])

  const ErrorBoundaryWrapper: React.FC<{ children: React.ReactNode }> = React.useCallback(
    ({ children }) => (
      <ErrorBoundary key={key}>
        {children}
      </ErrorBoundary>
    ),
    [key]
  )

  return { ErrorBoundaryWrapper, resetError }
}
