'use client'

import { motion } from 'framer-motion'
import { Camera, Star, CheckCircle2, ChevronRight, Folder } from 'lucide-react'
import { type FilterType, type Session } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SidebarProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  sessions: Session[]
  activeSession: string | null
  onSessionChange: (sessionId: string) => void
}

export function Sidebar({
  activeFilter,
  onFilterChange,
  sessions,
  activeSession,
  onSessionChange,
}: SidebarProps) {
  const quickAccess = [
    {
      id: 'all' as FilterType,
      label: 'All Screenshots',
      icon: Camera,
      count: sessions.reduce((sum, s) => sum + s.screenshots.length, 0),
    },
    {
      id: 'hero' as FilterType,
      label: 'Hero Moments',
      icon: Star,
      count: sessions.reduce(
        (sum, s) => sum + s.screenshots.filter((sc) => sc.relevance >= 80).length,
        0
      ),
    },
    {
      id: 'success' as FilterType,
      label: 'Success',
      icon: CheckCircle2,
      count: sessions.reduce(
        (sum, s) =>
          sum + s.screenshots.filter((sc) => sc.relevance >= 50 && sc.relevance < 80).length,
        0
      ),
    },
  ]

  return (
    <aside className="w-60 bg-bg-sidebar border-r border-border flex-shrink-0 overflow-y-auto">
      {/* Quick Access */}
      <div className="py-4">
        <h2 className="px-4 text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">
          Quick Access
        </h2>
        <nav className="space-y-0.5">
          {quickAccess.map((item) => {
            const Icon = item.icon
            const isActive = activeFilter === item.id

            return (
              <motion.button
                key={item.id}
                onClick={() => onFilterChange(item.id)}
                className={cn(
                  'w-full h-8 flex items-center gap-2 px-4 text-sm transition-colors relative',
                  isActive
                    ? 'bg-bg-hover text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                )}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left truncate">{item.label}</span>
                <span className="text-xs text-text-tertiary tabular-nums">{item.count}</span>
              </motion.button>
            )
          })}
        </nav>
      </div>

      {/* Sessions */}
      <div className="py-4 border-t border-border-subtle">
        <h2 className="px-4 text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">
          Sessions
        </h2>
        <nav className="space-y-0.5">
          {sessions.map((session) => {
            const isActive = activeSession === session.id

            return (
              <motion.button
                key={session.id}
                onClick={() => onSessionChange(session.id)}
                className={cn(
                  'w-full h-8 flex items-center gap-2 px-4 text-sm transition-colors relative group',
                  isActive
                    ? 'bg-bg-hover text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                )}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSession"
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <ChevronRight className="w-3 h-3 flex-shrink-0 text-text-tertiary" />
                <Folder className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left truncate">{session.name}</span>
                <span className="text-xs text-text-tertiary tabular-nums">
                  {session.screenshots.length}
                </span>
              </motion.button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
