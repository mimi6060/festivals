'use client'

import { useState } from 'react'
import { Button, ButtonProps } from '@/components/ui/Button'
import { QrCode, Download, Check } from 'lucide-react'
import { accountApi } from '@/lib/api/account'

interface QRDownloadButtonProps extends Omit<ButtonProps, 'onClick'> {
  ticketId: string
  label?: string
}

export function QRDownloadButton({
  ticketId,
  label = 'Telecharger QR',
  variant = 'outline',
  size = 'sm',
  ...props
}: QRDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const downloadUrl = accountApi.downloadTicketQR(ticketId)

      // Create a temporary link to trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `ticket-${ticketId}-qr.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setDownloaded(true)
      setTimeout(() => setDownloaded(false), 2000)
    } catch (error) {
      console.error('Failed to download QR code:', error)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      leftIcon={downloaded ? <Check className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
      loading={downloading}
      onClick={handleDownload}
      {...props}
    >
      {downloaded ? 'Telecharge' : label}
    </Button>
  )
}

// Alternative download button for PDF tickets
interface PDFDownloadButtonProps extends Omit<ButtonProps, 'onClick'> {
  ticketId: string
  label?: string
}

export function PDFDownloadButton({
  ticketId,
  label = 'Telecharger PDF',
  variant = 'outline',
  size = 'sm',
  ...props
}: PDFDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const downloadUrl = accountApi.downloadTicketPDF(ticketId)

      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `ticket-${ticketId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setDownloaded(true)
      setTimeout(() => setDownloaded(false), 2000)
    } catch (error) {
      console.error('Failed to download PDF:', error)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      leftIcon={downloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      loading={downloading}
      onClick={handleDownload}
      {...props}
    >
      {downloaded ? 'Telecharge' : label}
    </Button>
  )
}
