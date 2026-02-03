'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload,
  X,
  Image as ImageIcon,
  Video,
  File,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface UploadFile {
  id: string
  file: File
  preview: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

interface MediaUploaderProps {
  festivalId: string
  onUploadComplete?: () => void
  maxFiles?: number
  maxSize?: number // in bytes
  accept?: Record<string, string[]>
}

export function MediaUploader({
  festivalId,
  onUploadComplete,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB default
  accept = {
    'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    'video/*': ['.mp4', '.mov', '.avi', '.webm'],
  },
}: MediaUploaderProps) {
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<UploadFile[]>([])

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('festivalId', festivalId)
      formData.append('type', file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO')

      // Simulate upload - in real app, call API
      await new Promise((resolve) => setTimeout(resolve, 1500))

      return { id: Math.random().toString(36).substr(2, 9) }
    },
    onSuccess: (_, file) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, status: 'success' as const, progress: 100 } : f
        )
      )
      queryClient.invalidateQueries({ queryKey: ['admin-gallery'] })
    },
    onError: (error: Error, file) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.file === file
            ? { ...f, status: 'error' as const, error: error.message }
            : f
        )
      )
    },
  })

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: 'pending' as const,
      }))

      setFiles((prev) => [...prev, ...newFiles].slice(0, maxFiles))
    },
    [maxFiles]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles: maxFiles - files.length,
  })

  const handleUploadAll = () => {
    const pendingFiles = files.filter((f) => f.status === 'pending')
    pendingFiles.forEach((f) => {
      setFiles((prev) =>
        prev.map((file) =>
          file.id === f.id ? { ...file, status: 'uploading' as const } : file
        )
      )
      uploadMutation.mutate(f.file)
    })
  }

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter((f) => f.id !== id)
    })
  }

  const handleClearAll = () => {
    files.forEach((f) => URL.revokeObjectURL(f.preview))
    setFiles([])
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const successCount = files.filter((f) => f.status === 'success').length
  const isUploading = files.some((f) => f.status === 'uploading')

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return ImageIcon
    if (file.type.startsWith('video/')) return Video
    return File
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-4 text-sm font-medium text-gray-700">
          {isDragActive
            ? 'Deposez les fichiers ici...'
            : 'Glissez-deposez des fichiers ou cliquez pour selectionner'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Photos (JPG, PNG, GIF, WebP) ou Videos (MP4, MOV, AVI, WebM)
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Max {maxFiles} fichiers, {formatFileSize(maxSize)} par fichier
        </p>
      </div>

      {/* Rejected files */}
      {fileRejections.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Fichiers rejetes</span>
          </div>
          <ul className="mt-2 space-y-1">
            {fileRejections.map(({ file, errors }) => (
              <li key={file.name} className="text-sm text-red-600">
                {file.name}: {errors.map((e) => e.message).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {files.length} fichier(s) - {successCount} uploade(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearAll}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Tout effacer
              </button>
              <button
                onClick={handleUploadAll}
                disabled={pendingCount === 0 || isUploading}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Uploader ({pendingCount})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Files grid */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.file)
              return (
                <div
                  key={file.id}
                  className={cn(
                    'relative overflow-hidden rounded-lg border bg-card',
                    file.status === 'error' && 'border-red-200',
                    file.status === 'success' && 'border-green-200'
                  )}
                >
                  {/* Preview */}
                  <div className="relative aspect-square bg-gray-100">
                    {file.file.type.startsWith('image/') ? (
                      <Image
                        src={file.preview}
                        alt={file.file.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FileIcon className="h-12 w-12 text-gray-400" />
                      </div>
                    )}

                    {/* Remove button */}
                    {file.status !== 'uploading' && (
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    {/* Status overlay */}
                    {file.status === 'uploading' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      </div>
                    )}
                    {file.status === 'success' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-green-500/40">
                        <Check className="h-8 w-8 text-white" />
                      </div>
                    )}
                    {file.status === 'error' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-500/40">
                        <AlertCircle className="h-8 w-8 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <p className="truncate text-xs font-medium">{file.file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.file.size)}
                    </p>
                    {file.error && (
                      <p className="mt-1 text-xs text-red-600">{file.error}</p>
                    )}
                  </div>

                  {/* Progress bar */}
                  {file.status === 'uploading' && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
