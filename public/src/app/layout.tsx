import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout'
import { Header } from '@/components/layout'
import { Footer } from '@/components/layout'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'),
  title: {
    default: 'Festival 2026 - Billetterie Officielle',
    template: '%s | Festival 2026',
  },
  description: "L'experience musicale ultime. Achetez vos billets pour le Festival 2026.",
  keywords: ['festival', 'musique', 'concert', 'billetterie', '2026'],
  authors: [{ name: 'Festival' }],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://festival.example.com',
    title: 'Festival 2026 - Billetterie Officielle',
    description: "L'experience musicale ultime. Achetez vos billets pour le Festival 2026.",
    siteName: 'Festival 2026',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Festival 2026 - Billetterie Officielle',
    description: "L'experience musicale ultime. Achetez vos billets pour le Festival 2026.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className="dark">
      <body className={inter.className}>
        <Providers>
          <Header />
          <main className="min-h-screen pt-20">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
