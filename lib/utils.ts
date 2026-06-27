import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function daysUp(dateStart: string, dateEnd?: string | null): number {
  const start = new Date(dateStart)
  const end = dateEnd ? new Date(dateEnd) : new Date()
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
