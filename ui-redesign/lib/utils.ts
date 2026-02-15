import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function getRelevanceColor(relevance: number): string {
  if (relevance >= 80) return 'bg-warning text-black'
  if (relevance >= 60) return 'bg-success/20 text-success'
  if (relevance >= 40) return 'bg-accent/20 text-accent'
  return 'bg-text-tertiary/20 text-text-tertiary'
}

export function getRelevanceLabel(relevance: number): string {
  if (relevance >= 80) return 'Hero'
  if (relevance >= 50) return 'Success'
  return 'Context'
}
