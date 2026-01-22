'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  X,
} from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { Table } from '@/components/ui/Table'

interface ActivationResult {
  uid: string
  status: 'success' | 'error' | 'pending'
  message?: string
  walletCode?: string
}

export default function NFCBulkActivatePage() {
  const params = useParams()
  const festivalId = params.id as string

  const [step, setStep] = useState<'input' | 'preview' | 'processing' | 'complete'>('input')
  const [inputMethod, setInputMethod] = useState<'paste' | 'file'>('paste')
  const [textInput, setTextInput] = useState('')
  const [uids, setUids] = useState<string[]>([])
  const [results, setResults] = useState<ActivationResult[]>([])
  const [processing, setProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const parseInput = (text: string): string[] => {
    // Split by newlines, commas, or semicolons
    const lines = text.split(/[\n,;]+/)
    return lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line, index, arr) => arr.indexOf(line) === index) // Remove duplicates
  }

  const handleTextSubmit = () => {
    const parsed = parseInput(textInput)
    if (parsed.length === 0) {
      alert('Veuillez entrer au moins un UID')
      return
    }
    setUids(parsed)
    setResults(parsed.map((uid) => ({ uid, status: 'pending' })))
    setStep('preview')
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseInput(text)
      if (parsed.length === 0) {
        alert('Aucun UID trouve dans le fichier')
        return
      }
      setUids(parsed)
      setResults(parsed.map((uid) => ({ uid, status: 'pending' })))
      setStep('preview')
    }
    reader.readAsText(file)
  }

  const handleActivate = async () => {
    setStep('processing')
    setProcessing(true)
    setCurrentIndex(0)

    // Process UIDs one by one
    for (let i = 0; i < uids.length; i++) {
      setCurrentIndex(i)

      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Random success/failure for demo
        const success = Math.random() > 0.1

        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: success ? 'success' : 'error',
                  message: success ? 'Active avec succes' : 'Bracelet deja actif ou introuvable',
                  walletCode: success ? `WALLET-${Math.random().toString(36).substr(2, 8).toUpperCase()}` : undefined,
                }
              : r
          )
        )
      } catch (error) {
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: 'error', message: 'Erreur de connexion' } : r
          )
        )
      }
    }

    setProcessing(false)
    setStep('complete')
  }

  const successCount = results.filter((r) => r.status === 'success').length
  const errorCount = results.filter((r) => r.status === 'error').length

  const columns = [
    {
      key: 'uid',
      header: 'UID',
      cell: (row: ActivationResult) => (
        <span className="font-mono text-sm">{row.uid}</span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (row: ActivationResult) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            row.status === 'success' && 'bg-green-100 text-green-700',
            row.status === 'error' && 'bg-red-100 text-red-700',
            row.status === 'pending' && 'bg-gray-100 text-gray-700'
          )}
        >
          {row.status === 'success' && <CheckCircle className="h-3 w-3" />}
          {row.status === 'error' && <AlertCircle className="h-3 w-3" />}
          {row.status === 'pending' && <Loader2 className="h-3 w-3 animate-spin" />}
          {row.status === 'success' ? 'Succes' : row.status === 'error' ? 'Erreur' : 'En attente'}
        </span>
      ),
    },
    {
      key: 'message',
      header: 'Message',
      cell: (row: ActivationResult) => (
        <span className="text-sm text-gray-500">{row.message || '-'}</span>
      ),
    },
    {
      key: 'walletCode',
      header: 'Code Wallet',
      cell: (row: ActivationResult) =>
        row.walletCode ? (
          <span className="font-mono text-sm text-green-600">{row.walletCode}</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
  ]

  const renderInputStep = () => (
    <div className="space-y-6">
      {/* Method Selection */}
      <div className="flex gap-4">
        <button
          onClick={() => setInputMethod('paste')}
          className={cn(
            'flex-1 rounded-lg border-2 p-4 text-left transition-colors',
            inputMethod === 'paste'
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
          )}
        >
          <FileText className="h-6 w-6 text-primary mb-2" />
          <h3 className="font-medium">Coller les UIDs</h3>
          <p className="text-sm text-gray-500">Collez une liste d'UIDs separee par des virgules ou retours a la ligne</p>
        </button>
        <button
          onClick={() => setInputMethod('file')}
          className={cn(
            'flex-1 rounded-lg border-2 p-4 text-left transition-colors',
            inputMethod === 'file'
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
          )}
        >
          <Upload className="h-6 w-6 text-primary mb-2" />
          <h3 className="font-medium">Importer un fichier</h3>
          <p className="text-sm text-gray-500">Importez un fichier CSV ou TXT contenant les UIDs</p>
        </button>
      </div>

      {/* Input Area */}
      {inputMethod === 'paste' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Liste des UIDs (un par ligne ou separes par virgules)
          </label>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="04:A2:B3:C4:D5:E6:F7&#10;04:B3:C4:D5:E6:F7:A8&#10;04:C4:D5:E6:F7:A8:B9"
            className="w-full h-48 rounded-lg border p-4 font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleTextSubmit}
            disabled={!textInput.trim()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            Continuer
          </button>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fichier CSV ou TXT
          </label>
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 mb-3 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Cliquez pour selectionner</span> ou glissez-deposez
                </p>
                <p className="text-xs text-gray-500">CSV, TXT (MAX. 10MB)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".csv,.txt"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <h3 className="font-medium text-blue-900">
          {formatNumber(uids.length)} bracelets a activer
        </h3>
        <p className="text-sm text-blue-700 mt-1">
          Verifiez la liste ci-dessous avant de lancer l'activation.
        </p>
      </div>

      <div className="max-h-96 overflow-auto rounded-lg border">
        <Table columns={columns.slice(0, 2)} data={results} />
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => {
            setStep('input')
            setUids([])
            setResults([])
          }}
          className="inline-flex items-center gap-2 rounded-lg border px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <button
          onClick={handleActivate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <CheckCircle className="h-4 w-4" />
          Lancer l'activation
        </button>
      </div>
    </div>
  )

  const renderProcessingStep = () => (
    <div className="space-y-6">
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
          <div>
            <h3 className="font-medium text-yellow-900">Activation en cours...</h3>
            <p className="text-sm text-yellow-700">
              {currentIndex + 1} / {uids.length} bracelets traites
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-yellow-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-500 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / uids.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="max-h-96 overflow-auto rounded-lg border">
        <Table columns={columns} data={results} />
      </div>
    </div>
  )

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="rounded-lg bg-green-50 border border-green-200 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <h3 className="font-medium text-green-900">Activation terminee</h3>
            <p className="text-sm text-green-700">
              {formatNumber(successCount)} bracelets actives avec succes
              {errorCount > 0 && `, ${formatNumber(errorCount)} erreurs`}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Total traite</p>
          <p className="text-2xl font-bold">{formatNumber(uids.length)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-green-600">Succes</p>
          <p className="text-2xl font-bold text-green-600">{formatNumber(successCount)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-red-600">Erreurs</p>
          <p className="text-2xl font-bold text-red-600">{formatNumber(errorCount)}</p>
        </div>
      </div>

      <div className="max-h-96 overflow-auto rounded-lg border">
        <Table columns={columns} data={results} />
      </div>

      <div className="flex gap-4">
        <Link
          href={`/festivals/${festivalId}/nfc`}
          className="inline-flex items-center gap-2 rounded-lg border px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Retour a la liste
        </Link>
        <button
          onClick={() => {
            setStep('input')
            setTextInput('')
            setUids([])
            setResults([])
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          Nouvelle activation
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/festivals/${festivalId}/nfc`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activation en masse</h1>
          <p className="text-gray-500">Activez plusieurs bracelets NFC en une seule operation</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {['Saisie', 'Verification', 'Activation', 'Termine'].map((label, index) => {
          const stepIndex = ['input', 'preview', 'processing', 'complete'].indexOf(step)
          const isActive = index === stepIndex
          const isComplete = index < stepIndex

          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                  isComplete && 'bg-primary text-white',
                  isActive && 'bg-primary text-white',
                  !isComplete && !isActive && 'bg-gray-200 text-gray-500'
                )}
              >
                {isComplete ? <CheckCircle className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'text-sm',
                  isActive ? 'font-medium text-gray-900' : 'text-gray-500'
                )}
              >
                {label}
              </span>
              {index < 3 && <div className="h-px w-8 bg-gray-300" />}
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div className="rounded-lg border bg-white p-6">
        {step === 'input' && renderInputStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'processing' && renderProcessingStep()}
        {step === 'complete' && renderCompleteStep()}
      </div>
    </div>
  )
}
