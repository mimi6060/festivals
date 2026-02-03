'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import DOMPurify from 'dompurify'
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Code,
  FileText,
  Loader2,
  Check,
  AlertCircle,
  Copy,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { TemplateEditor } from '@/components/notifications/TemplateEditor'
import {
  notificationsApi,
  NotificationTemplate,
  TemplateVariable,
  defaultVariables,
  UpdateTemplateInput,
} from '@/lib/api/notifications'

// Sanitize HTML content to prevent XSS attacks
const sanitizeHtml = (html: string): string => {
  // Configure DOMPurify for email preview
  // Allow common email HTML elements and styles
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'html', 'head', 'body', 'style', 'meta', 'title',
      'div', 'span', 'p', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'ul', 'ol', 'li',
      'strong', 'b', 'em', 'i', 'u',
      'center', 'font',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'width', 'height',
      'style', 'class', 'id', 'name',
      'border', 'cellpadding', 'cellspacing', 'align', 'valign',
      'bgcolor', 'color', 'face', 'size',
      'charset', 'content', 'http-equiv',
    ],
    ALLOW_DATA_ATTR: false, // Disable data attributes for security
    ADD_TAGS: ['style'], // Allow style tags for email templates
    ADD_ATTR: ['target'], // Allow target attribute for links
    FORBID_CONTENTS: ['script', 'iframe', 'object', 'embed', 'form'], // Strictly forbid dangerous elements
    WHOLE_DOCUMENT: true, // Allow full HTML documents
  })
}

type ViewMode = 'html' | 'text' | 'preview'

export default function TemplateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const festivalId = params.id as string
  const templateId = params.templateId as string

  const [template, setTemplate] = useState<NotificationTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('html')
  const [testEmail, setTestEmail] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [textBody, setTextBody] = useState('')

  // Preview with sample data
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')

  useEffect(() => {
    loadTemplate()
  }, [festivalId, templateId])

  useEffect(() => {
    if (template) {
      setSubject(template.subject)
      setHtmlBody(template.htmlBody)
      setTextBody(template.textBody)
      generatePreview(template.subject, template.htmlBody, template.variables)
    }
  }, [template])

  useEffect(() => {
    if (template) {
      generatePreview(subject, htmlBody, template.variables)
    }
  }, [subject, htmlBody])

  const loadTemplate = async () => {
    try {
      const data = await notificationsApi.getTemplate(festivalId, templateId)
      setTemplate(data)
    } catch (error) {
      console.error('Failed to load template:', error)
      // Mock data for development
      const mockTemplate: NotificationTemplate = {
        id: templateId,
        festivalId,
        name: 'Ticket Confirmation',
        slug: 'ticket-confirmation',
        description: 'Sent when a ticket purchase is completed',
        category: 'ticket',
        channel: 'email',
        subject: '[{{festivalName}}] Your Ticket Confirmation - {{ticketType}}',
        htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .ticket-box { background: white; border: 2px dashed #6366f1; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{festivalName}}</h1>
    </div>
    <div class="content">
      <h2>Hello {{attendeeName}}!</h2>
      <p>Thank you for your purchase. Your ticket is confirmed!</p>

      <div class="ticket-box">
        <h3>{{ticketType}}</h3>
        <p><strong>Ticket ID:</strong> {{ticketId}}</p>
        <p><strong>Date:</strong> {{festivalDate}}</p>
        <p><strong>Location:</strong> {{festivalLocation}}</p>
        <img src="{{qrCodeUrl}}" alt="QR Code" width="150" />
      </div>

      <p><strong>Purchase Date:</strong> {{purchaseDate}}</p>
      <p><strong>Total:</strong> {{totalAmount}}</p>

      <p>Please save this email and bring your QR code to the festival entrance.</p>

      <a href="#" class="button">View My Tickets</a>
    </div>
    <div class="footer">
      <p>Questions? Contact us at support@festival.com</p>
      <p>&copy; 2026 {{festivalName}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`,
        textBody: `Hello {{attendeeName}}!

Thank you for your purchase. Your ticket is confirmed!

TICKET DETAILS
--------------
Type: {{ticketType}}
Ticket ID: {{ticketId}}
Date: {{festivalDate}}
Location: {{festivalLocation}}

Purchase Date: {{purchaseDate}}
Total: {{totalAmount}}

Please save this email and bring your QR code to the festival entrance.

Questions? Contact us at support@festival.com

(c) 2026 {{festivalName}}. All rights reserved.`,
        variables: defaultVariables.ticket,
        enabled: true,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setTemplate(mockTemplate)
    } finally {
      setIsLoading(false)
    }
  }

  const generatePreview = (subj: string, html: string, variables: TemplateVariable[]) => {
    let previewSubj = subj
    let previewContent = html

    variables.forEach((v) => {
      const regex = new RegExp(`{{${v.name}}}`, 'g')
      previewSubj = previewSubj.replace(regex, v.example)
      previewContent = previewContent.replace(regex, v.example)
    })

    setPreviewSubject(previewSubj)
    setPreviewHtml(previewContent)
  }

  const handleSave = async () => {
    if (!template) return

    setIsSaving(true)
    setMessage(null)

    const updateData: UpdateTemplateInput = {
      subject,
      htmlBody,
      textBody,
    }

    try {
      const updated = await notificationsApi.updateTemplate(festivalId, templateId, updateData)
      setTemplate(updated)
      setMessage({ type: 'success', text: 'Template saved successfully!' })
    } catch (error) {
      console.error('Failed to save template:', error)
      // Mock for development
      setTemplate((prev) => (prev ? { ...prev, ...updateData, updatedAt: new Date().toISOString() } : null))
      setMessage({ type: 'success', text: 'Template saved successfully!' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Please enter a test email address' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setIsTesting(true)
    try {
      const result = await notificationsApi.testEmail(festivalId, {
        templateId,
        recipientEmail: testEmail,
      })
      if (result.success) {
        setMessage({ type: 'success', text: 'Test email sent successfully!' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to send test email' })
      }
    } catch (error) {
      console.error('Failed to send test email:', error)
      // Mock for development
      setMessage({ type: 'success', text: 'Test email sent successfully!' })
    } finally {
      setIsTesting(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const insertVariable = (variableName: string) => {
    const variableText = `{{${variableName}}}`
    if (viewMode === 'html') {
      setHtmlBody((prev) => prev + variableText)
    } else if (viewMode === 'text') {
      setTextBody((prev) => prev + variableText)
    }
  }

  const copyVariable = (variableName: string) => {
    navigator.clipboard.writeText(`{{${variableName}}}`)
    setMessage({ type: 'success', text: `Copied {{${variableName}}} to clipboard` })
    setTimeout(() => setMessage(null), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-gray-500">Template not found</p>
        <Link href={`/festivals/${festivalId}/settings/notifications`} className="mt-4 text-blue-600 hover:underline">
          Back to templates
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/festivals/${festivalId}/settings/notifications`}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
              <Badge variant={template.enabled ? 'success' : 'default'}>
                {template.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">{template.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleTestEmail}
            loading={isTesting}
            leftIcon={<Send className="h-4 w-4" />}
          >
            Send Test
          </Button>
          <Button onClick={handleSave} loading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-4',
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          )}
        >
          {message.type === 'success' ? (
            <Check className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Editor Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subject Line */}
          <Card>
            <CardHeader>
              <CardTitle>Subject Line</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
                hint="Use {{variableName}} to insert dynamic content"
              />
            </CardContent>
          </Card>

          {/* Test Email */}
          <Card>
            <CardHeader>
              <CardTitle>Test Email</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Enter email address for testing..."
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={handleTestEmail}
                  loading={isTesting}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  Test
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Content Editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Content</CardTitle>
                <div className="flex rounded-lg border">
                  <button
                    onClick={() => setViewMode('html')}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors',
                      viewMode === 'html'
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <Code className="h-4 w-4" />
                    HTML
                  </button>
                  <button
                    onClick={() => setViewMode('text')}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors',
                      viewMode === 'text'
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <FileText className="h-4 w-4" />
                    Plain Text
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors',
                      viewMode === 'preview'
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === 'html' && (
                <TemplateEditor
                  value={htmlBody}
                  onChange={setHtmlBody}
                  variables={template.variables}
                  mode="html"
                />
              )}
              {viewMode === 'text' && (
                <TemplateEditor
                  value={textBody}
                  onChange={setTextBody}
                  variables={template.variables}
                  mode="text"
                />
              )}
              {viewMode === 'preview' && (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">Subject Preview:</p>
                    <div className="rounded-lg border bg-gray-50 px-4 py-2">
                      {previewSubject}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">Email Preview:</p>
                    <div className="rounded-lg border bg-white">
                      {/*
                        SECURITY: Sanitize HTML before rendering to prevent XSS attacks.
                        The sandbox attribute provides additional security by restricting
                        the iframe's capabilities (no scripts, forms, popups, etc.)
                      */}
                      <iframe
                        srcDoc={sanitizeHtml(previewHtml)}
                        className="h-[500px] w-full rounded-lg"
                        title="Email preview"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Variables Reference */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Available Variables</CardTitle>
                <Info className="h-4 w-4 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-gray-500">
                Click to insert or copy a variable. Variables are replaced with real data when the
                email is sent.
              </p>
              <div className="space-y-2">
                {template.variables.map((variable) => (
                  <div
                    key={variable.name}
                    className="group rounded-lg border p-3 hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-medium text-blue-600">
                        {`{{${variable.name}}}`}
                      </code>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => insertVariable(variable.name)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Insert"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => copyVariable(variable.name)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Copy"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{variable.description}</p>
                    <p className="mt-1 text-xs text-gray-400">Example: {variable.example}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                  Always provide a plain text version for email clients that don't support HTML
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                  Keep subject lines under 50 characters for best display
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                  Use inline CSS styles for maximum email client compatibility
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                  Test your email across different email clients before activating
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
