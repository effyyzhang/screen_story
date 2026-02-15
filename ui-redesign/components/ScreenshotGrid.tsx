'use client'

import { motion } from 'framer-motion'
import { type Screenshot } from '@/lib/types'
import { ScreenshotCard } from './ScreenshotCard'

interface ScreenshotGridProps {
  screenshots: Screenshot[]
  sessionName: string
  sessionMeta: string
  onScreenshotClick: (screenshot: Screenshot) => void
}

export function ScreenshotGrid({
  screenshots,
  sessionName,
  sessionMeta,
  onScreenshotClick,
}: ScreenshotGridProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">
        {/* Session header */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h2 className="text-base font-medium text-text-primary mb-1">
            Session: {sessionName}
          </h2>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>{sessionMeta}</span>
          </div>
        </motion.div>

        {/* Grid */}
        {screenshots.length === 0 ? (
          <div className="flex items-center justify-center h-96 text-text-tertiary">
            <div className="text-center">
              <p className="text-sm">No screenshots found</p>
              <p className="text-xs mt-1">Start a capture session to begin</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {screenshots.map((screenshot, index) => (
              <motion.div
                key={screenshot.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.03,
                  ease: [0.4, 0, 0.2, 1],
                }}
              >
                <ScreenshotCard
                  screenshot={screenshot}
                  onClick={() => onScreenshotClick(screenshot)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
