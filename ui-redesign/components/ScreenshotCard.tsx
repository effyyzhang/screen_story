'use client'

import { motion } from 'framer-motion'
import { Eye, DownloadSimple } from '@phosphor-icons/react'
import { type Screenshot } from '@/lib/types'
import { formatTime, getRelevanceColor } from '@/lib/utils'
import { getThumbnailUrl } from '@/lib/api'
import { useState } from 'react'

interface ScreenshotCardProps {
  screenshot: Screenshot
  onClick: () => void
}

export function ScreenshotCard({ screenshot, onClick }: ScreenshotCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <motion.div
      className="group relative bg-bg-surface border border-border rounded-lg overflow-hidden cursor-pointer"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Image */}
      <div className="aspect-[16/10] bg-bg-app relative overflow-hidden">
        {/* Loading placeholder */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-bg-surface animate-pulse" />
        )}
        <img
          src={getThumbnailUrl(screenshot.file_path, 'thumb')}
          alt={screenshot.ai_summary || 'Screenshot'}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
        />

        {/* Hover Overlay */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Top metadata */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            <motion.div
              className="px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-xs text-white"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : -10 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            >
              {formatTime(screenshot.timestamp)}
            </motion.div>
            <motion.div
              className={`px-2 py-1 rounded text-xs font-medium backdrop-blur-sm ${getRelevanceColor(
                screenshot.relevance_display
              )}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : -10 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              {screenshot.relevance_display}%
            </motion.div>
          </div>

          {/* Bottom content */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 p-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 10 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            <p className="text-xs text-white mb-2 line-clamp-2">{screenshot.ai_summary || 'No description'}</p>

            {/* Quick actions */}
            <div className="flex gap-2">
              <button
                className="flex-1 h-7 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-xs text-white backdrop-blur-sm transition-colors flex items-center justify-center gap-1.5"
                onClick={(e) => {
                  e.stopPropagation()
                  // Handle view
                }}
              >
                <Eye size={12} />
                View
              </button>
              <button
                className="flex-1 h-7 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-xs text-white backdrop-blur-sm transition-colors flex items-center justify-center gap-1.5"
                onClick={(e) => {
                  e.stopPropagation()
                  // Handle export
                }}
              >
                <DownloadSimple size={12} />
                Export
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}
