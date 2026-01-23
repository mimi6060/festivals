'use client'

import * as React from 'react'
import { Upload, Trash2, Loader2, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoUploaderProps {
  value?: string
  onChange: (url: string) => void
  onUpload: (file: File) => Promise<string>
  label?: string
  hint?: string
  accept?: string
  maxSize?: number // in MB
  className?: string
}

export function LogoUploader({
  value,
  onChange,
  onUpload,
  label = 'Logo',
  hint = 'PNG, JPG or SVG. Max 2MB. Recommended: 512x512px',
  accept = 'image/*',
  maxSize = 2,
  className,
}: LogoUploaderProps) {
  const [isUploading, setIsUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File | null) => {
    if (!file) return

    setError(null)

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`)
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    setIsUploading(true)
    try {
      const url = await onUpload(file)
      onChange(url)
    } catch (err) {
      console.error('Upload failed:', err)
      setError('Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    handleFileSelect(file || null)
    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    handleFileSelect(file || null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleRemove = () => {
    onChange('')
    setError(null)
  }

  return (
    <div className={className}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="flex items-start gap-6">
        {/* Preview */}
        <div
          className={cn(
            'relative flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed bg-gray-50 transition-colors',
            isDragging && 'border-primary bg-primary/5',
            !isDragging && 'border-gray-300'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          ) : value ? (
            <img
              src={value}
              alt="Logo preview"
              className="h-full w-full rounded-lg object-contain"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-gray-400" />
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            {value ? 'Change logo' : 'Upload logo'}
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={handleInputChange}
              className="hidden"
              disabled={isUploading}
            />
          </label>

          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && hint && <p className="text-sm text-gray-500">{hint}</p>}
        </div>
      </div>
    </div>
  )
}
