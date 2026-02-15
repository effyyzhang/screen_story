'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  Star,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Folder,
  Calendar,
  Monitor,
} from 'lucide-react'
import { type FilterType, type FolderCounts } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SidebarProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  activeFolder: string | null
  onFolderChange: (folder: string) => void
  folderCounts: FolderCounts | null
}

export function Sidebar({
  activeFilter,
  onFilterChange,
  activeFolder,
  onFolderChange,
  folderCounts,
}: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState({
    apps: true,
    time: true,
    sessions: true,
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const quickAccess = [
    {
      id: 'all' as FilterType,
      label: 'All Screenshots',
      icon: Camera,
      count: folderCounts?.total || 0,
    },
    {
      id: 'hero' as FilterType,
      label: 'Hero Moments',
      icon: Star,
      count: folderCounts?.success.hero || 0,
    },
    {
      id: 'success' as FilterType,
      label: 'Success',
      icon: CheckCircle2,
      count: folderCounts?.success.success || 0,
    },
  ]

  const timeFilters = [
    { id: 'today', label: 'Today', count: folderCounts?.timePeriods.today || 0 },
    { id: 'yesterday', label: 'Yesterday', count: folderCounts?.timePeriods.yesterday || 0 },
    { id: 'week', label: 'Last 7 days', count: folderCounts?.timePeriods.week || 0 },
    { id: 'month', label: 'Last 30 days', count: folderCounts?.timePeriods.month || 0 },
  ]

  const appFolders = folderCounts?.apps || []
  const sessions = folderCounts?.sessions || []

  return (
    <aside className="w-full h-full bg-bg-sidebar border-r border-border overflow-y-auto">
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

      {/* By App */}
      <div className="py-4 border-t border-border-subtle">
        <button
          onClick={() => toggleSection('apps')}
          className="w-full px-4 flex items-center justify-between text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2 hover:text-text-secondary transition-colors"
        >
          <span>By App</span>
          {expandedSections.apps ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
        <AnimatePresence initial={false}>
          {expandedSections.apps && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-0.5 overflow-hidden"
            >
              {appFolders.map((app) => {
                const isActive = activeFolder === `app:${app.name}`
                return (
                  <button
                    key={app.name}
                    onClick={() => onFolderChange(`app:${app.name}`)}
                    className={cn(
                      'w-full h-8 flex items-center gap-2 px-4 text-sm transition-colors relative',
                      isActive
                        ? 'bg-bg-hover text-text-primary'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeFolderIndicator"
                        className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                    <Monitor className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{app.name}</span>
                    <span className="text-xs text-text-tertiary tabular-nums">{app.count}</span>
                  </button>
                )
              })}
            </motion.nav>
          )}
        </AnimatePresence>
      </div>

      {/* By Time */}
      <div className="py-4 border-t border-border-subtle">
        <button
          onClick={() => toggleSection('time')}
          className="w-full px-4 flex items-center justify-between text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2 hover:text-text-secondary transition-colors"
        >
          <span>By Time</span>
          {expandedSections.time ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
        <AnimatePresence initial={false}>
          {expandedSections.time && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-0.5 overflow-hidden"
            >
              {timeFilters.map((filter) => {
                const isActive = activeFolder === `time:${filter.id}`
                return (
                  <button
                    key={filter.id}
                    onClick={() => onFolderChange(`time:${filter.id}`)}
                    className={cn(
                      'w-full h-8 flex items-center gap-2 px-4 text-sm transition-colors relative',
                      isActive
                        ? 'bg-bg-hover text-text-primary'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeFolderIndicator"
                        className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{filter.label}</span>
                    <span className="text-xs text-text-tertiary tabular-nums">{filter.count}</span>
                  </button>
                )
              })}
            </motion.nav>
          )}
        </AnimatePresence>
      </div>

      {/* Sessions */}
      <div className="py-4 border-t border-border-subtle">
        <button
          onClick={() => toggleSection('sessions')}
          className="w-full px-4 flex items-center justify-between text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2 hover:text-text-secondary transition-colors"
        >
          <span>Sessions</span>
          {expandedSections.sessions ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
        <AnimatePresence initial={false}>
          {expandedSections.sessions && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-0.5 overflow-hidden"
            >
              {sessions.map((session) => {
                const isActive = activeFolder === `session:${session.name}`

                return (
                  <motion.button
                    key={session.id}
                    onClick={() => onFolderChange(`session:${session.name}`)}
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
                        layoutId="activeFolderIndicator"
                        className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                    <Folder className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{session.name}</span>
                    <span className="text-xs text-text-tertiary tabular-nums">
                      {session.count}
                    </span>
                  </motion.button>
                )
              })}
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}
