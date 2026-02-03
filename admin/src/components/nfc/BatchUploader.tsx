'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'

interface BatchUploaderProps {
  festivalId: string
  onComplete: (result: { uids: string[]; batchId: string }) => void
  onCancel: () => void
}

interface UploadState {
  step: 'select' | 'preview' | 'uploading' | 'complete' | 'error'
  file: File | null
  uids: string[]
  batchName: string
  batchDescription: string
  notes: string
  progress: number
  error: string | null
  batchId: string | null
}

export default function BatchUploader({ festivalId, onComplete, onCancel }: BatchUploaderProps) {
  const [state, setState] = useState<UploadState>({
    step: 'select',
    file: null,
    uids: [],
    batchName: '',
    batchDescription: '',
    notes: '',
    progress: 0,
    error: null,
    batchId: null,
  })

  const parseCSV = (text: string): string[] => {
    const lines = text.split(/[\n\r]+/)
    const uids: string[] = []

    for (const line of lines) {
      // Skip empty lines and header rows
      const trimmed = line.trim()
      if (!trimmed || trimmed.toLowerCase().startsWith('uid') || trimmed.startsWith('#')) {
        continue
      }

      // Handle CSV with multiple columns (take first column)
      const columns = trimmed.split(/[,;\t]/)
      const uid = columns[0].trim().replace(/"/g, '')

      // Validate UID format (basic validation)
      if (uid.length >= 8 && /^[0-9A-Fa-f:]+$/.test(uid.replace(/:/g, ''))) {
        uids.push(uid.toUpperCase())
      }
    }

    // Remove duplicates
    return [...new Set(uids)]
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const uids = parseCSV(text)

      if (uids.length === 0) {
        setState((prev) => ({
          ...prev,
          error: 'Aucun UID valide trouve dans le fichier',
          step: 'error',
        }))
        return
      }

      // Auto-generate batch name from file name
      const baseName = file.name.replace(/\.[^/.]+$/, '')

      setState((prev) => ({
        ...prev,
        file,
        uids,
        batchName: baseName,
        step: 'preview',
        error: null,
      }))
    }
    reader.readAsText(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
  })

  const handleUpload = async () => {
    if (!state.batchName.trim()) {
      alert('Veuillez entrer un nom pour le lot')
      return
    }

    setState((prev) => ({ ...prev, step: 'uploading', progress: 0 }))

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        setState((prev) => ({ ...prev, progress: i }))
      }

      // API call would go here
      // const response = await nfcApi.createBatch(festivalId, {
      //   name: state.batchName,
      //   description: state.batchDescription,
      //   uids: state.uids,
      //   notes: state.notes,
      // })

      // Simulate success
      const mockBatchId = `batch-${Date.now()}`

      setState((prev) => ({
        ...prev,
        step: 'complete',
        batchId: mockBatchId,
      }))

      onComplete({ uids: state.uids, batchId: mockBatchId })
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: error.message || 'Erreur lors de l\'import',
      }))
    }
  }

  const handleReset = () => {
    setState({
      step: 'select',
      file: null,
      uids: [],
      batchName: '',
      batchDescription: '',
      notes: '',
      progress: 0,
      error: null,
      batchId: null,
    })
  }

  const renderSelectStep = () => (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 mb-3 text-gray-400" />
        <p className="mb-2 text-sm text-gray-500">
          <span className="font-semibold">Cliquez pour selectionner</span> ou glissez-deposez
        </p>
        <p className="text-xs text-gray-500">CSV ou TXT (MAX. 10MB)</p>
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <h4 className="font-medium text-blue-900 text-sm">Format attendu</h4>
        <p className="text-sm text-blue-700 mt-1">
          Le fichier doit contenir une liste d'UIDs NFC, un par ligne ou separes par des virgules.
        </p>
        <code className="block mt-2 text-xs bg-blue-100 p-2 rounded text-blue-800">
          04:A2:B3:C4:D5:E6:F7<br />
          04:B3:C4:D5:E6:F7:A8<br />
          04:C4:D5:E6:F7:A8:B9
        </code>
      </div>
    </div>
  )

  const renderPreviewStep = () => (
    <div className="space-y-4">
      {/* File Info */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <FileText className="h-8 w-8 text-gray-400" />
        <div className="flex-1">
          <p className="font-medium text-gray-900">{state.file?.name}</p>
          <p className="text-sm text-gray-500">
            {formatNumber(state.uids.length)} UIDs detectes
          </p>
        </div>
        <button
          onClick={handleReset}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Batch Info Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom du lot *
          </label>
          <input
            type="text"
            value={state.batchName}
            onChange={(e) => setState((prev) => ({ ...prev, batchName: e.target.value }))}
            placeholder="Ex: Lot Pass 3 Jours - Janvier"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            type="text"
            value={state.batchDescription}
            onChange={(e) => setState((prev) => ({ ...prev, batchDescription: e.target.value }))}
            placeholder="Description optionnelle du lot"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes internes
          </label>
          <textarea
            value={state.notes}
            onChange={(e) => setState((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Notes visibles uniquement par l'equipe"
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* UIDs Preview */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Apercu des UIDs ({formatNumber(state.uids.length)} total)
        </p>
        <div className="max-h-32 overflow-auto rounded-lg border bg-gray-50 p-3">
          <div className="grid grid-cols-2 gap-1 text-xs font-mono text-gray-600">
            {state.uids.slice(0, 20).map((uid, index) => (
              <div key={index}>{uid}</div>
            ))}
            {state.uids.length > 20 && (
              <div className="col-span-2 text-gray-400 mt-2">
                ... et {formatNumber(state.uids.length - 20)} autres
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Annuler
        </button>
        <button
          onClick={handleUpload}
          disabled={!state.batchName.trim()}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          Importer le lot
        </button>
      </div>
    </div>
  )

  const renderUploadingStep = () => (
    <div className="text-center py-8">
      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
      <h3 className="font-medium text-gray-900">Import en cours...</h3>
      <p className="text-sm text-gray-500 mt-1">
        {formatNumber(state.uids.length)} bracelets
      </p>
      <div className="mt-4 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${state.progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 mt-2">{state.progress}%</p>
    </div>
  )

  const renderCompleteStep = () => (
    <div className="text-center py-8">
      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
      <h3 className="font-medium text-gray-900">Import termine!</h3>
      <p className="text-sm text-gray-500 mt-1">
        {formatNumber(state.uids.length)} bracelets importes avec succes
      </p>
    </div>
  )

  const renderErrorStep = () => (
    <div className="text-center py-8">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h3 className="font-medium text-gray-900">Erreur d'import</h3>
      <p className="text-sm text-red-600 mt-1">{state.error}</p>
      <button
        onClick={handleReset}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
      >
        Reessayer
      </button>
    </div>
  )

  return (
    <div className="p-4">
      {state.step === 'select' && renderSelectStep()}
      {state.step === 'preview' && renderPreviewStep()}
      {state.step === 'uploading' && renderUploadingStep()}
      {state.step === 'complete' && renderCompleteStep()}
      {state.step === 'error' && renderErrorStep()}
    </div>
  )
}
