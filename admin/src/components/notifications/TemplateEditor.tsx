'use client'

import * as React from 'react'
import { Code, FileText, Eye, Copy, Check, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TemplateVariable } from '@/lib/api/notifications'

export type EditorMode = 'html' | 'text' | 'preview'

export interface TemplateEditorProps {
  value: string
  onChange: (value: string) => void
  variables?: TemplateVariable[]
  mode?: EditorMode
  placeholder?: string
  className?: string
  minHeight?: string
  showVariables?: boolean
}

export function TemplateEditor({
  value,
  onChange,
  variables = [],
  mode = 'html',
  placeholder = 'Enter template content...',
  className,
  minHeight = '300px',
  showVariables = true,
}: TemplateEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [copied, setCopied] = React.useState<string | null>(null)
  const [showVariablePanel, setShowVariablePanel] = React.useState(false)

  const insertVariable = (variableName: string) => {
    const variableText = `{{${variableName}}}`
    const textarea = textareaRef.current

    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.slice(0, start) + variableText + value.slice(end)
      onChange(newValue)

      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus()
        const newCursorPos = start + variableText.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    } else {
      onChange(value + variableText)
    }
  }

  const copyVariable = (variableName: string) => {
    navigator.clipboard.writeText(`{{${variableName}}}`)
    setCopied(variableName)
    setTimeout(() => setCopied(null), 2000)
  }

  const generatePreview = (): string => {
    let preview = value
    variables.forEach((v) => {
      const regex = new RegExp(`{{${v.name}}}`, 'g')
      preview = preview.replace(regex, `<span class="bg-yellow-100 text-yellow-800 px-1 rounded">${v.example}</span>`)
    })
    return preview
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Editor */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm',
            'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
            'placeholder:text-gray-400 resize-none'
          )}
          style={{ minHeight }}
        />

        {/* Character count */}
        <div className="absolute bottom-3 right-3 text-xs text-gray-400">
          {value.length} characters
        </div>
      </div>

      {/* Variable Panel */}
      {showVariables && variables.length > 0 && (
        <div className="rounded-lg border">
          <button
            type="button"
            onClick={() => setShowVariablePanel(!showVariablePanel)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                Available Variables ({variables.length})
              </span>
            </div>
            {showVariablePanel ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {showVariablePanel && (
            <div className="border-t bg-gray-50 p-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {variables.map((variable) => (
                  <div
                    key={variable.name}
                    className="group flex items-center justify-between rounded-lg border bg-white p-3 hover:border-blue-200"
                  >
                    <div className="min-w-0 flex-1">
                      <code className="text-sm font-medium text-blue-600 truncate block">
                        {`{{${variable.name}}}`}
                      </code>
                      <p className="mt-0.5 text-xs text-gray-500 truncate" title={variable.description}>
                        {variable.description}
                      </p>
                    </div>
                    <div className="ml-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => insertVariable(variable.name)}
                        className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                        title="Insert variable"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => copyVariable(variable.name)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Copy to clipboard"
                      >
                        {copied === variable.name ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Full Template Editor with tabs for HTML, Text, and Preview
export interface FullTemplateEditorProps {
  htmlContent: string
  textContent: string
  onHtmlChange: (value: string) => void
  onTextChange: (value: string) => void
  variables?: TemplateVariable[]
  className?: string
}

export function FullTemplateEditor({
  htmlContent,
  textContent,
  onHtmlChange,
  onTextChange,
  variables = [],
  className,
}: FullTemplateEditorProps) {
  const [activeTab, setActiveTab] = React.useState<EditorMode>('html')
  const [previewHtml, setPreviewHtml] = React.useState('')

  React.useEffect(() => {
    // Generate preview with sample data
    let preview = htmlContent
    variables.forEach((v) => {
      const regex = new RegExp(`{{${v.name}}}`, 'g')
      preview = preview.replace(regex, v.example)
    })
    setPreviewHtml(preview)
  }, [htmlContent, variables])

  const tabs = [
    { id: 'html' as EditorMode, label: 'HTML', icon: Code },
    { id: 'text' as EditorMode, label: 'Plain Text', icon: FileText },
    { id: 'preview' as EditorMode, label: 'Preview', icon: Eye },
  ]

  return (
    <div className={cn('rounded-lg border bg-white', className)}>
      {/* Tabs */}
      <div className="flex border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'html' && (
          <TemplateEditor
            value={htmlContent}
            onChange={onHtmlChange}
            variables={variables}
            mode="html"
            placeholder="Enter HTML template content..."
            minHeight="400px"
          />
        )}

        {activeTab === 'text' && (
          <TemplateEditor
            value={textContent}
            onChange={onTextChange}
            variables={variables}
            mode="text"
            placeholder="Enter plain text template content..."
            minHeight="400px"
          />
        )}

        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Preview with sample data. Variables are highlighted.
              </p>
            </div>
            <div className="rounded-lg border bg-white overflow-hidden">
              <iframe
                srcDoc={previewHtml}
                className="h-[500px] w-full"
                title="Email preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
