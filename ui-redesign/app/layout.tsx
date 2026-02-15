import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Screen Story',
  description: 'AI-powered screen recording and video creation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
