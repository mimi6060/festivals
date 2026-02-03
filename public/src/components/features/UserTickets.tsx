'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Ticket, Calendar, MapPin, Clock, Share2 } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { UserTicket } from '@/lib/api'

interface UserTicketsProps {
  tickets: UserTicket[]
}

export function UserTickets({ tickets }: UserTicketsProps) {
  if (tickets.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Ticket className="h-16 w-16 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Aucun billet</h3>
        <p className="text-gray-400 mb-6">
          Vous n&apos;avez pas encore achete de billets pour ce festival.
        </p>
        <Button variant="primary">Acheter des billets</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {tickets.map((ticket, index) => (
        <motion.div
          key={ticket.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <TicketCard ticket={ticket} />
        </motion.div>
      ))}
    </div>
  )
}

function TicketCard({ ticket }: { ticket: UserTicket }) {
  const [showQR, setShowQR] = React.useState(false)

  const handleDownload = () => {
    // Create a canvas from the QR code and download
    const svg = document.getElementById(`qr-${ticket.id}`)
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL('image/png')

      const downloadLink = document.createElement('a')
      downloadLink.download = `ticket-${ticket.code}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Mon billet - ${ticket.ticketType?.name}`,
          text: `Billet pour le festival - Code: ${ticket.code}`,
        })
      } catch {
        // User cancelled share or share failed - silently ignore
        // This is expected behavior when user dismisses the share dialog
      }
    }
  }

  const getStatusBadge = () => {
    switch (ticket.status) {
      case 'VALID':
        return <Badge variant="success">Valide</Badge>
      case 'USED':
        return <Badge variant="info">Utilise</Badge>
      case 'EXPIRED':
        return <Badge variant="warning">Expire</Badge>
      case 'CANCELLED':
        return <Badge variant="danger">Annule</Badge>
      case 'TRANSFERRED':
        return <Badge variant="default">Transfere</Badge>
      default:
        return null
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-festival-500 to-festival-600 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white">
              {ticket.ticketType?.name || 'Billet'}
            </h3>
            <p className="text-festival-100 mt-1">
              {ticket.festival?.name || 'Festival'}
            </p>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Ticket details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-festival-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Date</p>
              <p className="text-white font-medium">
                {ticket.festival
                  ? formatDate(ticket.festival.startDate)
                  : 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-festival-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Lieu</p>
              <p className="text-white font-medium">
                {ticket.festival?.location || 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
              <Ticket className="h-5 w-5 text-festival-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Code</p>
              <p className="text-white font-medium font-mono">{ticket.code}</p>
            </div>
          </div>
        </div>

        {/* Holder info */}
        <div className="p-4 rounded-lg bg-white/5">
          <p className="text-sm text-gray-400 mb-1">Titulaire</p>
          <p className="text-white font-medium">{ticket.holderName}</p>
          <p className="text-gray-400 text-sm">{ticket.holderEmail}</p>
        </div>

        {/* Check-in info */}
        {ticket.checkedInAt && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Clock className="h-4 w-4" />
            Entre le {formatDateTime(ticket.checkedInAt)}
          </div>
        )}

        {/* QR Code toggle */}
        <div className="border-t border-white/10 pt-4">
          <button
            onClick={() => setShowQR(!showQR)}
            className="w-full text-center text-festival-400 hover:text-festival-300 transition-colors"
          >
            {showQR ? 'Masquer le QR Code' : 'Afficher le QR Code'}
          </button>

          {showQR && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex flex-col items-center"
            >
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  id={`qr-${ticket.id}`}
                  value={ticket.qrCodeData || ticket.code}
                  size={200}
                  level="H"
                  includeMargin
                />
              </div>
              <p className="text-sm text-gray-400 mt-4 text-center">
                Presentez ce QR Code a l&apos;entree du festival
              </p>
            </motion.div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleDownload}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Telecharger
          </Button>
          {typeof window !== 'undefined' && 'share' in navigator && (
            <Button
              variant="secondary"
              onClick={handleShare}
              leftIcon={<Share2 className="h-4 w-4" />}
            >
              Partager
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
