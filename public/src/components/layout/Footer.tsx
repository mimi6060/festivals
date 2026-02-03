'use client'

import Link from 'next/link'
import { Music2, Instagram, Facebook, Twitter, Youtube, Mail } from 'lucide-react'

const footerLinks = {
  festival: [
    { name: 'Programme', href: '/programme' },
    { name: 'Infos Pratiques', href: '/infos' },
    { name: 'Billetterie', href: '/tickets' },
    { name: 'FAQ', href: '/infos#faq' },
  ],
  legal: [
    { name: 'Mentions legales', href: '/mentions-legales' },
    { name: 'CGV', href: '/cgv' },
    { name: 'Politique de confidentialite', href: '/confidentialite' },
    { name: 'Cookies', href: '/cookies' },
  ],
  social: [
    { name: 'Instagram', href: 'https://instagram.com', icon: Instagram },
    { name: 'Facebook', href: 'https://facebook.com', icon: Facebook },
    { name: 'Twitter', href: 'https://twitter.com', icon: Twitter },
    { name: 'YouTube', href: 'https://youtube.com', icon: Youtube },
  ],
}

export function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-black">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-festival-950/20 to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-festival-500 to-festival-600 shadow-lg shadow-festival-500/25">
                <Music2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Festival</span>
            </Link>
            <p className="mt-4 text-sm text-gray-400 max-w-xs">
              L&apos;experience musicale ultime. Rejoignez-nous pour un week-end inoubliable de musique, de danse et de festivites.
            </p>
            {/* Social links */}
            <div className="mt-6 flex gap-3">
              {footerLinks.social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-gray-400 transition-all hover:bg-white/10 hover:text-white"
                >
                  <item.icon className="h-5 w-5" />
                  <span className="sr-only">{item.name}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Festival Links */}
          <div>
            <h3 className="text-sm font-semibold text-white">Festival</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.festival.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-sm font-semibold text-white">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-sm font-semibold text-white">Newsletter</h3>
            <p className="mt-4 text-sm text-gray-400">
              Inscrivez-vous pour recevoir les dernieres actualites et annonces d&apos;artistes.
            </p>
            <form className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  placeholder="Votre email"
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-festival-500 focus:outline-none focus:ring-1 focus:ring-festival-500"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-festival-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-festival-600 transition-colors"
              >
                OK
              </button>
            </form>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 border-t border-white/10 pt-8 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Festival. Tous droits reserves.</p>
        </div>
      </div>
    </footer>
  )
}
