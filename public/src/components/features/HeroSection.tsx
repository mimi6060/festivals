'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Calendar, MapPin, ArrowRight, Play } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

interface HeroSectionProps {
  festivalName?: string
  tagline?: string
  dates?: string
  location?: string
  videoUrl?: string
  imageUrl?: string
}

export function HeroSection({
  festivalName = 'Festival 2026',
  tagline = "L'experience musicale ultime",
  dates = '15 - 17 Juillet 2026',
  location = 'Parc des Expositions, Paris',
  videoUrl,
  imageUrl = '/images/hero-bg.jpg',
}: HeroSectionProps) {
  const [isVideoPlaying, setIsVideoPlaying] = React.useState(false)

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        {videoUrl && isVideoPlaying ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
        ) : (
          <div
            className="h-full w-full bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${imageUrl})`,
            }}
          />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-festival-950/50 to-transparent" />
      </div>

      {/* Animated particles/stars effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white/30"
            initial={{
              x: Math.random() * 100 + '%',
              y: Math.random() * 100 + '%',
              scale: Math.random() * 0.5 + 0.5,
            }}
            animate={{
              y: [null, '-20%'],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-32 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="neon" size="lg" className="mb-6">
              Billetterie Ouverte
            </Badge>
          </motion.div>

          {/* Title */}
          <motion.h1
            className="text-5xl font-bold tracking-tight text-white sm:text-7xl lg:text-8xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="block">{festivalName}</span>
            <span className="block mt-2 bg-gradient-to-r from-festival-400 via-festival-300 to-neon-pink bg-clip-text text-transparent">
              {tagline}
            </span>
          </motion.h1>

          {/* Details */}
          <motion.div
            className="mt-8 flex flex-wrap gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center gap-2 text-gray-300">
              <Calendar className="h-5 w-5 text-festival-400" />
              <span className="text-lg">{dates}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <MapPin className="h-5 w-5 text-festival-400" />
              <span className="text-lg">{location}</span>
            </div>
          </motion.div>

          {/* CTAs */}
          <motion.div
            className="mt-10 flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link href="/tickets">
              <Button variant="primary" size="xl" rightIcon={<ArrowRight className="h-5 w-5" />}>
                Acheter des billets
              </Button>
            </Link>
            <Link href="/programme">
              <Button variant="secondary" size="xl">
                Voir le programme
              </Button>
            </Link>
            {videoUrl && !isVideoPlaying && (
              <Button
                variant="ghost"
                size="xl"
                leftIcon={<Play className="h-5 w-5" />}
                onClick={() => setIsVideoPlaying(true)}
              >
                Voir le teaser
              </Button>
            )}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <motion.div
          className="flex flex-col items-center gap-2 text-gray-400"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <div className="h-6 w-px bg-gradient-to-b from-white/50 to-transparent" />
        </motion.div>
      </motion.div>
    </section>
  )
}
