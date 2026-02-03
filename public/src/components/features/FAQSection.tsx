'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui'
import type { FAQ } from '@/lib/api'

interface FAQSectionProps {
  faqs: FAQ[]
}

export function FAQSection({ faqs }: FAQSectionProps) {
  // Group FAQs by category
  const faqsByCategory = React.useMemo(() => {
    const grouped: Record<string, FAQ[]> = {}

    faqs.forEach((faq) => {
      const category = faq.category || 'General'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(faq)
    })

    // Sort FAQs within each category by order
    Object.values(grouped).forEach((categoryFaqs) => {
      categoryFaqs.sort((a, b) => a.order - b.order)
    })

    return grouped
  }, [faqs])

  const categories = Object.keys(faqsByCategory)

  if (faqs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Aucune FAQ disponible pour le moment.</p>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {categories.map((category, categoryIndex) => (
        <motion.div
          key={category}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: categoryIndex * 0.1 }}
        >
          <h3 className="text-xl font-semibold text-white mb-6">{category}</h3>
          <Accordion type="single" collapsible className="space-y-2">
            {faqsByCategory[category].map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="bg-white/5 rounded-xl px-6 border-none"
              >
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent>
                  <div
                    className="prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: faq.answer }}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      ))}
    </div>
  )
}
