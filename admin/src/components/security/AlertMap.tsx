'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  MapPin,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Layers,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SecurityAlert,
  AlertSeverity,
  getAlertTypeLabel,
  getSeverityLabel,
} from '@/lib/api/security'
import { Button } from '@/components/ui/Button'

interface AlertMapProps {
  alerts: SecurityAlert[]
  center?: { lat: number; lng: number }
  zoom?: number
  onAlertClick?: (alert: SecurityAlert) => void
  onRefresh?: () => void
  isLoading?: boolean
  className?: string
}

// Placeholder map component - in production, integrate with Mapbox, Google Maps, or Leaflet
export function AlertMap({
  alerts,
  center = { lat: 50.8503, lng: 4.3517 }, // Default to Brussels
  zoom = 15,
  onAlertClick,
  onRefresh,
  isLoading = false,
  className,
}: AlertMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null)
  const [showLayers, setShowLayers] = useState(false)

  // Filter active alerts
  const activeAlerts = alerts.filter(
    (a) => ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(a.status)
  )

  // Get marker color based on severity
  const getMarkerColor = (severity: AlertSeverity): string => {
    const colors: Record<AlertSeverity, string> = {
      LOW: '#6B7280',
      MEDIUM: '#F59E0B',
      HIGH: '#F97316',
      CRITICAL: '#EF4444',
    }
    return colors[severity]
  }

  const handleAlertClick = (alert: SecurityAlert) => {
    setSelectedAlert(alert)
    onAlertClick?.(alert)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  return (
    <div
      ref={mapContainerRef}
      className={cn(
        'relative rounded-xl border border-gray-200 bg-gray-100 overflow-hidden',
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-[400px]',
        className
      )}
    >
      {/* Map placeholder - Replace with actual map implementation */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50">
        {/* Grid pattern to simulate map */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Alert markers */}
        {activeAlerts.map((alert, index) => {
          // Calculate position based on lat/lng relative to center
          // This is a simplified positioning for the placeholder
          const offsetX = ((alert.location.longitude - center.lng) * 5000) % 300
          const offsetY = ((alert.location.latitude - center.lat) * -5000) % 200

          return (
            <div
              key={alert.id}
              className={cn(
                'absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110',
                selectedAlert?.id === alert.id && 'scale-125 z-10'
              )}
              style={{
                left: `calc(50% + ${offsetX}px)`,
                top: `calc(50% + ${offsetY}px)`,
              }}
              onClick={() => handleAlertClick(alert)}
            >
              <div
                className={cn(
                  'relative flex items-center justify-center',
                  alert.severity === 'CRITICAL' && 'animate-pulse'
                )}
              >
                {/* Pulse ring for critical alerts */}
                {alert.severity === 'CRITICAL' && (
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                    style={{ backgroundColor: getMarkerColor(alert.severity) }}
                  />
                )}

                {/* Marker */}
                <div
                  className="relative w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                  style={{ backgroundColor: getMarkerColor(alert.severity) }}
                >
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>

                {/* Label */}
                <div className="absolute top-full mt-1 whitespace-nowrap">
                  <span
                    className="px-2 py-0.5 text-xs font-medium rounded-full text-white shadow"
                    style={{ backgroundColor: getMarkerColor(alert.severity) }}
                  >
                    {getAlertTypeLabel(alert.type)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Center marker */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg" />
        </div>
      </div>

      {/* Map controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button
          size="sm"
          variant="outline"
          className="bg-white shadow-md"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="bg-white shadow-md"
          onClick={() => setShowLayers(!showLayers)}
        >
          <Layers className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="bg-white shadow-md"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3">
        <div className="text-xs font-medium text-gray-700 mb-2">Severite</div>
        <div className="flex flex-col gap-1">
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as AlertSeverity[]).map((severity) => (
            <div key={severity} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getMarkerColor(severity) }}
              />
              <span className="text-xs text-gray-600">{getSeverityLabel(severity)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Alert count */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md px-3 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium">
            {activeAlerts.length} alerte{activeAlerts.length !== 1 ? 's' : ''} active{activeAlerts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Selected alert popup */}
      {selectedAlert && (
        <div className="absolute bottom-4 right-4 w-72 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <div
            className="px-3 py-2 text-white font-medium"
            style={{ backgroundColor: getMarkerColor(selectedAlert.severity) }}
          >
            {getAlertTypeLabel(selectedAlert.type)} - {getSeverityLabel(selectedAlert.severity)}
          </div>
          <div className="p-3">
            <h4 className="font-medium text-gray-900">{selectedAlert.title}</h4>
            {selectedAlert.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {selectedAlert.description}
              </p>
            )}
            {selectedAlert.location.zone && (
              <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                <MapPin className="h-3 w-3" />
                {selectedAlert.location.zone}
              </div>
            )}
            <button
              className="mt-3 text-sm text-primary hover:underline"
              onClick={() => onAlertClick?.(selectedAlert)}
            >
              Voir les details
            </button>
          </div>
          <button
            className="absolute top-2 right-2 text-white/80 hover:text-white"
            onClick={() => setSelectedAlert(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* No alerts message */}
      {activeAlerts.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <MapPin className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-gray-600 font-medium">Aucune alerte active</p>
            <p className="text-sm text-gray-400">La situation est calme</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default AlertMap
