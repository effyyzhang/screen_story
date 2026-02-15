'use client'

import { motion } from 'framer-motion'
import { Search, Settings, Circle } from 'lucide-react'
import { useState } from 'react'

interface HeaderProps {
  isRecording: boolean
  onStartCapture: () => void
  onStopCapture: () => void
}

export function Header({ isRecording, onStartCapture, onStopCapture }: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="h-14 bg-[#111111] border-b border-border flex items-center px-5 gap-6 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-lg">📹</span>
        <h1 className="text-base font-medium">Screen Story</h1>
      </div>

      {/* Search */}
      <motion.div
        className="relative flex-1 max-w-md"
        animate={{ width: searchFocused ? '500px' : '400px' }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
        <input
          type="search"
          placeholder="Search screenshots..."
          className="w-full h-8 bg-bg-app border border-border rounded-md pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none transition-colors"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </motion.div>

      <div className="flex-1" />

      {/* Status indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-surface rounded-md">
        <motion.div
          animate={{
            scale: isRecording ? [1, 1.2, 1] : 1,
            opacity: isRecording ? [1, 0.6, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: isRecording ? Infinity : 0,
            ease: 'easeInOut',
          }}
        >
          <Circle
            className={`w-2 h-2 ${
              isRecording ? 'fill-error text-error' : 'fill-text-tertiary text-text-tertiary'
            }`}
          />
        </motion.div>
        <span className="text-xs text-text-secondary">
          {isRecording ? 'Recording' : 'Idle'}
        </span>
      </div>

      {/* Actions */}
      <button
        className="w-8 h-8 flex items-center justify-center hover:bg-bg-hover rounded-md transition-colors"
        aria-label="Settings"
      >
        <Settings className="w-4 h-4 text-text-secondary" />
      </button>

      <button
        onClick={isRecording ? onStopCapture : onStartCapture}
        className="h-8 px-4 bg-accent hover:bg-accent-hover text-white rounded-md text-sm font-medium transition-colors"
      >
        {isRecording ? '⏹ Stop' : '▶︎ Start Capture'}
      </button>
    </header>
  )
}
