import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount / 100) // Convert cents to euros
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    ...options,
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeStyle: 'short',
  }).format(new Date(date))
}

export function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const startFormatted = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
  }).format(start)

  const endFormatted = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(end)

  return `${startFormatted} - ${endFormatted}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export function getDaysArray(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split('T')[0])
  }

  return days
}

export function getDayName(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(new Date(date))
}

export function getTimeFromISO(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
