'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Search, Clock, MapPin, Music } from 'lucide-react'
import { Input, Tabs, TabsList, TabsTrigger, TabsContent, Card, Badge } from '@/components/ui'
import { getDayName, getTimeFromISO } from '@/lib/utils'
import type { Performance, Stage } from '@/lib/api'

interface ScheduleViewProps {
  days: string[]
  stages: Stage[]
  performances: Performance[]
}

export function ScheduleView({ days, stages, performances }: ScheduleViewProps) {
  const [selectedDay, setSelectedDay] = React.useState(days[0] || '')
  const [selectedStage, setSelectedStage] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')

  // Filter performances
  const filteredPerformances = React.useMemo(() => {
    return performances.filter((perf) => {
      const matchesDay = perf.day === selectedDay
      const matchesStage = !selectedStage || perf.stageId === selectedStage
      const matchesSearch =
        !searchQuery ||
        perf.artist?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        perf.stage?.name.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesDay && matchesStage && matchesSearch
    })
  }, [performances, selectedDay, selectedStage, searchQuery])

  // Group performances by stage
  const performancesByStage = React.useMemo(() => {
    const grouped: Record<string, Performance[]> = {}

    filteredPerformances.forEach((perf) => {
      if (!grouped[perf.stageId]) {
        grouped[perf.stageId] = []
      }
      grouped[perf.stageId].push(perf)
    })

    // Sort performances within each stage by start time
    Object.values(grouped).forEach((perfs) => {
      perfs.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    })

    return grouped
  }, [filteredPerformances])

  return (
    <div className="space-y-8">
      {/* Day Tabs */}
      <Tabs value={selectedDay} onValueChange={setSelectedDay}>
        <TabsList className="flex-wrap">
          {days.map((day) => (
            <TabsTrigger key={day} value={day} className="capitalize">
              {getDayName(day)}
              <span className="ml-2 text-xs opacity-70">
                {new Date(day).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Rechercher un artiste..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => setSelectedStage(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              !selectedStage
                ? 'bg-festival-500 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            Toutes les scenes
          </button>
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setSelectedStage(stage.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selectedStage === stage.id
                  ? 'bg-festival-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
              style={{
                borderLeft: stage.settings.color
                  ? `3px solid ${stage.settings.color}`
                  : undefined,
              }}
            >
              {stage.name}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Grid */}
      {Object.keys(performancesByStage).length === 0 ? (
        <div className="text-center py-16">
          <Music className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Aucun resultat trouve</p>
        </div>
      ) : (
        <div className="space-y-8">
          {stages
            .filter((stage) => performancesByStage[stage.id])
            .map((stage) => (
              <div key={stage.id}>
                {/* Stage Header */}
                <div className="flex items-center gap-3 mb-4">
                  {stage.settings.color && (
                    <div
                      className="w-1 h-8 rounded-full"
                      style={{ backgroundColor: stage.settings.color }}
                    />
                  )}
                  <h3 className="text-xl font-bold text-white">{stage.name}</h3>
                  <Badge variant="default" size="sm">
                    {stage.settings.isIndoor ? 'Indoor' : 'Outdoor'}
                  </Badge>
                </div>

                {/* Performances */}
                <div className="grid gap-4">
                  {performancesByStage[stage.id].map((perf, index) => (
                    <motion.div
                      key={perf.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <PerformanceCard performance={perf} />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function PerformanceCard({ performance }: { performance: Performance }) {
  const startTime = getTimeFromISO(performance.startTime)
  const endTime = getTimeFromISO(performance.endTime)

  return (
    <Card hoverable className="p-4">
      <div className="flex items-center gap-4">
        {/* Artist Image */}
        <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0 bg-white/5">
          {performance.artist?.imageUrl ? (
            <Image
              src={performance.artist.imageUrl}
              alt={performance.artist.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Music className="h-6 w-6 text-gray-500" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h4 className="text-lg font-semibold text-white truncate">
            {performance.artist?.name || 'TBA'}
          </h4>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {startTime} - {endTime}
            </span>
            {performance.stage && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {performance.stage.name}
              </span>
            )}
          </div>
        </div>

        {/* Genre */}
        {performance.artist?.genre && (
          <Badge variant="default" size="sm" className="hidden sm:flex">
            {performance.artist.genre}
          </Badge>
        )}

        {/* Status */}
        {performance.status === 'LIVE' && (
          <Badge variant="danger" size="sm">
            En direct
          </Badge>
        )}
        {performance.status === 'CANCELLED' && (
          <Badge variant="warning" size="sm">
            Annule
          </Badge>
        )}
      </div>
    </Card>
  )
}
