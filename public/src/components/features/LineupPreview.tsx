'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, Music } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import type { Artist } from '@/lib/api'

interface LineupPreviewProps {
  artists: Artist[]
}

export function LineupPreview({ artists }: LineupPreviewProps) {
  // Show top 6 artists
  const featuredArtists = artists.slice(0, 6)

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-festival-950/10 to-black" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span
            className="inline-block text-festival-400 text-sm font-semibold tracking-wider uppercase mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Line-up 2026
          </motion.span>
          <motion.h2
            className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Les artistes
          </motion.h2>
          <motion.p
            className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Decouvrez les artistes qui enflammeront la scene cette annee
          </motion.p>
        </div>

        {/* Artists Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
          {featuredArtists.map((artist, index) => (
            <motion.div
              key={artist.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                hoverable
                className="group relative overflow-hidden aspect-[3/4]"
              >
                {/* Artist Image */}
                <div className="absolute inset-0">
                  {artist.imageUrl ? (
                    <Image
                      src={artist.imageUrl}
                      alt={artist.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-festival-500/20 to-festival-900/20 flex items-center justify-center">
                      <Music className="h-16 w-16 text-festival-400/30" />
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                </div>

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-4 lg:p-6">
                  <span className="text-sm text-festival-400 font-medium mb-1">
                    {artist.genre || 'Music'}
                  </span>
                  <h3 className="text-xl lg:text-2xl font-bold text-white group-hover:text-festival-300 transition-colors">
                    {artist.name}
                  </h3>
                </div>

                {/* Hover border effect */}
                <div className="absolute inset-0 border-2 border-festival-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              </Card>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Link href="/programme">
            <Button
              variant="outline"
              size="lg"
              rightIcon={<ArrowRight className="h-5 w-5" />}
            >
              Voir tout le programme
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
